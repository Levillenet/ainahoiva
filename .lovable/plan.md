

User wants a single, specific addition to `STATIC_ASSISTANT_CONFIG` in `supabase/functions/vapi-assistant-request/index.ts` — adding a `startSpeakingPlan` block right after `analysisPlan`, then deploying the function.

This is a trivial, well-specified edit. No clarification needed. I just need to confirm the location exists.

## Suunnitelma: Lisää `startSpeakingPlan` Vapi-assistenttiin

### Muutos

**`supabase/functions/vapi-assistant-request/index.ts`**

Lisätään `STATIC_ASSISTANT_CONFIG`-olion sisään, heti `analysisPlan`-lohkon jälkeen:

```typescript
startSpeakingPlan: {
  waitSeconds: 0.4,
  smartEndpointingEnabled: false,
  transcriptionEndpointingPlan: {
    onPunctuationSeconds: 0.4,
    onNoPunctuationSeconds: 1.5,
    onNumberSeconds: 0.5,
  },
},
```

### Vaikutus

```text
Aina odottaa 0.4 s ennen vastausta (ennen oletusarvo)
Päätemerkin jälkeen:        0.4 s  → nopea vastaus selkeisiin lauseisiin
Ilman päätemerkkiä:         1.5 s  → ikäihminen ehtii miettiä
Numeron jälkeen:            0.5 s  → estää keskeyttämästä esim. "klo 8..."
Smart endpointing pois     → ennustettavampi käytös vanhusten hitaammalle puheelle
```

### Käyttöönotto

1. Muokataan `vapi-assistant-request/index.ts`
2. Deployataan funktio

### Tiedostot

```text
MUOKATAAN:
  supabase/functions/vapi-assistant-request/index.ts   — startSpeakingPlan-lohko
```

