

User wants two things:
1. Helsingin Sanomat news integration — read top 2 domestic news to elder on request
2. Cost optimization — limit Hume AI (and possibly GPT) emotion analysis to first ~1 minute of audio

Let me think about this:

**HS API**: HS doesn't have a public free API. Options:
- HS RSS feed (free, public): https://www.hs.fi/rss/tuoreimmat.xml — gives latest, not "most read"
- HS "Luetuimmat" RSS: https://www.hs.fi/rss/most-read.xml exists for some sections
- Yle has good open RSS too as fallback
- Most read specifically requires checking — HS has rss for luetuimmat at certain URLs

For cost optimization:
- Hume processes the whole audio file. To limit to 1 min, we'd need to trim audio before sending to Hume
- Use ffmpeg? Not available in edge functions easily. Better: use Hume's prosody granularity + slice audio
- Actually simplest: download audio, slice first 60s using a small audio processing approach. WAV files are easy to slice by byte if we know format, but mp3/various — tricky in Deno
- Alternative: Hume API supports passing a URL — we can't tell Hume "only first 60s". So we must trim ourselves
- Use `https://deno.land/x/...` or send to a tiny processing step. Actually we can use `ffmpeg` via WASM but heavy
- Simpler: most call recordings from Vapi are mono WAV or MP3. We could fetch only first N bytes via Range header — risky for codec integrity
- Best approach: use `fluent-ffmpeg` won't work in Deno edge. Use `https://esm.sh/...` audio trimmer — limited
- Practical: pass `transcription`-aware truncation — for GPT, just truncate the transcript before sending. For Hume, the cleanest solution is to use Vapi's recording config to limit, OR fetch the audio and use a Deno-compatible audio trimmer

Actually, Hume's pricing is per-minute of audio. So we genuinely need to send shorter audio. Solutions:
- A) Add a new edge function that uses ffmpeg WASM (e.g. `@ffmpeg/ffmpeg`) — heavy but works
- B) Use Vapi's webhook to get audio URL, then download → send to a processing service
- C) Simpler: Hume has `prosody` granularity — but it still bills full duration

Best practical: use ffmpeg WASM in edge function to trim to 60s before uploading to Hume. There's `https://deno.land/x/deno_ffmpeg` but requires native ffmpeg binary on host — not available in Supabase edge.

Alternative: use a Deno-compatible WAV trimmer (if Vapi recordings are WAV). For MP3 we'd need decoding. Vapi typically provides WAV recordings for transcription.

Let me check Vapi recording format — Vapi supports both WAV and MP3, configurable. Default is often WAV.

Pragmatic plan: 
- For WAV: parse header, calculate bytes for 60s, slice. Simple, no library needed.
- For MP3: fall back to sending full audio
- For GPT: just truncate transcript to first ~1500 chars (≈ first minute of speech) before mood analysis

For HS news:
- Use HS RSS: `https://www.hs.fi/rss/tuoreimmat.xml` (newest) and try `https://www.hs.fi/rss/kotimaa.xml` for kotimaa
- "Most read" is harder; use top 2 from kotimaa RSS as proxy, OR use Yle's most-read fallback
- Add as Vapi tool: `vapi-get-news` edge function
- Aina asks: "Haluatteko kuulla päivän pääuutiset?" — if yes, calls tool, reads top 2 headlines + short summary

Need to ask user 1-2 clarifying questions to keep plan focused. Actually they were quite specific. Let me just present plan.

Keep plan concise.

