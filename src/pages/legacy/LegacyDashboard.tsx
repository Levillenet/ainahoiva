import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookHeart, ArrowRight, Sparkles } from 'lucide-react';
import { calcAge, formatMonthYear } from '@/lib/legacy';

interface ElderRow {
  id: string;
  full_name: string;
  legacy_subscriptions: {
    status: string;
    started_at: string;
    target_completion_date: string | null;
    book_target_chapters: number;
  }[] | null;
  legacy_profile: { birth_year: number | null }[] | null;
  call_reports: { called_at: string }[] | null;
}

const LegacyDashboard = () => {
  const [elders, setElders] = useState<ElderRow[]>([]);
  const [coverageByElder, setCoverageByElder] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: eldersData } = await supabase
        .from('elders')
        .select(`
          id, full_name,
          legacy_subscriptions(status, started_at, target_completion_date, book_target_chapters),
          legacy_profile(birth_year),
          call_reports(called_at)
        `)
        .eq('is_active', true)
        .order('full_name');

      const list = (eldersData ?? []) as unknown as ElderRow[];
      setElders(list);

      const subscribedIds = list
        .filter((e) => (e.legacy_subscriptions?.length ?? 0) > 0)
        .map((e) => e.id);

      if (subscribedIds.length) {
        const { data: cov } = await supabase
          .from('coverage_map')
          .select('elder_id, depth_score')
          .in('elder_id', subscribedIds);
        const map: Record<string, { sum: number; count: number }> = {};
        (cov ?? []).forEach((r: { elder_id: string; depth_score: number | null }) => {
          if (!map[r.elder_id]) map[r.elder_id] = { sum: 0, count: 0 };
          map[r.elder_id].sum += r.depth_score ?? 0;
          map[r.elder_id].count += 1;
        });
        const pct: Record<string, number> = {};
        Object.entries(map).forEach(([id, v]) => {
          pct[id] = v.count ? Math.round(v.sum / v.count) : 0;
        });
        setCoverageByElder(pct);
      }
      setLoading(false);
    };
    load();
  }, []);

  const subscribed = elders.filter((e) => (e.legacy_subscriptions?.length ?? 0) > 0);
  const available = elders.filter((e) => (e.legacy_subscriptions?.length ?? 0) === 0);

  if (loading) {
    return <div className="text-cream/60">Ladataan…</div>;
  }

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <BookHeart className="w-6 h-6 text-gold" />
            <div>
              <CardTitle className="text-cream">Aina Muistoissa</CardTitle>
              <p className="text-sm text-cream/60 mt-1">Elämäntarinan kokoaminen kirjaksi</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-cream/80 text-sm leading-relaxed">
            Aina haastattelee viikoittain lyhyillä puheluilla ja kokoaa vuoden aikana
            koko elämäntarinan painetuksi kirjaksi. Te näette edistymistä, mutta lukujen sisältö
            säilyy yllätyksenä — kirja toimitetaan kerralla valmiina.
          </p>
        </CardContent>
      </Card>

      {elders.length === 0 && (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <p className="text-cream/70">Lisää ensin vanhus Vanhukset-sivulla.</p>
          </CardContent>
        </Card>
      )}

      {subscribed.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-cream mb-3">Käynnissä olevat tarinat</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {subscribed.map((e) => {
              const sub = e.legacy_subscriptions![0];
              const age = calcAge(e.legacy_profile?.[0]?.birth_year);
              const pct = coverageByElder[e.id] ?? 0;
              const lastCall = e.call_reports?.[0]?.called_at;
              const target = sub.target_completion_date
                ? formatMonthYear(new Date(sub.target_completion_date))
                : '—';
              return (
                <Link key={e.id} to={`/dashboard/muistoissa/${e.id}`}>
                  <Card className="bg-card border-border hover:border-gold/40 transition-colors cursor-pointer">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-cream font-medium">{e.full_name}</h3>
                          {age && <p className="text-xs text-cream/50">{age} v.</p>}
                        </div>
                        <ProgressRing pct={pct} />
                      </div>
                      <div className="mt-4 space-y-1 text-xs text-cream/60">
                        <p>Arvioitu valmistuminen: <span className="text-cream/80">{target}</span></p>
                        <p>
                          Viimeinen puhelu:{' '}
                          <span className="text-cream/80">
                            {lastCall ? new Date(lastCall).toLocaleDateString('fi-FI') : 'Ei vielä'}
                          </span>
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {available.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-cream mb-3">Voitte aloittaa Muistoissa</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {available.map((e) => (
              <Card key={e.id} className="bg-card border-border">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-sage" />
                    <h3 className="text-cream font-medium">{e.full_name}</h3>
                  </div>
                  <p className="text-xs text-cream/60 mb-4">
                    Kokoa hänen elämäntarinansa kirjaksi viikoittaisilla puheluilla.
                  </p>
                  <Link to={`/dashboard/muistoissa/${e.id}/onboarding`}>
                    <Button variant="outline" size="sm" className="w-full">
                      Aloita Muistoissa
                      <ArrowRight className="w-3 h-3 ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ProgressRing = ({ pct }: { pct: number }) => {
  const r = 22;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative w-14 h-14">
      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} className="fill-none stroke-muted" strokeWidth="4" />
        <circle
          cx="28"
          cy="28"
          r={r}
          className="fill-none stroke-gold transition-all"
          strokeWidth="4"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs text-cream font-medium">
        {pct}%
      </span>
    </div>
  );
};

export default LegacyDashboard;
