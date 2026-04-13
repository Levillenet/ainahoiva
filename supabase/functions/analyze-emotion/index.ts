import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { call_report_id, audio_url, elder_id } = await req.json();

    if (!audio_url) {
      return new Response(JSON.stringify({ skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const HUME_API_KEY = Deno.env.get("HUME_API_KEY");
    if (!HUME_API_KEY) {
      console.error("HUME_API_KEY not configured");
      return new Response(JSON.stringify({ skipped: true, reason: "no_api_key" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Submit audio to Hume Expression Measurement API
    const humeResponse = await fetch("https://api.hume.ai/v0/batch/jobs", {
      method: "POST",
      headers: {
        "X-Hume-Api-Key": HUME_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        models: { prosody: { granularity: "utterance" } },
        urls: [audio_url],
      }),
    });

    const job = await humeResponse.json();
    const jobId = job.job_id;
    if (!jobId) throw new Error("No job ID from Hume");

    // Step 2: Poll for results (max 30 seconds)
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

    // Step 3: Extract emotion scores
    const emotions = extractEmotions(predictions);

    // Step 4: Calculate combined mood score
    const { data: report } = await supabase
      .from("call_reports")
      .select("mood_score")
      .eq("id", call_report_id)
      .single();

    const gptScore = report?.mood_score ?? 3;
    const humeMoodScore = calculateHumeMoodScore(emotions);
    const combinedScore = Math.round(gptScore * 0.4 + humeMoodScore * 0.6);

    // Step 5: Update call report
    await supabase.from("call_reports").update({
      hume_joy: emotions.joy,
      hume_sadness: emotions.sadness,
      hume_anxiety: emotions.anxiety,
      hume_tiredness: emotions.tiredness,
      hume_anger: emotions.anger,
      hume_confusion: emotions.confusion,
      hume_raw: predictions,
      mood_score: combinedScore,
      mood_source: "hume+gpt",
    }).eq("id", call_report_id);

    // Step 6: Alert if sadness or anxiety very high
    if (emotions.sadness > 0.7 || emotions.anxiety > 0.7) {
      const reason = `Korkea tunnearvo: suru ${Math.round(emotions.sadness * 100)}%, ahdistus ${Math.round(emotions.anxiety * 100)}%`;
      
      // Send alert to family
      const { data: family } = await supabase
        .from("family_members")
        .select("phone_number")
        .eq("elder_id", elder_id)
        .eq("receives_alerts", true);

      const { data: elder } = await supabase
        .from("elders")
        .select("full_name")
        .eq("id", elder_id)
        .single();

      if (family?.length && elder) {
        for (const member of family) {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-sms`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              elder_id,
              to_number: member.phone_number,
              message: `⚠️ AinaHoiva: ${elder.full_name} — ${reason}. Tarkistakaa vointi.`,
              type: "alert",
            }),
          });
        }
      }

      await supabase.from("call_reports").update({
        alert_sent: true,
        alert_reason: reason,
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

    const avg = (name: string) => counts[name] ? totals[name] / counts[name] : 0;

    return {
      joy: avg("Joy"),
      sadness: avg("Sadness"),
      anxiety: avg("Anxiety"),
      tiredness: avg("Tiredness"),
      anger: avg("Anger"),
      confusion: avg("Confusion"),
    };
  } catch {
    return { joy: 0, sadness: 0, anxiety: 0, tiredness: 0, anger: 0, confusion: 0 };
  }
}

function calculateHumeMoodScore(emotions: Record<string, number>): number {
  const positive = emotions.joy;
  const negative = emotions.sadness * 0.4 + emotions.anxiety * 0.3 + emotions.tiredness * 0.2 + emotions.anger * 0.1;
  const raw = positive - negative;
  const score = Math.round(((raw + 1) / 2) * 4 + 1);
  return Math.min(5, Math.max(1, score));
}
