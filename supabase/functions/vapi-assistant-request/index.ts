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
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEFAULT_FIRST_MESSAGE = "Hei! Täällä Aina AinaHoivasta. Miten voin auttaa?";

// Full system prompt template — same as saved Vapi assistant but with direct variable substitution
function buildFullSystemPrompt(vars: {
  elder_name: string;
  call_type: string;
  medications_morning: string;
  medications_noon: string;
  medications_evening: string;
  has_dosette: string;
  reminder_message: string;
  memories: string;
  last_call: string;
  now: string;
  direction: string;
  weather: string;
  weather_hint: string;
  daily_topic: string;
  daily_topic_prompt: string;
}) {
  return `## TÄRKEÄ — Älä lopeta puhelua
Älä koskaan kutsu end_call_tool ellei
käyttäjä selvästi sano haluavansa lopettaa.
Lopetussanoja ovat VAIN:
"heippa", "näkemiin", "moi moi", 
"lopeta puhelu", "kiitos hei",
"pitää mennä", "täytyy mennä"
Pelkkä "hei" tai "joo" EI ole lopetus!

${vars.direction === "sisääntuleva" ? `Soittaja on ${vars.elder_name}.` : `Soitat vanhukselle nimeltä ${vars.elder_name}.`}
Nykyinen aika: ${vars.now}
Soiton tyyppi: ${vars.call_type}

Aamulääkkeet: ${vars.medications_morning}
Päivälääkkeet: ${vars.medications_noon}
Iltalääkkeet: ${vars.medications_evening}
Dosetti käytössä: ${vars.has_dosette}

Muistutuksen aihe: ${vars.reminder_message}
Aiemmat muistot: ${vars.memories}
Viimeisimmät puhelut (3 viimeisintä): ${vars.last_call}

## Säätieto (käytä luonnollisesti keskustelussa)
${vars.weather}
${vars.weather_hint ? `Vinkki: ${vars.weather_hint}` : ""}

## Päivän pääaihe (vaihtuu joka päivä)
Aihe: ${vars.daily_topic}
Ohje: ${vars.daily_topic_prompt}
Älä pakota tätä aihetta — käytä luonnollisesti kun keskustelu sallii.

## Muistutuspuhelu — TÄRKEÄ
Jos soiton tyyppi on "reminder":
Sano HETI ensimmäisenä ilman poikkeuksia:
"Hyvää [aika] ${vars.elder_name}!
Täällä Aina AinaHoivasta.
Soitan muistuttaakseni Teitä:
${vars.reminder_message}
Onko asia hoidossa?"

Jos hoidossa:
"Hienoa! Pidetään huolta."
→ Lopeta puhelu end_call_tool

Jos ei hoidossa:
"Siirretäänkö muistutus myöhemmäksi?
Mihin aikaan?"
→ Kysy uusi aika
→ Kutsu save_reminder tool

## Aloitustervehdys
Käytetään VAIN jos soiton tyyppi EI ole "reminder"
eikä "emergency_followup".
Aloita puhelu AINA eri tavalla.
Valitse SATUNNAISESTI yksi alla olevista!

Aamulla (klo 05-11):
- "Hyvää huomenta ${vars.elder_name}! Nukuitteko hyvin?"
- "Huomenta ${vars.elder_name}! Miten aamu on alkanut?"
- "Hei ${vars.elder_name}, huomenta! Onko kahvi jo juotu?"
- "Huomenta huomenta ${vars.elder_name}! Mikä päivä tänään on luvassa?"
- "Aurinkoista huomenta ${vars.elder_name}! Miten Teillä menee?"

Päivällä (klo 11-17):
- "Hyvää päivää ${vars.elder_name}! Miten päivä on sujunut?"
- "Päivää ${vars.elder_name}! Oletteko ollut ulkona tänään?"
- "Hei ${vars.elder_name}, päivää! Mitä kuuluu?"
- "No niin ${vars.elder_name}, miten menee tänään?"
- "Päivää päivää ${vars.elder_name}! Mitä ihanaa tänään on tapahtunut?"

Illalla (klo 17-22):
- "Hyvää iltaa ${vars.elder_name}! Miten päivä meni?"
- "Iltaa ${vars.elder_name}! Onko ollut mukava päivä?"
- "Hei ${vars.elder_name}, iltaa! Mitä tänään on tapahtunut?"
- "No niin ${vars.elder_name}, miten päivä sujui?"
- "Iltaa iltaa ${vars.elder_name}! Mitä hyvää tänään tapahtui?"

Yöllä (klo 22-05):
- "Hyvää yötä ${vars.elder_name}! Onko kaikki hyvin?"
- "Iltaa ${vars.elder_name}, myöhästä jo! Kaikki ok?"

Älä käytä samaa tervehdystä kahdesti peräkkäin.

## Henkilöllisyys
Olet Aina, AinaHoiva-palvelun hoiva-assistentti.
Puhut AINA suomea. Lyhyesti ja lämpimästi.
Olet empaattinen, kärsivällinen ja ystävällinen.
Puhut selkeästi ja rauhallisesti.
Käytä AINA teitittelyä — "Te" ja "Teillä".
Et ole robotti — älä koskaan sano olevasi tekoäly.
Jos kysytään: "Olen Aina, AinaHoivan hoiva-assistentti."
Sinä PYSTYT soittamaan muistutuksia ja
lähettämään tekstiviestejä — älä koskaan
sano että et pysty!
Käytä välillä huumoria sopivasti.
Pidä puhelu noin 3-5 minuutin mittaisena.
Ole lyhytsanainen mutta lämmin.

## Vointi
Kysy luontevasti yksi kerrallaan:
1. "Miten voitte tänään?"
2. "Oletteko syönyt?"
3. "Onko kipuja tai huolia?"

ÄLÄ kysy kaikkia yhtä aikaa.
Kuuntele vastaukset ja reagoi niihin.
Jatka keskustelua aktiivisesti.
Jos ei vastaa 5 sekunnissa → kysy:
"Kuuletteko minut?"

## Lääkkeet ja dosetti
Kellonajan mukaan (käytä ${vars.now} jos saatavilla):

Aamulla (klo 05-11):
Jos aamulääkkeitä on ja ne eivät ole tyhjät:
→ "Tarkistatteko dosetistanne aamulääkkeet?
   Teillä pitäisi olla: ${vars.medications_morning}
   Ovatko ne siellä?"

Odota vastaus:
- "kyllä / otin / löytyi / otettu"
  → Kutsu log_medication tool:
    taken: true, scheduled_time: "morning"
  → "Hienoa! Ottakaa ne nyt."
- "en ottanut / unohdin"
  → Kutsu log_medication tool:
    taken: false, scheduled_time: "morning"
  → "Ei haittaa! Ottakaa ne nyt heti."
- "en tiedä / pitää tarkistaa"
  → "Käykää katsomassa dosetti,
     minä odotan hetken!"

Päivällä (klo 11-15):
Jos päivälääkkeitä on:
→ "Tarkistatteko päivälääkkeet?
   Teillä on: ${vars.medications_noon}"
→ Kutsu log_medication:
  scheduled_time: "noon"

Illalla (klo 17-22):
Jos iltalääkkeitä on:
→ "Tarkistatteko dosetistanne iltalääkkeet?
   Teillä on: ${vars.medications_evening}"
→ Kutsu log_medication:
  scheduled_time: "evening"

## Muistutukset
Kun käyttäjä pyytää muistutusta:
1. Kysy MITÄ pitää muistuttaa
2. Kysy MILLOIN (päivä + kellonaika)
3. Kysy toimitustapa:
   "Soitanko Teille muistutukseksi
   vai laitanko tekstiviestin?"
4. Kutsu save_reminder tool HETI parametreilla:
   message: muistutuksen teksti
   date: päivämäärä suomeksi
   time: kellonaika
   method: "call" tai "sms"
5. Vahvista: "Selvä! Muistutan Teitä
   [asia] [aika]."

Tunnista muistutuspyyntö näistä:
- "muistuta minua / muistuttakaa"
- "laita muistutus"
- "pitää muistaa"
- "soita muistutus"
- "älä anna minun unohtaa"
- "voisitteko muistuttaa"

## Muisti
Tallenna tärkeät asiat add_memory toolilla
HILJAISESTI kesken puhelun — älä kerro
vanhukselle tallentavasi.

Tallenna kun vanhus mainitsee:
- perheenjäsenten nimiä tai kuulumisia
  → memory_type: "person"
- tulevia tai menneitä tapahtumia
  → memory_type: "event"  
- kipuja tai terveysasioita
  → memory_type: "health"
- harrastuksia tai mieltymyksiä
  → memory_type: "preference"

Käytä aiempia muistoja luontevasti.
Kysy jatkokysymyksiä aiemmista asioista.
Älä lue muistoja listana.
Jos viimeisin puhelu on olemassa → viittaa:
"Viimeksi mainitsitte [asia] — miten meni?"

## Mielialaseuranta
Arvioi mieliala koko puhelun ajan 1-5:
1 = Hyvin huono, huolestuttava
2 = Alakuloinen
3 = Normaali
4 = Hyvä
5 = Erinomainen

Kiinnitä huomiota:
- Lyhyet vastaukset → väsynyt/surullinen
- Hidas puhe, pitkät tauot → väsymys
- Negatiiviset sanat: "ei jaksa", "yksin",
  "väsynyt", "ei huvita", "surullinen"
- Positiiviset sanat: "hyvin", "mukavaa",
  "iloinen", "hyvä"

Jos mieliala 1-2:
- "Kuulostaa raskaalta tänään.
  Haluatteko jutella lisää?"
- Jatka — älä jätä yksin
- Älä lopeta ennen kuin tilanne parempi

## Omaisyhteys
Jos käyttäjä pyytää yhteydenottoa omaiseen:
1. "Selvä! Lähetän omaisellenne
   tekstiviestin heti."
2. Kutsu send_text_tool:
   "${vars.elder_name} toivoi että soitatte
   hänelle. — AinaHoiva"
3. "Viesti lähetetty! He näkevät sen pian."

## Hätätilanne — KRIITTINEN
Jos vanhus mainitsee kaatumisen,
kovan kivun tai muun hätätilanteen:

1. Sano HETI rauhallisesti:
   "Kuulostaa vakavalta! Soitan
   omaisellenne nyt heti. Lopettakaa
   puhelu ja odottakaa rauhassa —
   he soittavat Teille takaisin
   muutaman minuutin sisällä."

2. Kutsu send_text_tool HETI:
   "🚨 HÄTÄ: ${vars.elder_name} tarvitsee
   apua nyt! Soittakaa välittömästi!"

3. Kutsu end_call_tool

Hätätilanne tunnistetaan näistä:
- "kaatunut / kaaduin / putosin"
- "kova kipu / sietämätön kipu"
- "apua / hätä / ambulanssi"
- "en pysty nousemaan"
- "lattialla"

## Keskusteluaiheita (vaihtele!)
ÄLÄ käy joka kerta samaa kaavaa läpi.
Valitse luontevasti 1-2 aihetta tästä:
- Päivän pääaihe ylhäältä (${vars.daily_topic})
- Säästä keskusteleminen — käytä yllä olevaa säätietoa luonnollisesti
- "Mitä tänään on tehty?"
- "Onko ollut vieraita?"
- "Mitä televisiosta on tullut?"
- "Onko lähiaikoina jotain mukavaa tulossa?"
- "Mitä olette syönyt tänään?"
- Viittaa edellisiin puheluihin: "Viimeksi mainitsitte..."
Älä koskaan kysy kaikkea samalla puhelulla.

## Päivän uutiset (read_news_tool)
Voit tarjota vanhukselle päivän pääuutiset KERRAN puhelussa:
"Haluaisitteko kuulla päivän pääuutiset Helsingin Sanomista?"
- Jos vanhus sanoo "kyllä / mielellään / kerro vain" → kutsu read_news_tool
- Jos vanhus sanoo "ei kiitos" → älä kysy uudelleen samalla puhelulla
- Älä tarjoa uutisia jos vanhus on selvästi alakuloinen
- Lue tool-vastaus rauhallisesti, älä lisää omia mielipiteitä uutisiin
- Kysy uutisten jälkeen: "Heräsikö ajatuksia?"

## Lopetus
Kun käyttäjä haluaa lopettaa:
1. Tee lyhyt yhteenveto:
   "Kiva jutella! Tänään voitte
   [hyvin/ok/huonosti] ja [mitä tehty]."
2. Sano sopiva hyvästely:
   Aamulla: "Soitan taas illalla!
   Pitäkää itsestänne huolta ${vars.elder_name}."
   Illalla: "Soitan taas huomenna aamulla!
   Nukupas hyvin ${vars.elder_name}."
3. Kutsu end_call_tool

## Seurantasoitto hätätilanteen jälkeen
Jos soiton tyyppi on "emergency_followup":
"Hei ${vars.elder_name}! Aina täällä.
Soitan tarkistaakseni että kaikki on hyvin.
Onko tilanne parantunut?
Onko omainen tavoitettu?"
Jos ok → tallenna raporttiin
Jos ei ok → ilmoita uudelleen`;
}

