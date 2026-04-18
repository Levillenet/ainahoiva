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
const CLAUDE_MODEL = "claude-sonnet-4-6";

function buildConsistencyPrompt(vars: {
  elder_name: string;
  chapters: Array<{ life_stage: string; title: string; notes: string }>;
}): string {
  const chapterBlocks = vars.chapters
    .filter((c) => c.notes && c.notes.length >= 50)
    .map((c) => `### ${c.title} (${c.life_stage})\n${c.notes}`)
    .join("\n\n");

  return `Olet tarkistaja joka etsii ristiriitoja elämäntarinakirjan muistiinpanoista.

VANHUS: ${vars.elder_name}

KAIKKI LUKUJEN MUISTIINPANOT:

${chapterBlocks}

TEHTÄVÄSI:

Etsi kohdat joissa eri luvuissa sanotaan ristiriitaisia asioita tai joissa aiheet liittyvät toisiinsa epäselvästi.

Esim:
- Luku A "ei naimisissa", luku B puhuu puolisosta → ristiriita
- Luku A mainitsee lapsen X, luku B "ei lapsia" → ristiriita
- Eri ammatti samalle henkilölle eri luvuissa → ristiriita
- Päällekkäiset päivämäärät tai paikat → mahdollinen ongelma
- Sama nimi eri rooleissa eri luvuissa → epäselvyys

Kategorisoi:
- SUORAT RISTIRIIDAT (severity: error)
- MAHDOLLISET ONGELMAT (severity: warning)
- PUUTTUVAT YHTEYDET (severity: info)

ÄLÄ keksi ristiriitoja. Jos ei ole varmuutta, merkitse "warning" tai "info".

VASTAUSMUOTO — TARKASTI TÄMÄ JSON (ei mitään muuta):

{
  "issues": [
    {
      "severity": "error",
      "title": "Lyhyt kuvaus",
      "description": "Tarkempi selitys",
      "affected_chapters": ["lapsuus", "kotoa_lahto"],
      "suggested_action": "Mitä omaisen pitäisi tehdä"
    }
  ],
  "overall_assessment": "Lyhyt yleisarvio kirjan johdonmukaisuudesta."
}

Jos ristiriitoja ei löydy, palauta tyhjä issues-taulukko.`;
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
    return jsonError("ANTHROPIC_API_KEY puuttuu", 500);
  }

  try {
    const body = await req.json();
    const elderId = body.elder_id;

    if (!elderId) {
      return jsonError("elder_id puuttuu", 400);
    }

    console.log(`[check-consistency] Checking elder ${elderId}`);

    const [elderRes, chaptersRes, notesRes] = await Promise.all([
      supabase.from("elders").select("full_name").eq("id", elderId).single(),
      supabase.from("book_chapters").select("life_stage, title").eq("elder_id", elderId).order("chapter_number"),
      supabase.from("chapter_notes").select("life_stage, notes_markdown").eq("elder_id", elderId),
    ]);

    if (!elderRes.data) return jsonError("Vanhusta ei löydy", 404);

    const elderName = elderRes.data.full_name;
    const chapters = (chaptersRes.data || []).map((c: any) => {
      const notes = (notesRes.data || []).find((n: any) => n.life_stage === c.life_stage);
      return {
        life_stage: c.life_stage,
        title: c.title,
        notes: notes?.notes_markdown || "",
      };
    });

    const chaptersWithContent = chapters.filter((c) => c.notes.length >= 50);
    if (chaptersWithContent.length < 2) {
      return new Response(
        JSON.stringify({
          success: true,
          issues: [],
          overall_assessment: "Vain yksi tai ei yhtään lukua joilla on sisältöä — tarkistusta ei tehdä.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const prompt = buildConsistencyPrompt({
      elder_name: elderName,
      chapters,
    });

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
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      return jsonError(`Claude API -virhe: ${errText}`, 500);
    }

    const claudeData = await claudeResponse.json();
    const responseText = claudeData.content[0].text.trim();

    let parsed: any;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      return jsonError("Claude palautti virheellisen JSON:n", 500);
    }

    const now = new Date().toISOString();

    for (const issue of parsed.issues || []) {
      await supabase.from("legacy_observations").insert({
        elder_id: elderId,
        type: "consistency_issue",
        title: issue.title,
        description: `${issue.description}\n\nLuvut: ${(issue.affected_chapters || []).join(", ")}\n\nEhdotus: ${issue.suggested_action || "—"}`,
        read_by_family: false,
        created_at: now,
      });
    }

    const inputTokens = claudeData.usage?.input_tokens || 0;
    const outputTokens = claudeData.usage?.output_tokens || 0;
    const estimatedCost = (inputTokens * 3 + outputTokens * 15) / 1_000_000;

    console.log(`[check-consistency] Done. ${parsed.issues?.length || 0} issues. Cost ~$${estimatedCost.toFixed(4)}`);

    return new Response(
      JSON.stringify({
        success: true,
        issues: parsed.issues || [],
        overall_assessment: parsed.overall_assessment,
        tokens: { input: inputTokens, output: outputTokens },
        estimated_cost_usd: estimatedCost,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[check-consistency] Error:", err);
    return jsonError(String(err), 500);
  }
});
