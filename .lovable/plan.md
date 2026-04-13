

## Korjaussuunnitelma: "Ei vastattu" ylikirjoittaa oikeat raportit

### Ongelma
Vapi webhook käsittelee puhelun oikein: AI-analyysi antaa mood 5/5, litterointi tallennetaan, mutta **missatun puhelun tarkistus (rivi 112-118) ylikirjoittaa tuloksen** tekstillä "Ei vastattu puheluun". Tämä tapahtuu koska `duration` on aina 0 (Vapi raportoi 0s keston).

Lisäksi `extractMemories`-funktiota ei koskaan kutsuta (ei lokeja), mikä viittaa siihen että funktio kaatuu tai aikakatkaisee ennen sitä.

### Ratkaisu: `vapi-webhook/index.ts`

**1. Korjaa missatun puhelun logiikka** — Siirrä tarkistus ENNEN AI-analyysiä ja käytä pelkkää transkriptia signaalina:

```typescript
// Detect missed call FIRST — before doing expensive AI analysis
const hasRealConversation = transcript.length > 50;

if (!hasRealConversation) {
  // Short/empty transcript = missed call → update and return early
  // ... update report, trigger handle-missed-call, return
}

// Only reach here if real conversation happened
const analysis = await analyzeTranscript(transcript);
// ... update report with analysis, never overwrite with "Ei vastattu"
```

**2. Lisää transcript fallback** — Tarkista myös `message.artifact?.transcript`:
```typescript
const transcript = message?.transcript || message?.artifact?.transcript || "";
```

**3. Lisää debug-lokit** — Lokita transcript-pituus ja missed call -päätös.

### Muutettavat tiedostot
- `supabase/functions/vapi-webhook/index.ts` — Uudelleenjärjestä logiikka niin ettei "Ei vastattu" voi ylikirjoittaa onnistunutta analyysiä
- Deploy funktio uudelleen

