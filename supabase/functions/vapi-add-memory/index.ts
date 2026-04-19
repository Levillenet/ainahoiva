import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function vapiResult(toolCallId: string, text: string) {
  const oneLine = String(text).replace(/\s+/g, " ").trim();
  return new Response(
    JSON.stringify({ results: [{ toolCallId, result: oneLine }] }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

Deno.serve(async (req) => {
  let toolCallId = "";
  try {
    const body = await req.json();
    const toolCall =
      body?.message?.toolCallList?.[0] ??
      body?.message?.toolCalls?.[0];
    toolCallId = toolCall?.id ?? "";

    const args = toolCall?.function?.arguments ?? body;
    const callerNumber = body?.message?.call?.customer?.number;

    const { data: elderMatch } = await supabase.rpc("find_elder_by_phone", {
      p_phone: callerNumber,
    });
    const elder = elderMatch?.[0] ?? null;

    // Palautetaan aina "ok" — tämä tool on "hiljainen tallennus"
    // eikä GPT:n ole tarkoitus kertoa vanhukselle mitään.
    if (!elder) {
      return vapiResult(toolCallId, "ok");
    }

    await supabase.from("elder_memory").insert({
      elder_id: elder.id,
      memory_type: args.memory_type ?? "event",
      content: args.content,
    });

    return vapiResult(toolCallId, "ok");
  } catch (error) {
    console.error("add-memory error:", error);
    return vapiResult(toolCallId, "ok");
  }
});
