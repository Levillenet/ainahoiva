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

    if (message?.type !== "end-of-call-report") {
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vapiCallId = message?.call?.id;
    const rawCallerNumber = message?.call?.customer?.number;
    const callerNumber = rawCallerNumber?.replace(/[\s\-()]/g, "") || "";
    // Transcript fallback: check both locations
    const transcript = message?.transcript || message?.artifact?.transcript || "";
    // Duration: try multiple Vapi payload locations
    let duration = 0;
    if (message?.durationSeconds) {
      duration = Math.round(message.durationSeconds);
    } else if (message?.call?.duration) {
      duration = Math.round(message.call.duration);
    } else if (message?.artifact?.duration) {
      duration = Math.round(message.artifact.duration);
    } else if (message?.call?.endedAt && message?.call?.startedAt) {
      duration = Math.floor(
        (new Date(message.call.endedAt).getTime() -
          new Date(message.call.startedAt).getTime()) /
          1000
      );
    }
    console.log(`[vapi-webhook] Duration sources: durationSeconds=${message?.durationSeconds}, call.duration=${message?.call?.duration}, artifact.duration=${message?.artifact?.duration}, calculated=${duration}`);

    console.log(`[vapi-webhook] Transcript length: ${transcript.length}, Duration: ${duration}, CallerNumber: ${callerNumber}`);

    // Find elder by phone number (normalized comparison)
    const { data: elders } = await supabase.rpc("find_elder_by_phone", { p_phone: callerNumber });
    const elder = elders?.[0] ?? null;

    if (!elder) {
      console.log("Unknown caller:", callerNumber);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === MISSED CALL CHECK FIRST ===
    const hasRealConversation = transcript.length > 50;
    console.log(`[vapi-webhook] hasRealConversation: ${hasRealConversation}`);

    if (!hasRealConversation) {
      console.log(`[vapi-webhook] Missed call detected for elder ${elder.id}`);
      
      const missedData = {
        elder_id: elder.id,
        duration_seconds: duration,
        mood_score: null,
        medications_taken: null,
        ate_today: null,
        transcript: transcript || null,
        ai_summary: "Ei vastattu puheluun",
        alert_sent: true,
        alert_reason: "Vanhus ei vastannut soittoon",
      };

      let insertedReport: { id: string } | null = null;

      if (vapiCallId) {
        const { data: updated } = await supabase
          .from("call_reports")
          .update(missedData)
          .eq("vapi_call_id", vapiCallId)
          .select("id")
          .maybeSingle();
        if (updated) insertedReport = updated;
      }

      if (!insertedReport) {
        const { data: inserted } = await supabase
          .from("call_reports")
          .insert({ ...missedData, call_type: "inbound", vapi_call_id: vapiCallId || null })
          .select("id")
          .single();
        insertedReport = inserted;
      }

      // Trigger retry logic
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/handle-missed-call`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ elder_id: elder.id }),
      });

      return new Response(JSON.stringify({ success: true, missed: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === REAL CONVERSATION — proceed with AI analysis ===
    console.log(`[vapi-webhook] Real conversation detected, running AI analysis...`);
    const analysis = await analyzeTranscript(transcript);
    console.log(`[vapi-webhook] AI analysis result:`, JSON.stringify(analysis));

    const reportData = {
      elder_id: elder.id,
      duration_seconds: duration,
      mood_score: analysis.mood_score,
      medications_taken: analysis.medications_taken,
      ate_today: analysis.ate_today,
      transcript: transcript,
      ai_summary: analysis.summary,
      alert_sent: analysis.needs_alert,
      alert_reason: analysis.alert_reason,
    };

    let insertedReport: { id: string } | null = null;

    if (vapiCallId) {
      const { data: updated, error: updateError } = await supabase
        .from("call_reports")
        .update(reportData)
        .eq("vapi_call_id", vapiCallId)
        .select("id")
        .maybeSingle();

      if (updateError) console.error("Update error:", updateError);
      if (updated) {
        insertedReport = updated;
        console.log("Updated existing report:", updated.id);
      }
    }

    if (!insertedReport) {
      const { data: inserted, error: insertError } = await supabase
        .from("call_reports")
        .insert({
          ...reportData,
          call_type: "inbound",
          vapi_call_id: vapiCallId || null,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      insertedReport = inserted;
      console.log("Inserted new report:", inserted?.id);
    }

    // Call was answered — resolve any pending retries
    await supabase
      .from("missed_call_retries")
      .update({ is_resolved: true })
      .eq("elder_id", elder.id)
      .eq("is_resolved", false);

    // Send alert SMS if needed
    if (analysis.needs_alert) {
      await sendAlertSms(elder.id, elder.full_name, analysis.alert_reason);
    }

    // Send family contact request if elder asked for it
    if (analysis.contact_family) {
      const reason = analysis.contact_reason || "Vanhus pyysi yhteydenottoa omaisiin";
      await sendFamilyContactSms(elder.id, elder.full_name, reason);
      if (insertedReport) {
        await supabase.from("call_reports").update({
          alert_sent: true,
          alert_reason: `Omaisen kutsumispyyntö: ${reason}`,
        }).eq("id", insertedReport.id);
      }
    }

    // Send daily summary
    await sendSummary(elder.id, elder.full_name, analysis);

    // Extract and save memories
    console.log("[vapi-webhook] Starting memory extraction for elder:", elder.id);
    try {
      await extractMemories(elder.id, transcript, elder.full_name);
      console.log("[vapi-webhook] Memory extraction completed for elder:", elder.id);
    } catch (memErr) {
      console.error("[vapi-webhook] Memory extraction failed:", memErr);
    }

    // Analyze and save medication status from transcript
    if (insertedReport) {
      try {
        await analyzeMedications(transcript, elder.id, insertedReport.id);
        console.log("[vapi-webhook] Medication analysis completed for elder:", elder.id);
      } catch (medErr) {
        console.error("[vapi-webhook] Medication analysis failed:", medErr);
      }
    }

    // Cognitive assessment extraction (subtle — only saves if anything notable or if tracking enabled)
    if (insertedReport && transcript) {
      try {
        const { data: elderRow } = await supabase
          .from("elders")
          .select("cognitive_tracking_enabled")
          .eq("id", elder.id)
          .maybeSingle();
        const cogEnabled = elderRow?.cognitive_tracking_enabled ?? false;
        await extractCognitiveAssessment(transcript, elder.id, insertedReport.id, cogEnabled);
        console.log("[vapi-webhook] Cognitive assessment completed for elder:", elder.id);
      } catch (cogErr) {
        console.error("[vapi-webhook] Cognitive assessment failed:", cogErr);
      }
    }

    // Save reminders extracted from conversation
    if (analysis.reminders?.length) {
      console.log(`[vapi-webhook] Saving ${analysis.reminders.length} reminders for elder ${elder.id}`);
      for (const rem of analysis.reminders) {
        if (rem.message && rem.date && rem.time) {
          const { error: remError } = await supabase.from("reminders").insert({
            elder_id: elder.id,
            message: rem.message,
            remind_at: `${rem.date}T${rem.time}:00+03:00`,
            method: rem.method || "call",
            is_sent: false,
          });
          if (remError) console.error("[vapi-webhook] Reminder insert error:", remError);
        }
      }
    }

    // Mark today's call-embedded reminders as sent (morning_call/evening_call/both_calls)
    // The assistant prompt was given today's reminders matching this call slot — now that
    // the call completed with real conversation, mark them done.
    try {
      const helsinkiHour = (new Date().getUTCHours() + 3) % 24;
      const isMorningSlot = helsinkiHour < 14;
      const callSlotMethods = isMorningSlot
        ? ["morning_call", "both_calls"]
        : ["evening_call", "both_calls"];
      const todayHelsinki = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split("T")[0];
      const todayStart = `${todayHelsinki}T00:00:00+03:00`;
      const todayEnd = `${todayHelsinki}T23:59:59+03:00`;

      const { data: marked, error: markErr } = await supabase
        .from("reminders")
        .update({ is_sent: true })
        .eq("elder_id", elder.id)
        .eq("is_sent", false)
        .in("method", callSlotMethods)
        .gte("remind_at", todayStart)
        .lte("remind_at", todayEnd)
        .select("id");
      if (markErr) {
        console.error("[vapi-webhook] Failed to mark day-reminders sent:", markErr);
      } else if (marked?.length) {
        console.log(`[vapi-webhook] Marked ${marked.length} call-embedded reminders sent for elder ${elder.id}`);
      }
    } catch (e) {
      console.error("[vapi-webhook] Day-reminder marking error:", e);
    }

    // Emergency detection
    try {
      const emergency = await detectEmergency(transcript, elder.id);
      if (emergency.isEmergency) {
        console.log(`[vapi-webhook] EMERGENCY DETECTED for elder ${elder.id}: ${emergency.type} - ${emergency.reason}`);
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/handle-emergency`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            elder_id: elder.id,
            alert_type: emergency.type,
            alert_reason: emergency.reason,
          }),
        });
      }
    } catch (emergencyErr) {
      console.error("[vapi-webhook] Emergency detection error:", emergencyErr);
    }

    const audioUrl = resolveAudioUrl(body);
    console.log("[vapi-webhook] Resolved audio URL:", audioUrl ?? "none");
    if (audioUrl && insertedReport) {
      await supabase.from("call_reports").update({ audio_url: audioUrl }).eq("id", insertedReport.id);
      try {
        const analyzeResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/analyze-emotion`, {
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

        const analyzeText = await analyzeResponse.text();
        console.log(
          `[vapi-webhook] analyze-emotion response for report ${insertedReport.id}: ${analyzeResponse.status} ${analyzeText}`
        );
      } catch (humeDispatchError) {
        console.error("[vapi-webhook] Failed to dispatch analyze-emotion:", humeDispatchError);
      }
    } else {
      console.log(
        "[vapi-webhook] Skipping Hume analysis, recording URL missing. Available recording fields:",
        JSON.stringify(getRecordingDebugInfo(body))
      );
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

  // GPT analysoi koko transkriptin → tunnistaa kaikki kiputilat, lääkkeet, muistutukset ja teemat
  // Turvaraja: erittäin pitkät puhelut (yli ~20 min puhetta) leikataan, jotta context window ei ylity
  const MAX_TRANSCRIPT_CHARS = 30000;
  const truncatedTranscript = transcript.length > MAX_TRANSCRIPT_CHARS
    ? transcript.slice(0, MAX_TRANSCRIPT_CHARS) + "\n\n[...puhelu jatkuu, leikattu turvarajan vuoksi...]"
    : transcript;

  if (transcript.length > MAX_TRANSCRIPT_CHARS) {
    console.log(`[vapi-webhook] Transcript truncated (safety cap): ${transcript.length} → ${MAX_TRANSCRIPT_CHARS} chars`);
  } else {
    console.log(`[vapi-webhook] Full transcript analyzed: ${transcript.length} chars`);
  }

  const prompt = `Analysoi tämä vanhuksen ja AI-assistentin välinen puhelinkeskustelu suomeksi.
Palauta VAIN JSON-objekti, ei muuta tekstiä.

Transkripti:
${truncatedTranscript}

Palauta:
{
  "mood_score": <numero 1-5 missä 1=erittäin huono, 5=erinomainen>,
  "medications_taken": <true jos vanhus kertoo ottaneensa lääkkeet, false VAIN jos vanhus sanoo ettei ole ottanut lääkkeitä, null jos lääkkeistä ei puhuttu tai vain kysyttiin/muistutettiin>,
  "ate_today": <true jos vanhus kertoo syöneensä, false VAIN jos sanoo ettei ole syönyt, null jos ruoasta ei puhuttu>,
  "summary": "<2-3 lauseen yhteenveto suomeksi>",
  "needs_alert": <true jos mieliala 1-2 tai mainitsee kipua/hätää/kaatumista>,
  "alert_reason": "<syy hälytykselle suomeksi tai null>",
  "contact_family": <true jos vanhus pyytää yhteydenottoa omaisiin, esim. "soita tyttärelleni", "kerro pojalleni", "tarvitsen apua", "kutsu joku käymään">,
  "contact_reason": "<syy yhteydenottopyyntöön suomeksi tai null>",
  "reminders": [{"message": "<muistutuksen aihe>", "date": "YYYY-MM-DD", "time": "HH:MM", "method": "call|sms"}]
}

Reminders-kenttä: Jos vanhus pyytää muistutusta jostakin (esim. "muistuta parturista huomenna kello 10"), poimi se tähän.
- method: jos vanhus sanoo "soita" tai "muistuta soittamalla" → "call", jos "laita viesti" tai "tekstiviesti" → "sms", muuten oletus "call"
- date: päättele päivämäärä kontekstista (tänään on ` + new Date().toISOString().split("T")[0] + `)
- Palauta tyhjä taulukko [] jos muistutuksia ei pyydetty`;

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

function resolveAudioUrl(payload: any): string | null {
  const candidates = collectAudioUrlCandidates(payload);
  return candidates[0] ?? null;
}

function collectAudioUrlCandidates(value: any, seen = new WeakSet<object>()): string[] {
  if (!value) return [];

  if (typeof value === "string") {
    return isAudioUrl(value) ? [value] : [];
  }

  if (typeof value !== "object") {
    return [];
  }

  if (seen.has(value)) {
    return [];
  }
  seen.add(value);

  const directKeys = [
    "recordingUrl",
    "stereoRecordingUrl",
    "monoRecordingUrl",
    "combinedRecordingUrl",
    "url",
  ];

  const found: string[] = [];

  for (const key of directKeys) {
    const candidate = value[key];
    if (typeof candidate === "string" && isAudioUrl(candidate)) {
      found.push(candidate);
    }
  }

  for (const nested of Object.values(value)) {
    found.push(...collectAudioUrlCandidates(nested, seen));
  }

  return [...new Set(found)];
}

function isAudioUrl(value: string): boolean {
  if (!value.startsWith("http://") && !value.startsWith("https://")) {
    return false;
  }

  const normalized = value.toLowerCase();
  return ["recording", ".mp3", ".wav", ".m4a", ".ogg", ".webm"].some((token) => normalized.includes(token));
}

function getRecordingDebugInfo(payload: any) {
  return {
    callRecordingUrl: payload?.message?.call?.recordingUrl ?? null,
    artifactRecordingUrl: payload?.message?.artifact?.recordingUrl ?? null,
    artifactMonoRecordingUrl: payload?.message?.artifact?.monoRecordingUrl ?? null,
    artifactStereoRecordingUrl: payload?.message?.artifact?.stereoRecordingUrl ?? null,
    artifactRecording: payload?.message?.artifact?.recording ?? null,
    analysisRecordingUrl: payload?.message?.analysis?.recordingUrl ?? null,
    topLevelRecordingUrl: payload?.recordingUrl ?? null,
    detectedCandidates: collectAudioUrlCandidates(payload),
  };
}

function fallbackAnalysis() {
  return {
    mood_score: 3,
    medications_taken: null,
    ate_today: null,
    summary: "Yhteenvetoa ei voitu muodostaa automaattisesti.",
    needs_alert: false,
    alert_reason: null,
    contact_family: false,
    contact_reason: null,
    reminders: [],
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

async function sendFamilyContactSms(elderId: string, elderName: string, reason: string) {
  const { data: family } = await supabase
    .from("family_members")
    .select("phone_number, full_name")
    .eq("elder_id", elderId)
    .eq("receives_alerts", true);

  if (!family?.length) return;

  for (const member of family) {
    const message = `📞 AinaHoiva: ${elderName} pyysi yhteydenottoa. Syy: ${reason}. Soittakaa hänelle.`;
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

async function detectEmergency(
  transcript: string,
  elderId: string
): Promise<{ isEmergency: boolean; type: string; reason: string }> {
  // Get elder-specific keywords
  const { data: settings } = await supabase
    .from("emergency_settings")
    .select("*")
    .eq("elder_id", elderId)
    .single();

  const customKeywords = settings?.custom_keywords
    ?.split(",")
    .map((k: string) => k.trim().toLowerCase())
    .filter(Boolean) ?? [];

  const fallKeywords = settings?.detect_fall !== false
    ? ["kaatunut", "kaaduin", "kaatui", "putosin", "lattialla", "en pysty nousemaan"]
    : [];

  const painKeywords = settings?.detect_pain !== false
    ? ["kova kipu", "sietämätön kipu", "hätä", "apua", "ambulanssi", "soita apua"]
    : [];

  const confusionKeywords = settings?.detect_confusion !== false
    ? ["en tiedä missä olen", "eksyin", "hukassa"]
    : [];

  const allKeywords = [
    ...fallKeywords,
    ...painKeywords,
    ...confusionKeywords,
    ...customKeywords,
  ];

  const lowerTranscript = transcript.toLowerCase();

  for (const keyword of allKeywords) {
    if (lowerTranscript.includes(keyword)) {
      const type = fallKeywords.includes(keyword)
        ? "fall"
        : painKeywords.includes(keyword)
        ? "pain"
        : confusionKeywords.includes(keyword)
        ? "confusion"
        : "general";

      return {
        isEmergency: true,
        type,
        reason: `Tunnistettu avainsana: "${keyword}"`,
      };
    }
  }

  return { isEmergency: false, type: "", reason: "" };
}

async function extractMemories(elderId: string, transcript: string, elderName: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.log("[extractMemories] No LOVABLE_API_KEY, skipping");
    return;
  }

  console.log(`[extractMemories] Starting for elder ${elderId}, transcript length: ${transcript.length}`);

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
      console.error("[extractMemories] AI error:", response.status);
      return;
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    console.log(`[extractMemories] AI response length: ${content.length}`);
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log("[extractMemories] No JSON array found in response");
      return;
    }

    const memories = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(memories) || memories.length === 0) {
      console.log("[extractMemories] No memories to save");
      return;
    }

    for (const memory of memories) {
      if (memory.memory_type && memory.content) {
        const { error } = await supabase.from("elder_memory").insert({
          elder_id: elderId,
          memory_type: memory.memory_type,
          content: memory.content,
        });
        if (error) console.error("[extractMemories] Insert error:", error);
      }
    }

    console.log(`[extractMemories] Saved ${memories.length} memories for elder ${elderId}`);
  } catch (err) {
    console.error("[extractMemories] Error:", err);
  }
}

async function analyzeMedications(
  transcript: string,
  elderId: string,
  callReportId: string
) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.log("[analyzeMedications] No LOVABLE_API_KEY, skipping");
    return;
  }

  const prompt = `Analysoi tämä puhelinkeskustelu ja tunnista lääkkeiden ottamiseen liittyvät maininnat.
Palauta VAIN JSON, ei muuta tekstiä.

Transkripti:
${transcript}

Palauta:
{
  "morning_taken": true/false/null,
  "noon_taken": true/false/null,
  "evening_taken": true/false/null,
  "specific_medications": [
    {"name": "lääkkeen nimi", "time": "morning/noon/evening", "taken": true/false}
  ],
  "dosette_checked": true/false,
  "notes": "lisätietoja suomeksi tai null"
}

Tunnista ottamisesta kertovat sanat:
- Otettu: "otin", "joo otin", "kyllä", "löytyi", "otettua", "otettu"
- Ei otettu: "en ottanut", "unohdin", "ei löydy", "ei otettu"
- Dosetti: "dosetti", "lääkepurkki", "pilleri", "tarkistin"

Jos ei mainintaa → palauta null`;

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
          { role: "system", content: "Analysoi lääkkeiden otto puhelulitteroinnista tarkasti." },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error("[analyzeMedications] AI error:", response.status);
      return;
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;

    const result = JSON.parse(jsonMatch[0]);
    const today = new Date().toISOString().split("T")[0];

    const { data: medications } = await supabase
      .from("medications")
      .select("id, name, dosage, morning, noon, evening")
      .eq("elder_id", elderId);

    if (!medications?.length) return;

    const saveLogs = async (time: string, taken: boolean | null) => {
      if (taken === null || taken === undefined) return;
      const timeMeds = medications.filter((m: any) => m[time]);
      for (const med of timeMeds) {
        await supabase
          .from("medication_logs")
          .upsert({
            elder_id: elderId,
            medication_id: med.id,
            medication_name: `${med.name} ${med.dosage || ""}`.trim(),
            scheduled_time: time,
            taken: taken === true,
            not_taken: taken === false,
            log_date: today,
            taken_at: taken ? new Date().toISOString() : null,
            call_report_id: callReportId,
            confirmed_by: "aina",
          }, {
            onConflict: "elder_id,medication_id,scheduled_time,log_date",
          });
      }
    };

    await saveLogs("morning", result.morning_taken);
    await saveLogs("noon", result.noon_taken);
    await saveLogs("evening", result.evening_taken);

    // Specific medication mentions
    if (result.specific_medications?.length) {
      for (const specific of result.specific_medications) {
        const matchedMed = medications.find((m: any) =>
          `${m.name} ${m.dosage || ""}`.toLowerCase().includes(specific.name.toLowerCase())
        );
        if (matchedMed) {
          await supabase
            .from("medication_logs")
            .upsert({
              elder_id: elderId,
              medication_id: matchedMed.id,
              medication_name: `${matchedMed.name} ${matchedMed.dosage || ""}`.trim(),
              scheduled_time: specific.time,
              taken: specific.taken,
              not_taken: !specific.taken,
              log_date: today,
              taken_at: specific.taken ? new Date().toISOString() : null,
              call_report_id: callReportId,
              confirmed_by: "aina",
              notes: result.notes || null,
            }, {
              onConflict: "elder_id,medication_id,scheduled_time,log_date",
            });
        }
      }
    }

    // Alert if morning meds not taken by noon
    const now = new Date();
    const hour = now.getUTCHours() + 3; // Finnish time approx
    if (hour >= 12 && result.morning_taken === false) {
      const { data: notTaken } = await supabase
        .from("medication_logs")
        .select("medication_name")
        .eq("elder_id", elderId)
        .eq("log_date", today)
        .eq("scheduled_time", "morning")
        .eq("taken", false);

      if (notTaken?.length) {
        await sendAlertSms(
          elderId,
          "",
          `Aamulääkkeitä ei ole otettu: ${notTaken.map((m: any) => m.medication_name).join(", ")}`
        );
      }
    }

    console.log(`[analyzeMedications] Saved medication logs for elder ${elderId}`);
  } catch (error) {
    console.error("[analyzeMedications] Error:", error);

async function extractCognitiveAssessment(transcript: string, elderId: string, callReportId: string, cognitiveEnabled: boolean) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("[extractCognitiveAssessment] LOVABLE_API_KEY not configured");
    return;
  }

  const MAX_CHARS = 20000;
  const truncated = transcript.length > MAX_CHARS ? transcript.slice(0, MAX_CHARS) : transcript;

  const prompt = cognitiveEnabled
    ? `Analysoi tämä puhelun transkripti kognitiivisen seurannan näkökulmasta.

Etsi merkkejä seuraavista:
1. Orientaatio: Tiesiköhän vanhus päivän, kuukauden, vuodenajan?
2. Muisti: Jos mainittiin kolme sanaa — muistettiinko ne?
3. Sujuvuus: Löysivätkö sanat helposti vai etsittiinkö niitä?

Palauta JSON:
{
  "orientation_score": 0-3,
  "memory_score": 0-3,
  "fluency_score": 0-3,
  "overall_impression": "normaali|lievä huoli|selkeä huoli",
  "observations": "lyhyt kuvaus havainnoista suomeksi",
  "flags": ["lista huolista jos on, muuten tyhjä array"]
}

Transkripti:
${truncated}`
    : `Tarkista onko tässä puhelussa merkkejä selkeästä sekavuudesta tai muistiongelmista.
Palauta JSON:
{
  "orientation_score": null,
  "memory_score": null,
  "fluency_score": null,
  "overall_impression": "normaali|lievä huoli|selkeä huoli",
  "observations": "mainitse vain jos jotain selkeästi poikkeavaa, muuten tyhjä string",
  "flags": []
}

Transkripti:
${truncated}`;

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
          { role: "system", content: "Olet suomalaisen vanhustenhoitopalvelun kognitiivinen analyytikko. Palauta vain JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error("[extractCognitiveAssessment] AI gateway error:", response.status, await response.text());
      return;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[extractCognitiveAssessment] No JSON in response");
      return;
    }
    const result = JSON.parse(jsonMatch[0]);

    // Only save if there's something worth saving
    if (result.overall_impression !== "normaali" || cognitiveEnabled) {
      const { error } = await supabase.from("cognitive_assessments").insert({
        elder_id: elderId,
        call_report_id: callReportId,
        orientation_score: result.orientation_score,
        memory_score: result.memory_score,
        fluency_score: result.fluency_score,
        overall_impression: result.overall_impression,
        observations: result.observations,
        flags: result.flags || [],
      });
      if (error) console.error("[extractCognitiveAssessment] Insert error:", error);
      else console.log(`[extractCognitiveAssessment] Saved (${result.overall_impression})`);
    } else {
      console.log("[extractCognitiveAssessment] Normal call, not saving (tracking disabled)");
    }
  } catch (err) {
    console.error("[extractCognitiveAssessment] Error:", err);
  }
}
}