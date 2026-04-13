

## Korjaa puhelinnumeroiden vertailu välilyöntiongelman takia

### Ongelma
JYKÄ:n puhelinnumero tietokannassa on `+358 44 0444298` mutta Vapi lähettää `+358440444298`. Suora `eq()`-vertailu epäonnistuu, eikä raporttia tallenneta.

### Ratkaisu
Kaksi muutosta varmuuden vuoksi:

**1. `supabase/functions/vapi-webhook/index.ts`**
- Poista välilyönnit ja viivat saapuvasta puhelinnumerosta ennen hakua
- Käytä tietokantahakua, joka poistaa välilyönnit myös tietokannan puolelta: `replace(phone_number, ' ', '')` SQL-funktiolla
- Käytännössä: vaihda `.eq("phone_number", callerNumber)` käyttämään normalisoitua numeroa, esim. haetaan kaikki elderit ja vertaillaan normalisoituna, TAI luodaan tietokantafunktio

Yksinkertaisin ratkaisu: normalisoi numero koodissa ja käytä Supabase `.filter()` tai `.rpc()` -kutsua. Koska Supabase JS-kirjasto ei tue SQL-funktioita suoraan eq:ssa, paras tapa on:
- Luodaan DB-funktio `find_elder_by_phone(p_phone text)` joka vertailee normalisoituja numeroita
- TAI normalisoidaan puhelinnumerot tietokannassa (poistetaan välilyönnit) ja normalisoidaan myös saapuva numero

Suositeltavin: **Normalisoi saapuva numero JA tee haku `ilike`/`filter`-tyyppisellä vertailulla**, tai vielä paremmin:

**Vaihtoehto A (nopein, luotettavin):**
1. Luo DB-funktio `find_elder_by_phone` joka normalisoi molemmat puolet
2. Kutsu sitä webhookissa `supabase.rpc("find_elder_by_phone", { p_phone: normalizedNumber })`

**Vaihtoehto B (yksinkertaisin):**
1. Normalisoi saapuva numero (poista välilyönnit/viivat)
2. Hae kaikki elderit ja vertaa normalisoituna koodissa — ei skaalaudu hyvin

**Valittu ratkaisu: Vaihtoehto A**

### Muutokset

**Tietokantamigraatio:**
```sql
CREATE OR REPLACE FUNCTION public.find_elder_by_phone(p_phone text)
RETURNS TABLE(id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, full_name
  FROM elders
  WHERE replace(replace(replace(phone_number, ' ', ''), '-', ''), '(', '') 
      = replace(replace(replace(p_phone, ' ', ''), '-', ''), '(', '')
  LIMIT 1;
$$;
```

**`supabase/functions/vapi-webhook/index.ts`:**
- Normalisoi `callerNumber`: `callerNumber.replace(/[\s\-()]/g, "")`
- Korvaa suora `.from("elders").select().eq("phone_number", ...)` -haku kutsulla:
  ```typescript
  const { data: elders } = await supabase.rpc("find_elder_by_phone", { p_phone: normalizedNumber });
  const elder = elders?.[0] ?? null;
  ```

Nämä kaksi muutosta varmistavat, että puhelinnumeroiden vertailu toimii riippumatta muotoilusta.

