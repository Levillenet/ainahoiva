import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Phone, CheckCircle2, Clock, Sparkles, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Call {
  id: string;
  called_at: string | null;
  duration_seconds: number | null;
  ai_summary: string | null;
  processed_at: string | null;
  transcript: string | null;
}

const LegacyCalls = () => {
  const { elderId } = useParams();
  const [calls, setCalls] = useState<Call[]>([]);
  const [elderName, setElderName] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [processingAll, setProcessingAll] = useState(false);

  const load = async () => {
    if (!elderId) return;
    const [callsRes, elderRes] = await Promise.all([
      supabase
        .from('call_reports')
        .select('id, called_at, duration_seconds, ai_summary, processed_at, transcript')
        .eq('elder_id', elderId)
        .eq('call_type', 'muistoissa')
        .order('called_at', { ascending: false }),
      supabase.from('elders').select('full_name').eq('id', elderId).maybeSingle(),
    ]);
    setCalls(callsRes.data ?? []);
    if (elderRes.data) setElderName(elderRes.data.full_name);
  };

  useEffect(() => {
    load();
  }, [elderId]);

  const processOne = async (callId: string) => {
    setProcessingId(callId);
    try {
      const { data, error } = await supabase.functions.invoke('muistoissa-process-call', {
        body: { call_report_id: callId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: 'Puhelu käsitelty',
        description: `${data.chapters_updated || 0} lukua päivitetty, ${data.highlights_saved || 0} arvokasta hetkeä, ${data.observations_saved || 0} huomiota.`,
      });
      await load();
    } catch (err) {
      toast({
        title: 'Käsittely epäonnistui',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const processAllUnprocessed = async () => {
    const unprocessed = calls.filter((c) => !c.processed_at && c.transcript && c.transcript.length > 100);
    if (unprocessed.length === 0) {
      toast({ title: 'Ei käsittelemättömiä puheluja', description: 'Kaikki puhelut on jo käsitelty.' });
      return;
    }
    setProcessingAll(true);
    let success = 0;
    let failed = 0;
    for (const c of unprocessed) {
      try {
        const { data, error } = await supabase.functions.invoke('muistoissa-process-call', {
          body: { call_report_id: c.id },
        });
        if (error || data?.error) failed++;
        else success++;
      } catch {
        failed++;
      }
    }
    toast({
      title: 'Käsittely valmis',
      description: `${success} onnistui, ${failed} epäonnistui.`,
    });
    setProcessingAll(false);
    await load();
  };

  const unprocessedCount = calls.filter((c) => !c.processed_at && c.transcript && c.transcript.length > 100).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to={`/dashboard/muistoissa/${elderId}`} className="text-cream/60 hover:text-cream text-sm flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Takaisin
        </Link>
        <h1 className="text-xl text-cream font-medium">{elderName} — Muistoissa-puhelut</h1>
        <span className="text-xs text-cream/50">{calls.length} puhelua</span>
      </div>

      {unprocessedCount > 0 && (
        <Card className="bg-card border-gold/40">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-gold" />
              <div>
                <p className="text-cream font-medium">{unprocessedCount} käsittelemätöntä puhelua</p>
                <p className="text-xs text-cream/60">Kirjailija lukee nämä ja poimii muistiinpanot, arvokkaat hetket ja huomiot.</p>
              </div>
            </div>
            <Button
              onClick={processAllUnprocessed}
              disabled={processingAll}
              className="bg-gold text-navy hover:bg-gold/90"
            >
              {processingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {processingAll ? 'Käsitellään…' : 'Käsittele kaikki'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-cream text-base">Puhelut</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {calls.length === 0 && <p className="text-cream/50 text-sm py-6 text-center">Ei vielä Muistoissa-puheluja.</p>}
          {calls.map((c) => {
            const minutes = c.duration_seconds ? Math.round(c.duration_seconds / 60) : 0;
            const isProcessed = !!c.processed_at;
            const canProcess = c.transcript && c.transcript.length > 100;
            return (
              <div key={c.id} className="p-4 rounded-lg border border-border bg-muted/10">
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 mt-1 text-cream/60 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-cream font-medium">
                        {c.called_at ? new Date(c.called_at).toLocaleString('fi-FI') : '—'}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-cream/50 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {minutes} min
                        </span>
                        {isProcessed ? (
                          <span className="text-xs text-sage flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Käsitelty
                          </span>
                        ) : (
                          <span className="text-xs text-gold/80">Käsittelemättä</span>
                        )}
                      </div>
                    </div>
                    {c.ai_summary && <p className="text-cream/70 text-sm mt-2">{c.ai_summary}</p>}
                    {!c.ai_summary && !canProcess && (
                      <p className="text-cream/40 text-xs mt-2 italic">Ei transkriptiä — ei voi käsitellä.</p>
                    )}
                    {canProcess && (
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => processOne(c.id)}
                          disabled={processingId === c.id || processingAll}
                        >
                          {processingId === c.id ? (
                            <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3 mr-2" />
                          )}
                          {isProcessed ? 'Käsittele uudelleen' : 'Käsittele kirjailijalla'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};

export default LegacyCalls;
