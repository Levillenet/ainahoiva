
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Category =
  | "headlines"
  | "tuoreimmat"
  | "kotimaa"
  | "ulkomaat"
  | "talous"
  | "politiikka"
  | "kulttuuri"
  | "viihde"
  | "tiede"
  | "luonto"
  | "terveys"
  | "liikenne"
  | "urheilu"
  | "selko";

// Yle:n viralliset RSS-fiidit (https://yle.fi/uutiset/rss) — kaikki avoimia, ei API-avainta.
// Kaikki URL:t verifioitu HTTP 200 + sisältö vastaa aihetta (huhtikuu 2026).
// HUOM: TODO: Sää-ennusteille tulee käyttää FMI Open Data WFS:ää (Yle:llä ei säätietofiidiä).
const YLE_FEEDS: Record<Category, { url: string; name: string; label: string }[]> = {
  headlines: [
    { url: "https://yle.fi/rss/uutiset/paauutiset", name: "Yle", label: "pääuutiset" },
    // Varafiidi jos Yle ei vastaa
    { url: "https://www.hs.fi/rss/tuoreimmat.xml", name: "Helsingin Sanomat", label: "pääuutiset" },
  ],
  tuoreimmat: [
    { url: "https://yle.fi/rss/uutiset/tuoreimmat", name: "Yle", label: "tuoreimmat uutiset" },
  ],
  kotimaa: [
    { url: "https://yle.fi/rss/t/18-34837/fi", name: "Yle", label: "kotimaan uutiset" },
  ],
  ulkomaat: [
    { url: "https://yle.fi/rss/t/18-34953/fi", name: "Yle", label: "ulkomaiden uutiset" },
  ],
  talous: [
    { url: "https://yle.fi/rss/t/18-19274/fi", name: "Yle", label: "taloususutiset" },
  ],
  politiikka: [
    { url: "https://yle.fi/rss/t/18-38033/fi", name: "Yle", label: "politiikan uutiset" },
  ],
  kulttuuri: [
    { url: "https://yle.fi/rss/t/18-150067/fi", name: "Yle", label: "kulttuuriuutiset" },
  ],
  viihde: [
    { url: "https://yle.fi/rss/t/18-36066/fi", name: "Yle", label: "viihdeuutiset" },
  ],
  tiede: [
    { url: "https://yle.fi/rss/t/18-819/fi", name: "Yle", label: "tiedeuutiset" },
  ],
  luonto: [
    { url: "https://yle.fi/rss/t/18-35354/fi", name: "Yle", label: "luontouutiset" },
  ],
  terveys: [
    { url: "https://yle.fi/rss/t/18-35138/fi", name: "Yle", label: "terveysuutiset" },
  ],
  liikenne: [
    { url: "https://yle.fi/rss/t/18-12/fi", name: "Yle", label: "liikenneuutiset" },
  ],
  urheilu: [
    { url: "https://yle.fi/rss/urheilu", name: "Yle", label: "urheilu-uutiset" },
  ],
  selko: [
    { url: "https://yle.fi/rss/selkouutiset", name: "Yle", label: "selkouutiset" },
  ],
};

// Yksinkertainen RSS-XML-parseri (otsikko + kuvaus)
function parseRssItems(xml: string, max = 2): { title: string; description: string }[] {
  const items: { title: string; description: string }[] = [];
  const itemRegex = /<item[\s>][\s\S]*?<\/item>/gi;
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
  const v = raw
    .toLowerCase()
    .trim()
    .replace(/[äå]/g, "a")
    .replace(/ö/g, "o");

  // Pääuutiset
  if (["headlines", "paauutiset", "uutiset", "paivan uutiset"].includes(v)) return "headlines";
  // Tuoreimmat
  if (["tuoreimmat", "uusimmat", "viimeisimmat"].includes(v)) return "tuoreimmat";
  // Kotimaa
  if (["kotimaa", "kotimaan", "suomi", "suomesta", "kotimaiset"].includes(v)) return "kotimaa";
  // Ulkomaat
  if (["ulkomaat", "ulkomaa", "ulkomaiden", "maailma", "maailmalta", "kansainvaliset"].includes(v)) return "ulkomaat";
  // Talous
  if (["talous", "talousuutiset", "porssi", "porssi-uutiset", "raha", "raha-asiat", "talouselama"].includes(v)) return "talous";
  // Politiikka
  if (["politiikka", "politiikan uutiset", "eduskunta", "hallitus", "puolue"].includes(v)) return "politiikka";
  // Kulttuuri
  if (["kulttuuri", "kulttuuriuutiset", "taide", "musiikki", "kirjallisuus", "teatteri"].includes(v)) return "kulttuuri";
  // Viihde
  if (["viihde", "viihdeuutiset", "julkkikset", "tv-ohjelmat"].includes(v)) return "viihde";
  // Tiede
  if (["tiede", "tiedeuutiset", "tutkimus", "tutkimukset"].includes(v)) return "tiede";
  // Luonto
  if (["luonto", "luontouutiset", "ymparisto", "ilmasto", "elaimet"].includes(v)) return "luonto";
  // Terveys
  if (["terveys", "terveysuutiset", "sairaudet", "laakkeet", "laaketiede"].includes(v)) return "terveys";
  // Liikenne
  if (["liikenne", "liikenneuutiset", "ruuhkat", "tiet", "junat"].includes(v)) return "liikenne";
  // Urheilu
  if (["urheilu", "urheilun", "sport", "sports", "urheilu-uutiset", "jaakiekko", "jalkapallo"].includes(v)) return "urheilu";
  // Selko
  if (["selko", "selkouutiset", "selkokielinen", "selkokieli"].includes(v)) return "selko";

  return "headlines";
}

async function fetchNews(category: Category): Promise<{ source: string; label: string; items: { title: string; description: string }[] } | null> {
  const sources = YLE_FEEDS[category];
  for (const src of sources) {
    try {
      const res = await fetch(src.url, {
        headers: { "User-Agent": "AinaHoiva-NewsBot/1.0" },
        redirect: "follow",
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
  // "Yle" → "Yleltä", "Helsingin Sanomat" → "Helsingin Sanomista"
  const sourceSpoken = news.source === "Yle" ? "Yleltä" : `${news.source}ista`;
  const intro = `Tässä päivän ${news.label} ${sourceSpoken}. `;
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

Deno.serve(async (req) => {
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
