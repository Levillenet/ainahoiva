
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const vapiApiKey = Deno.env.get("VAPI_API_KEY");
    const assistantId = Deno.env.get("VAPI_ASSISTANT_ID") || "c19c2445-c22a-4c52-8831-3b882fc38d4b";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    if (!vapiApiKey) {
      return new Response(JSON.stringify({ error: "VAPI_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serverUrl = `${supabaseUrl}/functions/v1/vapi-assistant-request`;

    console.log(`[set-vapi-server-url] Setting serverUrl to: ${serverUrl}`);
    console.log(`[set-vapi-server-url] Assistant ID: ${assistantId}`);

    const response = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${vapiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        serverUrl: serverUrl,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("[set-vapi-server-url] Vapi API error:", result);
      return new Response(JSON.stringify({ error: "Vapi API error", details: result }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[set-vapi-server-url] Success! serverUrl set to: ${result.serverUrl}`);

    return new Response(JSON.stringify({
      success: true,
      assistantId,
      serverUrl: result.serverUrl,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[set-vapi-server-url] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
