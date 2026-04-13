

## Lisää puhelun tyyppi (inbound/outbound) puheluraportteihin

### Ongelma
Puheluraporteissa ei näy, oliko puhelu sisäänkisoitto (inbound) vai ulossoitto (outbound/scheduled). Tieto on jo tallennettuna `call_reports.call_type` -kentässä, mutta sitä ei näytetä käyttöliittymässä.

### Muutokset

**Tiedosto: `src/pages/ElderDetail.tsx`** (rivin 590 jälkeen)
- Lisätään puhelutyypin badge jokaisen puheluraportin riville
- Näytetään tyyppi suomeksi selkeällä merkinnällä:
  - `inbound` → "📲 Sisääntuleva"
  - `scheduled` / `morning` / `evening` → "📞 Ajoitettu"
  - `retry` → "🔄 Uudelleensoitto"  
  - `*_skipped` → "⏭️ Ohitettu"
- Badge sijoitetaan päivämäärän ja keston viereen samalle riville

### Tekninen toteutus
- Luodaan pieni apufunktio `callTypeLabel(call_type)` joka palauttaa suomenkielisen tekstin ja ikonin
- Lisätään badge `<span>` elementtinä olemassa olevaan flex-riviin
- Ei tarvita tietokantamuutoksia, data on jo olemassa

