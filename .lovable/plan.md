

The user wants a calendar/reminders feature where the family member can:
1. Schedule items to remind the elder about
2. Choose whether to make a separate call OR mention it in the morning/evening regular call (or both)

Currently the `reminders` table has `method` ('sms', 'call', 'both'). We need to extend this concept: the reminder can be delivered via the regular morning/evening call instead of/in addition to a separate call.

Let me plan a clean approach.

## Suunnitelma: Kalenterimuistutukset omaiselta — joustava toimitustapa

### Nykytilanne

- `reminders`-taulu: `elder_id, message, remind_at, method (sms|call|both), is_sent`
- `Reminders.tsx` -sivu: lisää muistutuksia listana
- `check-reminders` edge function: lähettää SMS:n tai soittaa erillisen puhelun kun `remind_at` koittaa

### Mitä puuttuu

Omainen ei voi sanoa: *"Muistuta isää torstaina lääkärinajasta — riittää että Aina mainitsee sen aamupuhelussa, ei tarvi erillistä soittoa."*

### Ratkaisu: laajennetaan `method`-vaihtoehdot

Uudet toimitustavat:

```text
sms                  → erillinen tekstiviesti (nykyinen)
call                 → erillinen puhelu (nykyinen)
both                 → SMS + erillinen puhelu (nykyinen)
morning_call         → mainitaan saman päivän aamupuhelussa (UUSI)
evening_call         → mainitaan saman päivän iltapuhelussa (UUSI)
both_calls           → mainitaan sekä aamu- että iltapuhelussa (UUSI)
```

### Vaiheet

**Vaihe 1 — Tietokantamigraatio**

- `reminders.delivery_mode` (uusi sarake, text) korvaa `method`-käytön loogisesti
  - Itse asiassa pidetään `method`-sarake (yhteensopivuus säilyy) ja annetaan sille uudet sallitut arvot
  - Lisätään `reminders.scheduled_for_date` (date) — selkeä päivämäärä kun muistutus liittyy puheluun (ei kellonaikaan)
  - `remind_at` säilyy SMS/erillispuhelua varten

Itse asiassa yksinkertaisempi: pidetään `remind_at` ainoana aikakenttänä. Aamu/iltapuhelu poimii kaikki muistutukset joiden `remind_at` osuu kyseiselle päivälle JA `method` on `morning_call`/`evening_call`/`both_calls`.

→ **Migraatio: ei skeemamuutoksia tarvita.** Vain `method`-arvojoukko laajenee. Päivitetään dokumentaatio koodin kommenttina.

**Vaihe 2 — UI: `Reminders.tsx`**

Päivitetään `method`-valikko:
```text
📱 SMS-viesti
📞 Erillinen puhelu
📱+📞 Molemmat (SMS + erillinen puhelu)
🌅 Mainitaan aamupuhelussa
🌙 Mainitaan iltapuhelussa
🌅+🌙 Mainitaan sekä aamu- että iltapuhelussa
```

Lisäksi:
- Kun käyttäjä valitsee aamu-/iltapuhelun, **kellonaika-kenttä piilotetaan** (ei merkitystä) ja vain päivämäärä jää
- Kalenterinäkymä (kuukausinäkymä) jossa muistutukset näkyvät päiväkohtaisesti — Shadcn `Calendar` + sivussa valitun päivän muistutukset
- Säilytetään myös taulukkonäkymä alle (toggleable: "Kalenteri" / "Lista")

**Vaihe 3 — Backend: `check-reminders`**

Muokataan niin että käsittelee VAIN `sms`, `call`, `both` (erilliset toimitukset). Aamu-/iltapuhelumuistutukset ohitetaan tässä cron-jobissa.

**Vaihe 4 — Backend: `vapi-assistant-request`**

Kun aamu- tai iltapuhelu alkaa:
1. Funktio jo tietää onko kyseessä `morning` vai `evening` -puhelu (call_type)
2. Hakee `reminders`-taulusta kaikki rivit joissa:
   - `elder_id` = nykyinen
   - `is_sent` = false
   - `remind_at::date` = tämä päivä
   - `method` ∈ (`morning_call` jos aamu, `evening_call` jos ilta, tai `both_calls`)
3. Lisää muistutukset system promptiin: *"Mainitse luonnollisesti puhelun aikana: [muistutusviesti]. Älä kuulosta robotilta."*
4. Merkitsee muistutukset `is_sent = true` puhelun jälkeen (tai välittömästi haun yhteydessä)

**Vaihe 5 — Vapi system prompt -muutos**

Lisätään ohje: jos muistutuksia on, Aina kutoo ne keskusteluun luontevasti — ei luettele listana, vaan esim. *"Muistattehan, että Teillä on tänään lääkärin aika kello 14."*

**Vaihe 6 — Tila-merkintä**

Kun aamu-/iltapuhelu päättyy onnistuneesti, merkitään ne muistutukset `is_sent = true` jotka liitettiin promptiin. Tehdään tämä `vapi-assistant-request`-funktiossa heti kun ne haetaan (yksinkertaisin: optimistinen merkintä). Riskinä: jos puhelu ei mene läpi, muistutus jää sanomatta. → Vaihtoehto: merkitään vasta `vapi-webhook`:in `end-of-call-report`-tapahtumassa. Valitaan **jälkimmäinen** (turvallisempi).

### Tiedostot

```text
LUODAAN:
  (ei uusia tiedostoja)

MUOKATAAN:
  src/pages/Reminders.tsx                           — kalenterinäkymä + uudet method-valinnat
  supabase/functions/vapi-assistant-request/index.ts — hae päivän muistutukset, lisää promptiin
  supabase/functions/vapi-webhook/index.ts          — merkitse is_sent puhelun jälkeen
  supabase/functions/check-reminders/index.ts       — ohita uudet method-arvot
```

### Riskit

- Aina saattaa unohtaa mainita muistutuksen → mitigointi: prompt-ohje korostaa että muistutus on TÄRKEÄ ja tulee mainita
- Useita muistutuksia samalle päivälle → Aina yhdistää ne luontevasti (prompt ohjaa)
- Jos puhelu epäonnistuu → muistutus jää tilaan `is_sent=false`, käsitellään seuraavassa puhelussa (tai siirtyy SMS-fallbackiin? — **ei tässä vaiheessa**, voidaan lisätä myöhemmin)

### Hyväksyntä

Vahvistatko että:
1. Käytetään `method`-saraketta uusilla arvoilla (ei skeemamuutosta) ✓
2. Lisätään kalenterinäkymä + säilytetään taulukko vaihtoehtona ✓
3. Aina mainitsee muistutukset luontevasti aamu-/iltapuhelussa, ei listana ✓
4. Muistutus merkitään hoidetuksi vasta puhelun loputtua (`vapi-webhook`) ✓

Vai haluatko muuttaa jotain ennen toteutusta?

