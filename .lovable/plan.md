

User wants to expand news with Yle RSS feeds covering: kotimaa, ulkomaat, urheilu — plus general headlines. Aina should offer category, then read.

Yle RSS feeds (known to exist):
- Pääuutiset: `https://feeds.yle.fi/uutiset/v1/majorHeadlines/YLE_UUTISET.rss`
- Tuoreimmat: `https://feeds.yle.fi/uutiset/v1/recent.rss?publisherIds=YLE_UUTISET`
- Kotimaa: `https://feeds.yle.fi/uutiset/v1/recent.rss?publisherIds=YLE_UUTISET&concepts=18-34953`
- Ulkomaat: `https://feeds.yle.fi/uutiset/v1/recent.rss?publisherIds=YLE_UUTISET&concepts=18-34952`
- Urheilu: `https://feeds.yle.fi/uutiset/v1/recent.rss?publisherIds=YLE_URHEILU`

Plan: extend existing `vapi-get-news` with category param. Update Vapi tool schema and prompt.

## Suunnitelma: Laajennettu uutispalvelu Ylen RSS-fiideillä

### Yle RSS -fiidit (kaikki avoimia, ei API-avainta)

```text
Pääuutiset:  https://feeds.yle.fi/uutiset/v1/majorHeadlines/YLE_UUTISET.rss
Kotimaa:     https://feeds.yle.fi/uutiset/v1/recent.rss?publisherIds=YLE_UUTISET&concepts=18-34953
Ulkomaat:    https://feeds.yle.fi/uutiset/v1/recent.rss?publisherIds=YLE_UUTISET&concepts=18-34952
Urheilu:     https://feeds.yle.fi/uutiset/v1/recent.rss?publisherIds=YLE_URHEILU
```

HS-fiidi säilytetään fallbackina pääuutisille.

### Muutokset

**`supabase/functions/vapi-get-news/index.ts` — laajennus**
- Lisätään `category`-parametri tool-kutsuun: `"headlines" | "kotimaa" | "ulkomaat" | "urheilu"` (oletus: `"headlines"`)
- Mappays kategoria → RSS-URL
- Palautetaan 2 otsikkoa + kuvaus, kuten nyt
- Yli 30 minuutin ikäiset urheilutulokset OK — ei suodatusta iän mukaan
- Säilytetään HS-fallback vain pääuutisille (muut kategoriat: jos Yle ei vastaa → kerrotaan luonnollinen virheviesti)

**`supabase/functions/vapi-assistant-request/index.ts` + `outbound-call/index.ts`**
- Päivitetään `read_news`-toolin parametriskeema: lisätään `category`-enum
- Päivitetään system prompt: Aina voi tarjota: *"Haluaisitteko kuulla pääuutiset, kotimaan, ulkomaiden vai urheilun uutiset?"*
- Jos asiakas sanoo esim. "kerrohan ulkomaan uutiset" → Aina kutsuu toolia `category: "ulkomaat"`
- Aina tunnistaa myös puhekieliset variantit: "maailmalta" → ulkomaat, "Suomesta" → kotimaa, "miten meidän joukkue pärjäsi" → urheilu

### Vaikutus

```text
Ennen:  Aina lukee aina 2 HS:n kotimaan uutista
Jälkeen: Asiakas voi pyytää: pääuutiset / kotimaa / ulkomaat / urheilu
        Aina valitsee oikean Yle RSS:n ja lukee 2 tuoretta otsikkoa
```

### Tiedostot

```text
MUOKATAAN:
  supabase/functions/vapi-get-news/index.ts          — category-parametri + 4 RSS-mappausta
  supabase/functions/vapi-assistant-request/index.ts — read_news-toolin schema + prompt
  supabase/functions/outbound-call/index.ts          — sama tool-päivitys
```

### Huomiot

- Ei uusia salaisuuksia eikä rekisteröitymistä — kaikki Ylen fiidit ovat avoimia
- Vanha käytös toimii edelleen: jos `category` puuttuu → palautetaan pääuutiset
- HS säilyy varafiidinä pääuutisille luotettavuuden vuoksi

