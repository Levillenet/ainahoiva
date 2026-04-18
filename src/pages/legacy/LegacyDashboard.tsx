import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { BookHeart, ArrowRight, Sparkles, FlaskConical } from 'lucide-react';
import { calcAge, formatMonthYear, LIFE_STAGES, startOfWeek, toDateString } from '@/lib/legacy';
import { toast } from '@/hooks/use-toast';

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
  const [seeding, setSeeding] = useState(false);

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
    } else {
      setCoverageByElder({});
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const seedRitvaData = async () => {
    setSeeding(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) {
        throw new Error('Et ole kirjautunut sisään.');
      }

      // 1. Find or create Ritva
      const { data: existingRitva, error: findErr } = await supabase
        .from('elders')
        .select('id')
        .eq('full_name', 'Ritva Mäkinen')
        .maybeSingle();
      if (findErr) throw new Error('Vanhuksen haku: ' + findErr.message);

      let ritvaId = existingRitva?.id;
      if (!ritvaId) {
        const { data: newRitva, error: createErr } = await supabase
          .from('elders')
          .insert({
            full_name: 'Ritva Mäkinen',
            phone_number: '+358401234567',
            date_of_birth: '1943-03-12',
            call_time_morning: '10:00',
            call_time_evening: '19:00',
            is_active: true,
            created_by: userId,
          })
          .select('id')
          .single();
        if (createErr) throw new Error('Vanhuksen luonti: ' + createErr.message);
        ritvaId = newRitva.id;
      }

      // 2. legacy_profile (upsert)
      const { error: profileErr } = await supabase
        .from('legacy_profile')
        .upsert({
          elder_id: ritvaId,
          birth_year: 1943,
          birth_place: 'Viipuri',
          dialect_region: 'Karjala',
          marital_status: 'leski',
          spouse_info: { name: 'Paavo', status: 'kuollut' },
          children_info: [
            { name: 'Anja', birth_year: '1965' },
            { name: 'Tuomo', birth_year: '1968' },
          ],
          parents_info: {
            mother: { name: 'Maria', note: 'rauhallinen, pidätyskykyinen' },
            father: { name: 'Jaakko', note: 'puuseppä' },
            siblings: 'Eino (sotalapsi Ruotsissa, ei palannut) - ÄLÄ KYSY',
          },
          sensitive_topics: 'Eino-veli (sotalapsi), Paavon kuolema liian aikaista',
          favorite_topics: 'Liisa-ystävä ompelimosta, mökki Karjalohjalla, muutto Helsinkiin 1962',
          profession: 'ompelija rouva Saarnion ompelimossa Töölössä 1962-1998',
          health_notes: 'virkea',
          onboarding_completed: true,
        }, { onConflict: 'elder_id' });
      if (profileErr) throw new Error('Profiili: ' + profileErr.message);

      // 3. legacy_subscriptions (upsert)
      const startedAt = new Date();
      startedAt.setDate(startedAt.getDate() - 90);
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 275);

      const { error: subErr } = await supabase
        .from('legacy_subscriptions')
        .upsert({
          elder_id: ritvaId,
          status: 'active',
          started_at: startedAt.toISOString(),
          target_completion_date: targetDate.toISOString().slice(0, 10),
          book_target_chapters: 15,
          weekly_call_count: 2,
        }, { onConflict: 'elder_id' });
      if (subErr) throw new Error('Tilaus: ' + subErr.message);

      // 4. coverage_map (only if not already seeded)
      const { data: existingCov, error: covCheckErr } = await supabase
        .from('coverage_map')
        .select('id')
        .eq('elder_id', ritvaId)
        .limit(1);
      if (covCheckErr) throw new Error('Coverage-tarkistus: ' + covCheckErr.message);

      if (!existingCov?.length) {
        const ritvaCoverage: Record<string, { status: string; depth: number }> = {
          lapsuus: { status: 'in_progress', depth: 45 },
          vanhemmat: { status: 'in_progress', depth: 60 },
          sisarukset: { status: 'declined', depth: 5 },
          koulu: { status: 'well_covered', depth: 85 },
          nuoruus: { status: 'well_covered', depth: 90 },
          kotoa_lahto: { status: 'well_covered', depth: 100 },
          tyo: { status: 'in_progress', depth: 75 },
          parisuhde: { status: 'in_progress', depth: 25 },
          lasten_synty: { status: 'not_started', depth: 0 },
          keski_ika: { status: 'not_started', depth: 0 },
          harrastukset: { status: 'in_progress', depth: 30 },
          matkat: { status: 'not_started', depth: 0 },
          menetykset: { status: 'not_started', depth: 0 },
          elakkeelle: { status: 'not_started', depth: 0 },
          arvot: { status: 'not_started', depth: 0 },
        };
        const rows = LIFE_STAGES.map((s) => {
          const r = ritvaCoverage[s.key] ?? { status: 'not_started', depth: 0 };
          return {
            elder_id: ritvaId!,
            life_stage: s.key,
            theme: s.label,
            priority: s.priority,
            is_sensitive: !!s.sensitive,
            requires_trust_first: !!s.trustFirst,
            status: r.status,
            depth_score: r.depth,
            last_discussed: r.status === 'in_progress' || r.status === 'well_covered'
              ? new Date().toISOString()
              : null,
          };
        });
        const { error: covErr } = await supabase.from('coverage_map').insert(rows);
        if (covErr) throw new Error('Coverage-luonti: ' + covErr.message);
      }

      // 5. legacy_highlights — 4 rows over the past weeks
      const thisWeek = startOfWeek();
      const weekFor = (weeksAgo: number) => {
        const d = new Date(thisWeek);
        d.setDate(d.getDate() - weeksAgo * 7);
        return toDateString(d);
      };
      const createdFor = (daysAgo: number) => {
        const d = new Date();
        d.setDate(d.getDate() - daysAgo);
        return d.toISOString();
      };

      const highlights = [
        {
          elder_id: ritvaId,
          week_start: weekFor(4),
          quote: 'Kun muutin Helsinkiin 1962 toukokuussa, äiti itki aamulla. Mulle hän antoi sata markkaa ja ruskean pahvisen matkalaukun.',
          context: 'Ritva kertoi kotoa lähdöstä',
          target_chapter: 'Muutto Helsinkiin',
          created_at: createdFor(28),
        },
        {
          elder_id: ritvaId,
          week_start: weekFor(3),
          quote: 'Liisa oli Ylihärmästä ja laulaa koko ajan. Me jaettiin vuokralappu Tähtitorninkadulla, kolmannen kerroksen ullakkohuone.',
          context: 'Ritva kertoi ensimmäisestä Helsingin-vuodestaan',
          target_chapter: 'Ompelimon aika',
          created_at: createdFor(21),
        },
        {
          elder_id: ritvaId,
          week_start: weekFor(2),
          quote: 'Rouva Saarnio piti minusta koska olin hiljainen ja pistot oli nätit. Hän antoi minulle avaimen ensimmäisenä syksynä.',
          context: 'Ensimmäisestä työpaikasta',
          target_chapter: 'Ensimmäinen työ',
          created_at: createdFor(14),
        },
        {
          elder_id: ritvaId,
          week_start: weekFor(0),
          quote: 'Hän istui samaan pöytään ja kysyi saiko lainata suolasirotinta. Mä katsoin Liisaa ja Liisa mulle. Me tiedettiin että tämä oli se.',
          context: 'Paavon tapaamisesta Elannon ruokalassa',
          target_chapter: 'Kun tapasin Paavon',
          created_at: createdFor(2),
        },
      ];
      const { error: hlErr } = await supabase.from('legacy_highlights').insert(highlights);
      if (hlErr) throw new Error('Poiminnat: ' + hlErr.message);

      // 6. legacy_observations
      const observations = [
        {
          elder_id: ritvaId,
          type: 'milestone',
          title: 'Ensimmäinen luku valmis',
          description: 'Muutto Helsinkiin -luku on valmis. Tämän viikon aikana Aina alkoi käsitellä Paavon tapaamista.',
          created_at: createdFor(7),
        },
        {
          elder_id: ritvaId,
          type: 'sensitive_topic',
          title: 'Eino-veljen aihe',
          description: 'Ritva ei halua puhua Einosta. Aina on kysynyt kahdesti kevyesti, molemmilla kerroilla Ritva vaihtoi aihetta. Aina kunnioittaa rajaa eikä kysy enää suoraan.',
          created_at: createdFor(14),
        },
        {
          elder_id: ritvaId,
          type: 'suggestion',
          title: 'Äiti Mariasta',
          description: 'Ritva mainitsee äitiään Mariaa haikeasti useissa puheluissa. Jos haluatte, voisin pyytää Ainaa syventämään tätä aihetta lähiaikoina.',
          created_at: createdFor(3),
          read_by_family: false,
        },
      ];
      const { error: obsErr } = await supabase.from('legacy_observations').insert(observations);
      if (obsErr) throw new Error('Huomiot: ' + obsErr.message);

      // 7. legacy_topic_requests
      const topicRequests = [
        {
          elder_id: ritvaId,
          requested_by: userId,
          status: 'addressed',
          topic: 'Isoäiti Marian elämä',
          note: 'Haluaisin tietää enemmän äidistäni Mariasta — millainen hän oli, miten he pärjäsivät evakon jälkeen',
          created_at: createdFor(30),
        },
        {
          elder_id: ritvaId,
          requested_by: userId,
          status: 'pending',
          topic: 'Mökkielämä Karjalohjalla',
          note: 'Lapset muistavat mökkiä, mutta ei tarinoita. Voisiko Aina kysellä mökin arkea: kuka rakensi, minkälaisia kesiä, mikä oli tärkeintä?',
          created_at: createdFor(5),
        },
      ];
      const { error: trErr } = await supabase.from('legacy_topic_requests').insert(topicRequests);
      if (trErr) throw new Error('Aihepyynnöt: ' + trErr.message);

      toast({
        title: 'Ritva-testidata luotu',
        description: 'Vanhus näkyy nyt Muistoissa-listassa.',
      });
      await load();
    } catch (err) {
      console.error('Seed failed:', err);
      toast({
        title: 'Testidatan luonti epäonnistui',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setSeeding(false);
    }
  };

  const subscribed = elders.filter((e) => (e.legacy_subscriptions?.length ?? 0) > 0);
  const available = elders.filter((e) => (e.legacy_subscriptions?.length ?? 0) === 0);

  if (loading) {
    return <div className="text-cream/60">Ladataan…</div>;
  }

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <BookHeart className="w-6 h-6 text-gold" />
              <div>
                <CardTitle className="text-cream">Aina Muistoissa</CardTitle>
                <p className="text-sm text-cream/60 mt-1">Elämäntarinan kokoaminen kirjaksi</p>
              </div>
            </div>
            {import.meta.env.DEV && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={seeding}>
                    <FlaskConical className="w-3 h-3 mr-1" />
                    {seeding ? 'Luodaan…' : 'Luo Ritva-testidata'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Luodaan testivanhus</AlertDialogTitle>
                    <AlertDialogDescription>
                      Luodaan testivanhus Ritva kaikilla Muistoissa-tiedoilla (profiili, tilaus, edistymä, poiminnat, huomiot ja aihepyynnöt). Jatkaako?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Peruuta</AlertDialogCancel>
                    <AlertDialogAction onClick={seedRitvaData}>Luo testidata</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
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
