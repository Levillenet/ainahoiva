import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[muistoissa-nightly-batch] Starting batch run");

  const stats = {
    calls_processed: 0,
    calls_failed: 0,
    chapters_generated: 0,
    chapters_failed: 0,
    total_tokens_in: 0,
    total_tokens_out: 0,
    estimated_cost_usd: 0,
    errors: [] as string[],
  };

  try {
    const { data: unprocessedCalls, error: callsErr } = await supabase
      .from("call_reports")
      .select("id, elder_id, called_at")
      .eq("call_type", "muistoissa")
      .is("processed_at", null)
      .not("transcript", "is", null)
      .order("called_at", { ascending: true })
      .limit(50);

    if (callsErr) throw callsErr;

    console.log(`[muistoissa-nightly-batch] Found ${unprocessedCalls?.length || 0} unprocessed calls`);

    const chaptersTouchedByElder = new Map<string, Set<string>>();

    for (const call of unprocessedCalls || []) {
      try {
        const chaptersBeforeRes = await supabase
          .from("book_chapters")
          .select("id, life_stage, last_generated_at")
          .eq("elder_id", call.elder_id);

        const beforeTimestamps = new Map(
          (chaptersBeforeRes.data || []).map((c) => [c.id, c.last_generated_at]),
        );

        const processRes = await fetch(`${SUPABASE_URL}/functions/v1/muistoissa-process-call`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ call_report_id: call.id }),
        });

        if (!processRes.ok) {
          const errText = await processRes.text();
          throw new Error(`process-call failed: ${errText}`);
        }

        await processRes.json();
        stats.calls_processed++;

        const chaptersAfterRes = await supabase
          .from("book_chapters")
          .select("id, last_generated_at")
          .eq("elder_id", call.elder_id);

        if (!chaptersTouchedByElder.has(call.elder_id)) {
          chaptersTouchedByElder.set(call.elder_id, new Set());
        }
        const touchedSet = chaptersTouchedByElder.get(call.elder_id)!;

        for (const ch of chaptersAfterRes.data || []) {
          const before = beforeTimestamps.get(ch.id);
          if (ch.last_generated_at && ch.last_generated_at !== before) {
            touchedSet.add(ch.id);
          }
        }

        console.log(
          `[nightly-batch] Processed call ${call.id}, ${touchedSet.size} chapters touched for elder ${call.elder_id}`,
        );
      } catch (err) {
        stats.calls_failed++;
        const errMsg = `Call ${call.id}: ${String(err)}`;
        stats.errors.push(errMsg);
        console.error("[nightly-batch]", errMsg);
      }
    }

    for (const [elderId, chapterIds] of chaptersTouchedByElder.entries()) {
      for (const chapterId of chapterIds) {
        try {
          const generateRes = await fetch(
            `${SUPABASE_URL}/functions/v1/muistoissa-generate-chapter`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
              },
              body: JSON.stringify({ chapter_id: chapterId }),
            },
          );

          if (!generateRes.ok) {
            const errText = await generateRes.text();
            throw new Error(`generate-chapter failed: ${errText}`);
          }

          const genData = await generateRes.json();
          stats.chapters_generated++;
          stats.total_tokens_in += genData.tokens?.input || 0;
          stats.total_tokens_out += genData.tokens?.output || 0;
          stats.estimated_cost_usd += genData.estimated_cost_usd || 0;

          console.log(
            `[nightly-batch] Generated prose for chapter ${chapterId}, ${genData.word_count} words (elder ${elderId})`,
          );
        } catch (err) {
          stats.chapters_failed++;
          const errMsg = `Chapter ${chapterId}: ${String(err)}`;
          stats.errors.push(errMsg);
          console.error("[nightly-batch]", errMsg);
        }
      }
    }

    const durationMs = Date.now() - startTime;
    const summary = {
      success: true,
      duration_ms: durationMs,
      duration_human: `${Math.round(durationMs / 1000)}s`,
      stats,
      timestamp: new Date().toISOString(),
    };

    await supabase.from("nightly_batch_log").insert({
      calls_processed: stats.calls_processed,
      calls_failed: stats.calls_failed,
      chapters_generated: stats.chapters_generated,
      chapters_failed: stats.chapters_failed,
      total_tokens_in: stats.total_tokens_in,
      total_tokens_out: stats.total_tokens_out,
      estimated_cost_usd: stats.estimated_cost_usd,
      duration_ms: durationMs,
      errors: stats.errors.length > 0 ? stats.errors : null,
    });

    console.log(`[nightly-batch] Done in ${Math.round(durationMs / 1000)}s:`, JSON.stringify(stats));

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[nightly-batch] Fatal error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: String(err),
        stats,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
