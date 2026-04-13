

## Vapi Assistant webhook-URL:n päivitys

### Tavoite
Päivitä Vapi-assistantin (`c19c2445-c22a-4c52-8831-3b882fc38d4b`) `serverUrl`-kenttä osoittamaan webhook-funktioosi.

### Toteutus

Luodaan väliaikainen edge function `update-vapi-assistant`, joka tekee PATCH-kutsun Vapi API:in:

```typescript
// supabase/functions/update-vapi-assistant/index.ts
const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
const res = await fetch(
  "https://api.vapi.ai/assistant/c19c2445-c22a-4c52-8831-3b882fc38d4b",
  {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${VAPI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      serverUrl: "https://bjsthjvpotfcxgqxtoiy.supabase.co/functions/v1/vapi-webhook"
    }),
  }
);
```

### Vaiheet
1. Luo `update-vapi-assistant` edge function
2. Deploy se
3. Kutsu sitä kerran curl-työkalulla
4. Varmista vastaus (serverUrl päivittynyt)
5. Poista funktio (ei enää tarvita)

