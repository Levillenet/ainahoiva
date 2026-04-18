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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    if (!vapiApiKey) {
      return new Response(JSON.stringify({ error: "VAPI_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lue assistant-parametri (default: aina)
    const url = new URL(req.url);
    const assistantParam = (url.searchParams.get("assistant") || "aina").toLowerCase();

    let assistantId: string | undefined;
    let webhookPath: string;

    if (assistantParam === "muistoissa") {
      assistantId = Deno.env.get("VAPI_MUISTOISSA_ASSISTANT_ID");
      // vapi-muistoissa-request käsittelee sekä assistant-request- että end-of-call-report -viestit
      webhookPath = "vapi-muistoissa-request";
    } else {
      assistantId = Deno.env.get("VAPI_ASSISTANT_ID") || "c19c2445-c22a-4c52-8831-3b882fc38d4b";
      webhookPath = "vapi-assistant-request";
    }

    if (!assistantId) {
      return new Response(
        JSON.stringify({ error: `Assistant ID not configured for: ${assistantParam}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const serverUrl = `${supabaseUrl}/functions/v1/${webhookPath}`;

    console.log(`[set-vapi-server-url] assistant=${assistantParam} id=${assistantId}`);
    console.log(`[set-vapi-server-url] Setting serverUrl to: ${serverUrl}`);

    const response = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${vapiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        serverUrl: serverUrl,
        serverMessages: assistantParam === "muistoissa"
          ? ["assistant-request", "end-of-call-report"]
          : ["end-of-call-report"],
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

    console.log(`[set-vapi-server-url] Success! serverUrl=${result.serverUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        assistant: assistantParam,
        assistantId,
        serverUrl: result.serverUrl,
        serverMessages: result.serverMessages,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[set-vapi-server-url] Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
