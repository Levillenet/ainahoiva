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

function helsinkiWeekStart(): string {
  const nowHelsinki = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Helsinki" }));
  const day = nowHelsinki.getDay(); // 0=Sun
  const offset = day === 0 ? -6 : 1 - day;
  const monday = new Date(nowHelsinki);
  monday.setDate(monday.getDate() + offset);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, "0");
  const d = String(monday.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let toolCallId: string | undefined;

  try {
    const body = await req.json();
    console.log("[muistoissa-save-quote] received:", JSON.stringify(body));

    const toolCall = body?.message?.toolCalls?.[0];
    toolCallId = toolCall?.id;
    const args = parseArgs(toolCall?.function?.arguments);
    const elderId = body?.message?.call?.metadata?.elderId;

    console.log("[muistoissa-save-quote] elderId:", elderId);
    console.log("[muistoissa-save-quote] args:", JSON.stringify(args));

    if (!elderId) {
      return fail(toolCallId, "Vanhuksen tunnistetta ei löytynyt puhelun metatiedoista.");
    }

    const quote = (args.quote as string) || "";
    const context = (args.context as string) || null;
    const targetChapter = (args.target_chapter as string) || null;

    if (!quote) {
      return fail(toolCallId, "Sitaatti puuttuu.");
    }

    const weekStart = helsinkiWeekStart();
    console.log("[muistoissa-save-quote] week_start:", weekStart);

    const { data, error } = await supabase
      .from("legacy_highlights")
      .insert({
        elder_id: elderId,
        quote,
        context,
        target_chapter: targetChapter,
        week_start: weekStart,
      })
      .select()
      .single();

    if (error) {
      console.error("[muistoissa-save-quote] insert error:", error);
      return fail(toolCallId, `Sitaatin tallennus epäonnistui: ${error.message}`);
    }

    console.log("[muistoissa-save-quote] db result:", data);
    return ok(toolCallId, "Sitaatti tallennettu.");
  } catch (error) {
    console.error("[muistoissa-save-quote] error:", error);
    return fail(toolCallId, `Tallennus epäonnistui: ${(error as Error).message}`);
  }
});
