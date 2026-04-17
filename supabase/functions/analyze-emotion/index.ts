import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// === Käännökset ===
const TRANSLATIONS: Record<string, string> = {
  "Admiration": "Ihailu", "Adoration": "Palvonta", "Aesthetic Appreciation": "Esteettinen arvostus",
  "Amusement": "Huvittuneisuus", "Anger": "Viha", "Anxiety": "Ahdistus", "Awe": "Hämmästys",
  "Awkwardness": "Kiusaantuneisuus", "Boredom": "Tylsistyminen", "Calmness": "Rauhallisuus",
  "Concentration": "Keskittyminen", "Confusion": "Hämmennys", "Contemplation": "Mietiskely",
  "Contempt": "Halveksunta", "Contentment": "Tyytyväisyys", "Craving": "Himo", "Desire": "Halu",
  "Determination": "Päättäväisyys", "Disappointment": "Pettymys", "Disgust": "Inho",
  "Distress": "Ahdistuneisuus", "Doubt": "Epäily", "Ecstasy": "Hurmio", "Embarrassment": "Häpeä",
  "Empathic Pain": "Empaattinen kipu", "Entrancement": "Lumoutuminen", "Envy": "Kateus",
  "Excitement": "Innostus", "Fear": "Pelko", "Guilt": "Syyllisyys", "Horror": "Kauhu",
  "Interest": "Kiinnostus", "Joy": "Ilo", "Love": "Rakkaus", "Nostalgia": "Nostalgia",
  "Pain": "Kipu", "Pride": "Ylpeys", "Realization": "Oivallus", "Relief": "Helpotus",
  "Romance": "Romantiikka", "Sadness": "Suru", "Satisfaction": "Tyytyväisyys", "Shame": "Häpeä",
  "Surprise (negative)": "Yllätys (neg.)", "Surprise (positive)": "Yllätys (pos.)",
  "Sympathy": "Myötätunto", "Tiredness": "Väsymys", "Triumph": "Voitonriemu",
};

function getCategory(name: string): string {
  const positive = ["Joy", "Contentment", "Satisfaction", "Relief", "Calmness", "Pride", "Triumph",
    "Love", "Excitement", "Amusement", "Admiration", "Adoration", "Sympathy", "Interest",
    "Nostalgia", "Entrancement", "Determination", "Realization"];
  const negative = ["Sadness", "Anxiety", "Fear", "Distress", "Pain", "Horror", "Guilt", "Shame",
    "Contempt", "Disgust", "Disappointment", "Envy", "Doubt", "Anger", "Embarrassment", "Awkwardness"];
  if (positive.includes(name)) return "positive";
  if (negative.includes(name)) return "negative";
  return "neutral";
}

function extractEmotions(predictions: any) {
  try {
    const prosody = predictions?.[0]?.results?.predictions?.[0]?.models?.prosody;
    const grouped = prosody?.grouped_predictions?.[0]?.predictions ?? [];

    const totals: Record<string, number> = {};
    const counts: Record<string, number> = {};

    for (const utterance of grouped) {
      for (const emotion of utterance.emotions ?? []) {
        totals[emotion.name] = (totals[emotion.name] ?? 0) + emotion.score;
        counts[emotion.name] = (counts[emotion.name] ?? 0) + 1;
      }
    }

    const avg: Record<string, number> = {};
    for (const [name, total] of Object.entries(totals)) {
      avg[name] = total / counts[name];
    }

    const g = (name: string) => avg[name] ?? 0;

    // === HOITOTYÖN TUNNERYHMÄT ===
    const wellbeing = g("Joy") * 0.20 + g("Contentment") * 0.15 + g("Satisfaction") * 0.15 +
      g("Relief") * 0.10 + g("Calmness") * 0.10 + g("Pride") * 0.08 + g("Triumph") * 0.07 +
      g("Love") * 0.07 + g("Excitement") * 0.05 + g("Amusement") * 0.03;

    const social = g("Admiration") * 0.20 + g("Adoration") * 0.15 + g("Sympathy") * 0.15 +
      g("Empathic Pain") * 0.12 + g("Love") * 0.12 + g("Interest") * 0.10 +
      g("Nostalgia") * 0.08 + g("Romance") * 0.05 + g("Entrancement") * 0.03;

    const distress = g("Distress") * 0.25 + g("Fear") * 0.20 + g("Anxiety") * 0.15 +
      g("Pain") * 0.15 + g("Horror") * 0.10 + g("Sadness") * 0.08 + g("Empathic Pain") * 0.07;

    const lowMood = g("Sadness") * 0.25 + g("Disappointment") * 0.20 + g("Guilt") * 0.15 +
      g("Shame") * 0.15 + g("Doubt") * 0.10 + g("Envy") * 0.08 + g("Contempt") * 0.07;

    const cognition = g("Concentration") * 0.25 + g("Contemplation") * 0.20 +
      g("Determination") * 0.20 + g("Interest") * 0.15 + g("Realization") * 0.12 +
      g("Confusion") * 0.08;

    const physical = g("Tiredness") * 0.40 + g("Pain") * 0.30 + g("Craving") * 0.15 +
      g("Desire") * 0.15;

    // TOP 6
    const sorted = Object.entries(avg).sort(([, a], [, b]) => b - a).slice(0, 6);

    return {
      wellbeing_score: wellbeing,
      social_score: social,
      distress_score: distress,
      low_mood_score: lowMood,
      cognition_score: cognition,
      physical_score: physical,
      top_emotions: sorted.map(([name, score]) => ({
        name_en: name, name_fi: TRANSLATIONS[name] ?? name,
        score: Math.round(score * 100), category: getCategory(name),
      })),
      joy: g("Joy"), sadness: g("Sadness"), anxiety: g("Anxiety"),
      tiredness: g("Tiredness"), anger: g("Anger"), confusion: g("Confusion"),
      fear: g("Fear"), distress_raw: g("Distress"), pain: g("Pain"),
      contentment: g("Contentment"), determination: g("Determination"), calmness: g("Calmness"),
      all_emotions: avg,
    };
  } catch {
    return {
      wellbeing_score: 0, social_score: 0, distress_score: 0,
      low_mood_score: 0, cognition_score: 0, physical_score: 0,
      top_emotions: [], all_emotions: {},
      joy: 0, sadness: 0, anxiety: 0, tiredness: 0, anger: 0, confusion: 0,
      fear: 0, distress_raw: 0, pain: 0, contentment: 0, determination: 0, calmness: 0,
    };
  }
}

