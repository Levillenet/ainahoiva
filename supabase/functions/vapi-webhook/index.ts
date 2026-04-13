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
    const { error } = await supabase.from("call_reports").insert({
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
    });

    if (error) throw error;

    // Send alert SMS log if needed
    if (analysis.needs_alert) {
      await sendAlertSms(elder.id, elder.full_name, analysis.alert_reason);
    }

    // Send daily summary SMS log
    await sendSummary(elder.id, elder.full_name, analysis);

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
    await supabase.from("sms_log").insert({
      elder_id: elderId,
      to_number: member.phone_number,
      message: `⚠️ AinaHoiva HÄLYTYS: ${elderName} tarvitsee huomiota. ${reason}`,
      type: "alert",
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
    await supabase.from("sms_log").insert({
      elder_id: elderId,
      to_number: member.phone_number,
      message,
      type: "summary",
    });
  }
}
