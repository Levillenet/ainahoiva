import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Vapi vaatii vastauksen muodossa:
//   { "results": [{ "toolCallId": "...", "result": "..." }] }
// Tärkeää: toolCallId pyynnöstä, result yksirivinen, HTTP 200 aina.
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

    // Tuetaan sekä uutta (toolCallList) että vanhaa (toolCalls) muotoa
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
      return vapiResult(toolCallId, "En löydä tietojanne järjestelmästä.");
    }

    const remindAt = parseDateTime(args.date, args.time);

    const { error } = await supabase.from("reminders").insert({
      elder_id: elder.id,
      message: args.message,
      remind_at: remindAt,
      method: args.method ?? "sms",
      is_sent: false,
    });

    if (error) throw error;

    const confirmMsg =
      `AinaHoiva muistutus tallennettu: ${args.message} — ${formatDateTime(remindAt)}`;

    await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-sms`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          elder_id: elder.id,
          to_number: callerNumber,
          message: confirmMsg,
          type: "reminder_confirmation",
        }),
      }
    );

    return vapiResult(
      toolCallId,
      `Muistutus tallennettu. Muistutan Teitä ${args.message} ${formatDateTime(remindAt)}.`
    );
  } catch (error) {
    console.error("save-reminder error:", error);
    // HUOM: HTTP 200 silloinkin kun sisäisesti failasi — muuten Vapi ignooraa.
    return vapiResult(toolCallId, "Muistutuksen tallennus epäonnistui.");
  }
});

function parseDateTime(date: string, time: string): string {
  const now = new Date();
  const finnish = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  let targetDate = new Date(finnish);

  const dateLower = (date ?? "").toLowerCase();
  if (dateLower.includes("huomenna") || dateLower.includes("huomis")) {
    targetDate.setDate(targetDate.getDate() + 1);
  } else if (dateLower.includes("ylihuomenna")) {
    targetDate.setDate(targetDate.getDate() + 2);
  }

  if (time) {
    const timeMatch = time.match(/(\d{1,2})[:.:]?(\d{2})?/);
    if (timeMatch) {
      targetDate.setHours(
        parseInt(timeMatch[1]),
        parseInt(timeMatch[2] ?? "0"),
        0,
        0
      );
    }
  }

  return targetDate.toISOString();
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  const finnish = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  return finnish.toLocaleString("fi-FI", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
