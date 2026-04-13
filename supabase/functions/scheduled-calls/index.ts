import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (_req) => {
  try {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

    const { data: elders } = await supabase
      .from("elders")
      .select("id, full_name, phone_number")
      .eq("is_active", true)
      .or(`call_time_morning.eq.${currentTime},call_time_evening.eq.${currentTime}`);

    if (!elders?.length) {
      return new Response(JSON.stringify({ called: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().split("T")[0];
    const results: string[] = [];

    for (const elder of elders) {
      const { data: existingCall } = await supabase
        .from("call_reports")
        .select("id")
        .eq("elder_id", elder.id)
        .gte("called_at", `${today}T${currentTime}:00Z`)
        .maybeSingle();

      if (!existingCall) {
        await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/outbound-call`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({ elder_id: elder.id }),
          }
        );
        results.push(elder.full_name);
      }
    }

    return new Response(
      JSON.stringify({ called: results.length, elders: results }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Scheduled calls error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
