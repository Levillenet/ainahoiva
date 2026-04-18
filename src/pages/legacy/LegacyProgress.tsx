import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Check, Clock, Circle, X } from 'lucide-react';
import { lifeStageLabel, STATUS_LABELS } from '@/lib/legacy';

interface Row {
  id: string;
  life_stage: string;
  theme: string | null;
  depth_score: number | null;
  status: string | null;
  priority: number | null;
}

const LegacyProgress = () => {
  const { elderId } = useParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [target, setTarget] = useState<string>('—');

  useEffect(() => {
    if (!elderId) return;
    const load = async () => {
      const [{ data: cov }, { data: sub }] = await Promise.all([
        supabase.from('coverage_map').select('id, life_stage, theme, depth_score, status, priority').eq('elder_id', elderId).order('priority', { ascending: false }),
        supabase.from('legacy_subscriptions').select('target_completion_date').eq('elder_id', elderId).maybeSingle(),
      ]);
      setRows(cov ?? []);
      if (sub?.target_completion_date) {
        setTarget(new Date(sub.target_completion_date).toLocaleDateString('fi-FI', { month: 'numeric', year: 'numeric' }));
      }
    };
    load();
  }, [elderId]);

  const overall = rows.length ? Math.round(rows.reduce((s, r) => s + (r.depth_score ?? 0), 0) / rows.length) : 0;

  return (
    <div className="space-y-6">
      <Link to={`/dashboard/muistoissa/${elderId}`} className="text-cream/60 hover:text-cream text-sm flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Takaisin
      </Link>

      <Card className="bg-card border-border">
        <CardContent className="p-6 flex flex-col items-center text-center">
          <BigRing pct={overall} />
          <p className="text-xs text-cream/60 mt-4">Arvioitu valmistuminen</p>
          <p className="text-cream font-medium text-lg">{target}</p>
          <p className="text-xs text-cream/60 mt-3 max-w-md leading-relaxed">
            Koko kirja toimitetaan kerralla. Lukuja ei julkaista yksittäin —
            tämä pitää lopputuloksen yllätyksenä.
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-cream text-base">Elämänkaaren peittokartta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.length === 0 && <p className="text-cream/50 text-sm">Peittokarttaa ei ole vielä alustettu.</p>}
          {rows.map((r) => <CoverageRow key={r.id} row={r} />)}
        </CardContent>
      </Card>
    </div>
  );
};

const CoverageRow = ({ row }: { row: Row }) => {
  const pct = row.depth_score ?? 0;
  const status = row.status ?? 'not_started';
  const colorClass =
    status === 'well_covered' ? 'bg-navy-light' :
    status === 'in_progress' ? 'bg-sage' :
    status === 'declined' ? 'bg-terracotta/40' :
    'bg-muted';

  const Icon =
    status === 'well_covered' ? Check :
    status === 'in_progress' ? Clock :
    status === 'declined' ? X :
    Circle;

  const iconColor =
    status === 'well_covered' ? 'text-gold' :
    status === 'in_progress' ? 'text-sage' :
    status === 'declined' ? 'text-terracotta' :
    'text-cream/40';

  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className={`w-4 h-4 flex-shrink-0 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <p className="text-sm text-cream truncate">{lifeStageLabel(row.life_stage)}</p>
          <span className="text-xs text-cream/50 flex-shrink-0">{STATUS_LABELS[status]}</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className={`h-full ${colorClass} transition-all`} style={{ width: `${status === 'declined' ? 100 : pct}%` }} />
        </div>
      </div>
      <span className="text-xs text-cream/60 w-10 text-right">{pct}%</span>
    </div>
  );
};

const BigRing = ({ pct }: { pct: number }) => {
  const r = 64;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative w-40 h-40">
      <svg className="w-40 h-40 -rotate-90" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={r} className="fill-none stroke-muted" strokeWidth="10" />
        <circle cx="80" cy="80" r={r} className="fill-none stroke-gold transition-all" strokeWidth="10" strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl text-cream font-light">{pct}%</span>
        <span className="text-[10px] text-cream/50 uppercase tracking-wider">valmis</span>
      </div>
    </div>
  );
};

export default LegacyProgress;
