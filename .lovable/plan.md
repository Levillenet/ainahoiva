

## Diagnoosi

**Data EI ole hävinnyt.** Tarkistin tietokannan:
- Sami: `legacy_profile` tallessa, `onboarding_completed=true`, `legacy_subscriptions.status='active'`, 15 `coverage_map`-riviä.
- LegacyDashboard listaa Samin oikein "Käynnissä olevat tarinat" -puolelle.

**Oikea ongelma — UX-aukko:**

Kun käyttäjä tallentaa onboardingin ja käy sitten päävalikosta **"Vanhukset" → Sami**, hän päätyy `ElderDetail`-sivulle joka on hoivapalvelun perusnäkymä (puhelut, lääkkeet, tunteet) — siellä **ei ole mitään mainintaa** Muistoissa-tilauksesta tai linkkiä Muistoissa-näkymään. Käyttäjä luulee että data on poissa.

Lisäksi: jos käyttäjä klikkaa "Aloita Muistoissa" toistamiseen jollekin vanhukselle joka jo on tilattu, hän päätyy onboardingiin ilman varoitusta — toinen sekoittava polku.

## Korjaussuunnitelma — 2 pientä muutosta

### 1. `src/pages/ElderDetail.tsx` — lisää Muistoissa-tilakortti

Lisää sivun yläosaan (esim. heti otsikon alle) pieni kortti joka näkyy **vain jos** `legacy_subscriptions.status === 'active'` kyseiselle vanhukselle:

```
┌──────────────────────────────────────────────┐
│ 📖 Aina Muistoissa — aktiivinen              │
│ Edistymä 12% · Arvioitu valmistuminen 4/2027 │
│                          [ Avaa Muistoissa → ]│
└──────────────────────────────────────────────┘
```

Linkki vie `/dashboard/muistoissa/${elderId}`. Tämä yhdistää kaksi näkymää ja näyttää käyttäjälle ettei mitään ole hävinnyt.

### 2. `src/pages/legacy/LegacyOnboarding.tsx` — varmista ettei onboardingiin pääse uudelleen

Lisää `useEffect` joka komponentin latautuessa tarkistaa `legacy_profile.onboarding_completed`-tilan ja **ohjaa suoraan** `/dashboard/muistoissa/${elderId}`-sivulle jos tilaus on jo tehty. Näin estetään uudelleentäyttöyritykset (joista käyttäjä saattaisi tulkita että edellinen data hävisi).

### (Valinnainen) 3. Pieni leivänmurupolku LegacyElderView'iin

Lisää LegacyElderView'iin vasemman yläkulman "Takaisin"-linkin viereen lisälinkki "→ Vanhuksen perustiedot" joka vie `ElderDetail`-sivulle. Auttaa navigoimaan kahden näkymän välillä.

## Tiedostot

```text
MUOKATAAN:
  src/pages/ElderDetail.tsx                     (Muistoissa-tilakortti yläosaan)
  src/pages/legacy/LegacyOnboarding.tsx         (redirect jos jo tehty)
  src/pages/legacy/LegacyElderView.tsx          (linkki perustietoihin — valinnainen)
```

Ei skeemamuutoksia, ei datan korjausta — Samin tiedot ovat jo oikein tallessa.

