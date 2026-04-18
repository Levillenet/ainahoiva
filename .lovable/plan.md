
Selkeä, fokusoitu kehittäjätyökalu. Käyttäjä antoi tarkat ohjeet — toteutetaan suoraan.

Tarkistan ensin nopeasti:
1. Onko `OPENAI_API_KEY` jo secreteissä? → Ei näy listassa, mutta `LOVABLE_API_KEY` on. Käytetään mieluummin Lovable AI Gatewayta (`google/gemini-2.5-flash` vastaa hyvin gpt-4o-minin tasoa nopeudessa/hinnassa) — se on jo konfiguroitu eikä vaadi uutta secretiä. Tämä noudattaa myös Lovable-platformin ohjeita.
2. `vapi-muistoissa-request` rakenne (käytän DRY-tyylillä — kopioin promptinrakennuksen testifunktioon, en tee jaettua moduulia koska edge functionit eivät jaa moduuleja helposti).
3. Onko admin-järjestelmää? Schemassa ei ole `profiles`-taulua eikä `is_admin`-kenttää. Käytän **vaihtoehto A** (`import.meta.env.DEV`) — yksinkertaisin, ja käyttäjä antoi vaihtoehdon. Voi myöhemmin laajentaa.

### Tiedostot

**LUODAAN:**
- `supabase/functions/test-chat-reply/index.ts` — Lovable AI Gateway -kutsu, sama prompt-rakennus + topic-valinta kuin Vapissa
- `src/pages/legacy/LegacyTestChat.tsx` — chat-UI 2/3 + 1/3 layout, debug-paneeli, kustannuslaskuri, skenaariot, modal koko prompille
- `src/lib/testScenarios.ts` — 10 skenaariota

**MUOKATAAN:**
- `src/App.tsx` — lisää reitti `muistoissa/:elderId/testaa`
- `src/pages/legacy/LegacyElderView.tsx` — lisää "Testaa algoritmia" -nappi `import.meta.env.DEV`-ehdolla

### Tekniset valinnat
- **AI-malli**: `google/gemini-2.5-flash` Lovable AI Gatewayn kautta (vastaa pyydettyä halpaa+nopeaa profiilia, ei vaadi OPENAI_API_KEYä). Päivitän kustannuslaskurin tämän mallin hintoihin (Gemini 2.5 Flash on tällä hetkellä ilmainen Lovable AI:lla 6.10.2025 asti, mutta pidän laskurin paikalla informatiivisena placeholderina).
- **Tallennus** `call_reports.call_type='test_chat'` — sallittu nykyisellä CHECK-rajoituksella? Migration lisäsi check-listan `('basic','reminder','emergency','muistoissa')` — `test_chat` puuttuu! → **Tarvitaan migration** joka laajentaa CHECK-rajoituksen sisältämään `'test_chat'`.

### Migration
ALTER call_reports check constraint lisätäkseen `'test_chat'`-arvon.

Aloitan migration-tool-kutsulla.
