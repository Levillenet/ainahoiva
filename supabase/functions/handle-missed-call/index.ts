import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { elder_id } = await req.json();

    // Get retry settings
    const { data: settings } = await supabase
      .from("retry_settings")
      .select("*")
      .eq("id", "00000000-0000-0000-0000-000000000001")
      .single();

    const maxAttempts = settings?.max_attempts ?? 3;
    const retryInterval = settings?.retry_interval_minutes ?? 5;
    const alertAfter = settings?.alert_after_attempts ?? 3;
    const retryEnabled = settings?.retry_enabled ?? true;

    if (!retryEnabled) {
      await sendFamilyAlert(elder_id, 1, maxAttempts);
      return new Response(JSON.stringify({ retried: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check existing retry record
    const { data: existing } = await supabase
      .from("missed_call_retries")
      .select("*")
      .eq("elder_id", elder_id)
      .eq("is_resolved", false)
      .single();

    if (existing) {
      const newAttempt = existing.attempt_number + 1;

      if (newAttempt >= alertAfter && !existing.alert_sent) {
        await sendFamilyAlert(elder_id, newAttempt, maxAttempts);
        await supabase
          .from("missed_call_retries")
          .update({ attempt_number: newAttempt, alert_sent: true, is_resolved: true })
          .eq("id", existing.id);
      } else {
        const nextRetry = new Date(Date.now() + retryInterval * 60 * 1000).toISOString();
        await supabase
          .from("missed_call_retries")
          .update({ attempt_number: newAttempt, next_retry_at: nextRetry })
          .eq("id", existing.id);
      }
    } else {
      const nextRetry = new Date(Date.now() + retryInterval * 60 * 1000).toISOString();
      await supabase.from("missed_call_retries").insert({
        elder_id,
        attempt_number: 1,
        next_retry_at: nextRetry,
        max_attempts: maxAttempts,
        retry_interval_minutes: retryInterval,
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Handle missed call error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function sendFamilyAlert(elderId: string, attempts: number, _maxAttempts: number) {
  const { data: elder } = await supabase
    .from("elders")
    .select("full_name, phone_number")
    .eq("id", elderId)
    .single();

  const { data: family } = await supabase
    .from("family_members")
    .select("phone_number, full_name")
    .eq("elder_id", elderId)
    .eq("receives_alerts", true);

  if (!family?.length) return;

  const message =
    `🚨 AinaHoiva HÄLYTYS\n` +
    `${elder?.full_name} ei vastannut puheluun ${attempts} yrityksen jälkeen.\n` +
    `Viimeinen yritys: ${new Date().toLocaleTimeString("fi-FI")}\n` +
    `Tarkistakaa vointi välittömästi!`;

  for (const member of family) {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        elder_id: elderId,
        to_number: member.phone_number,
        message,
        type: "missed_call_alert",
      }),
    });
  }
}
