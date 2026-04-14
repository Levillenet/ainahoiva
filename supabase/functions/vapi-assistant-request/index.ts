import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const body = await req.json();
    const messageType = body?.message?.type;

    console.log(`[vapi-assistant-request] Received message type: ${messageType}`);

    // Only handle assistant-request messages
    if (messageType !== "assistant-request") {
      // For other server messages (status-update, end-of-call-report, etc.), just acknowledge
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const callerNumber = body?.message?.call?.customer?.number;
    const callDirection = body?.message?.call?.type; // "inboundPhoneCall" or "outboundPhoneCall"

    console.log(`[vapi-assistant-request] Call direction: ${callDirection}, caller: ${callerNumber}`);

    // For outbound calls, don't override — outbound-call already sets everything
    const assistantId = Deno.env.get("VAPI_ASSISTANT_ID") || "c19c2445-c22a-4c52-8831-3b882fc38d4b";

    if (callDirection === "outboundPhoneCall") {
      console.log("[vapi-assistant-request] Outbound call — no override needed");
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // === Inbound call — look up the caller ===
    if (!callerNumber) {
      console.log("[vapi-assistant-request] No caller number — generic greeting");
      return new Response(JSON.stringify({
        assistant: {
          firstMessage: "Hei! Täällä Aina AinaHoivasta. Miten voin auttaa?",
        },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Find elder by phone number
    const { data: elderMatch } = await supabase.rpc("find_elder_by_phone", { p_phone: callerNumber });
    const elderId = elderMatch?.[0]?.id;
    const elderName = elderMatch?.[0]?.full_name;

    if (!elderId) {
      console.log(`[vapi-assistant-request] Unknown caller: ${callerNumber}`);
      return new Response(JSON.stringify({
        assistant: {
          firstMessage: "Hei! Täällä Aina AinaHoivasta. Miten voin auttaa?",
        },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`[vapi-assistant-request] Recognized: ${elderName} (${elderId})`);

    // Fetch medications, memories, and last call in parallel
    const [medsResult, memoriesResult, lastCallResult] = await Promise.all([
      supabase
        .from("medications")
        .select("name, dosage, morning, noon, evening, has_dosette")
        .eq("elder_id", elderId),
      supabase
        .from("elder_memory")
        .select("memory_type, content, updated_at")
        .eq("elder_id", elderId)
        .order("updated_at", { ascending: false })
        .limit(20),
      supabase
        .from("call_reports")
        .select("ai_summary, called_at, mood_score")
        .eq("elder_id", elderId)
        .order("called_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const meds = medsResult.data || [];
    const memories = memoriesResult.data || [];
    const lastCall = lastCallResult.data;

    // Build medication variables
    const medsMorning = meds.filter((m: any) => m.morning).map((m: any) => `${m.name} ${m.dosage || ""}`.trim()).join(", ") || "Ei aamulääkkeitä";
    const medsNoon = meds.filter((m: any) => m.noon).map((m: any) => `${m.name} ${m.dosage || ""}`.trim()).join(", ") || "Ei päivälääkkeitä";
    const medsEvening = meds.filter((m: any) => m.evening).map((m: any) => `${m.name} ${m.dosage || ""}`.trim()).join(", ") || "Ei iltalääkkeitä";
    const hasDosette = meds.some((m: any) => m.has_dosette);

    // Build memories text
    const memoryText = memories.length
      ? memories.map((m: any) => `[${m.memory_type}] ${m.content}`).join("\n")
      : "Ei aiempia muistoja";

    // Build last call text
    const lastCallText = lastCall
      ? `Viimeisin puhelu: ${new Date(lastCall.called_at!).toLocaleDateString("fi-FI")}\nMieliala oli: ${lastCall.mood_score}/5\nYhteenveto: ${lastCall.ai_summary}`
      : "Ensimmäinen puhelu";

    // Extract first name for greeting
    const firstName = elderName.split(" ")[0];

    // Time-based greeting
    const hour = (new Date().getUTCHours() + 3) % 24;
    let greeting: string;
    if (hour >= 5 && hour < 11) greeting = "Hyvää huomenta";
    else if (hour >= 11 && hour < 17) greeting = "Hyvää päivää";
    else if (hour >= 17 && hour < 22) greeting = "Hyvää iltaa";
    else greeting = "Hei";

    const firstMessage = `${greeting} ${firstName}! Täällä Aina, kiva kun soititte! Miten Teillä menee?`;

    console.log(`[vapi-assistant-request] Returning personalized config for ${elderName}`);

    return new Response(JSON.stringify({
      assistant: {
        firstMessage,
        variableValues: {
          elder_name: elderName,
          medications_morning: medsMorning,
          medications_noon: medsNoon,
          medications_evening: medsEvening,
          call_type: "inbound",
          memories: memoryText,
          last_call: lastCallText,
          has_dosette: hasDosette ? "true" : "false",
        },
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[vapi-assistant-request] Error:", error);
    // On error, return generic greeting so the call still works
    return new Response(JSON.stringify({
      assistant: {
        firstMessage: "Hei! Täällä Aina AinaHoivasta. Miten voin auttaa?",
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});
