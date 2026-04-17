import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    
    // Vapi sends tool call data in this format
    const toolCall = body?.message?.toolCalls?.[0];
    const args = toolCall?.function?.arguments ?? body;
    
    const callerNumber = body?.message?.call
      ?.customer?.number;

    const { data: elderMatch } = await supabase.rpc("find_elder_by_phone", {
      p_phone: callerNumber,
    });
    const elder = elderMatch?.[0] ?? null;

    if (!elder) {
      return new Response(
        JSON.stringify({ 
          result: "En löydä tietojanne järjestelmästä." 
        }),
        { status: 200 }
      );
    }

    // Parse remind_at from Finnish natural language
    const remindAt = parseDateTime(
      args.date, 
      args.time
    );

    // Save reminder
    const { error } = await supabase
      .from("reminders")
      .insert({
        elder_id: elder.id,
        message: args.message,
        remind_at: remindAt,
        method: args.method ?? "sms",
        is_sent: false,
      });

    if (error) throw error;

    // Send confirmation SMS
    const confirmMsg = 
      `AinaHoiva muistutus tallennettu: ` +
      `${args.message} — ` +
      `${formatDateTime(remindAt)}`;

    await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-sms`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get(
            "SUPABASE_SERVICE_ROLE_KEY"
          )}`,
        },
        body: JSON.stringify({
          elder_id: elder.id,
          to_number: callerNumber,
          message: confirmMsg,
          type: "reminder_confirmation",
        }),
      }
    );

    return new Response(
      JSON.stringify({
        result: `Muistutus tallennettu! ` +
          `Muistutan Teitä ${args.message} ` +
          `${formatDateTime(remindAt)}.`
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error("save-reminder error:", error);
    return new Response(
      JSON.stringify({ 
        result: "Muistutuksen tallennus epäonnistui." 
      }),
      { status: 200 }
    );
  }
});

function parseDateTime(
  date: string, 
  time: string
): string {
  const now = new Date();
  const finnish = new Date(
    now.getTime() + 3 * 60 * 60 * 1000
  );
  
  // Parse common Finnish date expressions
  let targetDate = new Date(finnish);
  
  const dateLower = (date ?? "").toLowerCase();
  if (dateLower.includes("huomenna") || 
      dateLower.includes("huomis")) {
    targetDate.setDate(targetDate.getDate() + 1);
  } else if (dateLower.includes("ylihuomenna")) {
    targetDate.setDate(targetDate.getDate() + 2);
  } else if (dateLower.includes("tänään") || 
             dateLower.includes("tanaan")) {
    // keep today
  }

  // Parse time
  if (time) {
    const timeMatch = time.match(/(\d{1,2})[:.:]?(\d{2})?/);
    if (timeMatch) {
      targetDate.setHours(
        parseInt(timeMatch[1]), 
        parseInt(timeMatch[2] ?? "0"), 
        0, 
        0
      );
    }
  }

  return targetDate.toISOString();
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  const finnish = new Date(
    date.getTime() + 3 * 60 * 60 * 1000
  );
  return finnish.toLocaleString("fi-FI", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