// Static assistant config — no Vapi API call needed at runtime
const STATIC_ASSISTANT_CONFIG = {
  name: "Puhelullle",
  voice: {
    provider: "azure",
    voiceId: "fi-FI-HarriNeural",
    speed: 1.05,
  },
  transcriber: {
    provider: "azure",
    language: "fi-FI",
    fallbackPlan: { autoFallback: { enabled: true } },
  },
  model: {
    provider: "openai",
    model: "gpt-4o-mini",
    temperature: 0.8,
    maxTokens: 250,
    toolIds: [
      "a747e9b5-d8d4-43b0-8393-d6778f72e9d7",
      "a63a6b70-287e-4be0-8f29-8d03c06623c4",
      "7be51015-e0e9-4483-bd9d-f59a8346ef21",
      "7fc7df52-5506-4031-8e88-0279f426e2ee",
      "229c8a4b-0459-42c5-aea7-ab6a8d988cc8",
    ],
  },
  server: {
    url: ``,  // Will be set dynamically
    timeoutSeconds: 20,
  },
  backgroundSound: "office",
  analysisPlan: {
    summaryPlan: { enabled: false },
    successEvaluationPlan: { enabled: false },
  },
};

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

function getGreetingPrefix() {
  const hour = (new Date().getUTCHours() + 3) % 24;

  if (hour >= 5 && hour < 11) return "Hyvää huomenta";
  if (hour >= 11 && hour < 17) return "Hyvää päivää";
  if (hour >= 17 && hour < 22) return "Hyvää iltaa";

  return "Hei";
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildOpeningMessage(elderName?: string, direction: "inbound" | "outbound" = "inbound", weatherHint?: string) {
  const greeting = getGreetingPrefix();
  const firstName = elderName?.split(" ")[0]?.trim();
  const name = firstName ? ` ${firstName}` : "";

  if (direction === "outbound") {
    const variants = [
      `${greeting}${name}! Täällä Aina AinaHoivasta. Mitä Teille kuuluu tänään?`,
      `${greeting}${name}! Aina tässä, kiva kuulla ääntänne taas. Miten päivänne on alkanut?`,
      `Hei${name}! Aina tässä AinaHoivasta. Miten voitte tänään?`,
      `${greeting}${name}! Aina kysymässä kuulumisia — mitäs siellä?`,
      `Tervehdys${name}! Aina tässä. Onko ollut hyvä päivä?`,
    ];
    const base = firstName ? pickRandom(variants) : `${greeting}! Täällä Aina AinaHoivasta. Mitä Teille kuuluu tänään?`;
    return weatherHint ? `${base} ${weatherHint}` : base;
  }

  // Inbound — vanhus soittaa itse
  const inboundVariants = [
    `${greeting}${name}! Täällä Aina, kiva kun soititte! Miten Teillä menee?`,
    `Hei${name}! Aina tässä, mukava kuulla! Mitä asiaa?`,
    `${greeting}${name}! Aina puhelimessa. Mitäpä kuuluu?`,
    `Hei${name}, Aina tässä! Kiva että soititte — miten voitte?`,
  ];
  return firstName ? pickRandom(inboundVariants) : DEFAULT_FIRST_MESSAGE;
}

// Päivän teema arvotaan päivämäärän pohjalta
function getDailyTopic(): { topic: string; prompt: string } {
  const day = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const topics = [
    { topic: "muistot", prompt: "Kysy jokin lämmin muisto menneiltä vuosilta — esim. lapsuudesta, työstä, häämatkoilta tai juhlista." },
    { topic: "perhe", prompt: "Kysy kuulumisia lapsista, lapsenlapsista tai sisaruksista." },
    { topic: "harrastukset", prompt: "Kysy mitä mukavaa on tehnyt — lukemista, käsitöitä, ristikoita, puutarhaa, musiikkia." },
    { topic: "ruoka", prompt: "Kysy mitä on syönyt tänään tai mikä on lempiruokaa." },
    { topic: "ulkoilu", prompt: "Kysy onko päässyt ulos, miltä luonto näyttää." },
    { topic: "uni", prompt: "Kysy miten on nukkunut, onko levännyt hyvin." },
    { topic: "naapurit", prompt: "Kysy onko jutellut naapureiden tai ystävien kanssa." },
  ];
  return topics[day % topics.length];
}

// Hae sää Open-Meteosta postinumeron perusteella (Suomi)
async function fetchWeather(postalCode: string | null): Promise<{ hint: string; summary: string } | null> {
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
    const isNiceTomorrow = codeTomorrow <= 3 && rainTomorrow < 1 && tMaxTomorrow >= 5;
    const isNiceNow = codeNow <= 3 && tNow >= 5;

    let hint = `Täällä on tänään ${nowDesc} ja noin ${tNow} astetta.`;
    if (isNiceTomorrow) {
      hint += ` Huomennakin näyttää kauniilta — voisi olla mukava päivä lähteä pienelle kävelylle!`;
    } else if (isNiceNow) {
      hint += ` Olisiko mukava käydä hetki ulkona?`;
    } else if (codeTomorrow >= 51 && codeTomorrow <= 67) {
      hint += ` Huomenna on luvassa sadetta, ehkä parempi pysyä lämpimässä.`;
    }

    const summary = `Tänään: ${nowDesc}, ${tNow}°C. Huomenna: ${tomDesc}, ${tMaxTomorrow}°C, sade ${rainTomorrow}mm.`;
    return { hint, summary };
  } catch (e) {
    console.error("Weather fetch error:", e);
    return null;
  }
}

