import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Yksinkertainen RSS-XML-parseri (otsikko + kuvaus)
function parseRssItems(xml: string, max = 2): { title: string; description: string }[] {
  const items: { title: string; description: string }[] = [];
  const itemRegex = /<item[\s\S]*?<\/item>/gi;
  const matches = xml.match(itemRegex) || [];
  for (const block of matches.slice(0, max)) {
    const titleMatch = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const descMatch = block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
    const title = (titleMatch?.[1] || "").replace(/<[^>]+>/g, "").trim();
    let description = (descMatch?.[1] || "").replace(/<[^>]+>/g, "").trim();
    // Lyhennä kuvaus 200 merkkiin
    if (description.length > 200) description = description.slice(0, 200) + "...";
    if (title) items.push({ title, description });
  }
  return items;
}

async function fetchNews(): Promise<{ source: string; items: { title: string; description: string }[] } | null> {
  // 1. Yritä Helsingin Sanomien Kotimaa-RSS:ää
  const sources: { url: string; name: string }[] = [
    { url: "https://www.hs.fi/rss/kotimaa.xml", name: "Helsingin Sanomat" },
    { url: "https://www.hs.fi/rss/tuoreimmat.xml", name: "Helsingin Sanomat" },
    { url: "https://yle.fi/uutiset/rss/uutiset.rss?osasto=kotimaa", name: "Yle" },
  ];

  for (const src of sources) {
    try {
      const res = await fetch(src.url, {
        headers: { "User-Agent": "AinaHoiva-NewsBot/1.0" },
      });
      if (!res.ok) {
        console.log(`[vapi-get-news] ${src.name} failed: ${res.status}`);
        continue;
      }
      const xml = await res.text();
      const items = parseRssItems(xml, 2);
      if (items.length > 0) {
        console.log(`[vapi-get-news] Got ${items.length} items from ${src.name}`);
        return { source: src.name, items };
      }
    } catch (e) {
      console.error(`[vapi-get-news] ${src.name} error:`, e);
    }
  }
  return null;
}

function buildSpeechResponse(news: { source: string; items: { title: string; description: string }[] } | null): string {
  if (!news || news.items.length === 0) {
    return "Pahoittelut, en saanut juuri nyt yhteyttä uutispalveluun. Kokeillaanko myöhemmin?";
  }
  const intro = `Tässä päivän pääuutiset ${news.source}ista. `;
  const lines = news.items.map((it, i) => {
    const num = i === 0 ? "Ensimmäinen" : "Toinen";
    return `${num} uutinen: ${it.title}. ${it.description}`;
  });
  return intro + lines.join(" ") + " Haluatteko kuulla jotain muuta?";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Vapi tool call -muoto: { message: { toolCalls: [{ id, function: { arguments: {} } }] } }
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      // ei body — palauta uutiset suoraan tekstinä testausta varten
    }

    const news = await fetchNews();
    const result = buildSpeechResponse(news);

    // Vapi-tool-vastaus
    const toolCalls = body?.message?.toolCallList || body?.message?.toolCalls;
    if (Array.isArray(toolCalls) && toolCalls.length > 0) {
      const responses = toolCalls.map((tc: any) => ({
        toolCallId: tc.id,
        result,
      }));
      return new Response(JSON.stringify({ results: responses }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: tavallinen JSON-vastaus
    return new Response(JSON.stringify({ result, news }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[vapi-get-news] Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message, result: "Uutispalvelussa on tekninen vika juuri nyt." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
