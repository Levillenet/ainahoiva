import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Brain } from 'lucide-react';

interface Concern {
  elder_id: string;
  elder_name: string;
  observations: string | null;
  assessed_at: string;
}

const CognitiveAlertBanner = () => {
  const [concerns, setConcerns] = useState<Concern[]>([]);

  useEffect(() => {
    const load = async () => {
      // Last 7 days, only "selkeä huoli" for elders with tracking enabled
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data } = await supabase
        .from('cognitive_assessments')
        .select('elder_id, observations, assessed_at, elders!inner(full_name, cognitive_tracking_enabled)')
        .eq('overall_impression', 'selkeä huoli')
        .gte('assessed_at', sevenDaysAgo.toISOString())
        .order('assessed_at', { ascending: false });

      if (!data) return;
      // Dedupe by elder, take most recent per elder
      const seen = new Set<string>();
      const list: Concern[] = [];
      for (const row of data as any[]) {
        if (seen.has(row.elder_id)) continue;
        if (!row.elders?.cognitive_tracking_enabled) continue;
        seen.add(row.elder_id);
        list.push({
          elder_id: row.elder_id,
          elder_name: row.elders.full_name,
          observations: row.observations,
          assessed_at: row.assessed_at,
        });
      }
      setConcerns(list);
    };
    load();
  }, []);

  if (concerns.length === 0) return null;

  return (
    <div className="bg-card rounded-lg p-5 border border-gold mb-6">
      <h2 className="text-base font-semibold text-gold mb-3 flex items-center gap-2">
        <Brain className="w-5 h-5" /> Kognitiivisia huomioita viime päivinä
      </h2>
      <div className="space-y-2">
        {concerns.map(c => (
          <Link
            key={c.elder_id}
            to={`/dashboard/vanhukset/${c.elder_id}/kognitio`}
            className="block bg-muted rounded-lg p-3 hover:bg-muted/70 transition-colors"
          >
            <p className="text-cream text-sm font-medium">{c.elder_name}</p>
            {c.observations && (
              <p className="text-muted-foreground text-xs mt-1 italic line-clamp-2">"{c.observations}"</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(c.assessed_at).toLocaleDateString('fi-FI')} — Klikkaa nähdäksesi koko historian
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default CognitiveAlertBanner;
