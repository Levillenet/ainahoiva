import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Helsinki local hour — handles DST automatically (EET/EEST)
function getHelsinkiHour(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Helsinki",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";
  return parseInt(hourStr, 10) % 24;
}

function getTimeOfDay(): string {
  const hour = getHelsinkiHour();
  if (hour >= 5 && hour < 11) return "huomenta";
  if (hour >= 11 && hour < 17) return "päivää";
  if (hour >= 17 && hour < 22) return "iltaa";
  return "yötä";
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildScheduledFirstMessage(fullName: string): string {
  // Tervehdyksessä EI mainita säätä — se mainitaan vain luonnollisesti keskustelussa
  const firstName = fullName.split(" ")[0]?.trim();
  const greet = `Hyvää ${getTimeOfDay()}`;
  const name = firstName ? ` ${firstName}` : "";

  const variants = [
    `${greet}${name}! Täällä Aina AinaHoivasta. Mitä Teille kuuluu tänään?`,
    `${greet}${name}! Täällä Aina, kiva kuulla ääntänne taas. Miten päivänne on alkanut?`,
    `Hei${name}! Aina tässä AinaHoivasta. Miten voitte tänään?`,
    `${greet}${name}! Aina kysymässä kuulumisia — mitäs siellä?`,
    `Tervehdys${name}! Aina tässä. Onko ollut hyvä päivä?`,
    `${greet}${name}! Mukava soittaa Teille taas. Kertokaa miten menee?`,
    `Hei${name}, Aina tässä AinaHoivasta! Miten päivä on sujunut?`,
  ];

  return pickRandom(variants);
}

// Päivän teema arvotaan päivämäärän pohjalta — sama teema saman päivän aikana
function getDailyTopic(): { topic: string; prompt: string } {
  const day = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const topics = [
    { topic: "muistot", prompt: "Kysy jokin lämmin muisto menneiltä vuosilta — esim. lapsuudesta, työstä, häämatkoilta, tai mukavista juhlista." },
    { topic: "perhe", prompt: "Kysy kuulumisia lapsista, lapsenlapsista tai sisaruksista. Onko kuulunut viime aikoina?" },
    { topic: "harrastukset", prompt: "Kysy mitä mukavaa on tehnyt — lukemista, käsitöitä, ristikoita, puutarhaa, musiikkia." },
    { topic: "ruoka", prompt: "Kysy mitä on syönyt tänään tai mikä on lempiruokaa. Maistuuko ruoka?" },
    { topic: "ulkoilu", prompt: "Kysy onko päässyt ulos, miltä luonto näyttää, onko nähnyt lintuja tai naapureita." },
    { topic: "uni", prompt: "Kysy miten on nukkunut, onko levännyt hyvin." },
    { topic: "naapurit", prompt: "Kysy onko jutellut naapureiden tai ystävien kanssa, onko joku käynyt kylässä." },
  ];
  return topics[day % topics.length];
}

// Hae sää Open-Meteosta postinumeron perusteella (Suomi)
async function fetchWeather(postalCode: string | null, helsinkiHour: number): Promise<{ hint: string; summary: string } | null> {
  if (!postalCode) return null;
  try {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(postalCode)}&country=FI&count=1`);
    const geo = await geoRes.json();
    const loc = geo?.results?.[0];
    if (!loc) return null;

    const wRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}` +
      `&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum&timezone=Europe%2FHelsinki&forecast_days=2`
    );
    const w = await wRes.json();
    const tNow = Math.round(w?.current?.temperature_2m ?? 0);
    const codeNow = w?.current?.weather_code ?? 0;
    const tMaxTomorrow = Math.round(w?.daily?.temperature_2m_max?.[1] ?? 0);
    const codeTomorrow = w?.daily?.weather_code?.[1] ?? 0;
    const rainTomorrow = w?.daily?.precipitation_sum?.[1] ?? 0;

    const describe = (code: number) => {
      if (code === 0) return "aurinkoista";
      if (code <= 3) return "puolipilvistä";
      if (code <= 48) return "sumuista";
      if (code <= 67) return "sateista";
      if (code <= 77) return "lumista";
      if (code <= 82) return "sadekuuroja";
      return "vaihtelevaa";
    };

    const nowDesc = describe(codeNow);
    const tomDesc = describe(codeTomorrow);
    const isDaytime = helsinkiHour >= 8 && helsinkiHour < 17;
    const isMorningOrDay = helsinkiHour >= 5 && helsinkiHour < 17;
    const isNiceTomorrow = codeTomorrow <= 3 && rainTomorrow < 1 && tMaxTomorrow >= 5;
    const isNiceNow = codeNow <= 3 && tNow >= 5;

    let hint = `Täällä on tänään ${nowDesc} ja noin ${tNow} astetta.`;
    // Kävelyehdotus VAIN päiväsaikaan
    if (isDaytime && isNiceNow) {
      hint += ` Olisiko mukava käydä hetki ulkona?`;
    } else if (isMorningOrDay && isNiceTomorrow) {
      hint += ` Huomenna näyttää kauniilta — voisi olla mukava päivä lähteä pienelle kävelylle!`;
    } else if (isMorningOrDay && codeTomorrow >= 51 && codeTomorrow <= 67) {
      hint += ` Huomenna on luvassa sadetta, ehkä parempi pysyä lämpimässä.`;
    } else if (helsinkiHour >= 17 && helsinkiHour < 22) {
      hint += ` Toivottavasti olette saanut levätä päivän aikana.`;
    } else if (helsinkiHour >= 22 || helsinkiHour < 5) {
      hint += ` Mukavia unia, kun on aika nukahtaa.`;
    }

    const summary = `Tänään: ${nowDesc}, ${tNow}°C. Huomenna: ${tomDesc}, ${tMaxTomorrow}°C, sade ${rainTomorrow}mm.`;
    return { hint, summary };
  } catch (e) {
    console.error("Weather fetch error:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { elder_id, call_type, phone_number, elder_name, alert_reason, elder_phone, alert_id, reminder_message } = await req.json();

    const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
    const VAPI_ASSISTANT_ID = Deno.env.get("VAPI_ASSISTANT_ID");
    const VAPI_PHONE_NUMBER_ID = Deno.env.get("VAPI_PHONE_NUMBER_ID");

    if (!VAPI_API_KEY || !VAPI_ASSISTANT_ID || !VAPI_PHONE_NUMBER_ID) {
      return new Response(JSON.stringify({ error: "Vapi-asetukset puuttuvat" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Emergency family call — call family member directly ===
    if (call_type === "emergency_family" && phone_number) {
      console.log(`[outbound-call] Emergency family call to ${phone_number}`);
      const vapiResponse = await fetch("https://api.vapi.ai/call/phone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${VAPI_API_KEY}`,
        },
        body: JSON.stringify({
          assistantId: VAPI_ASSISTANT_ID,
          customer: { number: phone_number },
          phoneNumberId: VAPI_PHONE_NUMBER_ID,
          assistantOverrides: {
            firstMessage:
              `Hei! Täällä AinaHoiva. ` +
              `${elder_name || "Vanhuksenne"} tarvitsee apuanne nyt. ` +
              `Syy: ${alert_reason || "hätätilanne"}. ` +
              `Soittakaa hänelle välittömästi numeroon ${elder_phone || ""}. Kiitos!`,
            firstMessageMode: "assistant-speaks-first",
            variableValues: {
              elder_name: elder_name || "",
              alert_reason: alert_reason || "",
              elder_phone: elder_phone || "",
              call_type: "emergency_family",
            },
          },
        }),
      });
      const result = await vapiResponse.json();
      return new Response(JSON.stringify({ success: vapiResponse.ok, call: result }), {
        status: vapiResponse.ok ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Regular and emergency followup calls need elder_id ===
    if (!elder_id) {
      return new Response(JSON.stringify({ error: "elder_id vaaditaan" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: elder } = await supabase
      .from("elders")
      .select("*, medications(*)")
      .eq("id", elder_id)
      .single();

    if (!elder) {
      return new Response(JSON.stringify({ error: "Vanhusta ei löytynyt" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip inactive elders (except emergency calls)
    if (!elder.is_active && call_type !== "emergency_followup") {
      console.log(`[outbound-call] Skipping call to inactive elder ${elder.full_name}`);
      return new Response(JSON.stringify({ error: "Vanhus ei ole aktiivinen", skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Emergency followup call — simplified prompt ===
    if (call_type === "emergency_followup") {
      console.log(`[outbound-call] Emergency followup call to elder ${elder.id}`);
      const vapiResponse = await fetch("https://api.vapi.ai/call/phone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${VAPI_API_KEY}`,
        },
        body: JSON.stringify({
          assistantId: VAPI_ASSISTANT_ID,
          customer: {
            number: elder.phone_number,
            name: elder.full_name,
          },
          phoneNumberId: VAPI_PHONE_NUMBER_ID,
          assistantOverrides: {
            firstMessage:
              `Hei ${elder.full_name}! Täällä Aina. ` +
              `Soitan tarkistaakseni että kaikki on hyvin. ` +
              `Onko tilanne parantunut?`,
            firstMessageMode: "assistant-speaks-first",
            variableValues: {
              elder_name: elder.full_name,
              call_type: "emergency_followup",
            },
          },
        }),
      });
      const result = await vapiResponse.json();
      if (vapiResponse.ok) {
        await supabase.from("call_reports").insert({
          elder_id: elder.id,
          call_type: "emergency_followup",
          ai_summary: "Hätätilanteen seurantasoitto käynnistetty",
          vapi_call_id: result.id,
        });
      }
      return new Response(JSON.stringify({ success: vapiResponse.ok, call: result }), {
        status: vapiResponse.ok ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Reminder call — simple message ===
    if (call_type === "reminder") {
      console.log(`[outbound-call] Reminder call to elder ${elder.id}`);
      const vapiResponse = await fetch("https://api.vapi.ai/call/phone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${VAPI_API_KEY}`,
        },
        body: JSON.stringify({
          assistantId: VAPI_ASSISTANT_ID,
          customer: {
            number: elder.phone_number,
            name: elder.full_name,
          },
          phoneNumberId: VAPI_PHONE_NUMBER_ID,
          assistantOverrides: {
            firstMessage:
              `Hyvää ${getTimeOfDay()}! Täällä Aina AinaHoivasta. ` +
              `Soitan muistuttaakseni Teitä: ${reminder_message || "muistutus"}. ` +
              `Onko asia hoidossa?`,
            firstMessageMode: "assistant-speaks-first",
            variableValues: {
              elder_name: elder.full_name,
              call_type: "reminder",
              reminder_message: reminder_message || "",
            },
          },
        }),
      });
      const result = await vapiResponse.json();
      if (vapiResponse.ok) {
        await supabase.from("call_reports").insert({
          elder_id: elder.id,
          call_type: "reminder",
          ai_summary: `Muistutussoitto: ${reminder_message || ""}`,
          vapi_call_id: result.id,
        });
      }
      return new Response(JSON.stringify({ success: vapiResponse.ok, call: result }), {
        status: vapiResponse.ok ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Build medication variables by time of day ===
    const medsMorning = (elder.medications || []).filter((m: any) => m.morning).map((m: any) => `${m.name} ${m.dosage || ""}`.trim()).join(", ") || "Ei aamulääkkeitä";
    const medsNoon = (elder.medications || []).filter((m: any) => m.noon).map((m: any) => `${m.name} ${m.dosage || ""}`.trim()).join(", ") || "Ei päivälääkkeitä";
    const medsEvening = (elder.medications || []).filter((m: any) => m.evening).map((m: any) => `${m.name} ${m.dosage || ""}`.trim()).join(", ") || "Ei iltalääkkeitä";

    // Check if any medication has dosette
    const hasDosette = (elder.medications || []).some((m: any) => m.has_dosette);

    // Fetch elder memories
    const { data: memories } = await supabase
      .from("elder_memory")
      .select("memory_type, content, updated_at")
      .eq("elder_id", elder.id)
      .order("updated_at", { ascending: false })
      .limit(20);

    const memoryText = memories?.length
      ? memories.map((m: { memory_type: string; content: string }) => `[${m.memory_type}] ${m.content}`).join("\n")
      : "Ei aiempia muistoja";

    // Get last 3 call summaries for natural follow-up
    const { data: lastCalls } = await supabase
      .from("call_reports")
      .select("ai_summary, called_at, mood_score")
      .eq("elder_id", elder.id)
      .not("ai_summary", "is", null)
      .order("called_at", { ascending: false })
      .limit(3);

    const lastCallText = lastCalls?.length
      ? lastCalls.map((c: any, i: number) =>
          `${i === 0 ? "Viimeisin puhelu" : `Puhelu ${i + 1}`} (${new Date(c.called_at!).toLocaleDateString("fi-FI")}): mieliala ${c.mood_score ?? "?"}/5 — ${c.ai_summary}`
        ).join("\n")
      : "Ensimmäinen puhelu — ei aiempaa keskustelua";

    // Fetch weather based on postal code (time-aware)
    const weather = await fetchWeather(elder.postal_code, getHelsinkiHour());
    const weatherSummary = weather?.summary || "Säätietoa ei saatavilla";

    // Pick a daily topic
    const daily = getDailyTopic();

    // Helsinki current time string (DST-aware)
    const nowStr = new Intl.DateTimeFormat("fi-FI", {
      timeZone: "Europe/Helsinki",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());

    // Sää EI tervehdykseen — se mainitaan vain luonnollisesti keskustelussa
    const firstMessage = buildScheduledFirstMessage(elder.full_name);

    console.log(`[outbound-call] Scheduled call to ${elder.full_name}, now=${nowStr}, topic=${daily.topic}, weather=${weatherSummary}`);

    const vapiResponse = await fetch("https://api.vapi.ai/call/phone", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${VAPI_API_KEY}`,
      },
      body: JSON.stringify({
        assistantId: VAPI_ASSISTANT_ID,
        customer: {
          number: elder.phone_number,
          name: elder.full_name,
        },
        phoneNumberId: VAPI_PHONE_NUMBER_ID,
        assistantOverrides: {
          firstMessage,
          firstMessageMode: "assistant-speaks-first",
          variableValues: {
            elder_name: elder.full_name,
            medications_morning: medsMorning,
            medications_noon: medsNoon,
            medications_evening: medsEvening,
            call_type: "scheduled",
            memories: memoryText,
            last_call: lastCallText,
            has_dosette: hasDosette ? "true" : "false",
            weather: weatherSummary,
            weather_hint: weather?.hint || "",
            daily_topic: daily.topic,
            daily_topic_prompt: daily.prompt,
          },
        },
      }),
    });

    const result = await vapiResponse.json();

    if (!vapiResponse.ok) {
      console.error("Vapi error:", result);
      return new Response(JSON.stringify({ error: "Vapi-puhelu epäonnistui", details: result }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("call_reports").insert({
      elder_id: elder.id,
      call_type: "outbound_scheduled",
      ai_summary: "Soitto käynnistetty — odottaa vastausta",
      vapi_call_id: result.id,
    });

    return new Response(JSON.stringify({ success: true, call: result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Outbound call error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
