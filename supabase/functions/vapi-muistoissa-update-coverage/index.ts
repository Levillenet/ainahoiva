import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

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
    console.log("[muistoissa-update-coverage] received:", JSON.stringify(body));

    const toolCall = body?.message?.toolCalls?.[0];
    toolCallId = toolCall?.id;
    const args = parseArgs(toolCall?.function?.arguments);
    const elderId = body?.message?.call?.metadata?.elderId;

    console.log("[muistoissa-update-coverage] elderId:", elderId);
    console.log("[muistoissa-update-coverage] args:", JSON.stringify(args));

    if (!elderId) {
      return fail(toolCallId, "Vanhuksen tunnistetta ei löytynyt puhelun metatiedoista.");
    }

    const lifeStage = args.life_stage as string | undefined;
    const theme = (args.theme as string | undefined) ?? null;
    const depthIncrement = Math.max(1, Math.min(3, Number(args.depth_increment ?? 1)));
    const status = (args.status as string) || "in_progress";

    if (!lifeStage) {
      return fail(toolCallId, "Elämänvaihe (life_stage) puuttuu.");
    }

    let query = supabase
      .from("coverage_map")
      .select("id, depth_score, questions_asked")
      .eq("elder_id", elderId)
      .eq("life_stage", lifeStage);
    query = theme === null ? query.is("theme", null) : query.eq("theme", theme);

    const { data: existing, error: selectError } = await query.maybeSingle();

    if (selectError) {
      console.error("[muistoissa-update-coverage] select error:", selectError);
      return fail(toolCallId, `Haku epäonnistui: ${selectError.message}`);
    }

    const now = new Date().toISOString();

    if (existing) {
      const newDepth = Math.min(100, (existing.depth_score ?? 0) + depthIncrement * 10);
      const { data, error } = await supabase
        .from("coverage_map")
        .update({
          depth_score: newDepth,
          status,
          last_discussed: now,
          questions_asked: (existing.questions_asked ?? 0) + 1,
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        console.error("[muistoissa-update-coverage] update error:", error);
        return fail(toolCallId, `Päivitys epäonnistui: ${error.message}`);
      }
      console.log("[muistoissa-update-coverage] db result:", data);
    } else {
      const { data, error } = await supabase
        .from("coverage_map")
        .insert({
          elder_id: elderId,
          life_stage: lifeStage,
          theme,
          depth_score: Math.min(100, depthIncrement * 10),
          status,
          last_discussed: now,
          questions_asked: 1,
        })
        .select()
        .single();

      if (error) {
        console.error("[muistoissa-update-coverage] insert error:", error);
        return fail(toolCallId, `Lisäys epäonnistui: ${error.message}`);
      }
      console.log("[muistoissa-update-coverage] db result (new):", data);
    }

    return ok(toolCallId, "Kattavuuskartta päivitetty.");
  } catch (error) {
    console.error("[muistoissa-update-coverage] error:", error);
    return fail(toolCallId, `Päivitys epäonnistui: ${(error as Error).message}`);
  }
});
