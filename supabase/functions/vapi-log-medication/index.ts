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

    if (!elder) {
      return vapiResult(toolCallId, "En löydä tietojanne.");
    }

    const today = new Date().toISOString().split("T")[0];
    const scheduledTime = args.scheduled_time ?? "morning";
    const taken = args.taken !== false;

    const { data: medications } = await supabase
      .from("medications")
      .select("id, name, dosage")
      .eq("elder_id", elder.id)
      .eq(scheduledTime, true);

    if (!medications?.length) {
      return vapiResult(toolCallId, "Ei lääkkeitä kirjattuna tälle ajankohdalle.");
    }

    for (const med of medications) {
      await supabase.from("medication_logs").upsert(
        {
          elder_id: elder.id,
          medication_id: med.id,
          medication_name: `${med.name} ${med.dosage}`,
          scheduled_time: scheduledTime,
          taken,
          not_taken: !taken,
          log_date: today,
          taken_at: taken ? new Date().toISOString() : null,
          confirmed_by: "aina_call",
        },
        { onConflict: "elder_id,medication_id,scheduled_time,log_date" }
      );
    }

    const medNames = medications.map((m) => `${m.name} ${m.dosage}`).join(", ");
    const response = taken
      ? `Merkitty otetuksi: ${medNames}. Hienoa!`
      : `Merkitty ottamattomaksi: ${medNames}. Muistakaa ottaa ne pian!`;

    return vapiResult(toolCallId, response);
  } catch (error) {
    console.error("log-medication error:", error);
    return vapiResult(toolCallId, "Lääkkeiden kirjaus epäonnistui.");
  }
});