function calculateHumeMoodScore(emotions: any): number {
  const positive = (emotions.wellbeing_score ?? 0) * 0.5 + (emotions.social_score ?? 0) * 0.2;
  const negative = (emotions.distress_score ?? 0) * 0.5 + (emotions.low_mood_score ?? 0) * 0.3;
  const raw = positive - negative;
  const score = Math.round(((raw + 1) / 2) * 4 + 1);
  return Math.min(5, Math.max(1, score));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { call_report_id, audio_url, elder_id } = await req.json();

    if (!audio_url) {
      return new Response(JSON.stringify({ skipped: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const HUME_API_KEY = Deno.env.get("HUME_API_KEY");
    if (!HUME_API_KEY) {
      console.error("HUME_API_KEY not configured");
      return new Response(JSON.stringify({ skipped: true, reason: "no_api_key" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download audio
    console.log("[analyze-emotion] Downloading audio from:", audio_url);
    const audioResponse = await fetch(audio_url);
    if (!audioResponse.ok) {
      console.error("[analyze-emotion] Failed to download audio:", audioResponse.status);
      return new Response(JSON.stringify({ skipped: true, reason: "audio_download_failed" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const audioArrayBuffer = await audioResponse.arrayBuffer();
    const fullBytes = new Uint8Array(audioArrayBuffer);

    // === Kustannussäästö: leikkaa WAV ensimmäiseen 60 sekuntiin ===
    // Hume laskutetaan per minuutti audiosta. Mielialatieto selviää alkupuolesta.
    const MAX_SECONDS = 60;
    let trimmedBytes = fullBytes;
    let trimNote = "";

    try {
      // Tarkista onko WAV: 'RIFF' (4 tavua) ... 'WAVE' (offset 8)
      const isRiff = fullBytes[0] === 0x52 && fullBytes[1] === 0x49 && fullBytes[2] === 0x46 && fullBytes[3] === 0x46;
      const isWave = fullBytes[8] === 0x57 && fullBytes[9] === 0x41 && fullBytes[10] === 0x56 && fullBytes[11] === 0x45;

      if (isRiff && isWave && fullBytes.length > 44) {
        const view = new DataView(audioArrayBuffer);
        // 'fmt ' chunk on yleensä offsetissa 12
        // sampleRate offset 24 (4 tavua, little-endian)
        // numChannels offset 22 (2 tavua)
        // bitsPerSample offset 34 (2 tavua)
        const numChannels = view.getUint16(22, true);
        const sampleRate = view.getUint32(24, true);
        const bitsPerSample = view.getUint16(34, true);
        const bytesPerSecond = sampleRate * numChannels * (bitsPerSample / 8);

        // Etsi 'data'-chunk dynaamisesti (header voi olla > 44 tavua jos lisächunkkeja)
        let dataOffset = 12;
        while (dataOffset < Math.min(fullBytes.length - 8, 200)) {
          const chunkId = String.fromCharCode(
            fullBytes[dataOffset], fullBytes[dataOffset + 1],
            fullBytes[dataOffset + 2], fullBytes[dataOffset + 3]
          );
          const chunkSize = view.getUint32(dataOffset + 4, true);
          if (chunkId === "data") {
            dataOffset += 8; // ohita id + size
            break;
          }
          dataOffset += 8 + chunkSize;
        }

        const maxDataBytes = MAX_SECONDS * bytesPerSecond;
        const fullDataBytes = fullBytes.length - dataOffset;

        if (bytesPerSecond > 0 && fullDataBytes > maxDataBytes) {
          const newDataSize = Math.floor(maxDataBytes);
          const newTotalLength = dataOffset + newDataSize;
          trimmedBytes = new Uint8Array(newTotalLength);
          trimmedBytes.set(fullBytes.subarray(0, newTotalLength));
          // Päivitä RIFF size (offset 4) ja data chunk size (dataOffset - 4)
          const newView = new DataView(trimmedBytes.buffer);
          newView.setUint32(4, newTotalLength - 8, true);
          newView.setUint32(dataOffset - 4, newDataSize, true);
          const savedPct = Math.round((1 - newTotalLength / fullBytes.length) * 100);
          trimNote = `WAV-leikkaus 60s (säästö ${savedPct}%, ${fullBytes.length}→${newTotalLength} tavua, ${sampleRate}Hz/${numChannels}ch/${bitsPerSample}bit)`;
          console.log(`[analyze-emotion] ${trimNote}`);
        } else {
          trimNote = `WAV alle 60s tai header outo, käytetään koko ääntä (${fullBytes.length} tavua)`;
          console.log(`[analyze-emotion] ${trimNote}`);
        }
      } else {
        trimNote = `Ei WAV-muotoa, käytetään koko ääntä (${fullBytes.length} tavua)`;
        console.log(`[analyze-emotion] ${trimNote}`);
      }
    } catch (trimErr) {
      console.error("[analyze-emotion] Trim failed, using full audio:", trimErr);
      trimmedBytes = fullBytes;
    }

    const audioBlob = new Blob([trimmedBytes], { type: "audio/wav" });

    const formData = new FormData();
    formData.append("json", JSON.stringify({ models: { prosody: { granularity: "utterance" } } }));
    formData.append("file", audioBlob, "recording.wav");

    const humeResponse = await fetch("https://api.hume.ai/v0/batch/jobs", {
      method: "POST",
      headers: { "X-Hume-Api-Key": HUME_API_KEY },
      body: formData,
    });

    const job = await humeResponse.json();
    const jobId = job.job_id;
    if (!jobId) throw new Error("No job ID from Hume");

    // Poll for results
    let predictions = null;
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const statusResponse = await fetch(
        `https://api.hume.ai/v0/batch/jobs/${jobId}/predictions`,
        { headers: { "X-Hume-Api-Key": HUME_API_KEY } }
      );
      if (statusResponse.ok) {
        predictions = await statusResponse.json();
        break;
      }
    }

    if (!predictions) throw new Error("Hume analysis timed out");

    // Extract emotions with care categories
    const emotions = extractEmotions(predictions);
    console.log('[analyze-emotion] Top emotions:', JSON.stringify(emotions.top_emotions));
    console.log('[analyze-emotion] Wellbeing:', emotions.wellbeing_score, 'Distress:', emotions.distress_score);

    // Combined mood score
    const { data: report } = await supabase
      .from("call_reports").select("mood_score").eq("id", call_report_id).single();

    const gptScore = report?.mood_score ?? 3;
    const humeMoodScore = calculateHumeMoodScore(emotions);
    const combinedScore = Math.round(gptScore * 0.4 + humeMoodScore * 0.6);

    // Save all scores
    await supabase.from("call_reports").update({
      hume_joy: emotions.joy,
      hume_sadness: emotions.sadness,
      hume_anxiety: emotions.anxiety,
      hume_tiredness: emotions.tiredness,
      hume_anger: emotions.anger,
      hume_confusion: emotions.confusion,
      hume_top_emotions: emotions.top_emotions,
      hume_all_emotions: emotions.all_emotions,
      hume_wellbeing_score: emotions.wellbeing_score,
      hume_social_score: emotions.social_score,
      hume_distress_score: emotions.distress_score,
      hume_raw: predictions,
      mood_score: combinedScore,
      mood_source: "hume+gpt",
    }).eq("id", call_report_id);

    // Alert if distress high or low mood
    const shouldAlert =
      emotions.distress_score > 0.3 ||
      emotions.fear > 0.2 ||
      emotions.pain > 0.2 ||
      emotions.distress_raw > 0.25 ||
      emotions.low_mood_score > 0.4 ||
      emotions.sadness > 0.3;

    if (shouldAlert) {
      const reason = `Hoitotyön tunnehälytys: hätä ${Math.round(emotions.distress_score * 100)}%, alakulo ${Math.round(emotions.low_mood_score * 100)}%, suru ${Math.round(emotions.sadness * 100)}%`;

      const { data: family } = await supabase
        .from("family_members").select("phone_number")
        .eq("elder_id", elder_id).eq("receives_alerts", true);

      const { data: elder } = await supabase
        .from("elders").select("full_name").eq("id", elder_id).single();

      if (family?.length && elder) {
        for (const member of family) {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-sms`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              elder_id, to_number: member.phone_number,
              message: `⚠️ AinaHoiva: ${elder.full_name} — ${reason}. Tarkistakaa vointi.`,
              type: "alert",
            }),
          });
        }
      }

      await supabase.from("call_reports").update({
        alert_sent: true, alert_reason: reason,
      }).eq("id", call_report_id);
    }

    return new Response(
      JSON.stringify({ success: true, emotions, combinedScore }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Hume analysis error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
