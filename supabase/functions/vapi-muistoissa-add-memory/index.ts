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
    console.log("[muistoissa-add-memory] received:", JSON.stringify(body));

    const toolCall = body?.message?.toolCalls?.[0];
    toolCallId = toolCall?.id;
    const args = parseArgs(toolCall?.function?.arguments);
    const elderId = body?.message?.call?.metadata?.elderId;

    console.log("[muistoissa-add-memory] elderId:", elderId);
    console.log("[muistoissa-add-memory] args:", JSON.stringify(args));

    if (!elderId) {
      console.error("[muistoissa-add-memory] error: missing elderId in metadata");
      return fail(toolCallId, "Vanhuksen tunnistetta ei löytynyt puhelun metatiedoista.");
    }

    const memoryType = (args.memory_type as string) || "event";
    let content = (args.content as string) || "";
    const targetChapter = args.target_chapter as string | undefined;
    const eventDate = args.event_date as string | undefined;

    if (!content) {
      return fail(toolCallId, "Muiston sisältö puuttuu.");
    }

    if (eventDate) {
      content = `[${eventDate}] ${content}`;
    }

    const { data: insertData, error: insertError } = await supabase
      .from("elder_memory")
      .insert({ elder_id: elderId, memory_type: memoryType, content })
      .select()
      .single();

    if (insertError) {
      console.error("[muistoissa-add-memory] error inserting memory:", insertError);
      return fail(toolCallId, `Muiston tallennus epäonnistui: ${insertError.message}`);
    }

    console.log("[muistoissa-add-memory] db result:", insertData);

    if (targetChapter) {
      const { data: existing, error: selectError } = await supabase
        .from("coverage_map")
        .select("id, questions_asked")
        .eq("elder_id", elderId)
        .eq("life_stage", targetChapter)
        .is("theme", null)
        .maybeSingle();

      if (selectError) {
        console.error("[muistoissa-add-memory] coverage select error:", selectError);
      } else if (existing) {
        const { error: updateError } = await supabase
          .from("coverage_map")
          .update({
            last_discussed: new Date().toISOString(),
            questions_asked: (existing.questions_asked ?? 0) + 1,
          })
          .eq("id", existing.id);
        if (updateError) console.error("[muistoissa-add-memory] coverage update error:", updateError);
      } else {
        const { error: insErr } = await supabase.from("coverage_map").insert({
          elder_id: elderId,
          life_stage: targetChapter,
          last_discussed: new Date().toISOString(),
          questions_asked: 1,
          status: "in_progress",
        });
        if (insErr) console.error("[muistoissa-add-memory] coverage insert error:", insErr);
      }
    }

    return ok(toolCallId, "Muisto tallennettu onnistuneesti.");
  } catch (error) {
    console.error("[muistoissa-add-memory] error:", error);
    return fail(toolCallId, `Tallennus epäonnistui: ${(error as Error).message}`);
  }
});
