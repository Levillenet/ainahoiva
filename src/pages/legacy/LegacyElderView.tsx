import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Quote, MessageCircle, ArrowLeft, Send, Eye, Phone, MessageSquare, Pencil, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { startOfWeek, lifeStageLabel } from '@/lib/legacy';
import { toast } from '@/hooks/use-toast';

const LegacyElderView = () => {
  const { elderId } = useParams();
  const [elder, setElder] = useState<{ full_name: string } | null>(null);
  const [coveragePct, setCoveragePct] = useState(0);
  const [target, setTarget] = useState<string>('—');
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<{ quote: string; created_at: string; context: string | null }[]>([]);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [observations, setObservations] = useState<{ id: string; title: string; description: string | null; type: string; read_by_family: boolean | null; created_at: string }[]>([]);
  const [weekStats, setWeekStats] = useState({ calls: 0, durationMin: 0, avgMood: 0 });
  const [currentTopic, setCurrentTopic] = useState<{ life_stage: string; depth_score: number } | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!elderId) return;
    const load = async () => {
      const [{ data: e }, { data: sub }, { data: cov }, { data: hl }, { data: obs }, { data: calls }, { data: topic }] = await Promise.all([
        supabase.from('elders').select('full_name').eq('id', elderId).maybeSingle(),
        supabase.from('legacy_subscriptions').select('target_completion_date, status').eq('elder_id', elderId).maybeSingle(),
        supabase.from('coverage_map').select('depth_score').eq('elder_id', elderId),
        supabase.from('legacy_highlights').select('quote, created_at, context').eq('elder_id', elderId).order('created_at', { ascending: false }),
        supabase.from('legacy_observations').select('id, title, description, type, read_by_family, created_at').eq('elder_id', elderId).order('created_at', { ascending: false }).limit(3),
        supabase.from('call_reports').select('duration_seconds, mood_score, called_at').eq('elder_id', elderId).eq('call_type', 'muistoissa').gte('called_at', startOfWeek().toISOString()),
        supabase.from('coverage_map').select('life_stage, depth_score').eq('elder_id', elderId).eq('status', 'in_progress').order('last_discussed', { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
      ]);

      setElder(e);
      setSubscriptionStatus(sub?.status ?? null);
      if (sub?.target_completion_date) {
        setTarget(new Date(sub.target_completion_date).toLocaleDateString('fi-FI', { month: 'numeric', year: 'numeric' }));
      }
      if (cov && cov.length) {
        const avg = cov.reduce((a, c) => a + (c.depth_score ?? 0), 0) / cov.length;
        setCoveragePct(Math.round(avg));
      }
      setHighlight(hl);
      setObservations(obs ?? []);
      setCurrentTopic(topic ?? null);
      const callsArr = calls ?? [];
      const totalSec = callsArr.reduce((s, c) => s + (c.duration_seconds ?? 0), 0);
      const moods = callsArr.map((c) => c.mood_score).filter((m): m is number => m != null);
      setWeekStats({
        calls: callsArr.length,
        durationMin: Math.round(totalSec / 60),
        avgMood: moods.length ? Math.round(moods.reduce((a, b) => a + b, 0) / moods.length) : 0,
      });
    };
    load();
  }, [elderId]);

  const firstName = elder?.full_name?.split(' ')[0] ?? '';
  const moodEmoji = weekStats.avgMood >= 7 ? '😊' : weekStats.avgMood >= 5 ? '🙂' : weekStats.avgMood > 0 ? '😐' : '—';

  const startMuistoissaCall = async () => {
    if (!elderId || starting) return;
    setStarting(true);
    try {
      const { data, error } = await supabase.functions.invoke('muistoissa-start-call', {
        body: { elderId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: 'Puhelu käynnistetty',
        description: 'Aina soittaa kohta vanhukselle. Seuraa tilannetta tällä sivulla.',
      });
    } catch (err) {
      toast({
        title: 'Puhelun käynnistäminen epäonnistui',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/dashboard/muistoissa" className="text-cream/60 hover:text-cream text-sm flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Takaisin
        </Link>
        <h1 className="text-xl text-cream font-medium">{elder?.full_name}</h1>
        <Link to={`/dashboard/vanhukset/${elderId}`} className="text-cream/60 hover:text-cream text-sm flex items-center gap-1">
          Perustiedot <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {subscriptionStatus === 'active' && (
        <div className="flex justify-end gap-2 flex-wrap">
          <Link to={`/dashboard/muistoissa/${elderId}/muokkaa`}>
            <Button variant="outline" size="sm">
              <Pencil className="w-3 h-3 mr-2" />
              Muokkaa tietoja
            </Button>
          </Link>
          <Link to={`/dashboard/muistoissa/${elderId}/kirja`}>
            <Button
              variant="outline"
              size="sm"
              className="border-gold/50 text-gold hover:bg-gold/10"
            >
              <BookOpen className="w-3 h-3 mr-2" />
              Avaa kirja
            </Button>
          </Link>
          {import.meta.env.DEV && (
            <Link to={`/dashboard/muistoissa/${elderId}/testaa`}>
              <Button variant="outline" size="sm">
                <MessageSquare className="w-3 h-3 mr-2" />
                Testaa algoritmia
              </Button>
            </Link>
          )}
          <Button
            onClick={startMuistoissaCall}
            disabled={starting}
            className="bg-gold text-navy hover:bg-gold/90"
          >
            <Phone className="w-4 h-4 mr-2" />
            {starting ? 'Käynnistetään…' : 'Aloita Muistoissa-puhelu nyt'}
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* LEFT — Book progress */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-cream text-base">Kirjan edistyminen</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <BigRing pct={coveragePct} />
            <p className="text-xs text-cream/60 mt-4">Arvioitu valmistuminen</p>
            <p className="text-cream font-medium">{target}</p>
            <Link to={`/dashboard/muistoissa/${elderId}/edistyminen`} className="mt-4 w-full">
              <Button variant="outline" size="sm" className="w-full">
                Avaa kartta <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* MIDDLE — This week */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-cream text-base">Tämä viikko</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Stat label="Puheluja" value={String(weekStats.calls)} />
            <Stat label="Yhteiskesto" value={`${weekStats.durationMin} min`} />
            <Stat label="Mieliala" value={`${moodEmoji} ${weekStats.avgMood || '—'}`} />
            {currentTopic && (
              <div className="pt-3 mt-3 border-t border-border/50">
                <p className="text-xs text-cream/50 uppercase tracking-wide mb-1">
                  Parhaillaan
                </p>
                <p className="text-cream font-medium">
                  {lifeStageLabel(currentTopic.life_stage)}
                </p>
                <p className="text-xs text-cream/60 mt-1">
                  {currentTopic.depth_score}% käsitelty
                </p>
              </div>
            )}
            <Link to={`/dashboard/muistoissa/${elderId}/puhelut`}>
              <Button variant="outline" size="sm" className="w-full mt-2">
                Katso Muistoissa-puhelut <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* RIGHT — Highlight */}
        <Card className="bg-card border-2 border-gold/40 shadow-lg shadow-gold/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Quote className="w-4 h-4 text-gold" />
              <CardTitle className="text-cream text-base">Arvokas hetki tältä viikolta</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {highlight ? (
              <>
                <p className="italic text-cream text-base leading-relaxed">"{highlight.quote}"</p>
                <p className="text-xs text-cream/60 mt-3">
                  — {firstName}, {new Date(highlight.created_at).toLocaleDateString('fi-FI')}
                </p>
                <p className="text-xs text-gold/70 mt-4 italic">Tämä tulee olemaan osa kirjaa.</p>
              </>
            ) : (
              <p className="text-cream/50 text-sm">Ensimmäinen poiminta ilmestyy ensimmäisten puheluiden jälkeen.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Observations */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-cream text-base">Ainan huomiot</CardTitle>
            <Link to={`/dashboard/muistoissa/${elderId}/huomiot`} className="text-xs text-cream/60 hover:text-cream flex items-center gap-1">
              Kaikki <Eye className="w-3 h-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {observations.length === 0 && <p className="text-cream/50 text-sm">Ei vielä huomioita.</p>}
          {observations.map((o) => (
            <div key={o.id} className={`p-3 rounded-lg border ${o.read_by_family ? 'border-border bg-muted/20' : 'border-sage/30 bg-sage/5'}`}>
              <p className="text-cream text-sm font-medium">{o.title}</p>
              {o.description && <p className="text-cream/70 text-xs mt-1">{o.description}</p>}
              <p className="text-cream/40 text-[10px] mt-2">{new Date(o.created_at).toLocaleDateString('fi-FI')}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* CTA */}
      <Card className="bg-card border-border">
        <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <MessageCircle className="w-5 h-5 text-sage mt-0.5" />
            <div>
              <p className="text-cream font-medium">Onko aiheita joista haluatte Ainan kysyvän?</p>
              <p className="text-cream/60 text-xs mt-1">Voitte ehdottaa muistoja, henkilöitä tai tapahtumia.</p>
            </div>
          </div>
          <Link to={`/dashboard/muistoissa/${elderId}/pyynnot`}>
            <Button variant="outline" size="sm">
              <Send className="w-3 h-3 mr-2" /> Pyydä Ainaa kysymään
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between items-baseline">
    <span className="text-xs text-cream/60">{label}</span>
    <span className="text-cream font-medium">{value}</span>
  </div>
);

const BigRing = ({ pct }: { pct: number }) => {
  const r = 56;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative w-36 h-36">
      <svg className="w-36 h-36 -rotate-90" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} className="fill-none stroke-muted" strokeWidth="8" />
        <circle
          cx="70"
          cy="70"
          r={r}
          className="fill-none stroke-gold transition-all"
          strokeWidth="8"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl text-cream font-light">{pct}%</span>
        <span className="text-[10px] text-cream/50 uppercase tracking-wider">valmis</span>
      </div>
    </div>
  );
};

export default LegacyElderView;
