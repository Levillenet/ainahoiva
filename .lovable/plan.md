

## Hätätilannejärjestelmä AinaHoivaan

### Yhteenveto
Lisätään hätätilanteiden automaattinen tunnistus puheluista, omaisten hälyttäminen (SMS + puhelu), seurantasoitot ja hallintakäyttöliittymä.

### Toteutettavat osat

**1. Tietokantataulut** (migraatio)
- `emergency_settings` — vanhuskohtaiset hätäasetukset (yhteystiedot, hälytystapa, seurantasoittoasetukset, tunnistettavat hätätilanteet, avainsanat, rauhoitusviesti)
- `emergency_alerts` — hätähälytyslokit (tyyppi, syy, seurantayritykset, ratkaisustatus)
- RLS-policyt molemmille tauluille (authenticated users via elders.created_by)
- Service role INSERT/UPDATE policyt emergency_alerts-taululle (edge functionit tarvitsevat)
- Realtime päälle emergency_alerts-taululle

**2. Edge Function: `handle-emergency`**
- Vastaanottaa elder_id, alert_type, alert_reason
- Hakee vanhuksen tiedot ja hätäasetukset (fallback: family_members)
- Lähettää SMS ja/tai soittaa omaiselle asetusten mukaan
- Tallentaa hälytyksen emergency_alerts-tauluun
- Ajastaa seurantasoiton (oletuksena 2 min)

**3. Edge Function: `emergency-followup`**
- Tarkistaa ratkaisemattomat hälytykset joiden seurantasoitto on myöhässä
- Soittaa vanhukselle seurantapuhelun (outbound-call, call_type: emergency_followup)
- Kasvattaa yrityskertojen laskuria, ajastaa seuraava yritys
- Max yritysten jälkeen merkitsee followup_done

**4. pg_cron-ajastus** (insert tool)
- `emergency-followup` joka minuutti

**5. Vapi-webhook päivitys** (`vapi-webhook/index.ts`)
- Lisätään `detectEmergency`-funktio joka tarkistaa transkriptin avainsanoista (kaatuminen, kipu, sekavuus, custom keywords)
- Hakee vanhuskohtaiset asetukset emergency_settings-taulusta
- Kutsuu handle-emergency edge functionia jos hätätilanne havaitaan

**6. Outbound-call päivitys** (`outbound-call/index.ts`)
- Lisätään tuki call_type: `emergency_followup` (seurantasoitto vanhukselle)
- Lisätään tuki call_type: `emergency_family` (hälytyssoitto omaiselle, vastaanottaa phone_number suoraan)

**7. UI: Hätäasetukset-välilehti** (`ElderDetail.tsx`)
- Uusi osio "Hätätilanteen asetukset" ElderDetail-sivulle (Omaiset-osion jälkeen)
- Lomake: ensisijainen/toissijainen hätänumero, hälytystapa (SMS/puhelu/molemmat), seurantasoiton toggle + viive + max yritykset, tunnistettavat tilanteet (checkboxit), omat avainsanat, rauhoitusviesti
- Tallenna-nappi joka upsertaa emergency_settings-tauluun

**8. UI: Hätähälytykset Dashboardiin** (`Dashboard.tsx`)
- Punainen pulssilainen banneri aktiivisista hätätilanteista (emergency_alerts where resolved=false)
- Näyttää vanhuksen nimen, tyypin, ajan, seurantasoiton ajankohdan
- "Merkitse ratkaistuksi" ja "Soita nyt" -napit
- Realtime-päivitys emergency_alerts-taulusta
- 30 sekunnin polling varavaihtoehtona

### Tekninen arkkitehtuuri

```text
Vanhus sanoo "kaaduin"
       ↓
vapi-webhook: detectEmergency()
       ↓
handle-emergency: SMS + soitto omaiselle
       ↓
emergency_alerts taulu (followup_call_at = +2min)
       ↓
pg_cron → emergency-followup (joka min)
       ↓
outbound-call (emergency_followup) → soitto vanhukselle
       ↓
Dashboard: punainen hälytys (realtime)
```

### Muutettavat tiedostot
1. Uusi migraatio: emergency_settings + emergency_alerts + RLS + realtime
2. `supabase/functions/handle-emergency/index.ts` (uusi)
3. `supabase/functions/emergency-followup/index.ts` (uusi)
4. `supabase/functions/vapi-webhook/index.ts` (lisätään detectEmergency)
5. `supabase/functions/outbound-call/index.ts` (lisätään emergency-tyypit)
6. `src/pages/ElderDetail.tsx` (hätäasetukset-osio)
7. `src/pages/Dashboard.tsx` (hätähälytys-banneri + realtime)
8. pg_cron ajastus (insert tool)

