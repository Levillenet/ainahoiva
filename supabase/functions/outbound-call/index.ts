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
    const { elder_id } = await req.json();

    if (!elder_id) {
      return new Response(JSON.stringify({ error: "elder_id vaaditaan" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: elder } = await supabase
      .from("elders")
      .select("*, medications(*)")
      .eq("id", elder_id)
      .single();

    if (!elder) {
      return new Response(JSON.stringify({ error: "Vanhusta ei löytynyt" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
    const VAPI_ASSISTANT_ID = Deno.env.get("VAPI_ASSISTANT_ID");
    const VAPI_PHONE_NUMBER_ID = Deno.env.get("VAPI_PHONE_NUMBER_ID");

    if (!VAPI_API_KEY || !VAPI_ASSISTANT_ID || !VAPI_PHONE_NUMBER_ID) {
      return new Response(JSON.stringify({ error: "Vapi-asetukset puuttuvat" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const medList = (elder.medications || [])
      .map((m: { name: string; dosage?: string }) => `- ${m.name} ${m.dosage || ""}`)
      .join("\n");

    const vapiResponse = await fetch("https://api.vapi.ai/call/phone", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${VAPI_API_KEY}`,
      },
      body: JSON.stringify({
        assistantId: VAPI_ASSISTANT_ID,
        customer: {
          number: elder.phone_number,
          name: elder.full_name,
        },
        phoneNumberId: VAPI_PHONE_NUMBER_ID,
        assistantOverrides: {
          variableValues: {
            elder_name: elder.full_name,
            medications: medList || "Ei lääkkeitä kirjattu",
            call_type: "scheduled",
          },
        },
      }),
    });

    const result = await vapiResponse.json();

    if (!vapiResponse.ok) {
      console.error("Vapi error:", result);
      return new Response(JSON.stringify({ error: "Vapi-puhelu epäonnistui", details: result }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("call_reports").insert({
      elder_id: elder.id,
      call_type: "outbound_scheduled",
      ai_summary: "Soitto käynnistetty — odottaa vastausta",
    });

    return new Response(JSON.stringify({ success: true, call: result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Outbound call error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
