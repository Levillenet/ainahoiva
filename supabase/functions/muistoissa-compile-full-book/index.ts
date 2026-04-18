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
const CLAUDE_OPUS_MODEL = "claude-opus-4-7";

function buildFullBookPrompt(vars: {
  elder_name: string;
  elder_first_name: string;
  birth_year: number;
  dialect_region: string;
  profile_summary: string;
  chapters_with_notes: Array<{
    chapter_number: number;
    life_stage: string;
    title: string;
    notes: string;
    has_content: boolean;
  }>;
}): string {
  const chapterBlocks = vars.chapters_with_notes
    .filter((c) => c.has_content)
    .map(
      (c) => `## LUKU ${c.chapter_number}: ${c.title}

Life stage: ${c.life_stage}

Muistiinpanot:
${c.notes}`,
    )
    .join("\n\n---\n\n");

  const emptyChapters = vars.chapters_with_notes
    .filter((c) => !c.has_content)
    .map((c) => `Luku ${c.chapter_number}: ${c.title}`)
    .join(", ");

  return `Olet suomalainen kirjailija joka kirjoittaa elämäntarinakirjoja ikäihmisten haastatteluiden pohjalta. Kirjoitat nyt KOKO KIRJAN ${vars.elder_name}sta yhdessä istunnossa. Tämä on tärkeää koska kirjan tyyliyhtenäisyys säilyy kun kaikki luvut generoituvat samassa prosessissa.

VANHUKSESTA:
${vars.elder_name} (s. ${vars.birth_year}), kotoisin alueelta jossa murre on ${vars.dialect_region}.

KIRJAILIJAN MUISTIINPANOT VANHUKSESTA:
${vars.profile_summary || "Ei vielä profiilia."}

LUVUT JOISSA ON MUISTIINPANOJA — KIRJOITETTAVAT:
${chapterBlocks}

LUVUT JOTKA OVAT VIELÄ TYHJIÄ (jätä ne kirjoittamatta):
${emptyChapters || "(ei tyhjiä lukuja)"}

TYYLIOHJEITA — LUE TARKASTI:

1. ÄÄNI: Kirjoita kolmannessa persoonassa ("${vars.elder_first_name} muisti...", "hän sanoi..."), älä minä-muodossa.

2. ETUNIMI: Käytä AINOASTAAN nimeä "${vars.elder_first_name}". Jos nimi puuttuu, käytä pronomineja. ÄLÄ KOSKAAN keksi nimeä.

3. SUORAT SITAATIT: Säilytä muistiinpanojen suorat sitaatit sellaisenaan, lainausmerkeissä.

4. TARKKUUS: Käytä vain sitä mitä muistiinpanoissa on. Älä keksi.

5. JOHDONMUKAISUUS LUKUJEN VÄLILLÄ: Tarkista että et väitä luvussa asiaa joka on ristiriidassa toisen luvun muistiinpanojen kanssa. Tarkista ennen jokaista absoluuttista väitettä ("aina", "koskaan").

6. VÄLTÄ LIIAN VAHVOJA YLEISTYKSIÄ.

7. RAUHA: Suomalainen elämäkerta ei kiirehdi.

8. AJAT JA PAIKAT: "Keväällä 1962" eikä "silloin joskus".

9. VAROVAISUUS HERKISSÄ ASIOISSA.

10. EI IMELÄÄ: Anna tekojen puhua.

11. LUVUN MITTA: 400-800 sanaa per luku.

VASTAUSMUOTO — TARKASTI TÄMÄ JSON (ei mitään ennen tai jälkeen):

{
  "chapters": [
    {
      "life_stage": "lapsuus",
      "prose": "Koko luvun proosa, kappaleet erotettu \\n\\n merkillä."
    }
  ],
  "consistency_notes": "Lyhyt huomio johdonmukaisuuden tarkistuksesta."
}

Älä sisällytä tyhjiä lukuja chapters-taulukkoon.`;
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

  if (!ANTHROPIC_API_KEY) {
    return jsonError("ANTHROPIC_API_KEY puuttuu Supabasen ympäristömuuttujista.", 500);
  }

  try {
    const body = await req.json();
    const elderId = body.elder_id;

    if (!elderId) {
      return jsonError("elder_id puuttuu", 400);
    }

    console.log(`[compile-full-book] Compiling full book for elder ${elderId}`);

    const [elderRes, profileRes, legacyProfileRes, chaptersRes, notesRes] = await Promise.all([
      supabase.from("elders").select("full_name").eq("id", elderId).single(),
      supabase.from("profile_summary").select("*").eq("elder_id", elderId).maybeSingle(),
      supabase.from("legacy_profile").select("birth_year, dialect_region").eq("elder_id", elderId).maybeSingle(),
      supabase.from("book_chapters").select("*").eq("elder_id", elderId).order("chapter_number"),
      supabase.from("chapter_notes").select("*").eq("elder_id", elderId),
    ]);

    if (!elderRes.data) return jsonError("Vanhusta ei löydy", 404);

    const elderName = elderRes.data.full_name;
    const elderFirstName = elderName.split(" ")[0];
    const birthYear = legacyProfileRes.data?.birth_year || 1945;
    const dialectRegion = legacyProfileRes.data?.dialect_region || "yleiskieli";
    const profile = profileRes.data;
    const chapters = chaptersRes.data || [];
    const allNotes = notesRes.data || [];

    const profileNotes = profile
      ? [
          profile.personality_notes && `Persoonallisuus: ${profile.personality_notes}`,
          profile.speaking_style && `Puhetyyli: ${profile.speaking_style}`,
          profile.recurring_people && `Toistuvat henkilöt: ${profile.recurring_people}`,
          profile.sensitive_areas_learned && `Herkät alueet: ${profile.sensitive_areas_learned}`,
        ]
          .filter(Boolean)
          .join("\n")
      : "Ei vielä profiilia.";

    const chaptersWithNotes = chapters.map((chapter: any) => {
      const notes = allNotes.find((n: any) => n.life_stage === chapter.life_stage);
      return {
        chapter_number: chapter.chapter_number,
        life_stage: chapter.life_stage,
        title: chapter.title,
        notes: notes?.notes_markdown || "",
        has_content: !!(notes?.notes_markdown && notes.notes_markdown.length >= 100),
      };
    });

    const hasAnyContent = chaptersWithNotes.some((c) => c.has_content);
    if (!hasAnyContent) {
      return jsonError("Kirjassa ei ole vielä yhtään lukua joka on riittävä kirjoitettavaksi. Käsittele ensin puheluja.", 400);
    }

    const prompt = buildFullBookPrompt({
      elder_name: elderName,
      elder_first_name: elderFirstName,
      birth_year: birthYear,
      dialect_region: dialectRegion,
      profile_summary: profileNotes,
      chapters_with_notes: chaptersWithNotes,
    });

    console.log(`[compile-full-book] Calling Claude Opus for ${chaptersWithNotes.filter((c) => c.has_content).length} chapters`);

    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_OPUS_MODEL,
        max_tokens: 16000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error("[compile-full-book] Claude API error:", errText);
      return jsonError(`Claude Opus API -virhe: ${errText}`, 500);
    }

    const claudeData = await claudeResponse.json();
    const responseText = claudeData.content[0].text.trim();

    let parsed: any;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("[compile-full-book] JSON parse failed:", responseText.slice(0, 500));
      return jsonError("Claude palautti virheellisen JSON:n", 500);
    }

    if (!parsed.chapters || !Array.isArray(parsed.chapters)) {
      return jsonError("Claude ei palauttanut chapters-taulukkoa", 500);
    }

    const now = new Date().toISOString();
    const inputTokens = claudeData.usage?.input_tokens || 0;
    const outputTokens = claudeData.usage?.output_tokens || 0;
    const estimatedCost = (inputTokens * 5 + outputTokens * 25) / 1_000_000;

    let chaptersWritten = 0;

    for (const chapterResult of parsed.chapters) {
      const chapter = chapters.find((c: any) => c.life_stage === chapterResult.life_stage);
      if (!chapter) continue;

      const proseText = chapterResult.prose;
      const wordCount = proseText.split(/\s+/).filter((w: string) => w.length > 0).length;

      // Tallenna vanha versio historiaan ennen ylikirjoitusta
      if (chapter.content_markdown && chapter.content_markdown.length > 0) {
        await supabase.from("chapter_revisions").insert({
          chapter_id: chapter.id,
          content_markdown: chapter.content_markdown,
          word_count: chapter.word_count || 0,
          ai_model_used: "pre-full-book-compile",
          prompt_version: "3d2-full-book",
          change_reason: "Ennen kokonaisuudistusta",
          created_by_ai: false,
        });
      }

      await supabase
        .from("book_chapters")
        .update({
          content_markdown: proseText,
          word_count: wordCount,
          status: "draft",
          version: (chapter.version || 1) + 1,
          last_generated_at: now,
          prose_generated_at: now,
        })
        .eq("id", chapter.id);

      await supabase.from("chapter_revisions").insert({
        chapter_id: chapter.id,
        content_markdown: proseText,
        word_count: wordCount,
        ai_model_used: CLAUDE_OPUS_MODEL,
        prompt_version: "3d2-full-book",
        change_reason: `Kokonaisuudistus. ${parsed.consistency_notes || ""}`.slice(0, 500),
        created_by_ai: true,
      });

      chaptersWritten++;
    }

    console.log(`[compile-full-book] Done. ${chaptersWritten} chapters written. Cost ~$${estimatedCost.toFixed(4)}`);

    return new Response(
      JSON.stringify({
        success: true,
        chapters_written: chaptersWritten,
        consistency_notes: parsed.consistency_notes,
        tokens: { input: inputTokens, output: outputTokens },
        estimated_cost_usd: estimatedCost,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[compile-full-book] Error:", err);
    return jsonError(String(err), 500);
  }
});
