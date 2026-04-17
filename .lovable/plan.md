

User wants to add all listed Yle concept-based categories. I should be honest: in my previous message I listed concept IDs from memory, and several are duplicates or guesses (Politiikka and Terveys both 18-35138 — clearly wrong; Kulttuuri 18-215 vs Tiede 18-212 look suspicious). Before bloating the function with 11 categories that may 404 or return wrong content, we should verify each feed actually works.

Plan: verify feeds first (in implementation mode via curl), keep working ones, drop broken ones, then expand.

## Suunnitelma: Laajennetaan uutiskategoriat 11:een — varmistetaan ensin että fiidit toimivat

### Rehellinen huomio

Edellisessä viestissäni listasin concept-ID:t muistinvaraisesti. Osa on selvästi vääriä:
- Politiikka ja Terveys molemmat `18-35138` → sama ID ei voi olla kahta asiaa
- Kulttuuri `18-215` ja Tiede `18-212` → epäilyttävän lyhyitä, todennäköisesti vääriä

Siksi **ennen kuin lisätään 11 kategoriaa, testataan jokainen RSS-URL** ettei Aina lupaa "kerron talousuutiset" ja saa tyhjän vastauksen tai väärän aiheen otsikoita.

### Vaiheet

**Vaihe 1 — Verifiointi (curl jokaiseen feediin)**

Käydään läpi kaikki 11 ehdotettua URL:ää:
```text
https://feeds.yle.fi/uutiset/v1/recent.rss?publisherIds=YLE_UUTISET&concepts=<id>
```
Tarkistetaan jokaisesta:
- HTTP 200 OK
- Sisältää `<item>`-elementtejä
- Otsikot vastaavat kategoriaa (esim. talous-feedissä puhutaan taloudesta)

Etsitään myös oikeat ID:t epäilyttäville (politiikka, terveys, kulttuuri, tiede) Ylen Areenan/uutissivuston kategorialinkeistä tai web-haulla.

**Vaihe 2 — Lisätään vain toimivat kategoriat `vapi-get-news/index.ts`:ään**

`YLE_FEEDS`-objektiin uudet avaimet (vain niille jotka läpäisivät testin). Säilytetään nykyiset (`headlines`, `kotimaa`, `ulkomaat`, `urheilu`).

**Vaihe 3 — Päivitetään `normalizeCategory` puhekielisillä muunnoksilla**

```text
talous     ← "talousuutiset", "pörssi", "raha-asiat", "talouselämä"
politiikka ← "politiikan uutiset", "eduskunta", "hallitus"
kulttuuri  ← "kulttuuriuutiset", "taide", "musiikki"
tiede      ← "tiedeuutiset", "tutkimus"
luonto     ← "luontouutiset", "ympäristö", "ilmasto"
terveys    ← "terveysuutiset", "sairaudet"
liikenne   ← "liikenneuutiset", "ruuhkat", "tiet"
media      ← "mediauutiset"
saa        ← "sää", "säätiedot", "sääennuste"
```

**Vaihe 4 — Päivitetään `vapi-assistant-request/index.ts` system prompt**

Aina ei voi luetella 11 kategoriaa puhelussa (liian pitkä). Sen sijaan:
- Aina kysyy avoimesti: *"Mitä uutisia haluaisitte kuulla? Voin lukea esimerkiksi pääuutiset, kotimaan, ulkomaat, talouden, urheilun tai sään."*
- Jos asiakas pyytää muuta (politiikka, kulttuuri, tiede, luonto, terveys, liikenne, media), Aina osaa silti kutsua oikealla `category`-arvolla
- Tool-skeemaan lisätään kaikki toimivat enum-arvot

**Vaihe 5 — Säätiedot (erikoistapaus)**

Sää-RSS palauttaa todennäköisesti yleistä sääuutista, ei lähikunnan ennustetta. Jos halutaan oikea ennuste asiakkaan kotipaikkakunnalle, tarvitaan erillinen FMI:n avoin rajapinta (Open Data WFS) — paljon isompi työ. Tässä vaiheessa: vain Yle Sää -RSS otsikot. Lisätään **TODO-kommentti** koodiin tarkemmasta ennusteesta myöhemmin.

**Vaihe 6 — Deployataan `vapi-get-news` ja `vapi-assistant-request`**

### Tiedostot

```text
MUOKATAAN:
  supabase/functions/vapi-get-news/index.ts          — YLE_FEEDS + normalizeCategory laajennus
  supabase/functions/vapi-assistant-request/index.ts — read_news-tool enum + prompt päivitys

VERIFIOIDAAN AJON AIKANA (curl):
  11 Yle RSS-URL:ää — vain toimivat lisätään lopulliseen koodiin
```

### Riskit ja hyväksyntä

- Jos useampi feedi ei toimi → kerron rehellisesti mitkä jätettiin pois
- Lisäkustannus: nolla (Yle RSS on ilmainen)
- Vapi tool latency ei kasva (yksi feedi per kutsu)

