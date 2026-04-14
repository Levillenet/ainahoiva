

## Nykytilanne

Tällä hetkellä järjestelmä **ei tunnista sisääntulevia puheluita**. Kun vanhus soittaa itse Vapi-numeroon, Vapi käyttää assistantin oletusasetuksia — geneeristä `firstMessage`-viestiä ilman personointia (ei tiedä soittajan nimeä, lääkkeitä, muistoja).

Sisääntuleva puhelu menee suoraan Vapi Assistantille staattisilla asetuksilla, koska mitään "assistant-request" -webhookia ei ole käytössä.

## Ratkaisu: Vapi Server URL (Assistant Request)

Vapin "Server URL" -ominaisuus mahdollistaa sen, että kun puhelu alkaa (sisääntuleva TAI lähtevä), Vapi lähettää `assistant-request`-tyyppisen pyynnön webhookiin. Webhook voi tunnistaa soittajan ja palauttaa **dynaamisen assistanttikonfiguraation** — personoidun firstMessagen, variableValues-arvot (nimi, lääkkeet, muistot).

### Uusi Edge Function: `vapi-assistant-request`

1. Vastaanottaa Vapin `assistant-request`-pyynnön kun puhelu alkaa
2. Tunnistaa soittajan numeron perusteella (`customer.number`)
3. Hakee tietokannasta vanhuksen nimen, lääkkeet, muistot, viimeisimmän puhelun
4. Palauttaa dynaamisen assistanttikonfiguraation:
   - **firstMessage**: `"Hei Sami! Mitäpä sinulla, kiva kun soitit!"` (personoitu)
   - **variableValues**: nimi, lääkkeet, muistot jne.
5. Jos soittajaa ei tunnisteta → palauttaa geneerisen tervehdyksen

### Muutokset

| Kohde | Muutos |
|-------|--------|
| `supabase/functions/vapi-assistant-request/index.ts` | Uusi edge function — tunnistaa soittajan ja palauttaa personoidun konfiguraation |
| Vapi Dashboard | Aseta Server URL osoittamaan tähän funktioon (manuaalinen asetus) |

### Tekninen toiminta

```text
Vanhus soittaa → Vapi vastaanottaa
  → Vapi lähettää POST assistant-request webhookiin
  → Edge function: etsi soittaja numerolla
  → Löytyi "Sami Virtanen"
  → Palauta: { assistantOverrides: { firstMessage: "Hei Sami! ...", variableValues: {...} } }
  → Vapi käyttää personoitua tervehdystä
```

### Esimerkki firstMessage sisääntulevalle puhelulle

- Tunnettu soittaja: `"Hei Sami! Täällä Aina, kiva kun soititte! Miten Teillä menee?"`
- Tuntematon numero: `"Hei! Täällä Aina AinaHoivasta. Miten voin auttaa?"`

### Tärkeää
- Lähtevät puhelut (outbound-call) jatkavat toimimaan kuten ennen — niissä personointi tapahtuu jo `outbound-call`-funktiossa
- Vapi Server URL käsittelee **molemmat** suunnat, joten outbound-puheluille palautetaan sama konfiguraatio kuin nytkin
- UI:hin ei tehdä mitään muutoksia

