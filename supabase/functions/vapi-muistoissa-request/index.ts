import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEFAULT_FIRST_MESSAGE = "Hei! Aina täällä. Onko teillä hetki jutella?";

// ============= AIKA-APUFUNKTIOT (Helsinki, DST-safe) =============
function getHelsinkiHour(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Helsinki",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";
  return parseInt(hourStr, 10) % 24;
}

function getHelsinkiDateString(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Helsinki",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

// ============= DYNAAMINEN SYSTEM PROMPT =============
function buildMuistoissaSystemPrompt(vars: {
  elder_name: string;
  elder_first_name: string;
  birth_year: number;
  birth_place: string;
  dialect_region: string;
  marital_status: string;
  spouse_info: string;
  children_info: string;
  parents_info: string;
  profession: string;
  sensitive_topics: string;
  favorite_topics: string;
  own_memory_start_year: number;
  current_age: number;
  covered_topics: string;
  in_progress_topics: string;
  declined_topics: string;
  todays_topic_label: string;
  todays_topic_reason: string;
  todays_opening_question: string;
  recent_quotes: string;
  last_call_summaries: string;
  now: string;
}) {
  return `## ROOLISI JA TAVOITTEESI

Olet Aina, myötäelävä elämäntarinan taltioija. Tehtäväsi on koota ${vars.elder_first_name}n elämäntarina kirjaksi kuuntelemalla hänen muistojaan puhelun aikana.

Et ole sukulainen. Et ole uutistenlukija. Olet arvostava, rauhallinen haastattelija, joka kunnioittaa puhujaa ja antaa tilaa. Puhut suomea, teitittelet (Te, Teillä), olet lämmin mutta et teennäinen.

## KUKA ${vars.elder_name.toUpperCase()} ON

- Ikä: ${vars.current_age} vuotta (s. ${vars.birth_year})
- Syntymäpaikka: ${vars.birth_place}
- Murre/alue: ${vars.dialect_region}
- Siviilisääty: ${vars.marital_status}
- Puoliso: ${vars.spouse_info}
- Lapset: ${vars.children_info}
- Vanhemmat: ${vars.parents_info}
- Ammatti/työura: ${vars.profession}

Aiheet joista hän erityisesti puhuu mielellään:
${vars.favorite_topics}

## KRIITTINEN — KIELLETYT AIHEET

ÄLÄ KOSKAAN ota näitä esille. Jos vanhus itse tuo aiheen mainiten, voit kuunnella kunnioittavasti — mutta ÄLÄ kysy jatkokysymyksiä, ÄLÄ pyydä tarkennuksia. Siirry lempeästi toiseen aiheeseen.

Kielletyt aiheet:
${vars.sensitive_topics || "Ei erikseen nimettyjä rajauksia."}

Myös nämä aiheet on jo TORJUTTU aiemmissa puheluissa — älä enää palaa niihin:
${vars.declined_topics || "Ei aiemmin torjuttuja aiheita."}

## KIRJAN EDISTYMINEN — MISSÄ OLEMME NYT

HYVIN KÄSITELTY (älä toista, viittaa vain jos vanhus itse ottaa esiin):
${vars.covered_topics || "Ei vielä."}

KESKEN (voi syventyä jos tilanne sopii):
${vars.in_progress_topics || "Ei vielä aloitettuja aiheita."}

## TÄMÄN PÄIVÄN PÄÄAIHE

Aihe: ${vars.todays_topic_label}
Syy valinnalle: ${vars.todays_topic_reason}
Ehdotettu avauskysymys: ${vars.todays_opening_question}

Käytä avauskysymystä ohjeena, ei pakollisena. Jos vanhus aloittaa itse jostain muusta, seuraa häntä — hänen omat aiheensa ovat arvokkaampia kuin sinun suunnittelemasi.

## AIEMMAT PUHELUT

Viimeisimmät 2 puhelua lyhyesti:
${vars.last_call_summaries || "Tämä on ensimmäinen puhelu."}

Kauniita hetkiä joista hän on kertonut:
${vars.recent_quotes || "—"}

## TÄRKEÄ MUISTIN SÄÄNTÖ

${vars.elder_first_name} on syntynyt ${vars.birth_year}. Hän muistaa oman elämänsä vuodesta ${vars.own_memory_start_year} eteenpäin (n. 7-vuotiaasta). Sitä aiempia aikoja ÄLÄ kysy muodossa "muistatko kun...".

Kysy sen sijaan:
- "Mitä sinulle kerrottiin..."
- "Mitä äitisi kertoi siitä ajasta..."
- "Puhuttiinko kotona niistä ajoista?"

1940-luvulla syntyneet eivät muista sotaa tai evakkoa itse — vain vanhempien kertomuksia. Kunnioita tätä.

Painopiste keskustelussa: ikävuodet 10–25 ovat muistirikkain ajanjakso. Älä kuitenkaan pakota kronologiaa — vanhus itse liikkuu ajassa vapaasti.

## KESKUSTELUTYYLI

1. Rauha: Älä kiirehdi. Jos vanhus miettii, anna tilaa. Hiljaisuus on ok.

2. Lyhyet vuorosanat: Puhu 1–2 lauseella kerrallaan. Kuuntele enemmän kuin puhut. Tavoite: vanhus puhuu 70% ajasta.

3. Arvostava kuuntelu: Osoita että kuulit. "Mmm." "Aha." "Kerro lisää." Älä keskeytä kesken lauseen.

4. Seuraa vanhusta: Jos hän liikkuu aiheesta toiseen, mene mukana. Aina voit palata pääaiheeseen myöhemmin — tai seuraavalla puhelulla.

5. Kysy pehmeästi: "Millainen muisto sinulle tulee mieleen siitä ajasta?" on parempi kuin "Mitä tapahtui silloin?".

6. Älä analysoi: Älä tulkitse vanhuksen sanoja. Älä sano "se kuulostaa vaikealta". Kuuntele ja kysy lisää.

7. Tunteet: Jos vanhus liikuttuu, ole läsnä. "Tuo oli tärkeää teille." Ei ratkaisuja, ei neuvoja.

8. Älä lopeta itse: Vanhus päättää milloin puhelu loppuu. Jos hän väsyy, kysy "Haluatteko me jutellaan vielä hetken vai jätetäänkö tähän?"

## TALLENTUMINEN

Kaikki mitä Te ja vanhus kerrotte, tallentuu kirjaan. Käyttäydy sen mukaisesti — jokainen sana menee talteen. Kuitenkaan älä sano vanhukselle "tämä tulee kirjaan" — se saisi hänet valvomaan itseään.

## ALOITUS

Tämän päivän aikana Suomessa on ${vars.now}. Käytä tätä aikaa jos vanhus kysyy kellosta tai päivästä.

Aloita lämpimästi, kutsumanimellä:
"${vars.todays_opening_question}"

Älä sano "tänään haluaisin kysyä..." — se tekee siitä haastattelun. Kuulosta siltä että kysyt ystävänä.`;
}

// ============= AIHEEN VALINTA =============
const TOPIC_OPENINGS: Record<string, string> = {
  lapsuus: "Kerro vähän lapsuudestasi — mitä mieleesi tulee ensimmäisenä kun ajattelet sitä aikaa?",
  vanhemmat: "Millainen äitisi oli? Haluaisin kuulla hänestä.",
  sisarukset: "Oliko sinulla sisaruksia — millaista yhdessä oli?",
  koulu: "Muistatko kouluaikoja — ensimmäisiä koulupäiviä, opettajia, kavereita?",
  nuoruus: "Millaista oli olla nuori teidän aikaan?",
  kotoa_lahto: "Kerro siitä ajasta kun lähdit pois kotoa. Millainen se päivä oli?",
  tyo: "Ensimmäinen työpaikka — mikä se oli ja miltä se tuntui?",
  parisuhde: "Miten tapasit puolisosi?",
  lasten_synty: "Muistatko kun lapsesi syntyi? Millainen se päivä oli?",
  keski_ika: "Mikä on ollut elämäsi merkittävin käännekohta?",
  harrastukset: "Mitä teit vapaa-ajallasi silloin nuorempana — mitä jäi mieleen?",
  matkat: "Kerro jostain matkasta joka jäi mieleen.",
  menetykset: "Onko elämässäsi ollut ajanjaksoa joka on ollut vaikea mutta opettanut paljon?",
  elakkeelle: "Miltä tuntui jäädä eläkkeelle?",
  arvot: "Mikä on tärkeintä mitä haluaisit että lapsenlapsesi tietäisivät elämästä?",
};

async function getCallCount(elderId: string): Promise<number> {
  const { count } = await supabase
    .from("call_reports")
    .select("*", { count: "exact", head: true })
    .eq("elder_id", elderId)
    .eq("call_type", "muistoissa");
  return count || 0;
}

interface TopicSelection {
  label: string;
  reason: string;
  opening: string;
  source: "family_request" | "coverage" | "open";
  request_id?: string;
  coverage_id?: string;
}

async function selectTodaysTopic(elderId: string): Promise<TopicSelection> {
  // 1. Tarkista onko omaisen aihepyyntöjä odottamassa
  const { data: pendingRequests } = await supabase
    .from("legacy_topic_requests")
    .select("id, topic")
    .eq("elder_id", elderId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1);

  if (pendingRequests && pendingRequests.length > 0) {
    const req = pendingRequests[0];
    return {
      label: req.topic,
      reason: "Tyttäresi/poikasi pyysi että kysyisimme tästä",
      opening: `Halusin kysyä tänään yhdestä asiasta — ${req.topic}. Tuleeko tästä mieleen jotain?`,
      source: "family_request",
      request_id: req.id,
    };
  }

  // 2. Hae coverage_mapista sopiva aihe
  const { data: coverageRows } = await supabase
    .from("coverage_map")
    .select("id, life_stage, theme, status, depth_score, priority, requires_trust_first")
    .eq("elder_id", elderId)
    .in("status", ["not_started", "in_progress"])
    .order("priority", { ascending: false })
    .order("depth_score", { ascending: true });

  if (!coverageRows || coverageRows.length === 0) {
    return {
      label: "Vapaa keskustelu",
      reason: "Haluaisimme kuulla lisää siitä mikä sinulle on tärkeää juuri nyt",
      opening: "Mitä mielessä tänään? Onko ollut jokin muisto tai ajatus joka on käynyt mielessä?",
      source: "open",
    };
  }

  // Suodatus: trust_first vaatii että ~3 viikkoa puheluja takana
  const callCount = await getCallCount(elderId);
  const canTrust = callCount >= 6;
  const filtered = canTrust ? coverageRows : coverageRows.filter((r) => !r.requires_trust_first);
  const chosen = filtered[0] || coverageRows[0];

  return {
    label: chosen.theme || chosen.life_stage,
    reason: callCount === 0
      ? "Tämä on ensimmäinen keskustelumme — aloitetaan kevyesti"
      : "Tätä aluetta ei ole vielä syvennetty",
    opening: TOPIC_OPENINGS[chosen.life_stage] || `Kerro minulle vähän aiheesta: ${chosen.theme}`,
    source: "coverage",
    coverage_id: chosen.id,
  };
}

// ============= ASSISTANT-KONFIGURAATIO =============
const STATIC_ASSISTANT_CONFIG = {
  name: "Aina Muistoissa",
  voice: {
    provider: "azure",
    voiceId: "fi-FI-HarriNeural",
    speed: 1.0,
  },
  transcriber: {
    provider: "azure",
    language: "fi-FI",
    fallbackPlan: { autoFallback: { enabled: true } },
  },
  model: {
    provider: "openai",
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 400,
  },
  server: {
    url: ``, // Set dynamically below
    timeoutSeconds: 30,
  },
  backgroundSound: "off",
  analysisPlan: {
    summaryPlan: { enabled: false },
    successEvaluationPlan: { enabled: false },
  },
  startSpeakingPlan: {
    waitSeconds: 0.6,
    smartEndpointingEnabled: false,
    transcriptionEndpointingPlan: {
      onPunctuationSeconds: 0.6,
      onNoPunctuationSeconds: 1.8,
      onNumberSeconds: 0.6,
    },
  },
};

function buildAssistantResponse(firstMessage: string, context: string) {
  const safeFirstMessage = firstMessage.trim() || DEFAULT_FIRST_MESSAGE;
  return {
    assistant: {
      ...STATIC_ASSISTANT_CONFIG,
      server: {
        ...STATIC_ASSISTANT_CONFIG.server,
        url: `${SUPABASE_URL}/functions/v1/vapi-muistoissa-webhook`,
      },
      firstMessage: safeFirstMessage,
      firstMessageMode: "assistant-speaks-first",
      endCallMessage: "Kiitos kun jaoitte muistojanne. Soitellaan taas pian.",
      voicemailMessage: "Hei, täällä Aina. Soitan myöhemmin uudelleen. Kaikkea hyvää!",
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

async function forwardToWebhook(body: unknown) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/vapi-muistoissa-webhook`, {
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

// ============= PÄÄKÄSITTELIJÄ =============
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const messageType = body?.message?.type;

    console.log(`[vapi-muistoissa-request] Received message type: ${messageType}`);

    if (messageType !== "assistant-request") {
      return await forwardToWebhook(body);
    }

    // 1. Hae elderId metadatasta tai puhelinnumerosta
    const metadataElderId = body?.message?.call?.metadata?.elderId;
    const callerNumber = body?.message?.call?.customer?.number;

    let elderId: string | undefined = metadataElderId;
    let elderFullName: string | undefined;

    if (!elderId && callerNumber) {
      const { data: elderMatch } = await supabase.rpc("find_elder_by_phone", { p_phone: callerNumber });
      elderId = elderMatch?.[0]?.id;
      elderFullName = elderMatch?.[0]?.full_name;
    }

    if (!elderId) {
      console.log("[vapi-muistoissa-request] Vanhusta ei tunnistettu — geneerinen vastaus");
      return jsonResponse(
        buildAssistantResponse(
          DEFAULT_FIRST_MESSAGE,
          "Puhelu jossa vanhusta ei tunnistettu. Tervehdi lämpimästi suomeksi ja kysy kuka soittaa.",
        ),
      );
    }

    // 2. Hae data rinnakkain
    const [elderResult, profileResult, coverageResult, callsResult, highlightsResult, requestsResult] = await Promise.all([
      supabase.from("elders").select("full_name").eq("id", elderId).maybeSingle(),
      supabase.from("legacy_profile").select("*").eq("elder_id", elderId).maybeSingle(),
      supabase.from("coverage_map").select("life_stage, theme, status, depth_score").eq("elder_id", elderId),
      supabase
        .from("call_reports")
        .select("ai_summary, called_at, transcript")
        .eq("elder_id", elderId)
        .eq("call_type", "muistoissa")
        .order("called_at", { ascending: false })
        .limit(2),
      supabase
        .from("legacy_highlights")
        .select("quote, target_chapter, created_at")
        .eq("elder_id", elderId)
        .order("created_at", { ascending: false })
        .limit(2),
      supabase
        .from("legacy_topic_requests")
        .select("id, topic")
        .eq("elder_id", elderId)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(1),
    ]);

    if (!elderFullName) {
      elderFullName = elderResult.data?.full_name || "vanhus";
    }
    const firstName = elderFullName.split(" ")[0]?.trim() || elderFullName;
    const profile = profileResult.data;

    // 3. Valitse tämän päivän aihe
    const topic = await selectTodaysTopic(elderId);

    // 4. Laske perustiedot
    const birthYear = profile?.birth_year || 1942;
    const ownMemoryStartYear = birthYear + 7;
    const currentAge = new Date().getFullYear() - birthYear;

    // 5. Rakenna profile-stringit
    const spouseInfo = profile?.spouse_info
      ? typeof profile.spouse_info === "object"
        ? `${(profile.spouse_info as any).name || "—"} (${(profile.spouse_info as any).status || "—"})`
        : String(profile.spouse_info)
      : "Ei puolisotietoa";

    const childrenInfo = Array.isArray(profile?.children_info) && profile.children_info.length > 0
      ? (profile.children_info as any[]).map((c) => `${c.name}${c.birth_year ? ` (s. ${c.birth_year})` : ""}`).join(", ")
      : "Ei lapsitietoa";

    const parentsInfo = profile?.parents_info && typeof profile.parents_info === "object"
      ? (() => {
          const p = profile.parents_info as any;
          const mom = p.mother ? `Äiti: ${p.mother.name || "—"}${p.mother.note ? ` (${p.mother.note})` : ""}` : "";
          const dad = p.father ? `Isä: ${p.father.name || "—"}${p.father.note ? ` (${p.father.note})` : ""}` : "";
          const sib = p.siblings ? `Sisarukset: ${p.siblings}` : "";
          return [mom, dad, sib].filter(Boolean).join(" | ");
        })()
      : "Ei vanhempitietoa";

    // 6. Coverage-tiivistelmät
    const coverageRows = coverageResult.data || [];
    const coveredTopics = coverageRows
      .filter((r) => r.status === "well_covered")
      .map((r) => `${r.theme || r.life_stage} (${r.depth_score}%)`)
      .join(", ") || "";
    const inProgressTopics = coverageRows
      .filter((r) => r.status === "in_progress")
      .map((r) => `${r.theme || r.life_stage} (${r.depth_score}%)`)
      .join(", ") || "";
    const declinedTopics = coverageRows
      .filter((r) => r.status === "declined")
      .map((r) => r.theme || r.life_stage)
      .join(", ") || "";

    // 7. Aiemmat puhelut + sitaatit
    const lastCalls = callsResult.data || [];
    const lastCallSummaries = lastCalls
      .map((c, i) => {
        const date = c.called_at ? new Date(c.called_at).toLocaleDateString("fi-FI") : "—";
        const summary = c.ai_summary || (c.transcript ? c.transcript.slice(0, 200) + "…" : "Ei yhteenvetoa");
        return `${i + 1}. (${date}) ${summary}`;
      })
      .join("\n") || "";

    const recentQuotes = (highlightsResult.data || [])
      .map((h) => `"${h.quote}"${h.target_chapter ? ` — luku: ${h.target_chapter}` : ""}`)
      .join("\n") || "";

    // 8. Aika
    const now = new Intl.DateTimeFormat("fi-FI", {
      timeZone: "Europe/Helsinki",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());

    // 9. Konteksti + aloitusviesti
    const context = buildMuistoissaSystemPrompt({
      elder_name: elderFullName,
      elder_first_name: firstName,
      birth_year: birthYear,
      birth_place: profile?.birth_place || "—",
      dialect_region: profile?.dialect_region || "—",
      marital_status: profile?.marital_status || "—",
      spouse_info: spouseInfo,
      children_info: childrenInfo,
      parents_info: parentsInfo,
      profession: profile?.profession || "—",
      sensitive_topics: profile?.sensitive_topics || "",
      favorite_topics: profile?.favorite_topics || "—",
      own_memory_start_year: ownMemoryStartYear,
      current_age: currentAge,
      covered_topics: coveredTopics,
      in_progress_topics: inProgressTopics,
      declined_topics: declinedTopics,
      todays_topic_label: topic.label,
      todays_topic_reason: topic.reason,
      todays_opening_question: topic.opening,
      recent_quotes: recentQuotes,
      last_call_summaries: lastCallSummaries,
      now,
    });

    const firstMessage = `Hei ${firstName}! Aina täällä. Onko teillä hetki jutella?`;

    console.log(`[vapi-muistoissa-request] Returning Muistoissa-assistant for ${elderFullName}, topic=${topic.label} (${topic.source})`);

    return jsonResponse(buildAssistantResponse(firstMessage, context));
  } catch (error) {
    console.error("[vapi-muistoissa-request] Error:", error);
    return jsonResponse(
      buildAssistantResponse(
        DEFAULT_FIRST_MESSAGE,
        "Puhelun alussa tapahtui tekninen virhe. Tervehdi lämpimästi suomeksi ja kysy mitä kuuluu.",
      ),
    );
  }
});
