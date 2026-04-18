import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const TYPE_MAP: Record<string, string> = {
  topic_declined: "sensitive_topic",
  suggestion_for_family: "suggestion",
  milestone_reached: "milestone",
  emotional_moment: "sensitive_topic",
  unresolved_thread: "suggestion",
};

function parseArgs(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw as Record<string, unknown>;
}

function ok(toolCallId: string | undefined, message: string) {
  return new Response(
    JSON.stringify({ results: [{ toolCallId: toolCallId ?? "unknown", result: message }] }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

function fail(toolCallId: string | undefined, message: string) {
  return new Response(
    JSON.stringify({ results: [{ toolCallId: toolCallId ?? "unknown", error: message }] }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let toolCallId: string | undefined;

  try {
    const body = await req.json();
    console.log("[muistoissa-save-observation] received:", JSON.stringify(body));

    const toolCall = body?.message?.toolCalls?.[0];
    toolCallId = toolCall?.id;
    const args = parseArgs(toolCall?.function?.arguments);
    const elderId = body?.message?.call?.metadata?.elderId;

    console.log("[muistoissa-save-observation] elderId:", elderId);
    console.log("[muistoissa-save-observation] args:", JSON.stringify(args));

    if (!elderId) {
      return fail(toolCallId, "Vanhuksen tunnistetta ei löytynyt puhelun metatiedoista.");
    }

    const inputType = (args.observation_type as string) || "";
    const title = (args.title as string) || "";
    const description = (args.description as string) || null;

    if (!title) {
      return fail(toolCallId, "Otsikko puuttuu.");
    }

    const dbType = TYPE_MAP[inputType] ?? "suggestion";
    console.log("[muistoissa-save-observation] mapped type:", inputType, "->", dbType);

    const { data, error } = await supabase
      .from("legacy_observations")
      .insert({
        elder_id: elderId,
        type: dbType,
        title,
        description,
      })
      .select()
      .single();

    if (error) {
      console.error("[muistoissa-save-observation] insert error:", error);
      return fail(toolCallId, `Havainnon tallennus epäonnistui: ${error.message}`);
    }

    console.log("[muistoissa-save-observation] db result:", data);
    return ok(toolCallId, "Havainto tallennettu.");
  } catch (error) {
    console.error("[muistoissa-save-observation] error:", error);
    return fail(toolCallId, `Tallennus epäonnistui: ${(error as Error).message}`);
  }
});
