import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Play, Loader2, AlertTriangle } from 'lucide-react';

type BatchRun = {
  id: string;
  ran_at: string;
  calls_processed: number;
  calls_failed: number;
  chapters_generated: number;
  chapters_failed: number;
  total_tokens_in: number;
  total_tokens_out: number;
  estimated_cost_usd: number | string;
  duration_ms: number;
  errors: string[] | null;
};

const USD_TO_EUR = 0.92;

export default function NightlyBatchLog() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<BatchRun[]>([]);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRuns();
  }, []);

  const loadRuns = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('nightly_batch_log')
      .select('*')
      .order('ran_at', { ascending: false })
      .limit(30);
    if (data) setRuns(data as BatchRun[]);
    setLoading(false);
  };

  const runNow = async () => {
    if (
      !confirm(
        'Ajetaanko yöllinen batch nyt? Tämä käsittelee kaikki käsittelemättömät puhelut ja kirjoittaa proosan päivittyneistä luvuista. Voi kestää useita minuutteja.',
      )
    )
      return;
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('muistoissa-nightly-batch', {
        body: {},
      });
      if (error) throw error;
      toast({
        title: 'Batch ajettu',
        description: `${data.stats.calls_processed} puhelua, ${data.stats.chapters_generated} lukua. Kustannus ${(data.stats.estimated_cost_usd * USD_TO_EUR).toFixed(3)} €.`,
      });
      await loadRuns();
    } catch (err) {
      toast({
        title: 'Batch epäonnistui',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setRunning(false);
    }
  };

  const totalCost = runs.reduce((sum, r) => sum + (Number(r.estimated_cost_usd) || 0), 0);
  const totalChapters = runs.reduce((sum, r) => sum + (r.chapters_generated || 0), 0);

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/dashboard/muistoissa')}
        className="text-cream/60 hover:text-cream text-sm flex items-center gap-1"
      >
        <ArrowLeft className="w-4 h-4" />
        Takaisin Muistoissa-koontiin
      </button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl text-cream font-medium">Kirjailijan yölliset ajot</h1>
          <p className="text-sm text-cream/60 mt-1">
            Yhteensä {totalChapters} lukua kirjoitettu, kustannus {(totalCost * USD_TO_EUR).toFixed(2)} €
          </p>
        </div>
        <Button
          onClick={runNow}
          disabled={running}
          className="bg-gold/80 hover:bg-gold text-background"
        >
          {running ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Ajetaan…
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Aja nyt
            </>
          )}
        </Button>
      </div>

      {loading ? (
        <p className="text-cream/60">Ladataan…</p>
      ) : runs.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <p className="text-cream/60">Ei vielä yöllisiä ajoja.</p>
            <p className="text-sm text-cream/40 mt-2">
              Klikkaa "Aja nyt" testataksesi tai odota ajastettua ajoa klo 02:00.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => {
            const hasErrors = run.errors && run.errors.length > 0;
            const isSuccess = run.calls_failed === 0 && run.chapters_failed === 0;
            const costEur = Number(run.estimated_cost_usd) * USD_TO_EUR;

            return (
              <Card key={run.id} className="bg-card border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <CardTitle className="text-cream text-base">
                        {new Date(run.ran_at).toLocaleString('fi-FI')}
                      </CardTitle>
                      <p className="text-xs text-cream/50 mt-1">
                        Kesto {Math.round((run.duration_ms || 0) / 1000)} s
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        isSuccess
                          ? 'bg-green-900/30 text-green-200 border-green-800/50'
                          : hasErrors
                            ? 'bg-red-900/30 text-red-200 border-red-800/50'
                            : 'bg-amber-900/30 text-amber-200 border-amber-800/50'
                      }
                    >
                      {isSuccess ? 'Onnistui' : hasErrors ? 'Virheitä' : 'Osittainen'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Stat label="Puhelut" value={`${run.calls_processed}/${run.calls_processed + run.calls_failed}`} />
                    <Stat label="Luvut" value={String(run.chapters_generated)} />
                    <Stat
                      label="Tokenit"
                      value={(run.total_tokens_in + run.total_tokens_out).toLocaleString('fi-FI')}
                    />
                    <Stat label="Kustannus" value={`${costEur.toFixed(3)} €`} />
                  </div>

                  {hasErrors && (
                    <details className="bg-red-950/20 border border-red-900/40 rounded-md p-3">
                      <summary className="text-sm text-red-200 cursor-pointer flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Virheet ({run.errors!.length})
                      </summary>
                      <ul className="mt-2 space-y-1">
                        {run.errors!.map((e, i) => (
                          <li key={i} className="text-xs text-red-200/80 font-mono">
                            {e}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-cream/50 uppercase tracking-wide">{label}</p>
      <p className="text-base text-cream font-medium mt-1">{value}</p>
    </div>
  );
}
