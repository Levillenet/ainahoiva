

## Ongelma

Puhelut on tehty Vapin kautta, mutta raportit jäävät tilaan "Soitto käynnistetty — odottaa vastausta" koska:

1. **Vapi webhook ei ole koskaan lauennut** — edge function lokeissa ei ole yhtään kutsua `vapi-webhook`-funktiolle. Tämä tarkoittaa, että Vapi ei tiedä mihin lähettää puhelun lopputuloksen.
2. **Duplikaattiongelma** — `outbound-call` luo uuden `call_reports`-rivin, ja `vapi-webhook` luo *toisen* rivin sen sijaan että päivittäisi olemassaolevan.

## Korjaussuunnitelma

### 1. Vapi webhook URL täytyy asettaa Vapi-dashboardissa

Vapin assistantin asetuksissa "Server URL" pitää olla:
```
https://bjsthjvpotfcxgqxtoiy.supabase.co/functions/v1/vapi-webhook
```
**Tämä on sinun tehtäväsi** — mene Vapi-dashboardiin ja aseta tämä URL assistantin asetuksiin.

### 2. Korjaa duplikaattiongelma koodissa

**outbound-call**: Tallenna Vapi call ID (`result.id`) call_reports-riviin.

**vapi-webhook**: Sen sijaan että luodaan uusi rivi, etsitään olemassa oleva rivi Vapi call ID:llä ja päivitetään se. Jos ei löydy, luodaan uusi (inbound-puhelut).

### Tekniset muutokset

**Tietokanta**: Lisää `vapi_call_id text` -sarake `call_reports`-tauluun + UPDATE RLS-policy.

**outbound-call/index.ts**: Tallenna `result.id` vapi_call_id-sarakkeeseen insertin yhteydessä.

**vapi-webhook/index.ts**: 
- Hae Vapi call ID webhookin payloadista (`message.call.id`)
- Yritä ensin `UPDATE` olemassa olevaa riviä `vapi_call_id`-kentällä
- Jos ei löydy, tee `INSERT` (inbound-puheluille)

