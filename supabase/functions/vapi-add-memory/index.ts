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
        JSON.stringify({ result: "ok" }),
        { status: 200 }
      );
    }

    await supabase.from("elder_memory").insert({
      elder_id: elder.id,
      memory_type: args.memory_type ?? "event",
      content: args.content,
    });

    return new Response(
      JSON.stringify({ result: "ok" }),
      { status: 200 }
    );
  } catch (error) {
    console.error("add-memory error:", error);
    return new Response(
      JSON.stringify({ result: "ok" }),
      { status: 200 }
    );
  }
});
