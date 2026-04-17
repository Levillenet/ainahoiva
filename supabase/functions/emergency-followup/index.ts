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
    const now = new Date().toISOString();

    // Find unresolved alerts where followup is due
    const { data: alerts } = await supabase
      .from("emergency_alerts")
      .select("*")
      .eq("resolved", false)
      .eq("followup_done", false)
      .lte("followup_call_at", now)
      .not("followup_call_at", "is", null);

    if (!alerts?.length) {
      return new Response(
        JSON.stringify({ checked: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[emergency-followup] Found ${alerts.length} alerts needing followup`);

    for (const alert of alerts) {
      const { data: settings } = await supabase
        .from("emergency_settings")
        .select("followup_max_attempts, followup_delay_minutes")
        .eq("elder_id", alert.elder_id)
        .single();

      const maxAttempts = settings?.followup_max_attempts ?? 3;
      const delayMinutes = settings?.followup_delay_minutes ?? 2;

      if (alert.followup_attempt >= maxAttempts) {
        // Max attempts reached — mark as done
        await supabase
          .from("emergency_alerts")
          .update({ followup_done: true })
          .eq("id", alert.id);
        console.log(`[emergency-followup] Max attempts reached for alert ${alert.id}`);
        continue;
      }

      // Trigger followup call to elder
      console.log(`[emergency-followup] Calling elder for alert ${alert.id}, attempt ${alert.followup_attempt + 1}`);
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/outbound-call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          elder_id: alert.elder_id,
          call_type: "emergency_followup",
          alert_id: alert.id,
        }),
      });

      // Schedule next followup
      const nextFollowup = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();

      await supabase
        .from("emergency_alerts")
        .update({
          followup_attempt: alert.followup_attempt + 1,
          followup_call_at: nextFollowup,
        })
        .eq("id", alert.id);
    }

    return new Response(
      JSON.stringify({ processed: alerts.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[emergency-followup] Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
