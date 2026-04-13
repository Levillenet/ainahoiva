import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Pill, Check, X, Clock, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface MedicationLogEntry {
  id: string;
  medication_id: string;
  medication_name: string;
  scheduled_time: string;
  taken: boolean;
  not_taken: boolean;
  taken_at: string | null;
  log_date: string;
  confirmed_by: string;
}

interface Medication {
  id: string;
  name: string;
  dosage: string | null;
  morning: boolean;
  noon: boolean;
  evening: boolean;
}

interface Props {
  elderId: string;
  medications: Medication[];
}

const timeLabels: Record<string, string> = {
  morning: 'Aamulääkkeet',
  noon: 'Päivälääkkeet',
  evening: 'Iltalääkkeet',
};

const MedicationLog = ({ elderId, medications }: Props) => {
  const [logs, setLogs] = useState<MedicationLogEntry[]>([]);
  const [weekLogs, setWeekLogs] = useState<MedicationLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];

  const fetchLogs = async () => {
    const { data } = await supabase
      .from('medication_logs')
      .select('*')
      .eq('elder_id', elderId)
      .eq('log_date', today);
    setLogs((data as any[]) || []);

    // Last 7 days
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { data: week } = await supabase
      .from('medication_logs')
      .select('*')
      .eq('elder_id', elderId)
      .gte('log_date', weekAgo.toISOString().split('T')[0]);
    setWeekLogs((week as any[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [elderId]);

  const getMedsForTime = (time: string) =>
    medications.filter((m: any) => m[time]);

  const getLogForMed = (medId: string, time: string) =>
    logs.find(l => l.medication_id === medId && l.scheduled_time === time);

  const handleToggle = async (med: Medication, time: string, taken: boolean) => {
    const medName = `${med.name} ${med.dosage || ''}`.trim();
    const { error } = await supabase
      .from('medication_logs')
      .upsert({
        elder_id: elderId,
        medication_id: med.id,
        medication_name: medName,
        scheduled_time: time,
        taken,
        not_taken: !taken,
        log_date: today,
        taken_at: taken ? new Date().toISOString() : null,
        confirmed_by: 'manual',
      } as any, { onConflict: 'elder_id,medication_id,scheduled_time,log_date' } as any);

    if (error) {
      toast.error('Virhe tallennuksessa');
      console.error(error);
    } else {
      toast.success(taken ? 'Merkitty otetuksi' : 'Merkitty ottamatta');
      fetchLogs();
    }
  };

  const StatusIcon = ({ log }: { log?: MedicationLogEntry }) => {
    if (!log) return <Clock className="w-4 h-4 text-muted-foreground" />;
    if (log.taken) return <Check className="w-4 h-4 text-green-400" />;
    if (log.not_taken) return <X className="w-4 h-4 text-red-400" />;
    return <HelpCircle className="w-4 h-4 text-yellow-400" />;
  };

  const statusText = (log?: MedicationLogEntry) => {
    if (!log) return 'odottaa...';
    if (log.taken) return `otettu ${log.taken_at ? new Date(log.taken_at).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' }) : ''}`;
    if (log.not_taken) return 'ei otettu';
    return 'ei tietoa';
  };

  // Week calendar data
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        date: d.toISOString().split('T')[0],
        label: d.toLocaleDateString('fi-FI', { weekday: 'short' }).slice(0, 2),
      });
    }
    return days;
  }, []);

  const getWeekStatus = (time: string, date: string) => {
    const timeMeds = getMedsForTime(time);
    if (timeMeds.length === 0) return 'none';
    const dayLogs = weekLogs.filter(l => l.log_date === date && l.scheduled_time === time);
    if (dayLogs.length === 0) return date === today ? 'pending' : 'unknown';
    const allTaken = dayLogs.every(l => l.taken);
    const anyNotTaken = dayLogs.some(l => l.not_taken);
    if (allTaken && dayLogs.length >= timeMeds.length) return 'taken';
    if (anyNotTaken) return 'missed';
    return 'partial';
  };

  const weekStatusIcon = (status: string) => {
    switch (status) {
      case 'taken': return '✅';
      case 'missed': return '❌';
      case 'pending': return '⏳';
      case 'partial': return '🟡';
      case 'unknown': return '❓';
      default: return '—';
    }
  };

  if (loading) return null;
  if (medications.length === 0) return null;

  return (
    <div className="bg-card rounded-lg p-6 border border-border">
      <h2 className="text-lg font-bold text-cream mb-4">
        <Pill className="w-5 h-5 inline mr-2 text-sage" />
        Lääkepäiväkirja — tänään {new Date().toLocaleDateString('fi-FI')}
      </h2>

      {/* Today's status by time slot */}
      <div className="space-y-4 mb-6">
        {(['morning', 'noon', 'evening'] as const).map(time => {
          const timeMeds = getMedsForTime(time);
          if (timeMeds.length === 0) return null;
          return (
            <div key={time}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">{timeLabels[time]}</h3>
              <div className="space-y-2">
                {timeMeds.map(med => {
                  const log = getLogForMed(med.id, time);
                  return (
                    <div key={`${med.id}-${time}`} className="bg-muted rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <StatusIcon log={log} />
                        <div>
                          <span className="text-cream text-sm font-medium">{med.name} {med.dosage && med.dosage}</span>
                          <span className="text-muted-foreground text-xs ml-2">{statusText(log)}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant={log?.taken ? 'default' : 'outline'}
                          className={`h-7 px-2 text-xs ${log?.taken ? 'bg-green-600 hover:bg-green-700 text-cream' : 'border-border text-cream'}`}
                          onClick={() => handleToggle(med, time, true)}
                        >
                          ✅
                        </Button>
                        <Button
                          size="sm"
                          variant={log?.not_taken ? 'default' : 'outline'}
                          className={`h-7 px-2 text-xs ${log?.not_taken ? 'bg-red-600 hover:bg-red-700 text-cream' : 'border-border text-cream'}`}
                          onClick={() => handleToggle(med, time, false)}
                        >
                          ❌
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 7-day calendar */}
      <h3 className="text-sm font-semibold text-muted-foreground mb-2">Viimeiset 7 päivää</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-center text-sm">
          <thead>
            <tr>
              <th className="text-left text-muted-foreground text-xs py-1 pr-2"></th>
              {weekDays.map(d => (
                <th key={d.date} className={`text-muted-foreground text-xs py-1 px-1 ${d.date === today ? 'text-gold font-bold' : ''}`}>
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(['morning', 'noon', 'evening'] as const).map(time => {
              if (getMedsForTime(time).length === 0) return null;
              return (
                <tr key={time}>
                  <td className="text-left text-muted-foreground text-xs py-1 pr-2">
                    {time === 'morning' ? 'Aamu' : time === 'noon' ? 'Päivä' : 'Ilta'}
                  </td>
                  {weekDays.map(d => (
                    <td key={d.date} className="py-1 px-1">
                      {weekStatusIcon(getWeekStatus(time, d.date))}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MedicationLog;
