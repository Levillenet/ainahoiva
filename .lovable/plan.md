

## Vahvistus: havainto on täsmälleen sama

Vapi-puhelulokit todistavat sen mitä epäilin:

- **Rivi 202**: `"toolName":"add_memory"` → `"error":"No result returned"`
- **Rivi 203**: `"toolNames":["add_memory"]` epäonnistui
- Aiemmin samassa puhelussa: `log_medication` epäonnistui samalla tavalla, lopulta `send_text` onnistui
- **Koko 544-rivisessä lokissa EI YHTÄÄN** mainintaa `read_news`, `get_news` tai `news` toolista

Promptissa (`vapi-assistant-request/index.ts` rivi 306-315) on ohje "Kutsu AINA read_news_tool" — **mutta itse työkalua ei ole rekisteröity assistentin tools-arrayssä**. Siksi malli arvaa lähimmän olemassa olevan työkalun (`add_memory`, `log_medication`) ja lopulta tippuu `send_text`:iin.

## Korjaus

### 1. Rekisteröi `read_news_tool` Vapi-assistentin tools-listaan

`supabase/functions/vapi-assistant-request/index.ts` palauttaa `assistantOverrides.model.tools[]`. Lisätään sinne uusi function-tool:

```ts
{
  type: "function",
  function: {
    name: "read_news_tool",
    description: "Hakee päivän uutiset Yle:n RSS-fiideistä ja palauttaa puheena luettavan tekstin. Kutsu AINA kun käyttäjä pyytää uutisia, otsikoita, urheilua, talousuutisia jne. ÄLÄ KOSKAAN korvaa tätä send_text_tool:lla.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Uutisluokka: headlines, kotimaa, ulkomaat, urheilu, talous, politiikka, kulttuuri, viihde, tiede, terveys, luonto, liikenne, selko, tuoreimmat",
        },
      },
      required: [],
    },
  },
  server: {
    url: "https://bjsthjvpotfcxgqxtoiy.supabase.co/functions/v1/vapi-get-news",
  },
}
```

### 2. Vahvista promptin ohje (jo olemassa, mutta korostetaan)

Lisätään vielä eksplisiittinen kielto: "Jos käyttäjä pyytää uutisia, sää tai ajan, ÄLÄ KOSKAAN kutsu add_memory, log_medication tai send_text. Kutsu read_news_tool."

### 3. Deployaa

`vapi-assistant-request` ja varmistetaan että `vapi-get-news` toimii (se on jo deployattu aiemmin).

### Tiedostot

```text
MUOKATAAN:
  supabase/functions/vapi-assistant-request/index.ts
    - lisää read_news_tool tools-listaan
    - kovenna promptin kielto-osio
DEPLOYATAAN:
  vapi-assistant-request
```

### Testaus puhelun jälkeen

Pyydä Ainalta uutisia → varmista lokeista että `toolName: "read_news_tool"` ilmestyy ja `eventStatus: "success"`.

