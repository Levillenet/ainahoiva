import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const messageType = body?.message?.type;

    console.log(`[vapi-muistoissa-webhook] Received: ${messageType}`);

    if (messageType !== "end-of-call-report") {
      return jsonResponse({ ok: true, ignored: messageType });
    }

    const call = body.message.call;
    const elderId = call?.metadata?.elderId as string | undefined;
    const transcript: string = body.message.transcript || "";
    const durationSeconds = Math.round(body.message.durationSeconds || 0);
    const endedAt = new Date(call?.endedAt || Date.now());
    const vapiCallId: string | undefined = call?.id;

    if (!elderId) {
      console.error("[vapi-muistoissa-webhook] Ei elderId:tä metadatassa");
      return jsonResponse({ ok: false, error: "no elderId" });
    }

    // 1. Tallenna call_reports
    const { data: callReport, error: callErr } = await supabase
      .from("call_reports")
      .insert({
        elder_id: elderId,
        call_type: "muistoissa",
        called_at: endedAt.toISOString(),
        duration_seconds: durationSeconds,
        transcript,
        vapi_call_id: vapiCallId,
        ai_summary: null, // Täytetään myöhemmässä batch-ajossa (analyze-emotion vastaava)
      })
      .select("id")
      .single();

    if (callErr) {
      console.error("[vapi-muistoissa-webhook] call_reports insert failed:", callErr);
      throw callErr;
    }

    // 2. Päivitä coverage_map jos metadatassa on coverageId
    const coverageId = call?.metadata?.coverageId as string | undefined;
    if (coverageId) {
      // Hae nykyinen questions_asked turvallista inkrementtiä varten
      const { data: cov } = await supabase
        .from("coverage_map")
        .select("questions_asked")
        .eq("id", coverageId)
        .maybeSingle();
      const newCount = (cov?.questions_asked ?? 0) + 1;

      const { error: covErr } = await supabase
        .from("coverage_map")
        .update({
          last_discussed: endedAt.toISOString(),
          questions_asked: newCount,
          status: "in_progress",
        })
        .eq("id", coverageId);
      if (covErr) {
        console.error("[vapi-muistoissa-webhook] coverage_map update failed:", covErr);
      }
    }

    // 3. Merkitse legacy_topic_request käsitellyksi
    const requestId = call?.metadata?.requestId as string | undefined;
    if (requestId) {
      const { error: trErr } = await supabase
        .from("legacy_topic_requests")
        .update({ status: "addressed" })
        .eq("id", requestId);
      if (trErr) {
        console.error("[vapi-muistoissa-webhook] topic_request update failed:", trErr);
      }
    }

    console.log(
      `[vapi-muistoissa-webhook] Saved call for elder ${elderId}, duration ${durationSeconds}s, transcript chars ${transcript.length}`,
    );

    return jsonResponse({ ok: true, callReportId: callReport.id });
  } catch (error) {
    console.error("[vapi-muistoissa-webhook] Error:", error);
    return jsonResponse({ ok: false, error: String(error) }, 500);
  }
});
