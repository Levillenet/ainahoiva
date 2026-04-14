import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

const moodEmoji = (s: number | null) => {
  if (!s) return '—';
  return ['😢', '😟', '😐', '🙂', '😊'][s - 1] + ` ${s}/5`;
};

const Reports = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [elders, setElders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [elderFilter, setElderFilter] = useState('');

  useEffect(() => {
    const fetch = async () => {
      const { data: eldersData } = await supabase.from('elders').select('id, full_name');
      setElders(eldersData || []);

      let query = supabase.from('call_reports').select('*, elders(full_name)').order('called_at', { ascending: false }).limit(100);
      if (dateFrom) query = query.gte('called_at', dateFrom);
      if (dateTo) query = query.lte('called_at', dateTo + 'T23:59:59');
      if (elderFilter) query = query.eq('elder_id', elderFilter);

      const { data } = await query;
      setReports(data || []);
      setLoading(false);
    };
    fetch();
  }, [dateFrom, dateTo, elderFilter]);

  const exportCsv = () => {
    const header = 'Vanhus,Aika,Kesto (s),Mieliala,Lääkkeet,Yhteenveto,Hälytys\n';
    const rows = reports.map(r =>
      `"${(r.elders as any)?.full_name || ''}","${r.called_at || ''}",${r.duration_seconds || ''},${r.mood_score || ''},${r.medications_taken ? 'Kyllä' : 'Ei'},"${r.ai_summary || ''}",${r.alert_sent ? 'Kyllä' : 'Ei'}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'raportit.csv'; a.click();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-cream">Raportit</h1>
        <Button onClick={exportCsv} variant="outline" className="border-sage text-sage hover:bg-sage/10">
          <Download className="w-4 h-4 mr-2" /> Lataa CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="Alkaen" className="bg-muted border-border text-cream w-40" />
        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="Asti" className="bg-muted border-border text-cream w-40" />
        <select
          value={elderFilter}
          onChange={e => setElderFilter(e.target.value)}
          className="bg-muted border border-border text-cream rounded-md px-3 py-2 text-sm"
        >
          <option value="">Kaikki vanhukset</option>
          {elders.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="animate-pulse bg-card rounded-lg h-48" />
      ) : reports.length === 0 ? (
        <div className="text-center bg-card rounded-lg p-12 border border-border">
          <p className="text-muted-custom">Ei raportteja.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-3 text-muted-custom">Vanhus</th>
                <th className="p-3 text-muted-custom">Aika</th>
                <th className="p-3 text-muted-custom">Kesto</th>
                <th className="p-3 text-muted-custom">Mieliala</th>
                <th className="p-3 text-muted-custom">Lääkkeet</th>
                <th className="p-3 text-muted-custom">Yhteenveto</th>
                <th className="p-3 text-muted-custom">Hälytys</th>
              </tr>
            </thead>
            <tbody>
              {reports.map(r => (
                <tr key={r.id} className="border-b border-border hover:bg-muted/30">
                  <td className="p-3 text-cream">{(r.elders as any)?.full_name || '—'}</td>
                  <td className="p-3 text-cream">{r.called_at ? new Date(r.called_at).toLocaleString('fi-FI') : '—'}</td>
                  <td className="p-3 text-cream">{r.duration_seconds ? `${Math.floor(r.duration_seconds / 60)} min ${r.duration_seconds % 60} sek` : '—'}</td>
                  <td className="p-3">{moodEmoji(r.mood_score)}</td>
                  <td className="p-3">{r.medications_taken ? '✅' : '❌'}</td>
                  <td className="p-3 text-cream max-w-xs truncate">{r.ai_summary || '—'}</td>
                  <td className="p-3">{r.alert_sent ? <span className="text-terracotta">⚠️</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Reports;
