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

// Palauttaa Suomen aikavyöhykkeen offsetin tunteina (2 tai 3)
// kesäaikakäytännön mukaan. Huhtikuu-lokakuu = +3, muut = +2.
function finnishOffsetHours(date: Date): number {
  const month = date.getUTCMonth() + 1;
  return month >= 4 && month <= 10 ? 3 : 2;
}

function parseDateTime(date: string, time: string): string {
  const nowUtc = new Date();
  const offset = finnishOffsetHours(nowUtc);

  // Luo "Suomen ajan näkymä" nykyhetkestä käyttämällä UTC-settereitä
  const nowFinnish = new Date(nowUtc.getTime() + offset * 60 * 60 * 1000);
  const target = new Date(nowFinnish);

  // Päivä suomeksi
  const dateLower = (date ?? "").toLowerCase();
  if (dateLower.includes("huomenna") || dateLower.includes("huomis")) {
    target.setUTCDate(target.getUTCDate() + 1);
  } else if (dateLower.includes("ylihuomenna")) {
    target.setUTCDate(target.getUTCDate() + 2);
  }

  // Kellonaika — tukee "11.45", "11:45", "11"
  let hours = 0;
  let minutes = 0;
  if (time) {
    const timeMatch = time.match(/(\d{1,2})(?:[:.]\s*(\d{1,2}))?/);
    if (timeMatch) {
      hours = parseInt(timeMatch[1], 10);
      minutes = parseInt(timeMatch[2] ?? "0", 10);
    }
  }

  // Aseta Suomen aika UTC-setterillä koska target on jo offsetattu
  target.setUTCHours(hours, minutes, 0, 0);

  // Muunna takaisin oikeaksi UTC-ajaksi tallennusta varten
  const utcMillis = target.getTime() - offset * 60 * 60 * 1000;
  return new Date(utcMillis).toISOString();
}

function formatDateTime(isoString: string): string {
  // Intl.DateTimeFormat hoitaa aikavyöhykemuunnoksen oikein
  // ilman manuaalista offsettia
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("fi-FI", {
    timeZone: "Europe/Helsinki",
    weekday: "long",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
