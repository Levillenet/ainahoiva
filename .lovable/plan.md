

## Suunnitelma: GPT analysoi koko litteroinnin, Hume pysyy 60 sekunnissa

### Mitä muutetaan

**`supabase/functions/vapi-webhook/index.ts` → `analyzeTranscript()`**
- Poistetaan 4000 merkin truncate-rajoitus
- GPT (Gemini 3 Flash) saa koko transkriptin → tunnistaa kaikki kiputilat, muistutukset, lääkemaininnat, perheviestit ja keskustelun teemat luotettavasti myös pitkissä puheluissa
- Lisätään silti turvaraja: jos transkripti on yli ~30 000 merkkiä (yli ~20 min puhetta), leikataan siinä kohtaa — Geminin context window kestää tämän helposti, mutta estää poikkeustapaukset
- Päivitetään loki: `[vapi-webhook] Full transcript analyzed: X chars`

**Mitä EI muuteta**
- `analyze-emotion/index.ts` pidetään ennallaan: WAV-leikkaus 60 sekuntiin → Hume-säästö säilyy (tunnetila selviää alkupuolesta, kuten käyttäjä totesi)
- Vapi-prompt, uutiset, säätieto ym. pysyvät samoina

### Vaikutus

```text
Ennen:  GPT näkee max 4000 merkkiä  →  pitkien puheluiden lopussa mainitut kivut/muistutukset jäivät huomaamatta
Jälkeen: GPT näkee koko keskustelun  →  täydellinen yhteenveto, kaikki kiputilat ja muistutukset talteen

Hume:   edelleen vain ensimmäiset 60 s  →  ~80% säästö äänianalyysin kustannuksista säilyy
```

### Kustannusvaikutus

- Gemini 3 Flash on hyvin halpa (token-pohjainen) — täysi 10 min litterointi (~15 000 merkkiä) maksaa marginaalisesti enemmän kuin 4000 merkin versio
- Hume (per-minuutti äänestä) on selvästi kalliimpi → siksi ääni leikataan, ei tekstiä
- Lopputulos: parempi sisältöanalyysi ilman merkittävää lisäkustannusta

### Tiedostot

```text
MUOKATAAN:
  supabase/functions/vapi-webhook/index.ts   — analyzeTranscript: poista 4000-rajoitus, nosta turvaraja 30 000:een
```

