

## Ongelman ydin

Vapi-puhelu käynnistyy `muistoissa-start-call`-funktiosta käyttäen `assistantId` → Vapi käyttää suoraan dashboardiin tallennettua staattista assistanttia. Se EI lähetä `assistant-request`-tapahtumaa, joten meidän dynaamista promptia (jossa on edelliset puhelut, coverage_map, vanhuksen profiili) ei koskaan käytetä.

Lisäksi `set-vapi-server-url` asettaa Vapin `serverUrl = vapi-muistoissa-webhook` ja vain `serverMessages: ["end-of-call-report"]` → Vapi ei voi pyytää assistanttia dynaamisesti.

## Korjaus

### 1. Päivitä Vapi-assistantin asetukset suoraan Vapi APIn kautta (kertaluonteinen)

Aja PATCH `/assistant/{VAPI_MUISTOISSA_ASSISTANT_ID}`:
- `serverUrl` → `https://bjsthjvpotfcxgqxtoiy.supabase.co/functions/v1/vapi-muistoissa-request`
- `serverMessages` → `["assistant-request", "end-of-call-report"]`

Tämä saa Vapin lähettämään meille molemmat: alkupromptipyynnön JA loppuraportin samaan endpointtiin. `vapi-muistoissa-request` jo osaa erottaa tyypit ja forwardaa loppuraportit `vapi-muistoissa-webhookkille` (`forwardToWebhook`).

### 2. Päivitä `muistoissa-start-call` käynnistämään puhelu ILMAN assistantId:tä

Vaihda body:

```text
ENNEN:                          JÄLKEEN:
assistantId: VAPI_..._ID    →   (ei kenttää)
phoneNumberId: ...              phoneNumberId: ...
customer: { ... }               customer: { ... }
metadata: { elderId, ... }      metadata: { elderId, ... }
```

Kun `assistantId` puuttuu, Vapi lähettää `assistant-request`-tapahtuman serverUrl:iin ja me palautamme **transient assistantin** dynaamisella system promptilla, joka sisältää elderin profiilin, coverage_mapin, edellisten puheluiden yhteenvedot ja tämän päivän aiheen.

### 3. Päivitä `set-vapi-server-url` lähettämään myös oikeat serverMessages-arvot tulevaisuutta varten

Muuta `serverMessages: ["end-of-call-report"]` → `["assistant-request", "end-of-call-report"]` ja `webhookPath` "muistoissa"-haaralle → `vapi-muistoissa-request`.

### 4. Testaa päästä päähän

1. Aja päivitetty `set-vapi-server-url?assistant=muistoissa` → varmistaa että Vapi-assistant osoittaa `vapi-muistoissa-request`-funktioon
2. Tarkista Vapi-assistantin asetukset GET `/assistant/{id}` ja vahvista että `serverUrl` ja `serverMessages` ovat oikein
3. Käynnistä testipuhelu Samille `muistoissa-start-call`-funktion kautta
4. Lue lokit `vapi-muistoissa-request`-funktiosta — vahvista että `assistant-request` saapuu ja että dynaaminen prompti palautetaan oikein (logissa "Returning Muistoissa-assistant for Sami, topic=...")
5. Soita oikea puhelu ja kuuntele että Aina viittaa edellisiin puheluihin, ei kiittele liikaa eikä kysy "kerro jotain"

## Muutettavat tiedostot

- `supabase/functions/muistoissa-start-call/index.ts` (poista assistantId puhelun käynnistyksestä)
- `supabase/functions/set-vapi-server-url/index.ts` (oikea webhookPath + serverMessages muistoissa-haaralle)

## Mitä EI muuteta

- `vapi-muistoissa-request` — toimii jo oikein (sisältää sekä `assistant-request`-käsittelyn että `forwardToWebhook`-fallbackin)
- `vapi-muistoissa-webhook` — pysyy ennallaan, vastaanottaa puhelun loppuraportit
- System promptin sisältö — viime kerralla parannetut säännöt (kolme tärkeintä sääntöä, konkreettiset kysymykset) ovat jo paikallaan

