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
    const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
    const VAPI_MUISTOISSA_ASSISTANT_ID = Deno.env.get("VAPI_MUISTOISSA_ASSISTANT_ID");
    const VAPI_PHONE_NUMBER_ID = Deno.env.get("VAPI_PHONE_NUMBER_ID");

    if (!VAPI_API_KEY || !VAPI_PHONE_NUMBER_ID) {
      return jsonResponse(
        { error: "Vapi-asetukset puuttuvat (VAPI_API_KEY tai VAPI_PHONE_NUMBER_ID)." },
        500,
      );
    }

    if (!VAPI_MUISTOISSA_ASSISTANT_ID) {
      return jsonResponse(
        {
          error:
            "Muistoissa-assistenttia ei ole vielä konfiguroitu Vapi-dashboardissa. Ota yhteys kehittäjään.",
        },
        500,
      );
    }

    const { elderId } = await req.json();
    if (!elderId) {
      return jsonResponse({ error: "elderId vaaditaan" }, 400);
    }

    // Hae vanhuksen tiedot
    const { data: elder, error: elderErr } = await supabase
      .from("elders")
      .select("phone_number, full_name, is_active")
      .eq("id", elderId)
      .single();

    if (elderErr || !elder) {
      return jsonResponse({ error: "Vanhusta ei löydy" }, 404);
    }
    if (!elder.is_active) {
      return jsonResponse({ error: "Vanhus ei ole aktiivinen" }, 400);
    }

    // Käynnistä Vapi-puhelu
    const vapiResponse = await fetch("https://api.vapi.ai/call/phone", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assistantId: VAPI_MUISTOISSA_ASSISTANT_ID,
        phoneNumberId: VAPI_PHONE_NUMBER_ID,
        customer: {
          number: elder.phone_number,
          name: elder.full_name,
        },
        metadata: {
          elderId,
          callType: "muistoissa",
        },
      }),
    });

    if (!vapiResponse.ok) {
      const errText = await vapiResponse.text();
      console.error("[muistoissa-start-call] Vapi error:", errText);
      return jsonResponse({ error: errText }, vapiResponse.status);
    }

    const callData = await vapiResponse.json();

    console.log(
      `[muistoissa-start-call] Started call for ${elder.full_name}, vapi call id ${callData.id}`,
    );

    return jsonResponse({
      ok: true,
      callId: callData.id,
      message: "Puhelu käynnistetty",
    });
  } catch (err) {
    console.error("[muistoissa-start-call] Error:", err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
