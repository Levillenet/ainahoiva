import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

function buildAnalysisPrompt(vars: {
  elder_name: string;
  birth_year: number;
  profile_notes: string;
  existing_chapters: string;
  transcript: string;
}): string {
  return `Olet Aina Muistoissa -palvelun kirjailija-assistentti. Tehtäväsi on analysoida yksi puhelu vanhuksen ja haastattelijan välillä, ja lisätä tiedot vanhuksen elämäntarinakirjaan jäsennellysti.

VANHUS: ${vars.elder_name} (s. ${vars.birth_year})

VANHUKSEN PROFIILI (aiemmat havainnot):
${vars.profile_notes || "Ei aiempia havaintoja."}

KIRJAN NYKYTILA:
${vars.existing_chapters}

PUHELUN TRANSKRIPTI:
${vars.transcript}

TEHTÄVÄSI:

1. Lue transkripti ja tunnista mistä aiheista keskusteltiin.

2. Jokaiselle aiheelle määritä mihin kirjan lukuun se kuuluu. Luvut ovat:
   - lapsuus, vanhemmat, sisarukset, koulu, nuoruus, kotoa_lahto
   - tyo, parisuhde, lasten_synty, keski_ika
   - harrastukset, matkat, menetykset, elakkeelle, arvot

3. Kirjoita jokaiselle käsitellylle luvulle JÄSENNELLYT MUISTIINPANOT (ei valmista proosaa — se kirjoitetaan myöhemmin). Muistiinpanot sisältävät:
   - FAKTOJA: päivämäärät, paikat, nimet, ammatit
   - ANEKDOOTTEJA: yksittäiset tapahtumat tai hetket
   - TUNNELMIA: mitä vanhus koki
   - SUORIA SITAATTEJA: jos vanhus sanoi jotain erityisen kuvaavaa

Älä keksi mitään. Käytä VAIN sitä mitä transkriptissä sanottiin.

4. Jos luvussa on jo aiempaa sisältöä, LISÄÄ uudet tiedot sen jatkoksi — älä korvaa vanhaa.

5. Päivitä myös kirjailijan profiilimuistiinpanot: mitä opimme tänään vanhuksesta persoonallisuutena, puhetyylinä, toistuvat teemat, mainitut henkilöt, herkät alueet.

VASTAA TÄSSÄ TÄSMÄLLISESSÄ JSON-MUODOSSA (älä mitään muuta, ei selityksiä):

{
  "chapter_updates": [
    {
      "life_stage": "kotoa_lahto",
      "notes_to_add": "FAKTOJA:\\n- Muutti Helsinkiin 1962 toukokuussa\\n- Matkusti junalla Viipurin asemalta\\n\\nANEKDOOTTEJA:\\n- Äiti itki aamulla keittiössä\\n\\nTUNNELMIA:\\n- Pelkoa ja odotusta yhtä aikaa\\n\\nSUORIA SITAATTEJA:\\n- 'Matkalaukku pysyi mun jalkojen välissä koko matkan'",
      "confidence": "high"
    }
  ],
  "profile_updates": {
    "personality_notes_addition": "Pysyy rauhallisena vaikeistakin aiheista puhuessaan.",
    "speaking_style_addition": "Käyttää sanaa 'justhiin' täytesanana.",
    "new_recurring_people": "Liisa (Ylihärmä, ompelukoulun tuttava)",
    "new_sensitive_areas": "Ei tuonut esiin Eino-veljeä vaikka sisaruksista puhuttiin."
  },
  "call_summary": "Puhelussa Ritva kertoi ensimmäistä kertaa yksityiskohtaisesti kotoa lähdöstään 1962.",
  "topics_covered_in_call": ["kotoa_lahto"],
  "topics_mentioned_briefly": ["sisarukset", "vanhemmat"],
  "highlights": [
    {
      "quote": "Suora sitaatti vanhukselta — yksi kaunis tai liikuttava lause sellaisenaan.",
      "context": "Lyhyt selitys mistä puhuttiin kun lause sanottiin.",
      "target_chapter": "kotoa_lahto"
    }
  ],
  "observations": [
    {
      "type": "milestone",
      "title": "Lyhyt otsikko",
      "description": "Tarkempi selitys mitä havaittiin tässä puhelussa."
    }
  ]
}

Tärkeät säännöt:
- Käytä notes_to_add kentässä \\n merkintöjä rivinvaihtoihin.
- Älä keksi faktoja, vain siteeraa transkriptiä.
- Jos transkriptiä on vähän tai aihetta ei käsitelty syvästi, chapter_updates voi olla tyhjä taulukko.
- confidence on "high" jos aihe käsiteltiin selkeästi, "medium" jos vihjeitä, "low" jos vain ohimennen.
- highlights: poimi 1–3 erityisen kaunista, liikuttavaa tai paljastavaa SUORAA SITAATTIA vanhukselta. Jos puhelu oli pinnallinen, palauta tyhjä taulukko. Älä keksi sitaatteja — vain todelliset rivit transkriptistä.
- observations: lisää 0–2 huomiota omaiselle. Tyypit: "milestone" (uusi luku alkoi tms.), "sensitive_topic" (vanhus vältti aihetta), "boundary_respected" (Aina kunnioitti rajaa), "suggestion" (ehdotus omaiselle). Vain jos jotain todella merkityksellistä tapahtui.
- Kaikki teksti suomeksi.`;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      return jsonError(
        "ANTHROPIC_API_KEY puuttuu Lovable Cloud -ympäristömuuttujista. Lisää se Edge Functions -secrettien joukkoon.",
        500,
      );
    }

    const body = await req.json();
    const callReportId = body?.call_report_id;

    if (!callReportId) {
      return jsonError("call_report_id puuttuu", 400);
    }

    console.log(`[muistoissa-process-call] Processing call ${callReportId}`);

    const { data: callReport, error: callErr } = await supabase
      .from("call_reports")
      .select("*")
      .eq("id", callReportId)
      .single();

    if (callErr || !callReport) {
      return jsonError("Puhelua ei löydy", 404);
    }

    if (callReport.call_type !== "muistoissa") {
      return jsonError("Tämä ei ole Muistoissa-puhelu", 400);
    }

    if (!callReport.transcript || callReport.transcript.length < 100) {
      return jsonError("Transkripti on liian lyhyt tai puuttuu", 400);
    }

    const elderId = callReport.elder_id;

    const [elderRes, profileRes, chaptersRes, legacyProfileRes] = await Promise.all([
      supabase.from("elders").select("full_name").eq("id", elderId).single(),
      supabase.from("profile_summary").select("*").eq("elder_id", elderId).maybeSingle(),
      supabase
        .from("book_chapters")
        .select("*")
        .eq("elder_id", elderId)
        .order("chapter_number"),
      supabase.from("legacy_profile").select("birth_year").eq("elder_id", elderId).maybeSingle(),
    ]);

    if (!elderRes.data) return jsonError("Vanhusta ei löydy", 404);

    const elderName = elderRes.data.full_name;
    const birthYear = legacyProfileRes.data?.birth_year || 1945;
    const profile = profileRes.data;
    const chapters = chaptersRes.data || [];

    const profileNotes = profile
      ? `Persoonallisuus: ${profile.personality_notes || "—"}\nPuhetyyli: ${profile.speaking_style || "—"}\nKantavat teemat: ${profile.key_themes || "—"}\nToistuvat henkilöt: ${profile.recurring_people || "—"}\nHerkät alueet: ${profile.sensitive_areas_learned || "—"}`
      : "Ei aiempaa profiilia.";

    const chaptersText = chapters
      .map((c: any) => {
        const preview = c.content_markdown
          ? c.content_markdown.slice(0, 300) + (c.content_markdown.length > 300 ? "..." : "")
          : "(tyhjä)";
        return `### ${c.title} (${c.life_stage}) — status: ${c.status}\n${preview}`;
      })
      .join("\n\n");

    const analysisPrompt = buildAnalysisPrompt({
      elder_name: elderName,
      birth_year: birthYear,
      profile_notes: profileNotes,
      existing_chapters: chaptersText,
      transcript: callReport.transcript,
    });

    console.log(`[muistoissa-process-call] Calling Claude Haiku for elder ${elderName}`);

    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 4000,
        messages: [{ role: "user", content: analysisPrompt }],
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error("[muistoissa-process-call] Claude API error:", errText);
      return jsonError(`Claude API -virhe: ${errText}`, 500);
    }

    const claudeData = await claudeResponse.json();
    const responseText = claudeData?.content?.[0]?.text ?? "";

    let analysis: any;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      analysis = JSON.parse(jsonMatch[0]);
    } catch (_e) {
      console.error("[muistoissa-process-call] JSON parse failed:", responseText);
      return jsonError("Claude palautti virheellisen JSON:n", 500);
    }

    console.log(
      `[muistoissa-process-call] Analysis parsed, updating ${analysis.chapter_updates?.length || 0} chapters`,
    );

    const now = new Date().toISOString();
    let chaptersUpdated = 0;

    for (const update of analysis.chapter_updates || []) {
      const existingChapter = chapters.find((c: any) => c.life_stage === update.life_stage);
      if (!existingChapter) continue;

      // Lue olemassa olevat muistiinpanot chapter_notes-taulusta (ei book_chapters!)
      const { data: existingNotes } = await supabase
        .from("chapter_notes")
        .select("*")
        .eq("elder_id", elderId)
        .eq("life_stage", update.life_stage)
        .maybeSingle();

      const currentNotes = existingNotes?.notes_markdown || "";
      const newNotesContent = currentNotes
        ? `${currentNotes}\n\n---\n\n${update.notes_to_add}`
        : update.notes_to_add;

      const newWordCount = countWords(newNotesContent);

      if (existingNotes) {
        await supabase
          .from("chapter_notes")
          .update({
            notes_markdown: newNotesContent,
            word_count: newWordCount,
            last_updated_at: now,
            chapter_id: existingChapter.id,
          })
          .eq("id", existingNotes.id);
      } else {
        await supabase
          .from("chapter_notes")
          .insert({
            elder_id: elderId,
            life_stage: update.life_stage,
            chapter_id: existingChapter.id,
            notes_markdown: newNotesContent,
            word_count: newWordCount,
            last_updated_at: now,
          });
      }

      // Merkitse luku draft-tilaan kun siihen tulee ensimmäiset muistiinpanot
      if (existingChapter.status === "empty") {
        await supabase
          .from("book_chapters")
          .update({ status: "draft" })
          .eq("id", existingChapter.id);
      }

      chaptersUpdated++;
    }

    if (analysis.profile_updates) {
      const upd = analysis.profile_updates;
      const currentProfile = profile || {
        personality_notes: "",
        speaking_style: "",
        key_themes: "",
        recurring_people: "",
        sensitive_areas_learned: "",
      };

      const appendIfNew = (existing: string, addition: string): string => {
        if (!addition) return existing;
        if (existing && existing.includes(addition.slice(0, 30))) return existing;
        return existing ? `${existing} ${addition}` : addition;
      };

      await supabase.from("profile_summary").upsert(
        {
          elder_id: elderId,
          personality_notes: appendIfNew(
            currentProfile.personality_notes || "",
            upd.personality_notes_addition || "",
          ),
          speaking_style: appendIfNew(
            currentProfile.speaking_style || "",
            upd.speaking_style_addition || "",
          ),
          recurring_people: appendIfNew(
            currentProfile.recurring_people || "",
            upd.new_recurring_people || "",
          ),
          sensitive_areas_learned: appendIfNew(
            currentProfile.sensitive_areas_learned || "",
            upd.new_sensitive_areas || "",
          ),
          key_themes: currentProfile.key_themes || "",
          last_updated: now,
        },
        { onConflict: "elder_id" },
      );
    }

    await supabase
      .from("call_reports")
      .update({
        ai_summary: analysis.call_summary || "Puhelu käsitelty.",
        processed_at: now,
      })
      .eq("id", callReportId);

    // Päivitä coverage_map jotta kirjailija-AI tietää mistä on jo puhuttu
    // ja seuraava puhelu osaa siirtyä uuteen aiheeseen.
    const coveredDeep: string[] = analysis.topics_covered_in_call || [];
    const coveredBriefly: string[] = analysis.topics_mentioned_briefly || [];

    // Hae nykyiset coverage-rivit jotta voimme inkrementoida depth_scorea
    const { data: existingCoverage } = await supabase
      .from("coverage_map")
      .select("id, life_stage, depth_score, status, questions_asked")
      .eq("elder_id", elderId)
      .in("life_stage", [...coveredDeep, ...coveredBriefly]);

    const coverageByStage = new Map(
      (existingCoverage || []).map((r: any) => [r.life_stage, r]),
    );

    for (const stage of coveredDeep) {
      const row = coverageByStage.get(stage);
      // Maltillisempi inkrementti: 15% per syvä keskustelu (ennen 30%)
      const newDepth = Math.min(100, (row?.depth_score || 0) + 15);
      const newStatus = newDepth >= 70 ? "well_covered" : "in_progress";
      if (row) {
        await supabase
          .from("coverage_map")
          .update({
            depth_score: newDepth,
            status: newStatus,
            last_discussed: now,
            questions_asked: (row.questions_asked || 0) + 1,
          })
          .eq("id", row.id);
      } else {
        await supabase.from("coverage_map").insert({
          elder_id: elderId,
          life_stage: stage,
          theme: stage,
          depth_score: newDepth,
          status: newStatus,
          last_discussed: now,
          questions_asked: 1,
          priority: 5,
        });
      }
    }

    for (const stage of coveredBriefly) {
      if (coveredDeep.includes(stage)) continue;
      const row = coverageByStage.get(stage);
      // Vain 5% kevyestä maininnasta (ennen 10%)
      const newDepth = Math.min(100, (row?.depth_score || 0) + 5);
      const newStatus = newDepth >= 70 ? "well_covered" : "in_progress";
      if (row) {
        await supabase
          .from("coverage_map")
          .update({
            depth_score: newDepth,
            status: newStatus,
            last_discussed: now,
            questions_asked: (row.questions_asked || 0) + 1,
          })
          .eq("id", row.id);
      } else {
        await supabase.from("coverage_map").insert({
          elder_id: elderId,
          life_stage: stage,
          theme: stage,
          depth_score: newDepth,
          status: newStatus,
          last_discussed: now,
          questions_asked: 1,
          priority: 5,
        });
      }
    }

    // Tallenna arvokkaat hetket (highlights) ja huomiot (observations)
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    let highlightsSaved = 0;
    for (const hl of analysis.highlights || []) {
      if (!hl?.quote || hl.quote.length < 10) continue;
      const { error: hlErr } = await supabase.from("legacy_highlights").insert({
        elder_id: elderId,
        week_start: weekStartStr,
        quote: hl.quote,
        context: hl.context || null,
        target_chapter: hl.target_chapter || null,
      });
      if (!hlErr) highlightsSaved++;
    }

    let observationsSaved = 0;
    for (const obs of analysis.observations || []) {
      if (!obs?.title) continue;
      const { error: obsErr } = await supabase.from("legacy_observations").insert({
        elder_id: elderId,
        type: obs.type || "suggestion",
        title: obs.title,
        description: obs.description || null,
        read_by_family: false,
      });
      if (!obsErr) observationsSaved++;
    }

    console.log(
      `[muistoissa-process-call] Done. ${chaptersUpdated} chapters, ${highlightsSaved} highlights, ${observationsSaved} observations, coverage: deep=[${coveredDeep.join(",")}] brief=[${coveredBriefly.join(",")}]`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        chapters_updated: chaptersUpdated,
        highlights_saved: highlightsSaved,
        observations_saved: observationsSaved,
        topics_covered: analysis.topics_covered_in_call || [],
        summary: analysis.call_summary,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[muistoissa-process-call] Error:", err);
    return jsonError(String(err), 500);
  }
});
