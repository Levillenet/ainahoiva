
Käyttäjä haluaa että:
1. Ottaa ladatun .wav-tiedoston (Samin Muistoissa-puhelu, vapi_call_id `019da11d-4d8a-7000-ad8a-8bfdcb3fa9ca`)
2. Litteroi sen (puheentunnistus → teksti)
3. Tallentaa sen Samin ensimmäiseksi Muistoissa-puheluksi `call_reports`-tauluun

## Tutkimus

Sami on `36da778e-7336-451a-8123-c84ab87982ba` (näkyi current-routesta aiemmin).

## Suunnitelma

### Vaihe 1: Litteroi audio
Käytän OpenAI Whisper API:a tai Lovable AI Gateway:n vastaavaa palvelua. Lovable AI Gateway:ssä ei ole suoraan whisper-mallia listattuna, mutta `gemini-2.5-flash` ja `gpt-5-mini` -mallit eivät tee puheentunnistusta — ne käsittelevät jo valmista tekstiä.

Vaihtoehdot:
- **A) OpenAI Whisper API** — vaatii OPENAI_API_KEY:n. Ei ole secretsissä.
- **B) Lovable AI Gateway audio-mallit** — gemini-2.5-pro tukee audiota. Voin lähettää audion base64:nä ja pyytää litterointia.
- **C) Hume API** — meillä on HUME_API_KEY mutta se on emotion analysis, ei transkriptio.

Käytän vaihtoehtoa B: Gemini 2.5 Pro tukee audiota multimodaalisena syötteenä Lovable AI Gateway:n kautta.

Toteutus exec-skriptinä (ei tarvitse luoda edge-funktiota tähän kertaluonteiseen tehtävään):
1. Kopioi audio /tmp/:hen
2. Lue base64
3. POST Lovable AI Gateway:lle gemini-2.5-pro mallilla, mukana audiopayload + prompt: "Litteroi tämä suomenkielinen puhelu Aina/Sami -muodossa"
4. Tulosta transkripti

### Vaihe 2: Tallenna call_reports-tauluun
INSERT-komento `supabase--insert`-työkalulla:
- elder_id: `36da778e-7336-451a-8123-c84ab87982ba`
- call_type: `muistoissa`
- vapi_call_id: `019da11d-4d8a-7000-ad8a-8bfdcb3fa9ca`
- transcript: <litteroitu teksti>
- called_at: nyt
- duration_seconds: lasketaan ffprobe:lla audiotiedostosta

### Vaihe 3: Vahvistus
Supabase-querylla varmistus että rivi on tallessa.

## Tiedostot

Ei pysyviä tiedostomuutoksia — tämä on yksittäinen data-task.

## Riskit
- Lovable AI Gateway:n audio-tuki: jos gemini-2.5-pro ei hyväksy audiota base64:nä (vaan vain inline_data fileURI:nä), joudun kokeilemaan toista lähestymistapaa
- Audio voi olla pitkä — gemini-2.5-pro tukee pitkiä audiotiedostoja
