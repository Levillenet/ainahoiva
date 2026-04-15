import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  try {
    const body = await req.json();
    const toolCall = body?.message?.toolCalls?.[0];
    const args = toolCall?.function?.arguments ?? body;
    const callerNumber = body?.message?.call?.customer?.number;

    const { data: elderMatch } = await supabase.rpc("find_elder_by_phone", {
      p_phone: callerNumber,
    });
    const elder = elderMatch?.[0] ?? null;

    if (!elder) {
      return new Response(
        JSON.stringify({ result: "En löydä tietojanne." }),
        { status: 200 }
      );
    }

    const today = new Date().toISOString().split("T")[0];
    const scheduledTime = args.scheduled_time ?? "morning";
    const taken = args.taken !== false;

    const { data: medications } = await supabase
      .from("medications")
      .select("id, name, dosage")
      .eq("elder_id", elder.id)
      .eq(scheduledTime, true);

    if (!medications?.length) {
      return new Response(
        JSON.stringify({ result: "Ei lääkkeitä kirjattuna tälle ajankohdalle." }),
        { status: 200 }
      );
    }

    for (const med of medications) {
      await supabase
        .from("medication_logs")
        .upsert(
          {
            elder_id: elder.id,
            medication_id: med.id,
            medication_name: `${med.name} ${med.dosage}`,
            scheduled_time: scheduledTime,
            taken,
            not_taken: !taken,
            log_date: today,
            taken_at: taken ? new Date().toISOString() : null,
            confirmed_by: "aina_call",
          },
          {
            onConflict: "elder_id,medication_id,scheduled_time,log_date",
          }
        );
    }

    const medNames = medications.map((m) => `${m.name} ${m.dosage}`).join(", ");

    const response = taken
      ? `Merkitty otetuksi: ${medNames}. Hienoa!`
      : `Merkitty ottamattomaksi: ${medNames}. Muistakaa ottaa ne pian!`;

    return new Response(
      JSON.stringify({ result: response }),
      { status: 200 }
    );
  } catch (error) {
    console.error("log-medication error:", error);
    return new Response(
      JSON.stringify({ result: "Lääkkeiden kirjaus epäonnistui." }),
      { status: 200 }
    );
  }
});
