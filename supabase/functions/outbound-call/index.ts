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
    const { elder_id, call_type, phone_number, elder_name, alert_reason, elder_phone, alert_id } = await req.json();

    const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
    const VAPI_ASSISTANT_ID = Deno.env.get("VAPI_ASSISTANT_ID");
    const VAPI_PHONE_NUMBER_ID = Deno.env.get("VAPI_PHONE_NUMBER_ID");

    if (!VAPI_API_KEY || !VAPI_ASSISTANT_ID || !VAPI_PHONE_NUMBER_ID) {
      return new Response(JSON.stringify({ error: "Vapi-asetukset puuttuvat" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Emergency family call — call family member directly ===
    if (call_type === "emergency_family" && phone_number) {
      console.log(`[outbound-call] Emergency family call to ${phone_number}`);
      const vapiResponse = await fetch("https://api.vapi.ai/call/phone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${VAPI_API_KEY}`,
        },
        body: JSON.stringify({
          assistantId: VAPI_ASSISTANT_ID,
          customer: { number: phone_number },
          phoneNumberId: VAPI_PHONE_NUMBER_ID,
          assistantOverrides: {
            firstMessage:
              `Hei! Täällä AinaHoiva. ` +
              `${elder_name || "Vanhuksenne"} tarvitsee apuanne nyt. ` +
              `Syy: ${alert_reason || "hätätilanne"}. ` +
              `Soittakaa hänelle välittömästi numeroon ${elder_phone || ""}. Kiitos!`,
            variableValues: {
              elder_name: elder_name || "",
              alert_reason: alert_reason || "",
              elder_phone: elder_phone || "",
              call_type: "emergency_family",
            },
          },
        }),
      });
      const result = await vapiResponse.json();
      return new Response(JSON.stringify({ success: vapiResponse.ok, call: result }), {
        status: vapiResponse.ok ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Regular and emergency followup calls need elder_id ===
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

    // === Emergency followup call — simplified prompt ===
    if (call_type === "emergency_followup") {
      console.log(`[outbound-call] Emergency followup call to elder ${elder.id}`);
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
            firstMessage:
              `Hei ${elder.full_name}! Täällä Aina. ` +
              `Soitan tarkistaakseni että kaikki on hyvin. ` +
              `Onko tilanne parantunut?`,
            variableValues: {
              elder_name: elder.full_name,
              call_type: "emergency_followup",
            },
          },
        }),
      });
      const result = await vapiResponse.json();
      if (vapiResponse.ok) {
        await supabase.from("call_reports").insert({
          elder_id: elder.id,
          call_type: "emergency_followup",
          ai_summary: "Hätätilanteen seurantasoitto käynnistetty",
          vapi_call_id: result.id,
        });
      }
      return new Response(JSON.stringify({ success: vapiResponse.ok, call: result }), {
        status: vapiResponse.ok ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Build medication status for Vapi variables ===
    const today = new Date().toISOString().split("T")[0];
    const { data: medLogs } = await supabase
      .from("medication_logs")
      .select("medication_name, scheduled_time, taken")
      .eq("elder_id", elder.id)
      .eq("log_date", today);

    const takenMeds = medLogs
      ?.filter((m: any) => m.taken)
      .map((m: any) => `${m.medication_name}_${m.scheduled_time}`) ?? [];

    const fmt = (arr: string[]) => arr.length ? arr.join(", ") : "ei lääkkeitä";
    const fmtTaken = (arr: string[]) => arr.length ? arr.join(", ") + " ✅" : "";

    const buildMedVars = (time: string) => {
      const allMeds = (elder.medications || [])
        .filter((m: any) => m[time])
        .map((m: any) => `${m.name} ${m.dosage || ""}`.trim());
      const taken = (elder.medications || [])
        .filter((m: any) => m[time] && takenMeds.includes(`${m.name} ${m.dosage || ""}`.trim() + `_${time}`))
        .map((m: any) => `${m.name} ${m.dosage || ""}`.trim());
      const remaining = allMeds.filter((med: string) => !taken.includes(med));
      return { allMeds, taken, remaining };
    };

    const morning = buildMedVars("morning");
    const noon = buildMedVars("noon");
    const evening = buildMedVars("evening");

    const medList = (elder.medications || [])
      .map((m: { name: string; dosage?: string }) => `- ${m.name} ${m.dosage || ""}`)
      .join("\n");

    // Check if any medication has dosette
    const hasDosette = (elder.medications || []).some((m: any) => m.has_dosette);

    // Fetch elder memories
    const { data: memories } = await supabase
      .from("elder_memory")
      .select("memory_type, content, updated_at")
      .eq("elder_id", elder.id)
      .order("updated_at", { ascending: false })
      .limit(20);

    const memoryText = memories?.length
      ? memories.map((m: { memory_type: string; content: string }) => `[${m.memory_type}] ${m.content}`).join("\n")
      : "Ei aiempia muistoja";

    // Get last call summary
    const { data: lastCall } = await supabase
      .from("call_reports")
      .select("ai_summary, called_at, mood_score")
      .eq("elder_id", elder.id)
      .order("called_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastCallText = lastCall
      ? `Viimeisin puhelu: ${new Date(lastCall.called_at!).toLocaleDateString("fi-FI")}\nMieliala oli: ${lastCall.mood_score}/5\nYhteenveto: ${lastCall.ai_summary}`
      : "Ensimmäinen puhelu";

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
            memories: memoryText,
            last_call: lastCallText,
            has_dosette: hasDosette ? "true" : "false",
            // Morning
            medications_morning_remaining: fmt(morning.remaining),
            medications_morning_taken: fmtTaken(morning.taken),
            medications_morning_all: fmt(morning.allMeds),
            morning_all_taken: morning.remaining.length === 0 && morning.allMeds.length > 0 ? "true" : "false",
            // Noon
            medications_noon_remaining: fmt(noon.remaining),
            medications_noon_taken: fmtTaken(noon.taken),
            medications_noon_all: fmt(noon.allMeds),
            noon_all_taken: noon.remaining.length === 0 && noon.allMeds.length > 0 ? "true" : "false",
            // Evening
            medications_evening_remaining: fmt(evening.remaining),
            medications_evening_taken: fmtTaken(evening.taken),
            medications_evening_all: fmt(evening.allMeds),
            evening_all_taken: evening.remaining.length === 0 && evening.allMeds.length > 0 ? "true" : "false",
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
      vapi_call_id: result.id,
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
