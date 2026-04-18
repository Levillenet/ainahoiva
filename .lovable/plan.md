
**Bugin diagnoosi (käyttäjän puhelu klo 12:00):**

Vanhus kertoi olleensa eilen kävelyllä → Aina ei tiennyt tästä → Aina kysyi vahvistusta toistuvasti → kognitioanalyysi tulkitsi tilanteen niin että VANHUS ei muista kävelyä → tallensi "selkeä huoli". Käyttäjä on oikeassa: oikea käytös olisi ollut "joo, te olitte kävelyllä" + hiljainen muistilappu "kerto kävelystä jota ei ollut aiemmissa muistoissa".

**Kaksi juurta bugille:**

1. **`extractMemories` ei tallenna konkreettisia tapahtumia ajalla**. Edellisten puheluiden muistot ovat sumeita ("Pitää kävelylenkkejä virkistävinä"), eivät tarkkoja faktoja ("17.4.2026: oli kävelyllä Lauttasaaressa"). Niinpä Aina ei voi seuraavana päivänä viitata "eiliseen kävelyyn".

2. **Cognitive assessment -prompti on yksipuolinen**. Se ei pyri erottamaan: johtuiko muistivirhe vanhuksesta vai Ainasta? Se merkitsee vanhuksen huolestuneeksi vaikka oikeasti vanhus muisti — Aina ei muistanut.

3. **Aina-prompti ei kannusta vahvistamaan vanhuksen omaa kertomaa**. Kun vanhus sanoo "olin kävelyllä eilen", Ainan oikea käytös on hyväksyä se ja kysyä jatkokysymys, ei pyytää toistoa.

---

**KORJAUSEHDOTUS — kolme tiedostoa**

### 1. `supabase/functions/vapi-webhook/index.ts` — `extractMemories`

Päivitetään prompti niin että:
- Pyytää AINA poimimaan tarkat **päivätyt tapahtumat** (`event`-tyyppi sisältää päivämäärän)
- Lisää uusi tyyppi `daily_activity` jonka contentissa on muoto: `"YYYY-MM-DD: kävi kävelyllä"` 
- Esimerkit promptissa näyttävät päivämäärää sisältäviä rivejä
- `extractMemories`-funktio injektoi puhelun päivämäärän (Helsinki-aika) promptiin, jotta AI tietää mihin "tänään" viittaa

### 2. `supabase/functions/vapi-assistant-request/index.ts` — kontekstin rakennus + Aina-prompti

A. **Erotellaan muistot tyypeittäin systeemipromptissa**:
```
Vanhuksen taustamuistot: [person/health/preference/family]
Viime päivien tapahtumat (KÄYTÄ NÄITÄ jos vanhus viittaa eiliseen): 
  17.4.2026: kävi kävelyllä
  16.4.2026: tytär soitti
```
Haetaan `event` ja `daily_activity` -tyypit erikseen, viim. 7 päivän ajalta, ja näytetään päivämäärillä.

B. **Lisätään uusi sääntö Aina-prompttiin** (heti `## Muisti` -osion jälkeen):
```
## TÄRKEÄ — Vahvista vanhuksen kertomaa
Jos vanhus mainitsee tehneensä jotain (kävelyllä, vieraita, syönyt 
jotain), USKO HÄNTÄ vaikket itse muistaisi sitä. Sano esim. 
"Aivan, kerroittehan siitä kävelystä" tai "Mukava kuulla!" — älä 
KOSKAAN pyydä vahvistusta toistuvasti tyyliin "Oletteko varma?" 
tai "Olitteko todella?". Toistuva varmistelu hämmentää vanhusta 
ja saattaa saada hänet epäilemään omaa muistiaan.

Jos asia on uusi sinulle, tallenna se hiljaa add_memory-toolilla 
tyypillä "event" — älä paljasta että et muistanut.
```

### 3. `supabase/functions/vapi-webhook/index.ts` — `extractCognitiveAssessment`

Päivitetään prompti niin että se EROTTAA vanhuksen ja assistentin virheet:
```
TÄRKEÄ EROTUS:
- Jos VANHUS unohtaa oman tekemisensä → memory-merkintä
- Jos AINA (assistentti) ei muista mitä vanhus on aiemmin 
  kertonut, ja vanhus joutuu toistamaan → TÄMÄ EI OLE vanhuksen 
  ongelma, vaan assistentin. Älä pisteytä vanhusta tästä.
- Jos vanhus toistuvasti vahvistaa Ainan kysymyksiä ("joo olin", 
  "joo tein") → tämä on assistentin huono kuuntelu, ei vanhuksen 
  muistivika.

Pisteytä vain selkeät vanhuksen kognitiiviset signaalit:
- Sekava aikaorientaatio (väärä vuosi, kuukausi)
- Sananhakuvaikeudet 
- Ymmärtämättömyys peruskysymyksiin
- Saman kysymyksen toistaminen useita kertoja
```

Lisäksi: jos `cognitiveEnabled === false` ja `overall_impression !== "selkeä huoli"`, **ei tallenneta** (jo nykyäänkin osittain — varmistetaan logiikka).

---

**Korjataanko myös virheellinen 18.4. klo 12:00 -arvio?**

`cognitive_assessments`-tauluun jäi virheellinen "selkeä huoli" -rivi (id-puhelu `03f228b8...`). Voin poistaa sen migration-käytön sijaan suoraan delete-kyselyllä, JOS käyttäjä haluaa siivota historian. Suosittelen poistoa, koska se vaikuttaa CognitiveAlertBanner-komponentin näkymään etusivulla.

---

**Tiedostot:**
```text
MUOKATAAN:
  supabase/functions/vapi-webhook/index.ts        (extractMemories + extractCognitiveAssessment promptit)
  supabase/functions/vapi-assistant-request/index.ts  (kontekstin haku + Aina-prompti)

DATA (käyttäjän hyväksynnällä):
  DELETE cognitive_assessments WHERE id = '...'   (virheellinen "selkeä huoli" -arvio 18.4.)
```

Ei skeemamuutoksia, ei uusia funktioita, ei UI-muutoksia. Korjaus vaikuttaa heti seuraavasta puhelusta.
