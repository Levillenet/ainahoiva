
Käyttäjä on jo rekisteröinyt 4 toolia Vapi-dashboardissa ja antoi täsmälliset spesifikaatiot. Tämä on suoraviivainen toteutus — ei tarvitse selvennystä. Tarkistan vain `vapi-add-memory`-mallin rakenteen lyhyesti varmistaakseni ettei mene päällekkäin.

Tärkeät havainnot spesifikaatiosta:
- elderId tulee `call.metadata.elderId` (ei phone-lookup) → yksinkertaisempi kuin nykyinen `vapi-add-memory`
- Vastaus EI ole `{result: "ok"}` vaan `{results: [{toolCallId, result}]}` (Vapi tool-calls -formaatti)
- Toolin nimet Vapissa ovat lyhyitä (esim. `save_memory`) — funktion nimi/URL on eri asia
- `update-coverage`: `depth_score += depth_increment * 10` capattuna 100:aan
- `save-observation`: type-mapping 5 arvoa → 2 tietokanta-arvoa (`sensitive_topic` / `suggestion` / `milestone`)
- `save-quote`: `week_start` lasketaan maanantaiksi Helsinki-aikavyöhykkeessä

## Toteutus — 4 uutta Edge Functionia

### 1. `supabase/functions/vapi-muistoissa-add-memory/index.ts`
- Parsii `elderId` metadatasta + argumentit toolCallista
- Insert `elder_memory` (`elder_id`, `memory_type`, `content`)
- Jos `event_date` annettu → prefiksoi `content` muotoon `[YYYY-MM-DD] ...`
- Jos `target_chapter` annettu → upsert `coverage_map` (`life_stage = target_chapter`): `last_discussed = now()`, `questions_asked += 1`
- Palauttaa `{results: [{toolCallId, result: "Muisto tallennettu..."}]}`

### 2. `supabase/functions/vapi-muistoissa-update-coverage/index.ts`
- Hakee `coverage_map`-rivin `(elder_id, life_stage, theme)` (theme voi olla null)
- Jos rivi puuttuu → insert; muuten update:
  - `depth_score = LEAST(100, COALESCE(depth_score,0) + depth_increment * 10)`
  - `status = annetut`
  - `last_discussed = now()`
  - `questions_asked = COALESCE(questions_asked,0) + 1`
- Tehdään SELECT → laskenta → UPDATE/INSERT (ei raw SQL, käytetään supabase-clientiä)

### 3. `supabase/functions/vapi-muistoissa-save-quote/index.ts`
- Insert `legacy_highlights`: `elder_id`, `quote`, `context`, `target_chapter`, `week_start`
- `week_start` laskenta:
  ```ts
  const nowHelsinki = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/Helsinki"}));
  const day = nowHelsinki.getDay(); // 0=su
  const offset = day === 0 ? -6 : 1 - day;
  const monday = new Date(nowHelsinki);
  monday.setDate(monday.getDate() + offset);
  const weekStart = monday.toISOString().slice(0,10);
  ```

### 4. `supabase/functions/vapi-muistoissa-save-observation/index.ts`
- Type-mapping objekti:
  ```ts
  const TYPE_MAP = {
    topic_declined: "sensitive_topic",
    suggestion_for_family: "suggestion",
    milestone_reached: "milestone",
    emotional_moment: "sensitive_topic",
    unresolved_thread: "suggestion",
  };
  ```
- Insert `legacy_observations`: `elder_id`, `type`, `title`, `description`

### Yhteinen rakenne kaikille
- `import { createClient } from "https://esm.sh/@supabase/supabase-js@2"` (sama kuin `vapi-add-memory`)
- CORS-headerit (OPTIONS-käsittely)
- Try/catch — virhe palauttaa `{results: [{toolCallId, error: "..."}]}` 200-statuksella (jotta puhelu ei katkea)
- `console.log` jokaisessa kriittisessä kohdassa Vapi-dashboardin debugausta varten:
  - `[muistoissa-X] received:` body
  - `[muistoissa-X] elderId:` ...
  - `[muistoissa-X] args:` ...
  - `[muistoissa-X] db result:` ...
  - `[muistoissa-X] error:` ...
- Argumentit voivat tulla joko stringinä (`JSON.parse`) tai objektina — käsitellään molemmat
- Fallback: jos `elderId` puuttuu metadatasta → palautetaan virhe selkeästi
- `verify_jwt = false` lisätään `supabase/config.toml`-tiedostoon kaikille neljälle funktiolle (Vapi ei lähetä JWT:tä)

### Tiedostot
```text
LUODAAN:
  supabase/functions/vapi-muistoissa-add-memory/index.ts
  supabase/functions/vapi-muistoissa-update-coverage/index.ts
  supabase/functions/vapi-muistoissa-save-quote/index.ts
  supabase/functions/vapi-muistoissa-save-observation/index.ts

MUOKATAAN:
  supabase/config.toml   (verify_jwt=false neljälle uudelle funktiolle)
```

Ei skeemamuutoksia — kaikki sarakkeet ovat jo olemassa (`elder_memory`, `coverage_map`, `legacy_highlights`, `legacy_observations`).

Ei muutoksia olemassa olevaan `vapi-add-memory`-funktioon — se jää geneerisille hoivapuheluille.
