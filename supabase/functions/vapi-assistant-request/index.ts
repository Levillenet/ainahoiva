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
const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

async function fetchBaseAssistant() {
  if (!VAPI_API_KEY) return null;

  try {
    const response = await fetch(`https://api.vapi.ai/assistant/${ASSISTANT_ID}`, {
      headers: {
        Authorization: `Bearer ${VAPI_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[vapi-assistant-request] Failed to fetch base assistant:", response.status, errorText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("[vapi-assistant-request] Error fetching base assistant:", error);
    return null;
  }
}

function buildAssistantResponse(baseAssistant: any, firstMessage: string, context: string) {
  const baseMessages = Array.isArray(baseAssistant?.model?.messages)
    ? baseAssistant.model.messages
    : [];

  const assistant: Record<string, unknown> = {
    firstMessage,
    firstMessageMode: "assistant-speaks-first",
  };

  if (baseAssistant?.name) assistant.name = baseAssistant.name;
  if (baseAssistant?.voice) assistant.voice = baseAssistant.voice;
  if (baseAssistant?.transcriber) assistant.transcriber = baseAssistant.transcriber;
  if (baseAssistant?.server) assistant.server = baseAssistant.server;
  if (baseAssistant?.serverMessages) assistant.serverMessages = baseAssistant.serverMessages;
  if (baseAssistant?.clientMessages) assistant.clientMessages = baseAssistant.clientMessages;
  if (baseAssistant?.backgroundSound) assistant.backgroundSound = baseAssistant.backgroundSound;
  if (baseAssistant?.maxDurationSeconds) assistant.maxDurationSeconds = baseAssistant.maxDurationSeconds;
  if (baseAssistant?.voicemailDetection) assistant.voicemailDetection = baseAssistant.voicemailDetection;
  if (baseAssistant?.endCallMessage) assistant.endCallMessage = baseAssistant.endCallMessage;
  if (baseAssistant?.endCallPhrases) assistant.endCallPhrases = baseAssistant.endCallPhrases;
  if (baseAssistant?.voicemailMessage) assistant.voicemailMessage = baseAssistant.voicemailMessage;
  if (baseAssistant?.analysisPlan) assistant.analysisPlan = baseAssistant.analysisPlan;
  if (baseAssistant?.artifactPlan) assistant.artifactPlan = baseAssistant.artifactPlan;
  if (baseAssistant?.metadata) assistant.metadata = baseAssistant.metadata;
  if (baseAssistant?.credentials) assistant.credentials = baseAssistant.credentials;
  if (baseAssistant?.hooks) assistant.hooks = baseAssistant.hooks;
  if (baseAssistant?.transportConfigurations) assistant.transportConfigurations = baseAssistant.transportConfigurations;

  if (baseAssistant?.model) {
    assistant.model = {
      ...baseAssistant.model,
      messages: [
        {
          role: "system",
          content: context,
        },
        ...baseMessages,
      ],
    };
  }

  return {
    assistant,
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

    console.log(`[vapi-assistant-request] Call direction: ${callDirection}, caller: ${callerNumber}`);

    if (callDirection === "outboundPhoneCall") {
      console.log("[vapi-assistant-request] Outbound call — returning saved assistant");
      return jsonResponse({ assistantId: ASSISTANT_ID });
    }

    const genericFirstMessage = "Hei! Täällä Aina AinaHoivasta. Miten voin auttaa?";
    const baseAssistant = await fetchBaseAssistant();

    if (!callerNumber) {
      console.log("[vapi-assistant-request] No caller number — using generic assistant");
      return jsonResponse(
        baseAssistant
          ? buildAssistantResponse(
              baseAssistant,
              genericFirstMessage,
              "Sisääntuleva puhelu. Tervehdi ystävällisesti suomeksi ja auta soittajaa.",
            )
          : { assistantId: ASSISTANT_ID },
      );
    }

    const { data: elderMatch } = await supabase.rpc("find_elder_by_phone", { p_phone: callerNumber });
    const elderId = elderMatch?.[0]?.id;
    const elderName = elderMatch?.[0]?.full_name;

    if (!elderId || !elderName) {
      console.log(`[vapi-assistant-request] Unknown caller: ${callerNumber}`);
      return jsonResponse(
        baseAssistant
          ? buildAssistantResponse(
              baseAssistant,
              genericFirstMessage,
              `Sisääntuleva puhelu numerosta ${callerNumber}. Soittajaa ei tunnistettu. Tervehdi ystävällisesti suomeksi ja kysy miten voit auttaa.`,
            )
          : { assistantId: ASSISTANT_ID },
      );
    }

    console.log(`[vapi-assistant-request] Recognized: ${elderName} (${elderId})`);

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

    const firstName = elderName.split(" ")[0];
    const hour = (new Date().getUTCHours() + 3) % 24;
    let greeting = "Hei";
    if (hour >= 5 && hour < 11) greeting = "Hyvää huomenta";
    else if (hour >= 11 && hour < 17) greeting = "Hyvää päivää";
    else if (hour >= 17 && hour < 22) greeting = "Hyvää iltaa";

    const firstMessage = `${greeting} ${firstName}! Täällä Aina, kiva kun soititte! Miten Teillä menee?`;
    const context = [
      `Soittaja on ${elderName}.`,
      `Kyseessä on sisääntuleva puhelu.`,
      `Aamulääkkeet: ${medsMorning}.`,
      `Päivälääkkeet: ${medsNoon}.`,
      `Iltalääkkeet: ${medsEvening}.`,
      `Dosetti käytössä: ${hasDosette ? "kyllä" : "ei"}.`,
      `Viimeisin puhelu: ${lastCallText}.`,
      `Muistot: ${memoryText}.`,
      `Puhu aina suomeksi, lämpimästi ja lyhyesti.`,
    ].join("\n");

    console.log(`[vapi-assistant-request] Returning speaking assistant for ${elderName}`);

    return jsonResponse(
      baseAssistant
        ? buildAssistantResponse(baseAssistant, firstMessage, context)
        : { assistantId: ASSISTANT_ID },
    );
  } catch (error) {
    console.error("[vapi-assistant-request] Error:", error);
    return jsonResponse({ assistantId: ASSISTANT_ID });
  }
});
