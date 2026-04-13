import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, PhoneCall, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface EmergencyAlert {
  id: string;
  elder_id: string;
  alert_type: string | null;
  alert_reason: string | null;
  alert_time: string | null;
  followup_call_at: string | null;
  followup_attempt: number;
  followup_done: boolean;
  resolved: boolean;
  elder_name: string;
}

const EmergencyBanner = () => {
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);

  const fetchAlerts = useCallback(async () => {
    const { data } = await supabase
      .from('emergency_alerts')
      .select('*, elders(full_name)')
      .eq('resolved', false)
      .order('alert_time', { ascending: false });

    if (data) {
      setAlerts(data.map((a: any) => ({
        ...a,
        elder_name: a.elders?.full_name || '—',
      })));
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);

    // Realtime subscription
    const channel = supabase
      .channel('emergency_alerts_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'emergency_alerts',
      }, () => {
        fetchAlerts();
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchAlerts]);

  const handleResolve = async (alertId: string) => {
    await supabase.from('emergency_alerts').update({
      resolved: true,
      resolved_at: new Date().toISOString(),
    }).eq('id', alertId);
    setAlerts(prev => prev.filter(a => a.id !== alertId));
    toast.success('Hätätilanne merkitty ratkaistuksi');
  };

  const handleCallNow = async (elderId: string) => {
    try {
      const { error } = await supabase.functions.invoke('outbound-call', {
        body: { elder_id: elderId, call_type: 'emergency_followup' },
      });
      if (error) throw error;
      toast.success('Seurantasoitto käynnistetty!');
    } catch {
      toast.error('Soitto epäonnistui');
    }
  };

  if (alerts.length === 0) return null;

  const alertTypeLabel = (type: string | null) => {
    switch (type) {
      case 'fall': return 'Kaatuminen';
      case 'pain': return 'Kova kipu';
      case 'confusion': return 'Sekavuus';
      default: return 'Hätätilanne';
    }
  };

  return (
    <div className="bg-card rounded-lg p-6 border-2 border-terracotta mb-6 animate-pulse-border">
      <h2 className="text-lg font-bold text-terracotta mb-4 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5" /> 🚨 AKTIIVINEN HÄTÄTILANNE
      </h2>
      <div className="space-y-3">
        {alerts.map(alert => (
          <div key={alert.id} className="flex items-center justify-between bg-muted rounded-lg p-4">
            <div>
              <p className="text-cream font-semibold flex items-center gap-2">
                🔴 {alert.elder_name} — {alertTypeLabel(alert.alert_type)}
              </p>
              <p className="text-sm text-muted-foreground">
                {alert.alert_reason}
              </p>
              <p className="text-xs text-muted-foreground">
                Ilmoitettu klo {alert.alert_time ? new Date(alert.alert_time).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' }) : '—'}
                {alert.followup_call_at && !alert.followup_done && (
                  <> · Seurantasoitto klo {new Date(alert.followup_call_at).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}</>
                )}
                {alert.followup_done && <> · Seurantasoitot suoritettu</>}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" onClick={() => handleCallNow(alert.elder_id)} className="bg-gold text-primary-foreground hover:bg-gold/90">
                <PhoneCall className="w-4 h-4 mr-1" /> Soita nyt
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleResolve(alert.id)} className="border-border text-cream">
                <CheckCircle className="w-4 h-4 mr-1" /> Merkitse ratkaistuksi
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmergencyBanner;
