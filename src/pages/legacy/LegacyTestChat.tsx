import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Send, RotateCcw, Save, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { TEST_SCENARIOS } from "@/lib/testScenarios";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface DebugInfo {
  topicLabel: string;
  topicReason: string;
  topicSource: string;
  coveredTopics: string;
  inProgressTopics: string;
  declinedTopics: string;
  sensitiveTopics: string;
  systemPromptPreview: string;
  fullSystemPrompt: string;
}

// Hinta-arvio per vaihto (gpt-4o-mini -tasoinen): ~$0.000465
const COST_PER_EXCHANGE = 0.000465;

const LegacyTestChat = () => {
  const { elderId } = useParams();
  const [elderName, setElderName] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [debug, setDebug] = useState<DebugInfo | null>(null);
  const [exchangeCount, setExchangeCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!elderId) return;
    const load = async () => {
      const { data } = await supabase
        .from("elders")
        .select("full_name")
        .eq("id", elderId)
        .maybeSingle();
      setElderName(data?.full_name || "");
      // Lataa Ainan ensimmäinen viesti
      await fetchAinaReply([]);
      setInitialLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elderId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const fetchAinaReply = async (history: ChatMessage[]) => {
    if (!elderId) return;
    setLoading(true);
    try {
      // Jos ei viestejä, lähetetään pyyntö "aloita keskustelu" -ohjeella
      const messagesToSend = history.length > 0
        ? history
        : [{ role: "user" as const, content: "[Tämä on ensimmäinen viesti — aloita lämpimästi tervehtimällä etunimellä ja kysymällä avauskysymys]" }];

      const { data, error } = await supabase.functions.invoke("test-chat-reply", {
        body: { elderId, messages: messagesToSend },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      setExchangeCount((n) => n + 1);
      setDebug({
        topicLabel: data.topic?.label || "—",
        topicReason: data.topic?.reason || "—",
        topicSource: data.topic?.source || "—",
        coveredTopics: data.debug?.coveredTopics || "",
        inProgressTopics: data.debug?.inProgressTopics || "",
        declinedTopics: data.debug?.declinedTopics || "",
        sensitiveTopics: data.debug?.sensitiveTopics || "",
        systemPromptPreview: data.debug?.systemPromptPreview || "",
        fullSystemPrompt: data.debug?.fullSystemPrompt || "",
      });
    } catch (err) {
      toast({
        title: "Virhe vastauksen haussa",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput("");
    await fetchAinaReply(newHistory);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    if (!confirm("Aloitetaanko uusi keskustelu? Nykyiset viestit häviävät.")) return;
    setMessages([]);
    setExchangeCount(0);
    setDebug(null);
    setInitialLoading(true);
    fetchAinaReply([]).then(() => setInitialLoading(false));
  };

  const handleSave = async () => {
    if (!elderId || messages.length === 0) {
      toast({ title: "Ei tallennettavaa", description: "Keskustelu on tyhjä." });
      return;
    }
    try {
      const transcript = messages
        .map((m) => `${m.role === "assistant" ? "Aina" : "Vanhus"}: ${m.content}`)
        .join("\n\n");

      const { error } = await supabase.from("call_reports").insert({
        elder_id: elderId,
        call_type: "test_chat",
        called_at: new Date().toISOString(),
        duration_seconds: 0,
        transcript,
      });
      if (error) throw error;
      toast({
        title: "Keskustelu tallennettu",
        description: "Löytyy nyt call_reports-taulusta tyypillä test_chat.",
      });
    } catch (err) {
      toast({
        title: "Tallennus epäonnistui",
        description: (err as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleLoadScenario = async (scenarioLabel: string) => {
    const scenario = TEST_SCENARIOS.find((s) => s.label === scenarioLabel);
    if (!scenario || loading) return;

    // Aloita puhtaalta pöydältä — Aina sanoo ensimmäisen viestin, sitten käytetään skenaario-vuoroja
    setMessages([]);
    setExchangeCount(0);
    setDebug(null);
    setInitialLoading(true);
    await fetchAinaReply([]);
    setInitialLoading(false);

    // Käy vuoro kerrallaan
    let history: ChatMessage[] = [];
    setMessages((current) => {
      history = [...current];
      return current;
    });

    // Pieni viive jotta state ehtii päivittyä
    await new Promise((r) => setTimeout(r, 100));

    for (const turn of scenario.turns) {
      const userMsg: ChatMessage = { role: "user", content: turn };
      history = [...history, userMsg];
      setMessages((prev) => [...prev, userMsg]);
      await new Promise((r) => setTimeout(r, 100));
      await fetchAinaReply(history);
      // Aseta history päivittymään uudella assistant-viestillä
      await new Promise((r) => setTimeout(r, 100));
      setMessages((current) => {
        history = [...current];
        return current;
      });
      await new Promise((r) => setTimeout(r, 100));
    }
  };

  const estimatedCost = (exchangeCount * COST_PER_EXCHANGE).toFixed(4);

  return (
    <div className="space-y-4">
      {/* Otsikko */}
      <div className="flex items-center justify-between">
        <Link
          to={`/dashboard/muistoissa/${elderId}`}
          className="text-cream/60 hover:text-cream text-sm flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Takaisin
        </Link>
        <div className="text-right">
          <h1 className="text-xl text-cream font-medium">
            Testaa Ainan keskustelua — {elderName}
          </h1>
          <p className="text-xs text-cream/50 mt-1">
            Sama algoritmi kuin oikea puhelu, mutta ilman ääntä
          </p>
        </div>
        <div className="w-20" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* CHAT — 2/3 leveys */}
        <Card className="bg-card border-border lg:col-span-2 flex flex-col" style={{ minHeight: "600px" }}>
          <CardHeader className="border-b border-border">
            <CardTitle className="text-cream text-base">Keskustelu</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-4 gap-3 overflow-hidden">
            <div className="flex-1 overflow-y-auto space-y-3 pr-2" style={{ maxHeight: "450px" }}>
              {initialLoading && messages.length === 0 && (
                <div className="flex items-center justify-center h-full text-cream/50 text-sm">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Aina valmistautuu…
                </div>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "assistant" ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === "assistant"
                        ? "bg-navy text-cream border border-border"
                        : "bg-sage/20 text-cream border border-sage/30"
                    }`}
                  >
                    <p className="text-[10px] uppercase tracking-wide opacity-60 mb-1">
                      {msg.role === "assistant" ? "Aina" : "Vanhus"}
                    </p>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-navy text-cream border border-border rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Aina miettii…
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex gap-2 pt-3 border-t border-border">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Kirjoita vanhuksen vastaus… (Enter lähettää, Shift+Enter uusi rivi)"
                className="flex-1 min-h-[60px] bg-background border-border text-cream resize-none"
                disabled={loading || initialLoading}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || loading || initialLoading}
                className="bg-gold text-navy hover:bg-gold/90 self-end"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* DEBUG-PANEELI — 1/3 leveys */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-cream text-base">Ainan konteksti</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {debug ? (
              <>
                <div>
                  <p className="text-xs text-cream/50 uppercase tracking-wide mb-1">
                    Päivän aihe
                  </p>
                  <p className="text-cream font-medium">{debug.topicLabel}</p>
                  <p className="text-xs text-cream/60 mt-1">{debug.topicReason}</p>
                  <p className="text-[10px] text-gold/70 mt-1">Lähde: {debug.topicSource}</p>
                </div>

                <div className="pt-2 border-t border-border/50">
                  <p className="text-xs text-cream/50 uppercase tracking-wide mb-1">
                    Käsitellyt
                  </p>
                  <p className="text-cream/80 text-xs">
                    {debug.coveredTopics || "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-cream/50 uppercase tracking-wide mb-1">
                    Keskeneräiset
                  </p>
                  <p className="text-cream/80 text-xs">
                    {debug.inProgressTopics || "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-cream/50 uppercase tracking-wide mb-1">
                    Kielletyt aiheet
                  </p>
                  <p className="text-cream/80 text-xs">
                    {debug.sensitiveTopics || "—"}
                  </p>
                </div>

                {debug.declinedTopics && (
                  <div>
                    <p className="text-xs text-cream/50 uppercase tracking-wide mb-1">
                      Aiemmin torjutut
                    </p>
                    <p className="text-cream/80 text-xs">{debug.declinedTopics}</p>
                  </div>
                )}

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full mt-3">
                      <FileText className="w-3 h-3 mr-2" />
                      Näytä koko system prompti
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-card border-border">
                    <DialogHeader>
                      <DialogTitle className="text-cream">System prompti</DialogTitle>
                    </DialogHeader>
                    <pre className="text-xs text-cream/80 whitespace-pre-wrap font-mono bg-background p-4 rounded-md border border-border">
                      {debug.fullSystemPrompt}
                    </pre>
                  </DialogContent>
                </Dialog>
              </>
            ) : (
              <p className="text-cream/50 text-sm">Konteksti ladataan…</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ALAREUNA — toiminnot ja kustannus */}
      <Card className="bg-card border-border">
        <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={loading}
            >
              <RotateCcw className="w-3 h-3 mr-2" />
              Aloita uusi
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={loading || messages.length === 0}
            >
              <Save className="w-3 h-3 mr-2" />
              Tallenna
            </Button>
            <Select onValueChange={handleLoadScenario} disabled={loading}>
              <SelectTrigger className="w-[220px] bg-background border-border text-cream text-sm">
                <SelectValue placeholder="Lataa valmis skenaario" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {TEST_SCENARIOS.map((s) => (
                  <SelectItem key={s.label} value={s.label} className="text-cream">
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-cream/50">
            {exchangeCount} viestiä · arviolta ${estimatedCost} LLM-kuluja
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default LegacyTestChat;
