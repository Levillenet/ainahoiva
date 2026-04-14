import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const ASSISTANT_ID = Deno.env.get("VAPI_ASSISTANT_ID") || "c19c2445-c22a-4c52-8831-3b882fc38d4b";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEFAULT_FIRST_MESSAGE = "Hei! Täällä Aina AinaHoivasta. Miten voin auttaa?";

// Static assistant config — no Vapi API call needed at runtime
const STATIC_ASSISTANT_CONFIG = {
  name: "Puhelullle",
  voice: {
    provider: "azure",
    voiceId: "fi-FI-HarriNeural",
    speed: 1.05,
  },
  transcriber: {
    provider: "azure",
    language: "fi-FI",
    fallbackPlan: { autoFallback: { enabled: true } },
  },
  model: {
    provider: "openai",
    model: "gpt-4o-mini",
    temperature: 0.8,
    maxTokens: 250,
    toolIds: [
      "a747e9b5-d8d4-43b0-8393-d6778f72e9d7",
      "a63a6b70-287e-4be0-8f29-8d03c06623c4",
      "7be51015-e0e9-4483-bd9d-f59a8346ef21",
      "7fc7df52-5506-4031-8e88-0279f426e2ee",
      "229c8a4b-0459-42c5-aea7-ab6a8d988cc8",
    ],
  },
  server: {
    url: ``,  // Will be set dynamically
    timeoutSeconds: 20,
  },
  backgroundSound: "office",
  analysisPlan: {
    summaryPlan: { enabled: false },
    successEvaluationPlan: { enabled: false },
  },
};

async function forwardToWebhook(body: unknown) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/vapi-webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();

  return new Response(text || JSON.stringify({ ok: response.ok }), {
    status: response.status,
    headers: {
      ...corsHeaders,
      "Content-Type": response.headers.get("Content-Type") || "application/json",
    },
  });
}

function getGreetingPrefix() {
  const hour = (new Date().getUTCHours() + 3) % 24;

  if (hour >= 5 && hour < 11) return "Hyvää huomenta";
  if (hour >= 11 && hour < 17) return "Hyvää päivää";
  if (hour >= 17 && hour < 22) return "Hyvää iltaa";

  return "Hei";
}

function buildOpeningMessage(elderName?: string, direction: "inbound" | "outbound" = "inbound") {
  const greeting = getGreetingPrefix();
  const firstName = elderName?.split(" ")[0]?.trim();

  if (direction === "outbound") {
    return firstName
      ? `${greeting} ${firstName}! Täällä Aina AinaHoivasta. Mitä Teille kuuluu tänään?`
      : `${greeting}! Täällä Aina AinaHoivasta. Mitä Teille kuuluu tänään?`;
  }

  return firstName
    ? `${greeting} ${firstName}! Täällä Aina, kiva kun soititte! Miten Teillä menee?`
    : DEFAULT_FIRST_MESSAGE;
}

