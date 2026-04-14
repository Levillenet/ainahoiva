import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Phone, Loader2, CheckCircle, Clock, XCircle, Ban, Trash2, RotateCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const CallSchedule = () => {
  const { toast } = useToast();
  const [elders, setElders] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [retries, setRetries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [callingId, setCallingId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const dayNames = ['Sunnuntai', 'Maanantai', 'Tiistai', 'Keskiviikko', 'Torstai', 'Perjantai', 'Lauantai'];

  const fetchData = useCallback(async () => {
    const [eldersRes, reportsRes, remindersRes, retriesRes] = await Promise.all([
      supabase.from('elders').select('*').eq('is_active', true).order('full_name'),
      supabase.from('call_reports').select('*').gte('called_at', todayStr),
      supabase.from('reminders').select('*, elders(full_name)').gte('remind_at', todayStr).lte('remind_at', todayStr + 'T23:59:59'),
      supabase.from('missed_call_retries').select('*').gte('created_at', todayStr).eq('is_resolved', false),
    ]);
    setElders(eldersRes.data || []);
    setReports(reportsRes.data || []);
    setReminders(remindersRes.data || []);
    setRetries(retriesRes.data || []);
    setLoading(false);
  }, [todayStr]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleCallNow = async (elderId: string) => {
    setCallingId(elderId);
    try {
      const { error } = await supabase.functions.invoke('outbound-call', { body: { elder_id: elderId } });
      if (error) throw error;
      toast({ title: 'Soitto käynnistetty!' });
      setTimeout(fetchData, 3000);
    } catch (err: any) {
      toast({ title: 'Virhe', description: err.message, variant: 'destructive' });
    } finally {
      setCallingId(null);
    }
  };

  const handleSkipCall = async (elderId: string, callType: string) => {
    setActionId(`skip-${elderId}-${callType}`);
    try {
      const { error } = await supabase.from('call_reports').insert({
        elder_id: elderId,
        call_type: `${callType}_skipped`,
        duration_seconds: 0,
        ai_summary: 'Soitto ohitettu manuaalisesti',
        mood_score: null,
      });
      if (error) throw error;
      toast({ title: 'Soitto ohitettu', description: 'Merkitty ohitetuksi tänään.' });
      await fetchData();
    } catch (err: any) {
      toast({ title: 'Virhe', description: err.message, variant: 'destructive' });
    } finally {
      setActionId(null);
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    setActionId(`rem-${reminderId}`);
    try {
      const { error } = await supabase.from('reminders').delete().eq('id', reminderId);
      if (error) throw error;
      toast({ title: 'Muistutus poistettu' });
      await fetchData();
    } catch (err: any) {
      toast({ title: 'Virhe', description: err.message, variant: 'destructive' });
    } finally {
      setActionId(null);
    }
  };

  const getCallStatus = (elderId: string, timeType: 'morning' | 'evening') => {
    const elderReports = reports.filter(r => r.elder_id === elderId);
    const skippedReport = elderReports.find(r => r.call_type === `${timeType}_skipped`);
    if (skippedReport) return { status: 'skipped', report: skippedReport };

    // Determine which reports belong to morning vs evening by call time
    const morningCutoff = '12:00';
    const relevantReports = elderReports.filter(r => {
      if (!r.called_at) return false;
      const callHour = new Date(r.called_at).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Helsinki' });
      if (timeType === 'morning') return callHour < morningCutoff;
      return callHour >= morningCutoff;
    });

    if (relevantReports.length === 0) return { status: 'pending', report: null };

    // Check if any call was successfully answered
    const answeredReport = relevantReports.find(r =>
      (r.duration_seconds != null && r.duration_seconds >= 10) ||
      (r.transcript && r.transcript.length > 50) ||
      (r.ai_summary && !r.ai_summary.includes('Ei vastattu') && !r.ai_summary.includes('odottaa'))
    );

    if (answeredReport) return { status: 'called', report: answeredReport };

    // Not answered — return the latest report
    return { status: 'missed', report: relevantReports[0] };
  };

  const getRetryInfo = (elderId: string) => {
    return retries.find(r => r.elder_id === elderId);
  };

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'called': return <CheckCircle className="w-5 h-5 text-sage" />;
      case 'missed': return <XCircle className="w-5 h-5 text-terracotta" />;
      case 'skipped': return <Ban className="w-5 h-5 text-muted-foreground" />;
      default: return <Clock className="w-5 h-5 text-gold" />;
    }
  };

  const statusText = (status: string, report: any, elderId?: string) => {
    switch (status) {
      case 'called':
        const time = report?.called_at ? new Date(report.called_at).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' }) : '';
        const dur = report?.duration_seconds ? `${Math.floor(report.duration_seconds / 60)} min` : '';
        return `soitettu ${time} ${dur}`.trim();
      case 'missed': {
        const retry = elderId ? getRetryInfo(elderId) : null;
        if (retry) {
          const nextTime = retry.next_retry_at
            ? new Date(retry.next_retry_at).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })
            : '—';
          return `ei vastattu (yritys ${retry.attempt_number}/${retry.max_attempts}) — seuraava klo ${nextTime}`;
        }
        return 'ei vastattu';
      }
      case 'skipped': return 'ohitettu';
      default: return 'odottaa...';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-cream">Aikataulu</h1>
        {[1, 2, 3].map(i => <div key={i} className="bg-card rounded-lg p-6 animate-pulse h-32" />)}
      </div>
    );
  }

  const morningElders = elders.filter(e => e.call_time_morning);
  const eveningElders = elders.filter(e => e.call_time_evening);
  const morningTime = morningElders[0]?.call_time_morning?.slice(0, 5) || '08:00';
  const eveningTime = eveningElders[0]?.call_time_evening?.slice(0, 5) || '19:00';

  const renderElderRow = (elder: any, timeType: 'morning' | 'evening') => {
    const { status, report } = getCallStatus(elder.id, timeType);
    const retry = status === 'missed' ? getRetryInfo(elder.id) : null;
    return (
      <div key={elder.id} className={`flex items-center justify-between p-3 rounded-lg ${status === 'missed' ? 'bg-terracotta/10 border border-terracotta/30' : status === 'skipped' ? 'bg-muted/50 opacity-60' : 'bg-muted'}`}>
        <div className="flex items-center gap-3">
          <StatusIcon status={status} />
          <span className="text-cream font-medium">{elder.full_name}</span>
          <span className="text-muted-foreground text-sm">{statusText(status, report, elder.id)}</span>
          {retry && !retry.is_resolved && (
            <span className="flex items-center gap-1 text-xs text-gold">
              <RotateCw className="w-3 h-3" />
              jonossa
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {status === 'pending' && (
            <>
              <Button
                size="sm"
                onClick={() => handleCallNow(elder.id)}
                disabled={callingId === elder.id}
                className="bg-sage text-primary-foreground hover:bg-sage/90"
              >
                {callingId === elder.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4 mr-1" />}
                Soita nyt
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleSkipCall(elder.id, timeType)}
                disabled={actionId === `skip-${elder.id}-${timeType}`}
                className="text-muted-foreground hover:text-foreground"
                title="Ohita soitto"
              >
                {actionId === `skip-${elder.id}-${timeType}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
              </Button>
            </>
          )}
          {status === 'missed' && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCallNow(elder.id)}
                disabled={callingId === elder.id}
                className="border-terracotta text-terracotta hover:bg-terracotta/10"
              >
                {callingId === elder.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4 mr-1" />}
                Soita uudelleen
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleSkipCall(elder.id, timeType)}
                disabled={actionId === `skip-${elder.id}-${timeType}`}
                className="text-muted-foreground hover:text-foreground"
                title="Ohita soitto"
              >
                {actionId === `skip-${elder.id}-${timeType}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
              </Button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-cream mb-1">Aikataulu</h1>
        <p className="text-muted-foreground">
          Tänään — {dayNames[today.getDay()]} {today.toLocaleDateString('fi-FI')}
        </p>
      </div>

      {/* Morning calls */}
      <div className="bg-card rounded-lg p-6 border border-border">
        <h2 className="text-lg font-bold text-cream mb-4">☀️ Aamusoitot klo {morningTime}</h2>
        {morningElders.length === 0 ? (
          <p className="text-muted-foreground">Ei aamusoittoja.</p>
        ) : (
          <div className="space-y-2">
            {morningElders.map(elder => renderElderRow(elder, 'morning'))}
          </div>
        )}
      </div>

      {/* Evening calls */}
      <div className="bg-card rounded-lg p-6 border border-border">
        <h2 className="text-lg font-bold text-cream mb-4">🌙 Iltasoitot klo {eveningTime}</h2>
        {eveningElders.length === 0 ? (
          <p className="text-muted-foreground">Ei iltasoittoja.</p>
        ) : (
          <div className="space-y-2">
            {eveningElders.map(elder => renderElderRow(elder, 'evening'))}
          </div>
        )}
      </div>

      {/* Today's reminders */}
      <div className="bg-card rounded-lg p-6 border border-border">
        <h2 className="text-lg font-bold text-cream mb-4">⏰ Muistutukset tänään</h2>
        {reminders.length === 0 ? (
          <p className="text-muted-foreground">Ei muistutuksia tänään.</p>
        ) : (
          <div className="space-y-2">
            {reminders.map(r => (
              <div key={r.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  {r.is_sent ? <CheckCircle className="w-4 h-4 text-sage" /> : <Clock className="w-4 h-4 text-gold" />}
                  <span className="text-cream text-sm">
                    {new Date(r.remind_at).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-cream font-medium">{(r as any).elders?.full_name}</span>
                  <span className="text-muted-foreground text-sm">— {r.message}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground uppercase">
                    {r.is_sent ? '✅ Lähetetty' : `⏳ ${r.method}`}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteReminder(r.id)}
                    disabled={actionId === `rem-${r.id}`}
                    className="text-muted-foreground hover:text-terracotta"
                    title="Poista muistutus"
                  >
                    {actionId === `rem-${r.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CallSchedule;
