import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (_req) => {
  try {
    const now = new Date();

    // Find unsent reminders that are due
    const { data: reminders } = await supabase
      .from("reminders")
      .select("*, elders(full_name, phone_number, is_active)")
      .eq("is_sent", false)
      .lte("remind_at", now.toISOString());

    if (!reminders?.length) {
      return new Response(JSON.stringify({ processed: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const results: string[] = [];

    for (const reminder of reminders) {
      const elder = (reminder as any).elders;

      // Skip inactive elders
      if (!elder?.is_active) {
        await supabase.from("reminders").update({ is_sent: true }).eq("id", reminder.id);
        console.log(`Skipping reminder for inactive elder ${elder?.full_name || reminder.elder_id}`);
        continue;
      }

      if (reminder.method === "sms" || reminder.method === "both") {
        await sendReminderSms(reminder.elder_id, elder.phone_number, elder.full_name, reminder.message);
      }

      if (reminder.method === "call" || reminder.method === "both") {
        await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/outbound-call`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              elder_id: reminder.elder_id,
              call_type: "reminder",
              reminder_message: reminder.message,
            }),
          }
        );
      }

      // Mark reminder as sent
      await supabase.from("reminders").update({ is_sent: true }).eq("id", reminder.id);
      results.push(reminder.message);
    }

    return new Response(
      JSON.stringify({ processed: results.length }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Check reminders error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

async function sendReminderSms(elderId: string, phone: string, name: string, message: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");

  if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
    console.error("Twilio connector not configured, logging SMS instead");
    await supabase.from("sms_log").insert({
      elder_id: elderId,
      to_number: phone,
      message: `AinaHoiva muistutus (${name}): ${message}`,
      type: "reminder",
    });
    return;
  }

  const smsBody = `AinaHoiva muistutus: ${message}`;

  try {
    // Get Twilio phone number from settings or use a default
    const twilioFrom = Deno.env.get("TWILIO_PHONE_NUMBER") || "+358000000000";

    const response = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: phone,
        From: twilioFrom,
        Body: smsBody,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error(`Twilio SMS error [${response.status}]:`, data);
    }
  } catch (err) {
    console.error("SMS send error:", err);
  }

  // Always log the SMS
  await supabase.from("sms_log").insert({
    elder_id: elderId,
    to_number: phone,
    message: smsBody,
    type: "reminder",
  });
}
