import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
// Käytetään Claude Sonnet 4.5 -mallia (Opus 4.7 ei vielä julkaistu yleisesti)
const CLAUDE_PROSE_MODEL = "claude-sonnet-4-5-20250929";

function buildProsePrompt(vars: {
  elder_name: string;
  elder_first_name: string;
  birth_year: number;
  chapter_title: string;
  life_stage: string;
  structured_notes: string;
  profile_summary: string;
  previous_prose: string;
  dialect_region: string;
}): string {
  return `Olet suomalainen kirjailija joka kirjoittaa elämäntarinakirjoja ikäihmisten haastatteluiden pohjalta. Tyylisi on rauhallinen, tarkka ja lämmin — muistuttaa Tove Janssonia tai Arto Paasilinnaa parhaimmillaan.

VANHUS JOSTA KIRJOITAT:
${vars.elder_name} (s. ${vars.birth_year}), kotoisin alueelta jossa murre on ${vars.dialect_region}.

KIRJAILIJAN MUISTIINPANOT VANHUKSESTA:
${vars.profile_summary || "Ei vielä profiilia."}

KIRJOITAT LUKUA: ${vars.chapter_title} (aihe: ${vars.life_stage})

JÄSENNELLYT MUISTIINPANOT TÄSTÄ LUVUSTA:
${vars.structured_notes}

${vars.previous_prose ? `AIEMPI VERSIO TÄSTÄ LUVUSTA (kirjoita kokonaan uudelleen, älä jatka):\n${vars.previous_prose}` : ""}

TYYLIOHJEITA — LUE TARKASTI:

1. ÄÄNI: Kirjoita kolmannessa persoonassa ("${vars.elder_first_name} muisti...", "hän sanoi..."), älä minä-muodossa. Tämä on elämäkerta, ei päiväkirja.

2. SUORAT SITAATIT: Säilytä muistiinpanoissa olevat suorat sitaatit sellaisenaan, lainausmerkeissä. Ne ovat kirjan parhaita kohtia.

3. TARKKUUS: Käytä vain sitä mitä muistiinpanoissa on. Älä keksi yksityiskohtia, tunteita, tapahtumia tai dialogia joita ei ole mainittu.

4. YKSITYISKOHDAT ELÄVÄT: Jos muistiinpanoissa mainitaan "ruskea pahvinen matkalaukku" tai "sata markkaa", käytä näitä täsmällisiä sanoja. Konkreettiset esineet tekevät tekstistä elävän.

5. RAUHA: Älä kirjoita liian tiivistä. Pieni hengähdys, pieni tauko, kuvailu. Suomalainen elämäkerta ei kiirehdi.

6. AJAT JA PAIKAT: Mainitse vuodet ja paikat luontevasti. "Keväällä 1962" eikä "silloin joskus". "Tähtitorninkadulla" eikä "eräässä talossa".

7. VAROVAISUUS HERKISSÄ ASIOISSA: Jos profiilimuistiinpanoissa on herkät alueet tai jokin aihe on torjuttu, ÄLÄ käsittele sitä tässä luvussa edes viittauksena.

8. EI IMELÄÄ: Älä kirjoita ylistävästi. Ei "hän oli lämmin ja ihana ihminen" -tyylistä. Anna tekojen ja yksityiskohtien puhua. Suomalainen tyyli.

9. LÄMPÖ TULEE HIDASTUKSESTA: Kun kirjoitat tärkeistä hetkistä, hidastu. Laita enemmän yksityiskohtia, enemmän aistimuksia. Älä selitä tunteita, anna niiden syntyä lukijassa.

10. LUVUN MITTA: Tavoite on 400-800 sanaa. Jos muistiinpanoja on vähän, kirjoita lyhyempi luku. Älä venytä tyhjää.

RAKENNE:

Aloita vahvasti — yhdellä lauseella joka sijoittaa lukijan aikaan ja paikkaan.

Kirjoita 3-6 kappaletta. Jaa kappaleet luontevasti: yksi kappale = yksi hetki tai ajatus.

Lopeta hiljentymiseen, yksityiskohtaan tai ajatelmaan joka jää soimaan. Älä tee yhteenvetoa.

KIRJOITA NYT KOKONAINEN LUKU. Vastaa VAIN kirjoituksella — ei otsikkoa, ei selitystä, ei "Tässä on luku:" -tyylistä alkua. Pelkkää proosaa joka alkaa heti ja päättyy viimeiseen kappaleeseen.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!ANTHROPIC_API_KEY) {
    return jsonError("ANTHROPIC_API_KEY puuttuu Supabasen ympäristömuuttujista.", 500);
  }

  try {
    const body = await req.json();
    const chapterId = body.chapter_id;

    if (!chapterId) {
      return jsonError("chapter_id puuttuu", 400);
    }

    console.log(`[muistoissa-generate-chapter] Generating prose for chapter ${chapterId}`);

    const { data: chapter, error: chapterErr } = await supabase
      .from("book_chapters")
      .select("*")
      .eq("id", chapterId)
      .single();

    if (chapterErr || !chapter) {
      return jsonError("Lukua ei löydy", 404);
    }

    // Lue muistiinpanot chapter_notes-taulusta (uusi arkkitehtuuri)
    const { data: notes, error: notesErr } = await supabase
      .from("chapter_notes")
      .select("*")
      .eq("elder_id", chapter.elder_id)
      .eq("life_stage", chapter.life_stage)
      .maybeSingle();

    if (notesErr) {
      return jsonError(`Muistiinpanojen luku epäonnistui: ${notesErr.message}`, 500);
    }

    if (!notes || !notes.notes_markdown || notes.notes_markdown.length < 100) {
      return jsonError(
        "Luvusta ei ole tarpeeksi muistiinpanoja kirjoitettavaksi. Käsittele ensin puheluja.",
        400,
      );
    }

    const elderId = chapter.elder_id;

    const [elderRes, profileRes, legacyProfileRes] = await Promise.all([
      supabase.from("elders").select("full_name").eq("id", elderId).single(),
      supabase.from("profile_summary").select("*").eq("elder_id", elderId).maybeSingle(),
      supabase.from("legacy_profile").select("birth_year, dialect_region").eq("elder_id", elderId).maybeSingle(),
    ]);

    if (!elderRes.data) return jsonError("Vanhusta ei löydy", 404);

    const elderName = elderRes.data.full_name;
    const elderFirstName = elderName.split(" ")[0];
    const birthYear = legacyProfileRes.data?.birth_year || 1945;
    const dialectRegion = legacyProfileRes.data?.dialect_region || "yleiskieli";
    const profile = profileRes.data;

    const profileNotes = profile
      ? [
          profile.personality_notes && `Persoonallisuus: ${profile.personality_notes}`,
          profile.speaking_style && `Puhetyyli: ${profile.speaking_style}`,
          profile.recurring_people && `Toistuvat henkilöt: ${profile.recurring_people}`,
          profile.sensitive_areas_learned && `Herkät alueet: ${profile.sensitive_areas_learned}`,
        ].filter(Boolean).join("\n")
      : "Ei vielä profiilia.";

    // Muistiinpanot tulevat omasta taulustaan; previous_prose on aiempi proosa book_chapters-kentästä
    const structuredNotes = notes.notes_markdown;
    const previousProse = chapter.content_markdown && chapter.content_markdown.length > 100
      ? chapter.content_markdown
      : "";

    const prompt = buildProsePrompt({
      elder_name: elderName,
      elder_first_name: elderFirstName,
      birth_year: birthYear,
      chapter_title: chapter.title,
      life_stage: chapter.life_stage,
      structured_notes: structuredNotes,
      profile_summary: profileNotes,
      previous_prose: previousProse,
      dialect_region: dialectRegion,
    });

    console.log(`[muistoissa-generate-chapter] Calling Claude for "${chapter.title}"`);

    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_PROSE_MODEL,
        max_tokens: 3000,
        temperature: 0.7,
        messages: [
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error("[muistoissa-generate-chapter] Claude API error:", errText);
      return jsonError(`Claude API -virhe: ${errText}`, 500);
    }

    const claudeData = await claudeResponse.json();
    const proseText = claudeData.content[0].text.trim();
    const wordCount = proseText.split(/\s+/).filter((w: string) => w.length > 0).length;

    console.log(`[muistoissa-generate-chapter] Generated ${wordCount} words`);

    // Tallenna aiempi proosa historiaan ennen ylikirjoitusta (jos sellainen oli)
    if (chapter.content_markdown && chapter.content_markdown.length > 100) {
      await supabase.from("chapter_revisions").insert({
        chapter_id: chapter.id,
        content_markdown: chapter.content_markdown,
        word_count: chapter.word_count,
        ai_model_used: "previous-prose",
        prompt_version: "3c-prose",
        change_reason: "Ennen proosan uudelleenkirjoitusta",
        created_by_ai: false,
      });
    }

    const now = new Date().toISOString();
    const newVersion = (chapter.version || 1) + 1;

    await supabase
      .from("book_chapters")
      .update({
        content_markdown: proseText,
        word_count: wordCount,
        status: "draft",
        version: newVersion,
        last_generated_at: now,
        prose_generated_at: now,
        prose_source_notes_version: notes.word_count,
      })
      .eq("id", chapter.id);

    // Tallenna uusi proosaversio historiaan jäljitettävyyden vuoksi
    await supabase.from("chapter_revisions").insert({
      chapter_id: chapter.id,
      content_markdown: proseText,
      word_count: wordCount,
      ai_model_used: CLAUDE_PROSE_MODEL,
      prompt_version: "3c-prose",
      change_reason: "Proosa kirjoitettu muistiinpanoista",
      created_by_ai: true,
    });

    const inputTokens = claudeData.usage?.input_tokens || 0;
    const outputTokens = claudeData.usage?.output_tokens || 0;
    // Sonnet 4.5 hinnoittelu: $3/M input, $15/M output
    const estimatedCost = (inputTokens * 3 + outputTokens * 15) / 1_000_000;

    console.log(`[muistoissa-generate-chapter] Done. Tokens: ${inputTokens} in, ${outputTokens} out, cost ~$${estimatedCost.toFixed(4)}`);

    return new Response(JSON.stringify({
      success: true,
      chapter_id: chapter.id,
      word_count: wordCount,
      version: newVersion,
      tokens: { input: inputTokens, output: outputTokens },
      estimated_cost_usd: estimatedCost,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[muistoissa-generate-chapter] Error:", err);
    return jsonError(String(err), 500);
  }
});

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
