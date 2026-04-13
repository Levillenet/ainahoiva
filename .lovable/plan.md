

## Parannussuunnitelma

### Ongelma 1: Vanhuksen pyyntö kutsua omainen
Tällä hetkellä AI analysoi vain mielialan, muttei tunnista vanhuksen eksplisiittistä pyyntöä ("soita tyttärelleni", "tarvitsen apua"). 

**Ratkaisu:** Päivitä `vapi-webhook` analyzeTranscript-prompti lisäämällä uusi kenttä:
- `"contact_family": true/false` — tunnistaa jos vanhus pyytää yhteydenottoa omaisiin
- `"contact_reason": "Pyysi soittamaan tyttärelleen"` — syy

Jos `contact_family === true`, lähetetään SMS omaisille vanhuksen pyynnöstä.

### Ongelma 2: Hume-analyysi ei näy
Tämä toimii jo teknisesti — data puuttuu koska puhelut eivät ole onnistuneet (0s kesto, ei ääntä). Kun seuraava puhelu onnistuu ja Vapi palauttaa recordingUrl:n, Hume-analyysi käynnistyy ja data näkyy ElderDetail-sivulla.

**Lisäparannus:** Näytä Dashboard-sivulla selkeämmin Hume-tunnetiedot, ja lisää "Ei tunneanalyysiä" -teksti kun dataa ei ole.

### Tekniset muutokset

1. **`vapi-webhook/index.ts`** — Päivitä analyzeTranscript-prompti tunnistamaan omaisen kutsumispyyntö + lisää logiikka SMS-lähetykseen
2. **`src/pages/ElderDetail.tsx`** — Näytä selkeä "Ei tunneanalyysiä saatavilla" kun hume-data on null, ja näytä `mood_source` (gpt/hume+gpt)
3. **`src/pages/Dashboard.tsx`** — Lisää info kun Hume-dataa ei ole vielä