function buildAssistantResponse(firstMessage: string, context: string) {
  const safeFirstMessage = firstMessage.trim() || DEFAULT_FIRST_MESSAGE;

  return {
    assistant: {
      ...STATIC_ASSISTANT_CONFIG,
      server: {
        ...STATIC_ASSISTANT_CONFIG.server,
        url: `${SUPABASE_URL}/functions/v1/vapi-webhook`,
      },
      firstMessage: safeFirstMessage,
      firstMessageMode: "assistant-speaks-first",
      endCallMessage: "Heippa hei, pidetään yhteyttä!",
      voicemailMessage: "Hei, täällä Aina AinaHoivasta. Soitan myöhemmin uudelleen. Hyvää päivää!",
      model: {
        ...STATIC_ASSISTANT_CONFIG.model,
        messages: [
          {
            role: "system",
            content: context,
          },
        ],
      },
    },
  };
}

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const messageType = body?.message?.type;

    console.log(`[vapi-assistant-request] Received message type: ${messageType}`);

    if (messageType !== "assistant-request") {
      return await forwardToWebhook(body);
    }

    const callDirection = body?.message?.call?.type;
    const callerNumber = body?.message?.call?.customer?.number;
    const isOutboundCall = callDirection === "outboundPhoneCall";
    const callLabel = isOutboundCall ? "lähtevä" : "sisääntuleva";

    console.log(`[vapi-assistant-request] Call direction: ${callDirection}, caller: ${callerNumber}`);

    if (!callerNumber) {
      console.log("[vapi-assistant-request] No caller number — using generic speaking assistant");
      return jsonResponse(
        buildAssistantResponse(
          buildOpeningMessage(undefined, isOutboundCall ? "outbound" : "inbound"),
          `${callLabel} puhelu. Tervehdi ystävällisesti suomeksi ja auta soittajaa.`,
        ),
      );
    }

    const { data: elderMatch } = await supabase.rpc("find_elder_by_phone", { p_phone: callerNumber });
    const elderId = elderMatch?.[0]?.id;
    const elderName = elderMatch?.[0]?.full_name;

    if (!elderId || !elderName) {
      console.log(`[vapi-assistant-request] Unknown caller: ${callerNumber}`);
      return jsonResponse(
        buildAssistantResponse(
          buildOpeningMessage(undefined, isOutboundCall ? "outbound" : "inbound"),
          `${callLabel} puhelu numerosta ${callerNumber}. Soittajaa ei tunnistettu. Tervehdi ystävällisesti suomeksi ja kysy miten voit auttaa.`,
        ),
      );
    }

    console.log(`[vapi-assistant-request] Recognized: ${elderName} (${elderId})`);

    // Fetch elder data in parallel — no Vapi API call needed
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

    const medsMorning = meds
      .filter((m: any) => m.morning)
      .map((m: any) => `${m.name} ${m.dosage || ""}`.trim())
      .join(", ") || "Ei aamulääkkeitä";
    const medsNoon = meds
      .filter((m: any) => m.noon)
      .map((m: any) => `${m.name} ${m.dosage || ""}`.trim())
      .join(", ") || "Ei päivälääkkeitä";
    const medsEvening = meds
      .filter((m: any) => m.evening)
      .map((m: any) => `${m.name} ${m.dosage || ""}`.trim())
      .join(", ") || "Ei iltalääkkeitä";
    const hasDosette = meds.some((m: any) => m.has_dosette);

    const memoryText = memories.length
      ? memories.map((m: any) => `[${m.memory_type}] ${m.content}`).join("\n")
      : "Ei aiempia muistoja";

    const lastCallText = lastCall
      ? `Viimeisin puhelu: ${new Date(lastCall.called_at!).toLocaleDateString("fi-FI")}\nMieliala oli: ${lastCall.mood_score}/5\nYhteenveto: ${lastCall.ai_summary}`
      : "Ensimmäinen puhelu";

    const firstMessage = buildOpeningMessage(elderName, isOutboundCall ? "outbound" : "inbound");
    const context = [
      `${isOutboundCall ? "Puhelun vastaanottaja" : "Soittaja"} on ${elderName}.`,
      `Kyseessä on ${callLabel} puhelu.`,
      `Aamulääkkeet: ${medsMorning}.`,
      `Päivälääkkeet: ${medsNoon}.`,
      `Iltalääkkeet: ${medsEvening}.`,
      `Dosetti käytössä: ${hasDosette ? "kyllä" : "ei"}.`,
      `Viimeisin puhelu: ${lastCallText}.`,
      `Muistot: ${memoryText}.`,
      `Puhu aina suomeksi, lämpimästi ja lyhyesti.`,
    ].join("\n");

    console.log(`[vapi-assistant-request] Returning speaking assistant for ${elderName}`);

    return jsonResponse(buildAssistantResponse(firstMessage, context));
  } catch (error) {
    console.error("[vapi-assistant-request] Error:", error);
    return jsonResponse(
      buildAssistantResponse(
        DEFAULT_FIRST_MESSAGE,
        "Puhelun alussa tapahtui tekninen virhe. Tervehdi ystävällisesti suomeksi ja jatka keskustelua normaalisti.",
      ),
    );
  }
});
