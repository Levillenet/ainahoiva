import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Category = "headlines" | "kotimaa" | "ulkomaat" | "urheilu";

// Yle RSS -fiidit kategorioittain (avoimia, ei API-avainta)
const YLE_FEEDS: Record<Category, { url: string; name: string; label: string }[]> = {
  headlines: [
    { url: "https://feeds.yle.fi/uutiset/v1/majorHeadlines/YLE_UUTISET.rss", name: "Yle", label: "pääuutiset" },
    // Fallback HS jos Yle ei vastaa
    { url: "https://www.hs.fi/rss/kotimaa.xml", name: "Helsingin Sanomat", label: "pääuutiset" },
    { url: "https://www.hs.fi/rss/tuoreimmat.xml", name: "Helsingin Sanomat", label: "pääuutiset" },
  ],
  kotimaa: [
    { url: "https://feeds.yle.fi/uutiset/v1/recent.rss?publisherIds=YLE_UUTISET&concepts=18-34953", name: "Yle", label: "kotimaan uutiset" },
  ],
  ulkomaat: [
    { url: "https://feeds.yle.fi/uutiset/v1/recent.rss?publisherIds=YLE_UUTISET&concepts=18-34952", name: "Yle", label: "ulkomaiden uutiset" },
  ],
  urheilu: [
    { url: "https://feeds.yle.fi/uutiset/v1/recent.rss?publisherIds=YLE_URHEILU", name: "Yle", label: "urheilu-uutiset" },
  ],
};

// Yksinkertainen RSS-XML-parseri (otsikko + kuvaus)
function parseRssItems(xml: string, max = 2): { title: string; description: string }[] {
  const items: { title: string; description: string }[] = [];
  const itemRegex = /<item[\s\S]*?<\/item>/gi;
  const matches = xml.match(itemRegex) || [];
  for (const block of matches.slice(0, max)) {
    const titleMatch = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const descMatch = block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
    let title = (titleMatch?.[1] || "").replace(/<[^>]+>/g, "").trim();
    let description = (descMatch?.[1] || "").replace(/<[^>]+>/g, "").trim();
    // Siivoa osasto-prefixit kuten "Parhaita timanttijuttuja |"
    title = title.replace(/^[^|]+\|\s*/, "").trim();
    if (description.length > 200) description = description.slice(0, 200) + "...";
    if (title) items.push({ title, description });
  }
  return items;
}

function normalizeCategory(raw: unknown): Category {
  if (typeof raw !== "string") return "headlines";
  const v = raw.toLowerCase().trim();
  if (["kotimaa", "kotimaan", "suomi", "suomesta"].includes(v)) return "kotimaa";
  if (["ulkomaat", "ulkomaa", "ulkomaiden", "maailma", "maailmalta"].includes(v)) return "ulkomaat";
  if (["urheilu", "urheilun", "sport", "sports"].includes(v)) return "urheilu";
  if (["headlines", "paauutiset", "pääuutiset", "uutiset"].includes(v)) return "headlines";
  return "headlines";
}

async function fetchNews(category: Category): Promise<{ source: string; label: string; items: { title: string; description: string }[] } | null> {
  const sources = YLE_FEEDS[category];
  for (const src of sources) {
    try {
      const res = await fetch(src.url, {
        headers: { "User-Agent": "AinaHoiva-NewsBot/1.0" },
      });
      if (!res.ok) {
        console.log(`[vapi-get-news] ${src.name} (${category}) failed: ${res.status}`);
        continue;
      }
      const xml = await res.text();
      const items = parseRssItems(xml, 2);
      if (items.length > 0) {
        console.log(`[vapi-get-news] Got ${items.length} items from ${src.name} (${category})`);
        return { source: src.name, label: src.label, items };
      }
    } catch (e) {
      console.error(`[vapi-get-news] ${src.name} (${category}) error:`, e);
    }
  }
  return null;
}

function buildSpeechResponse(
  category: Category,
  news: { source: string; label: string; items: { title: string; description: string }[] } | null
): string {
  if (!news || news.items.length === 0) {
    return `Pahoittelut, en saanut juuri nyt yhteyttä uutispalveluun ${category === "headlines" ? "" : category + "-osastolle "}. Kokeillaanko myöhemmin?`;
  }
  const intro = `Tässä päivän ${news.label} ${news.source}ista. `;
  const lines = news.items.map((it, i) => {
    const num = i === 0 ? "Ensimmäinen" : "Toinen";
    return `${num} uutinen: ${it.title}.${it.description ? " " + it.description : ""}`;
  });
  return intro + lines.join(" ") + " Haluatteko kuulla jotain muuta?";
}

function extractCategoryFromBody(body: any): Category {
  // Vapi tool call: message.toolCallList[].function.arguments.category
  const toolCalls = body?.message?.toolCallList || body?.message?.toolCalls;
  if (Array.isArray(toolCalls) && toolCalls.length > 0) {
    const args = toolCalls[0]?.function?.arguments;
    if (args) {
      if (typeof args === "string") {
        try {
          const parsed = JSON.parse(args);
          return normalizeCategory(parsed?.category);
        } catch {
          /* ignore */
        }
      } else if (typeof args === "object") {
        return normalizeCategory((args as any).category);
      }
    }
  }
  // Suora kutsu testausta varten
  return normalizeCategory(body?.category);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      // ei body
    }

    const category = extractCategoryFromBody(body);
    console.log(`[vapi-get-news] Category requested: ${category}`);

    const news = await fetchNews(category);
    const result = buildSpeechResponse(category, news);

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

    return new Response(JSON.stringify({ result, category, news }), {
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
