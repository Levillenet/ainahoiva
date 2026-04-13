

## Muistutuksen toimitustavan kysyminen puhelussa

### Tavoite
Kun vanhus pyytää muistutusta puhelun aikana, järjestelmä tallentaa myös toimitustavan (puhelu vai SMS) sen perusteella mitä vanhus toivoo. AI-analyysi tunnistaa tämän transkriptista.

### Muutokset

**1. `supabase/functions/vapi-webhook/index.ts`**
- Lisätään `analyzeTranscript`-funktion promptiin `reminders`-kenttä:
  ```json
  "reminders": [
    {"message": "Parturi", "date": "2026-04-14", "time": "10:00", "method": "call|sms"}
  ]
  ```
- Promptissa ohjeistetaan AI:ta päättelemään method transkriptista: jos vanhus sanoo "soita" tai "muistuta soittamalla" → `call`, jos "laita viesti" tai "tekstiviesti" → `sms`, muuten oletus `call`
- Analyysin jälkeen tallennetaan muistutukset `reminders`-tauluun automaattisesti

**2. Vapi-assistantin prompti** (päivitetään Vapi API:n kautta tai manuaalisesti)
- Lisätään ohje: kun vanhus pyytää muistutusta, assistantti kysyy "Haluatko että soitan sinulle muistutukseksi vai lähetänkö tekstiviestin?"
- Assistantti vahvistaa: "Selvä, laitan muistutuksen [puheluna/viestinä] [aika]"

### Tekninen toteutus

Webhookiin lisätään analyysin jälkeen:
```typescript
if (analysis.reminders?.length) {
  for (const rem of analysis.reminders) {
    await supabase.from("reminders").insert({
      elder_id: elder.id,
      message: rem.message,
      remind_at: `${rem.date}T${rem.time}:00+03:00`,
      method: rem.method || "call",
      is_sent: false,
    });
  }
}
```

Ei tietokantamuutoksia — `reminders`-taulu tukee jo `method`-kenttää arvoilla `sms`, `call` ja `both`.

