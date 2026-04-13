import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MessageSquare } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SmsEntry {
  id: string;
  elder_id: string | null;
  to_number: string | null;
  message: string | null;
  type: string | null;
  sent_at: string | null;
  elder_name?: string;
}

const typeConfig: Record<string, { icon: string; label: string }> = {
  summary: { icon: '📋', label: 'Yhteenveto' },
  reminder: { icon: '💊', label: 'Muistutus' },
  alert: { icon: '🚨', label: 'Hälytys' },
  missed_call_alert: { icon: '📵', label: 'Vastaamaton' },
};

const SmsLog = () => {
  const [logs, setLogs] = useState<SmsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchLogs = async () => {
      const { data } = await supabase
        .from('sms_log')
        .select('*, elders(full_name)')
        .order('sent_at', { ascending: false })
        .limit(200);

      if (data) {
        setLogs(
          data.map((d: any) => ({
            ...d,
            elder_name: d.elders?.full_name || '—',
          }))
        );
      }
      setLoading(false);
    };
    fetchLogs();
  }, []);

  const filtered = filter === 'all' ? logs : logs.filter((l) => l.type === filter);

  return (
    <div>
      <h1 className="text-2xl font-bold text-cream mb-6 flex items-center gap-2">
        <MessageSquare className="w-6 h-6 text-sage" /> Viestit
      </h1>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="bg-muted mb-4">
          <TabsTrigger value="all">Kaikki</TabsTrigger>
          <TabsTrigger value="summary">📋 Yhteenveto</TabsTrigger>
          <TabsTrigger value="reminder">💊 Muistutus</TabsTrigger>
          <TabsTrigger value="alert">🚨 Hälytys</TabsTrigger>
          <TabsTrigger value="missed_call_alert">📵 Vastaamaton</TabsTrigger>
        </TabsList>

        <TabsContent value={filter}>
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Ladataan...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Ei viestejä {filter !== 'all' ? 'tässä kategoriassa' : ''}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-left">
                      <th className="p-3">Tyyppi</th>
                      <th className="p-3">Vanhus</th>
                      <th className="p-3">Vastaanottaja</th>
                      <th className="p-3">Viesti</th>
                      <th className="p-3">Aika</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((log) => {
                      const cfg = typeConfig[log.type || ''] || { icon: '📩', label: log.type || '—' };
                      return (
                        <tr key={log.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="p-3">
                            <span className="flex items-center gap-1 text-xs">
                              {cfg.icon} {cfg.label}
                            </span>
                          </td>
                          <td className="p-3 text-cream">{log.elder_name}</td>
                          <td className="p-3 text-muted-foreground font-mono text-xs">{log.to_number}</td>
                          <td className="p-3 text-cream max-w-xs truncate">{log.message}</td>
                          <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                            {log.sent_at
                              ? new Date(log.sent_at).toLocaleString('fi-FI', {
                                  day: 'numeric',
                                  month: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SmsLog;
