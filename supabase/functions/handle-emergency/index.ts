import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { elder_id, alert_type, alert_reason } = await req.json();

    if (!elder_id) {
      return new Response(JSON.stringify({ error: "elder_id vaaditaan" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[handle-emergency] Processing emergency for elder ${elder_id}: ${alert_type} - ${alert_reason}`);

    // Get elder info
    const { data: elder } = await supabase
      .from("elders")
      .select("full_name, phone_number")
      .eq("id", elder_id)
      .single();

    if (!elder) {
      return new Response(JSON.stringify({ error: "Vanhusta ei löytynyt" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get emergency settings for this elder
    const { data: settings } = await supabase
      .from("emergency_settings")
      .select("*")
      .eq("elder_id", elder_id)
      .single();

    // Fall back to family members if no custom settings
    const { data: family } = await supabase
      .from("family_members")
      .select("phone_number, full_name, relationship")
      .eq("elder_id", elder_id)
      .eq("receives_alerts", true)
      .order("created_at", { ascending: true });

    const alertPhone = settings?.alert_primary_phone ?? family?.[0]?.phone_number;
    const alertPhone2 = settings?.alert_secondary_phone ?? family?.[1]?.phone_number;

    const followupDelay = settings?.followup_delay_minutes ?? 2;
    const followupEnabled = settings?.followup_call_enabled ?? true;
    const followupAt = followupEnabled
      ? new Date(Date.now() + followupDelay * 60 * 1000).toISOString()
      : null;

    // Save emergency alert
    const { data: alert } = await supabase
      .from("emergency_alerts")
      .insert({
        elder_id,
        alert_type,
        alert_reason,
        followup_call_at: followupAt,
        omainen_notified: false,
      })
      .select()
      .single();

    console.log(`[handle-emergency] Alert saved: ${alert?.id}`);

    const alertMethod = settings?.alert_method ?? "both";

    // Send SMS alert
    if (alertMethod === "sms" || alertMethod === "both") {
      const message =
        `🚨 HÄTÄTILANNE — AinaHoiva\n` +
        `${elder.full_name} tarvitsee apua nyt!\n` +
        `Syy: ${alert_reason}\n` +
        `Aika: ${new Date().toLocaleTimeString("fi-FI")}\n` +
        `Soittakaa välittömästi: ${elder.phone_number}`;

      const smsTargets = [alertPhone, alertPhone2].filter(Boolean);
      for (const phone of smsTargets) {
        console.log(`[handle-emergency] Sending SMS to ${phone}`);
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-sms`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            elder_id,
            to_number: phone,
            message,
            type: "emergency_alert",
          }),
        });
      }
    }

    // Trigger outbound call to family if method is call or both
    if (alertMethod === "call" || alertMethod === "both") {
      if (alertPhone) {
        console.log(`[handle-emergency] Calling family at ${alertPhone}`);
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/outbound-call`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            phone_number: alertPhone,
            call_type: "emergency_family",
            elder_name: elder.full_name,
            alert_reason,
            elder_phone: elder.phone_number,
          }),
        });
      }
    }

    // Update alert as notified
    if (alert?.id) {
      await supabase
        .from("emergency_alerts")
        .update({ omainen_notified: true })
        .eq("id", alert.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        followup_at: followupAt,
        alert_id: alert?.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[handle-emergency] Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
