import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (_req) => {
  try {
    const now = new Date();

    // Finnish time UTC+3 (simplified; DST would be UTC+2 in winter)
    const finnishOffset = 3 * 60;
    const finnishTime = new Date(now.getTime() + finnishOffset * 60000);
    const currentTime = `${finnishTime.getHours().toString().padStart(2, "0")}:${finnishTime.getMinutes().toString().padStart(2, "0")}`;

    console.log(`Checking calls for Finnish time: ${currentTime}`);

    const { data: elders } = await supabase
      .from("elders")
      .select("id, full_name, phone_number, call_time_morning, call_time_evening")
      .eq("is_active", true);

    if (!elders?.length) {
      return new Response(JSON.stringify({ called: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const results: string[] = [];

    for (const elder of elders) {
      const morningTime = elder.call_time_morning?.slice(0, 5);
      const eveningTime = elder.call_time_evening?.slice(0, 5);

      const shouldCall = morningTime === currentTime || eveningTime === currentTime;
      if (!shouldCall) continue;

      const callType = morningTime === currentTime ? "morning" : "evening";

      // Check if already called in last 30 minutes to avoid duplicates
      const thirtyMinAgo = new Date(now.getTime() - 30 * 60000).toISOString();
      const { data: recentCall } = await supabase
        .from("call_reports")
        .select("id")
        .eq("elder_id", elder.id)
        .gte("called_at", thirtyMinAgo)
        .maybeSingle();

      if (recentCall) {
        console.log(`Already called ${elder.full_name} recently, skipping`);
        continue;
      }

      const response = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/outbound-call`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ elder_id: elder.id, call_type: callType }),
        }
      );

      if (response.ok) {
        results.push(elder.full_name);
        console.log(`Called ${elder.full_name} for ${callType} call`);
      } else {
        console.error(`Failed to call ${elder.full_name}:`, await response.text());
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
