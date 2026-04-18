import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

// ============= SAMA SYSTEM PROMPT KUIN VAPI-MUISTOISSA-REQUEST =============
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
4. Seuraa vanhusta: Jos hän liikkuu aiheesta toiseen, mene mukana.
5. Kysy pehmeästi: "Millainen muisto sinulle tulee mieleen siitä ajasta?" on parempi kuin "Mitä tapahtui silloin?".
6. Älä analysoi: Älä tulkitse vanhuksen sanoja. Kuuntele ja kysy lisää.
7. Tunteet: Jos vanhus liikuttuu, ole läsnä. "Tuo oli tärkeää teille."
8. Älä lopeta itse: Vanhus päättää milloin puhelu loppuu.

## ALOITUS

Tämän päivän aikana Suomessa on ${vars.now}.`;
}

// ============= AIHEEN VALINTA (SAMA KUIN VAPI) =============
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

interface TopicSelection {
  label: string;
  reason: string;
  opening: string;
  source: "family_request" | "coverage" | "open";
}

async function selectTodaysTopic(elderId: string): Promise<TopicSelection> {
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
      reason: "Omainen pyysi että kysyisimme tästä",
      opening: `Halusin kysyä tänään yhdestä asiasta — ${req.topic}. Tuleeko tästä mieleen jotain?`,
      source: "family_request",
    };
  }

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
      reason: "Kaikki aiheet on jo käsitelty hyvin",
      opening: "Mitä mielessä tänään? Onko ollut jokin muisto tai ajatus joka on käynyt mielessä?",
      source: "open",
    };
  }

  const { count: callCount } = await supabase
    .from("call_reports")
    .select("*", { count: "exact", head: true })
    .eq("elder_id", elderId)
    .in("call_type", ["muistoissa", "test_chat"]);

  const canTrust = (callCount || 0) >= 6;
  const filtered = canTrust ? coverageRows : coverageRows.filter((r) => !r.requires_trust_first);
  const chosen = filtered[0] || coverageRows[0];

  return {
    label: chosen.theme || chosen.life_stage,
    reason: (callCount || 0) === 0
      ? "Ensimmäinen keskustelu — aloitetaan kevyesti"
      : "Tätä aluetta ei ole vielä syvennetty",
    opening: TOPIC_OPENINGS[chosen.life_stage] || `Kerro minulle vähän aiheesta: ${chosen.theme}`,
    source: "coverage",
  };
}

// ============= PÄÄKÄSITTELIJÄ =============
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { elderId, messages } = await req.json();

    if (!elderId || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "elderId ja messages vaaditaan" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Hae data rinnakkain
    const [elderResult, profileResult, coverageResult, callsResult, highlightsResult] = await Promise.all([
      supabase.from("elders").select("full_name").eq("id", elderId).maybeSingle(),
      supabase.from("legacy_profile").select("*").eq("elder_id", elderId).maybeSingle(),
      supabase.from("coverage_map").select("life_stage, theme, status, depth_score").eq("elder_id", elderId),
      supabase
        .from("call_reports")
        .select("ai_summary, called_at, transcript")
        .eq("elder_id", elderId)
        .in("call_type", ["muistoissa", "test_chat"])
        .order("called_at", { ascending: false })
        .limit(2),
      supabase
        .from("legacy_highlights")
        .select("quote, created_at")
        .eq("elder_id", elderId)
        .order("created_at", { ascending: false })
        .limit(2),
    ]);

    const elderFullName = elderResult.data?.full_name || "Vanhus";
    const firstName = elderFullName.split(" ")[0]?.trim() || elderFullName;
    const profile = profileResult.data;

    const topic = await selectTodaysTopic(elderId);

    const birthYear = profile?.birth_year || 1942;
    const ownMemoryStartYear = birthYear + 7;
    const currentAge = new Date().getFullYear() - birthYear;

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
          const mom = p.mother ? `Äiti: ${p.mother.name || "—"}` : "";
          const dad = p.father ? `Isä: ${p.father.name || "—"}` : "";
          return [mom, dad].filter(Boolean).join(" | ");
        })()
      : "Ei vanhempitietoa";

    const coverageRows = coverageResult.data || [];
    const coveredTopics = coverageRows
      .filter((r) => r.status === "well_covered")
      .map((r) => `${r.theme || r.life_stage} (${r.depth_score}%)`)
      .join(", ");
    const inProgressTopics = coverageRows
      .filter((r) => r.status === "in_progress")
      .map((r) => `${r.theme || r.life_stage} (${r.depth_score}%)`)
      .join(", ");
    const declinedTopics = coverageRows
      .filter((r) => r.status === "declined")
      .map((r) => r.theme || r.life_stage)
      .join(", ");

    const lastCalls = callsResult.data || [];
    const lastCallSummaries = lastCalls
      .map((c, i) => {
        const date = c.called_at ? new Date(c.called_at).toLocaleDateString("fi-FI") : "—";
        const summary = c.ai_summary || (c.transcript ? c.transcript.slice(0, 200) + "…" : "Ei yhteenvetoa");
        return `${i + 1}. (${date}) ${summary}`;
      })
      .join("\n");

    const recentQuotes = (highlightsResult.data || [])
      .map((h, i) => `${i + 1}. "${h.quote}"`)
      .join("\n");

    const systemPrompt = buildMuistoissaSystemPrompt({
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
      now: new Date().toLocaleString("fi-FI", { timeZone: "Europe/Helsinki" }),
    });

    // Kutsu Lovable AI Gateway
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0.7,
        max_tokens: 400,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[test-chat-reply] AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Liikaa pyyntöjä — odota hetki ja yritä uudelleen." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Lovable AI -krediitit loppu. Lisää krediittejä Settings > Workspace > Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content || "(ei vastausta)";

    return new Response(
      JSON.stringify({
        reply,
        topic: {
          label: topic.label,
          reason: topic.reason,
          source: topic.source,
        },
        debug: {
          coveredTopics,
          inProgressTopics,
          declinedTopics,
          sensitiveTopics: profile?.sensitive_topics || "",
          systemPromptPreview: systemPrompt.slice(0, 800),
          fullSystemPrompt: systemPrompt,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[test-chat-reply] Error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
