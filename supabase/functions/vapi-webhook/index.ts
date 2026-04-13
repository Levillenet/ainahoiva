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

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { message } = body;

    // Only process end-of-call reports
    if (message?.type !== "end-of-call-report") {
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerNumber = message?.call?.customer?.number;
    const transcript = message?.transcript || "";
    const duration = message?.call?.endedAt
      ? Math.floor(
          (new Date(message.call.endedAt).getTime() -
            new Date(message.call.startedAt).getTime()) /
            1000
        )
      : 0;

    // Find elder by phone number
    const { data: elder } = await supabase
      .from("elders")
      .select("id, full_name")
      .eq("phone_number", callerNumber)
      .single();

    if (!elder) {
      console.log("Unknown caller:", callerNumber);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Analyze transcript with Lovable AI
    const analysis = await analyzeTranscript(transcript);

    // Save call report
    const { data: insertedReport, error } = await supabase.from("call_reports").insert({
      elder_id: elder.id,
      duration_seconds: duration,
      mood_score: analysis.mood_score,
      medications_taken: analysis.medications_taken,
      ate_today: analysis.ate_today,
      transcript: transcript,
      ai_summary: analysis.summary,
      alert_sent: analysis.needs_alert,
      alert_reason: analysis.alert_reason,
      call_type: "inbound",
    }).select("id").single();

    if (error) throw error;

    // Detect missed call (duration < 15 seconds)
    if (duration < 15 && insertedReport) {
      await supabase.from("call_reports").update({
        ai_summary: "Ei vastattu puheluun",
        alert_sent: true,
        alert_reason: "Vanhus ei vastannut soittoon",
      }).eq("id", insertedReport.id);

      // Trigger missed call handler for retry logic
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/handle-missed-call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ elder_id: elder.id }),
      });
    } else if (duration >= 15) {
      // Call was answered — resolve any pending retries
      await supabase
        .from("missed_call_retries")
        .update({ is_resolved: true })
        .eq("elder_id", elder.id)
        .eq("is_resolved", false);
    }

    // Send alert SMS log if needed
    if (analysis.needs_alert) {
      await sendAlertSms(elder.id, elder.full_name, analysis.alert_reason);
    }

    // Send daily summary SMS log
    await sendSummary(elder.id, elder.full_name, analysis);

    // Extract and save memories from transcript
    await extractMemories(elder.id, transcript, elder.full_name);

    // Trigger Hume emotion analysis if audio URL available
    const audioUrl = message?.call?.recordingUrl ?? null;
    if (audioUrl && insertedReport) {
      await supabase.from("call_reports").update({ audio_url: audioUrl }).eq("id", insertedReport.id);

      // Fire and forget — don't await
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/analyze-emotion`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          call_report_id: insertedReport.id,
          audio_url: audioUrl,
          elder_id: elder.id,
        }),
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function analyzeTranscript(transcript: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured");
    return fallbackAnalysis();
  }

  const prompt = `Analysoi tämä vanhuksen ja AI-assistentin välinen puhelinkeskustelu suomeksi.
Palauta VAIN JSON-objekti, ei muuta tekstiä.

Transkripti:
${transcript}

Palauta:
{
  "mood_score": <numero 1-5 missä 1=erittäin huono, 5=erinomainen>,
  "medications_taken": <true/false/null jos ei mainittu>,
  "ate_today": <true/false/null jos ei mainittu>,
  "summary": "<2-3 lauseen yhteenveto suomeksi>",
  "needs_alert": <true jos mieliala 1-2 tai mainitsee kipua/hätää/kaatumista>,
  "alert_reason": "<syy hälytykselle suomeksi tai null>"
}`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Olet suomalaisen vanhustenhoitopalvelun analyytikko. Analysoi puhelulitteroinnit tarkasti." },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error("AI gateway error:", response.status, await response.text());
      return fallbackAnalysis();
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return fallbackAnalysis();
  } catch (err) {
    console.error("AI analysis error:", err);
    return fallbackAnalysis();
  }
}

function fallbackAnalysis() {
  return {
    mood_score: 3,
    medications_taken: null,
    ate_today: null,
    summary: "Yhteenvetoa ei voitu muodostaa automaattisesti.",
    needs_alert: false,
    alert_reason: null,
  };
}

async function sendAlertSms(elderId: string, elderName: string, reason: string) {
  const { data: family } = await supabase
    .from("family_members")
    .select("phone_number, full_name")
    .eq("elder_id", elderId)
    .eq("receives_alerts", true);

  if (!family?.length) return;

  for (const member of family) {
    const message = `⚠️ AinaHoiva HÄLYTYS: ${elderName} tarvitsee huomiota. ${reason}`;
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        elder_id: elderId,
        to_number: member.phone_number,
        message,
        type: "alert",
      }),
    });
  }
}

async function sendSummary(elderId: string, elderName: string, analysis: Record<string, unknown>) {
  const { data: family } = await supabase
    .from("family_members")
    .select("phone_number")
    .eq("elder_id", elderId)
    .eq("receives_daily_report", true);

  if (!family?.length) return;

  const moodScore = analysis.mood_score as number;
  const moodEmoji = ["", "😟", "😕", "😐", "😊", "😄"][moodScore] || "😐";
  const medsText = analysis.medications_taken === true
    ? "✅ Lääkkeet otettu"
    : analysis.medications_taken === false
    ? "❌ Lääkkeet EI otettu"
    : "💊 Lääkkeistä ei tietoa";

  const message = `AinaHoiva — ${elderName}\n${moodEmoji} Mieliala: ${moodScore}/5\n${medsText}\n\n${analysis.summary}`;

  for (const member of family) {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        elder_id: elderId,
        to_number: member.phone_number,
        message,
        type: "summary",
      }),
    });
  }
}

async function extractMemories(elderId: string, transcript: string, elderName: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return;

  const prompt = `Analysoi tämä puhelinkeskustelu ja poimi tärkeät muistettavat asiat vanhuksesta.
Palauta VAIN JSON-taulukko, ei muuta tekstiä.

Vanhuksen nimi: ${elderName}
Transkripti: ${transcript}

Palauta taulukko muistoista tässä muodossa:
[
  {"memory_type": "person", "content": "Tyttären nimi on Ritva, asuu Tampereella"},
  {"memory_type": "health", "content": "Polvi aristaa sään muuttuessa"},
  {"memory_type": "event", "content": "Kävi parturissa, tykkäsi lopputuloksesta"},
  {"memory_type": "preference", "content": "Pitää kahvista aamulla ennen lääkkeitä"}
]

Memory types:
- person: perheenjäsenet, ystävät, naapurit
- event: tapahtumat, käynnit, menot
- health: terveys, kivut, oireet
- preference: mieltymykset, tavat, rutiinit
- family: sukulaiset ja heidän kuulumiset

Palauta tyhjä taulukko [] jos ei ole mitään muistettavaa.
Älä keksi asioita — vain se mitä oikeasti mainittiin.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Poimi muistettavat asiat puhelulitteroinnista tarkasti. Älä keksi mitään." },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error("Memory extraction AI error:", response.status);
      return;
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return;

    const memories = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(memories) || memories.length === 0) return;

    for (const memory of memories) {
      if (memory.memory_type && memory.content) {
        await supabase.from("elder_memory").insert({
          elder_id: elderId,
          memory_type: memory.memory_type,
          content: memory.content,
        });
      }
    }
    console.log(`Extracted ${memories.length} memories for elder ${elderId}`);
  } catch (err) {
    console.error("Memory extraction error:", err);
  }
}
