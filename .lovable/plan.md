
Käyttäjä haluaa että asetan Vapi Server URL:n API:n kautta (ei dashboardissa) ja testaan että se toimii. Onneksi projektissa on jo olemassa `set-vapi-server-url`-edge function, mutta se on hardkoodattu vanhalle Aina-assistantille (`c19c2445...`) eikä Muistoissa-assistantille (`b497059c...`). Lisäksi se asettaa väärän serverUrl:n (`vapi-assistant-request` eikä `vapi-muistoissa-webhook`).

## Suunnitelma

### Vaihe 1: Päivitä `set-vapi-server-url` tukemaan molempia assistantteja

Muokkaan `supabase/functions/set-vapi-server-url/index.ts` ottamaan query-parametrin `?assistant=muistoissa` tai `?assistant=aina`:
- `aina` (default): assistant `VAPI_ASSISTANT_ID`, serverUrl → `vapi-assistant-request`
- `muistoissa`: assistant `VAPI_MUISTOISSA_ASSISTANT_ID`, serverUrl → `vapi-muistoissa-webhook`

Funktio käyttää jo `VAPI_API_KEY`-secretiä joka on olemassa, joten ei tarvita uusia secretejä.

### Vaihe 2: Kutsu funktiota Muistoissa-parametrilla

Käytän `supabase--curl_edge_functions`-työkalua kutsumaan `/set-vapi-server-url?assistant=muistoissa` ja varmistan että Vapi-API palauttaa `serverUrl: "https://bjsthjvpotfcxgqxtoiy.supabase.co/functions/v1/vapi-muistoissa-webhook"`.

### Vaihe 3: Varmista myös webhook-tilausten asetukset

Vapi-assistantilla pitää myös olla `serverMessages: ["end-of-call-report"]`. Lisään tämän PATCH-pyyntöön samalla kertaa, jotta `end-of-call-report` -tapahtuma varmasti laukaisee webhookin.

### Vaihe 4: Testikutsu webhookiin

Testaan vielä että `vapi-muistoissa-webhook` itse vastaa (lähetän tyhjän `OPTIONS`-pyynnön + dummy-payloadin jossa `messageType !== "end-of-call-report"`, jolloin pitäisi palauttaa `{ok: true, ignored: ...}`).

## Tiedostot

```text
MUOKATAAN:
  supabase/functions/set-vapi-server-url/index.ts
    - Lue ?assistant=muistoissa|aina query-parametri
    - Valitse oikea assistantId ja serverUrl sen perusteella
    - PATCH-bodyyn lisätään serverMessages: ["end-of-call-report"]
```

Ei muita muutoksia. Ei skeemamuutoksia. Ei UI-muutoksia.

## Testaus suunnitelman jälkeen

1. Curl: `POST /set-vapi-server-url?assistant=muistoissa` → odotetaan 200 + oikea serverUrl Vapin vastauksessa
2. Curl: `POST /vapi-muistoissa-webhook` dummy-payloadilla → odotetaan `{ok: true, ignored: ...}`
3. Käyttäjä voi sen jälkeen tehdä oikean Muistoissa-puhelun ja transcripti tallentuu `call_reports`-tauluun automaattisesti.
