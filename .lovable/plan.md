## Tavoite
Lisätä mahdollisuus poistaa vanhus järjestelmästä — sekä vanhuslistalta (`/dashboard/vanhukset`) että vanhuksen tietosivulta (`/dashboard/vanhukset/:id`).

## Muutokset

### 1. `src/pages/EldersList.tsx`
- Lisätään jokaiseen vanhuskorttiin "Poista"-painike (punainen, `Trash2`-ikoni, terracotta-tyyli) "Avaa tiedot" -napin viereen.
- Painike avaa `AlertDialog`-vahvistuksen suomeksi: *"Poista vanhus pysyvästi? Tätä toimintoa ei voi peruuttaa. Kaikki puhelut, muistot, muistutukset ja lääketiedot poistuvat."*
- Vahvistuksen jälkeen poistetaan **kaskadina** vanhukseen liittyvä data Supabasesta (taulujen välillä ei ole FK-cascadea). Poistojärjestys turvallisesti:
  1. `medication_logs`, `cognitive_assessments`, `chapter_revisions` (riippuvuudet ensin)
  2. `book_chapters`, `chapter_notes`, `coverage_map`, `legacy_highlights`, `legacy_observations`, `legacy_topic_requests`, `legacy_profile`, `legacy_subscriptions`, `profile_summary`
  3. `medications`, `reminders`, `sms_log`, `emergency_alerts`, `emergency_settings`, `family_members`, `missed_call_retries`, `elder_memory`, `call_reports`
  4. Lopuksi `elders`-rivi
- Onnistumisen jälkeen toast "Vanhus poistettu" ja `fetchElders()`.
- Virheet näytetään toastilla mutta jatketaan muiden taulujen poistoa (`Promise.allSettled`).

### 2. `src/pages/ElderDetail.tsx`
- Lisätään sivun yläosaan (otsikon viereen, paluunappi-rivin oikealle) "Poista vanhus" -nappi samalla `AlertDialog`-vahvistuksella.
- Käytetään samaa poistologiikkaa — eristetään apufunktioksi `src/lib/deleteElder.ts` jotta sitä voi kutsua molemmista paikoista.
- Onnistumisen jälkeen `navigate('/dashboard/vanhukset')`.

### 3. Uusi tiedosto `src/lib/deleteElder.ts`
- Vientifunktio `deleteElderCascade(elderId: string): Promise<{ success: boolean; errors: string[] }>` joka hoitaa kaskadipoiston yllä kuvatussa järjestyksessä.

## Tekniset huomiot
- RLS sallii authentikoituneille käyttäjille DELETEn kaikissa relevanteissa tauluissa (tarkistettu: `elders`, `medications`, `reminders`, `family_members`, `elder_memory`, `emergency_settings`, `legacy_*`, `coverage_map`, `missed_call_retries`).
- `call_reports`, `sms_log`, `cognitive_assessments`, `emergency_alerts`, `chapter_revisions`, `nightly_batch_log` **eivät salli DELETEä** authentikoidulle käyttäjälle. Näille tarvitaan joko (a) RLS-policyjen lisäys tai (b) Edge Function `service_role`-avaimella.
- **Suositus:** lisätään uusi DELETE-policy authentikoiduille käyttäjille tauluihin `call_reports`, `sms_log`, `cognitive_assessments`, `emergency_alerts` (chapter_revisions poistuu epäsuorasti book_chaptersin mukana jos lisätään cascade — tehdään se erikseen migraationa). Tämä on yksinkertaisempaa kuin edge function ja yhdenmukaista muiden taulujen kanssa.
- Migraatio lisää myös `ON DELETE CASCADE` -käyttäytymisen poistamatta nykyistä rakennetta — itse asiassa helpompi vain lisätä DELETE-policyt ja hoitaa cascade frontendissä koska FK:ita ei ole määritelty.

## Migraatio
```sql
-- Salli authentikoidut DELETEt poistamista varten
CREATE POLICY "Authenticated users can delete call reports"
  ON public.call_reports FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete sms logs"
  ON public.sms_log FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete cognitive assessments"
  ON public.cognitive_assessments FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete emergency alerts"
  ON public.emergency_alerts FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete chapter revisions"
  ON public.chapter_revisions FOR DELETE TO authenticated
  USING (chapter_id IN (SELECT id FROM public.book_chapters));
```

## Lopputulos
- Vanhuksen voi poistaa yhdellä klikkauksella + vahvistuksella sekä listalta että tietosivulta.
- Kaikki vanhukseen liittyvä data poistetaan kannasta (ei jää orpoja rivejä).
- Vahvistusdialogi estää vahingot.