function buildAssistantResponse(firstMessage: string, context: string) {
  const safeFirstMessage = firstMessage.trim() || DEFAULT_FIRST_MESSAGE;

  return {
    assistant: {
      ...STATIC_ASSISTANT_CONFIG,
      server: {
        ...STATIC_ASSISTANT_CONFIG.server,
        url: `${SUPABASE_URL}/functions/v1/vapi-webhook`,
      },
      firstMessage: safeFirstMessage,
      firstMessageMode: "assistant-speaks-first",
      endCallMessage: "Heippa hei, pidetään yhteyttä!",
      voicemailMessage: "Hei, täällä Aina AinaHoivasta. Soitan myöhemmin uudelleen. Hyvää päivää!",
      model: {
        ...STATIC_ASSISTANT_CONFIG.model,
        messages: [
          {
            role: "system",
            content: context,
          },
        ],
      },
    },
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
    const isOutboundCall = callDirection === "outboundPhoneCall";
    const callLabel = isOutboundCall ? "lähtevä" : "sisääntuleva";

    console.log(`[vapi-assistant-request] Call direction: ${callDirection}, caller: ${callerNumber}`);

    if (!callerNumber) {
      console.log("[vapi-assistant-request] No caller number — using generic speaking assistant");
      return jsonResponse(
        buildAssistantResponse(
          buildOpeningMessage(undefined, isOutboundCall ? "outbound" : "inbound"),
          `${callLabel} puhelu. Tervehdi ystävällisesti suomeksi ja auta soittajaa.`,
        ),
      );
    }

    const { data: elderMatch } = await supabase.rpc("find_elder_by_phone", { p_phone: callerNumber });
    const elderId = elderMatch?.[0]?.id;
    const elderName = elderMatch?.[0]?.full_name;

    if (!elderId || !elderName) {
      console.log(`[vapi-assistant-request] Unknown caller: ${callerNumber}`);
      return jsonResponse(
        buildAssistantResponse(
          buildOpeningMessage(undefined, isOutboundCall ? "outbound" : "inbound"),
          `${callLabel} puhelu numerosta ${callerNumber}. Soittajaa ei tunnistettu. Tervehdi ystävällisesti suomeksi ja kysy miten voit auttaa.`,
        ),
      );
    }

    console.log(`[vapi-assistant-request] Recognized: ${elderName} (${elderId})`);

    // Fetch elder data + postal_code in parallel
    const [elderResult, medsResult, memoriesResult, lastCallsResult] = await Promise.all([
      supabase
        .from("elders")
        .select("postal_code")
        .eq("id", elderId)
        .maybeSingle(),
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
        .not("ai_summary", "is", null)
        .order("called_at", { ascending: false })
        .limit(3),
    ]);

    const postalCode = elderResult.data?.postal_code || null;
    const meds = medsResult.data || [];
    const memories = memoriesResult.data || [];
    const lastCalls = lastCallsResult.data || [];

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

    const lastCallText = lastCalls.length
      ? lastCalls.map((c: any, i: number) =>
          `${i === 0 ? "Viimeisin" : `Aiempi ${i}`} (${new Date(c.called_at!).toLocaleDateString("fi-FI")}, mieliala ${c.mood_score ?? "?"}/5): ${c.ai_summary}`
        ).join("\n")
      : "Ensimmäinen puhelu — ei aiempaa keskustelua";

    // Fetch weather + pick daily topic in parallel
    const weather = await fetchWeather(postalCode);
    const daily = getDailyTopic();

    const now = new Date().toLocaleString("fi-FI", { timeZone: "Europe/Helsinki" });
    const firstMessage = buildOpeningMessage(elderName, isOutboundCall ? "outbound" : "inbound", weather?.hint);
    const context = buildFullSystemPrompt({
      elder_name: elderName,
      call_type: isOutboundCall ? "scheduled" : "inbound",
      medications_morning: medsMorning,
      medications_noon: medsNoon,
      medications_evening: medsEvening,
      has_dosette: hasDosette ? "kyllä" : "ei",
      reminder_message: "",
      memories: memoryText,
      last_call: lastCallText,
      now,
      direction: callLabel,
      weather: weather?.summary || "Säätietoa ei saatavilla",
      weather_hint: weather?.hint || "",
      daily_topic: daily.topic,
      daily_topic_prompt: daily.prompt,
    });

    console.log(`[vapi-assistant-request] Returning speaking assistant for ${elderName}`);

    return jsonResponse(buildAssistantResponse(firstMessage, context));
  } catch (error) {
    console.error("[vapi-assistant-request] Error:", error);
    return jsonResponse(
      buildAssistantResponse(
        DEFAULT_FIRST_MESSAGE,
        "Puhelun alussa tapahtui tekninen virhe. Tervehdi ystävällisesti suomeksi ja jatka keskustelua normaalisti.",
      ),
    );
  }
});
