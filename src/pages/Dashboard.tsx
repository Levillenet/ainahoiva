import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Users, Phone, AlertTriangle, Smile, Clock, PhoneCall, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface StatCard {
  label: string;
  value: string | number;
  icon: React.ElementType;
  alert?: boolean;
}

interface ActiveRetry {
  id: string;
  elder_id: string;
  attempt_number: number;
  max_attempts: number;
  next_retry_at: string | null;
  alert_sent: boolean;
  elder_name: string;
}

interface EmotionAvg {
  joy: number;
  sadness: number;
  anxiety: number;
  tiredness: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<StatCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [retries, setRetries] = useState<ActiveRetry[]>([]);
  const [emotions, setEmotions] = useState<EmotionAvg | null>(null);

  const fetchData = useCallback(async () => {
    const { count: elderCount } = await supabase.from('elders').select('*', { count: 'exact', head: true }).eq('is_active', true);

    const today = new Date().toISOString().split('T')[0];
    const { data: todayReports } = await supabase.from('call_reports').select('*').gte('called_at', today);

    const calledToday = todayReports?.length || 0;
    const alertsToday = todayReports?.filter(r => r.alert_sent)?.length || 0;
    const answeredCalls = todayReports?.filter(r => r.duration_seconds && r.duration_seconds > 10)?.length || 0;
    const answerRate = calledToday > 0 ? Math.round((answeredCalls / calledToday) * 100) : 0;

    const { data: moods } = await supabase.from('call_reports').select('mood_score').gte('called_at', today).not('mood_score', 'is', null);
    const avgMood = moods && moods.length > 0
      ? (moods.reduce((s, m) => s + (m.mood_score || 0), 0) / moods.length).toFixed(1)
      : '—';

    const now = new Date();
    const finnishOffset = 3 * 60;
    const finnishTime = new Date(now.getTime() + finnishOffset * 60000);
    const currentMinutes = finnishTime.getHours() * 60 + finnishTime.getMinutes();

    const { data: activeElders } = await supabase.from('elders').select('call_time_morning, call_time_evening').eq('is_active', true);
    let nextCall = '—';
    if (activeElders?.length) {
      const allTimes = activeElders.flatMap(e => [e.call_time_morning, e.call_time_evening].filter(Boolean));
      const futureTimes = allTimes
        .map(t => { const [h, m] = (t as string).split(':').map(Number); return { time: t as string, minutes: h * 60 + m }; })
        .filter(t => t.minutes > currentMinutes)
        .sort((a, b) => a.minutes - b.minutes);
      if (futureTimes.length > 0) nextCall = `klo ${futureTimes[0].time.slice(0, 5)}`;
    }

    setStats([
      { label: 'Aktiiviset vanhukset', value: elderCount || 0, icon: Users },
      { label: 'Tänään soitettu', value: `${calledToday} / ${elderCount || 0}`, icon: Phone },
      { label: 'Vastausprosentti', value: calledToday > 0 ? `${answerRate}%` : '—', icon: Phone },
      { label: 'Hälytykset tänään', value: alertsToday, icon: AlertTriangle, alert: alertsToday > 0 },
      { label: 'Keskimääräinen mieliala', value: avgMood === '—' ? '—' : `${avgMood}/5`, icon: Smile },
      { label: 'Seuraava soitto', value: nextCall, icon: Clock },
    ]);

    // Fetch active retries
    const { data: activeRetries } = await supabase
      .from('missed_call_retries')
      .select('*, elders(full_name)')
      .eq('is_resolved', false);

    if (activeRetries) {
      setRetries(activeRetries.map((r: any) => ({
        ...r,
        elder_name: r.elders?.full_name || '—',
      })));
    }

    // Fetch today's emotion averages
    const { data: emotionReports } = await supabase
      .from('call_reports')
      .select('hume_joy, hume_sadness, hume_anxiety, hume_tiredness')
      .gte('called_at', today)
      .not('hume_raw', 'is', null);

    if (emotionReports && emotionReports.length > 0) {
      const avg = (key: string) => {
        const vals = emotionReports.map((r: any) => r[key]).filter((v: any) => v != null);
        return vals.length > 0 ? vals.reduce((s: number, v: number) => s + v, 0) / vals.length : 0;
      };
      setEmotions({
        joy: avg('hume_joy'),
        sadness: avg('hume_sadness'),
        anxiety: avg('hume_anxiety'),
        tiredness: avg('hume_tiredness'),
      });
    } else {
      setEmotions(null);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleCallNow = async (elderId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('outbound-call', {
        body: { elder_id: elderId, call_type: 'retry' },
      });
      if (error) throw error;
      toast.success('Soitto käynnistetty!');
    } catch {
      toast.error('Soitto epäonnistui');
    }
  };

  const handleResolve = async (retryId: string) => {
    await supabase.from('missed_call_retries').update({ is_resolved: true }).eq('id', retryId);
    setRetries(prev => prev.filter(r => r.id !== retryId));
    toast.success('Merkitty ratkaistuksi');
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-cream mb-6">Yleiskatsaus</h1>

      {/* Active missed call alerts */}
      {retries.length > 0 && (
        <div className="bg-card rounded-lg p-6 border border-terracotta mb-6">
          <h2 className="text-lg font-bold text-terracotta mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Aktiiviset hälytykset
          </h2>
          <div className="space-y-3">
            {retries.map((retry) => (
              <div key={retry.id} className="flex items-center justify-between bg-muted rounded-lg p-4">
                <div>
                  <p className="text-cream font-semibold flex items-center gap-2">
                    🔴 {retry.elder_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {retry.alert_sent
                      ? 'Ei vastannut — hälytys lähetetty'
                      : `Ei vastannut — yritys ${retry.attempt_number}/${retry.max_attempts}`}
                  </p>
                  {retry.next_retry_at && !retry.alert_sent && (
                    <p className="text-xs text-muted-foreground">
                      Seuraava yritys klo {new Date(retry.next_retry_at).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {!retry.alert_sent && (
                    <Button size="sm" onClick={() => handleCallNow(retry.elder_id)} className="bg-gold text-primary-foreground hover:bg-gold/90">
                      <PhoneCall className="w-4 h-4 mr-1" /> Soita nyt
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => handleResolve(retry.id)} className="border-border text-cream">
                    <CheckCircle className="w-4 h-4 mr-1" /> Merkitse ok
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card rounded-lg p-6 animate-pulse h-28" />
          ))
        ) : (
          stats.map((stat) => (
            <div key={stat.label} className={`bg-card rounded-lg p-6 border ${stat.alert ? 'border-terracotta' : 'border-border'}`}>
              <div className="flex items-center gap-3 mb-3">
                <stat.icon className={`w-5 h-5 ${stat.alert ? 'text-terracotta' : 'text-sage'}`} />
                <span className="text-sm text-muted-foreground">{stat.label}</span>
              </div>
              <div className={`text-3xl font-bold ${stat.alert ? 'text-terracotta' : 'text-gold'}`}>
                {stat.value}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Emotion summary */}
      {!loading && emotions && (
        <div className="mt-6">
          <h2 className="text-lg font-bold text-cream mb-4">Tänään tunneprofiilit</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { emoji: '😊', label: 'Ilo', value: emotions.joy },
              { emoji: '😢', label: 'Suru', value: emotions.sadness },
              { emoji: '😰', label: 'Ahdistus', value: emotions.anxiety },
              { emoji: '😴', label: 'Väsymys', value: emotions.tiredness },
            ].map(e => (
              <div key={e.label} className="bg-card rounded-lg p-4 border border-border text-center">
                <div className="text-2xl mb-1">{e.emoji}</div>
                <div className="text-2xl font-bold text-gold">{Math.round(e.value * 100)}%</div>
                <div className="text-sm text-muted-foreground">{e.label}</div>
                <div className="text-xs text-muted-foreground">Kaikki vanhukset</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && stats[0]?.value === 0 && (
        <div className="mt-12 text-center bg-card rounded-lg p-8 border border-border">
          <Users className="w-12 h-12 text-sage mx-auto mb-4" />
          <h2 className="text-xl font-bold text-cream mb-2">Tervetuloa AinaHoivaan!</h2>
          <p className="text-muted-foreground">
            Aloita lisäämällä ensimmäinen vanhus. Siirry <span className="text-gold">Vanhukset</span>-sivulle.
          </p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
