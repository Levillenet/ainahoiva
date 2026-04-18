import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Lightbulb, Award, Shield, Heart, AlertTriangle } from 'lucide-react';

interface Obs {
  id: string;
  type: string | null;
  title: string;
  description: string | null;
  read_by_family: boolean | null;
  created_at: string;
}

const TYPE_META: Record<string, { label: string; Icon: typeof Lightbulb; color: string }> = {
  suggestion: { label: 'Ehdotus', Icon: Lightbulb, color: 'text-gold' },
  milestone: { label: 'Virstanpylväs', Icon: Award, color: 'text-sage' },
  sensitive_topic: { label: 'Herkkä aihe', Icon: Heart, color: 'text-terracotta' },
  boundary_respected: { label: 'Raja kunnioitettu', Icon: Shield, color: 'text-sage' },
  consistency_issue: { label: 'Johdonmukaisuus', Icon: AlertTriangle, color: 'text-red-400' },
};

const LegacyObservations = () => {
  const { elderId } = useParams();
  const [items, setItems] = useState<Obs[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'suggestion' | 'boundary_respected' | 'milestone'>('all');

  const load = async () => {
    if (!elderId) return;
    const { data } = await supabase
      .from('legacy_observations')
      .select('id, type, title, description, read_by_family, created_at')
      .eq('elder_id', elderId)
      .order('created_at', { ascending: false });
    setItems(data ?? []);
  };

  useEffect(() => { load(); }, [elderId]);

  const markRead = async (id: string) => {
    await supabase.from('legacy_observations').update({ read_by_family: true }).eq('id', id);
    setItems((p) => p.map((o) => o.id === id ? { ...o, read_by_family: true } : o));
  };

  const filtered = items.filter((o) => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !o.read_by_family;
    return o.type === filter;
  });

  return (
    <div className="space-y-6">
      <Link to={`/dashboard/muistoissa/${elderId}`} className="text-cream/60 hover:text-cream text-sm flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Takaisin
      </Link>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-cream">Ainan huomiot</CardTitle>
          <p className="text-xs text-cream/60 mt-1">Hienovaraiset havainnot puheluiden ajalta.</p>
        </CardHeader>
        <CardContent>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="all">Kaikki</TabsTrigger>
              <TabsTrigger value="unread">Lukemattomat</TabsTrigger>
              <TabsTrigger value="suggestion">Ehdotukset</TabsTrigger>
              <TabsTrigger value="boundary_respected">Rajat kunnioitettu</TabsTrigger>
              <TabsTrigger value="milestone">Virstanpylväät</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="mt-4 space-y-2">
            {filtered.length === 0 && <p className="text-cream/50 text-sm py-6 text-center">Ei huomioita.</p>}
            {filtered.map((o) => {
              const meta = TYPE_META[o.type ?? 'suggestion'] ?? TYPE_META.suggestion;
              const Icon = meta.Icon;
              return (
                <button
                  key={o.id}
                  onClick={() => !o.read_by_family && markRead(o.id)}
                  className={`w-full text-left p-4 rounded-lg border transition-colors ${
                    o.read_by_family ? 'border-border bg-muted/20' : 'border-gold/40 bg-gold/5 hover:bg-gold/10'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${meta.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-cream font-medium">{o.title}</p>
                        <span className="text-[10px] text-cream/40 flex-shrink-0">{meta.label}</span>
                      </div>
                      {o.description && <p className="text-cream/70 text-xs mt-1">{o.description}</p>}
                      <p className="text-cream/40 text-[10px] mt-2">{new Date(o.created_at).toLocaleDateString('fi-FI')}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LegacyObservations;
