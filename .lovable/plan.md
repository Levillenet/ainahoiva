

Käyttäjä sanoo että Aina kertoo kellonajan tunnin myöhässä: sanoo 20:42 vaikka oikea aika on 21:42. Tämä on klassinen aikavyöhykeongelma — Helsinki on tällä hetkellä EEST (UTC+3) koska on huhtikuu (kesäaika alkoi maaliskuun lopussa).

Pitää tutkia miten `now`-muuttuja muodostetaan vapi-assistant-request-funktiossa ja missä formaatissa se annetaan promptiin.

Todennäköiset ongelmakohdat:
1. `now`-muuttuja käyttää `toLocaleString` ilman `timeZone: "Europe/Helsinki"` -optiota
2. Tai käyttää manuaalista offset-laskentaa joka ei huomioi DST:tä
3. `getHelsinkiHour()` korjattiin aiemmin mutta itse `now`-stringi (joka näytetään promptissa) jäi vanhaan logiikkaan

Tutkin tiedoston nopeasti ennen suunnitelmaa.

## Suunnitelma: korjataan kellonajan formatointi promptissa

### Ongelma

`getHelsinkiHour()` korjattiin aiemmin Intl.DateTimeFormat:lla, mutta itse `now`-string (jonka Aina lukee ääneen) muodostetaan todennäköisesti edelleen tavalla joka antaa tunnin vähemmän. Helsinki on huhtikuussa EEST (UTC+3), mutta jos koodi käyttää kiinteää +2h offsettia tai `toLocaleString` ilman aikavyöhykettä, tulos on tunnin myöhässä.

### Korjaus

Yksi tiedosto, yksi funktio: tutkitaan `vapi-assistant-request/index.ts` ja korvataan `now`-muuttujan rakentaminen samalla `Intl.DateTimeFormat`-tekniikalla kuin `getHelsinkiHour`:

```typescript
function getHelsinkiNowString(): string {
  return new Intl.DateTimeFormat("fi-FI", {
    timeZone: "Europe/Helsinki",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}
```

Tämä antaa esim. `"perjantaina 17. huhtikuuta klo 21.42"` — oikealla DST-aikavyöhykkeellä.

Tarkistetaan myös `outbound-call/index.ts` saman ongelman varalta.

### Tiedostot

```text
MUOKATAAN:
  supabase/functions/vapi-assistant-request/index.ts — korvaa now-stringin muodostus
  supabase/functions/outbound-call/index.ts          — sama jos sama bugi siellä
```

### Deployaus

Deployataan molemmat funktiot heti korjauksen jälkeen.

