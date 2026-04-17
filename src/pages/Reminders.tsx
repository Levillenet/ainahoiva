import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Plus, Bell, Check, CalendarDays, List as ListIcon, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { fi } from 'date-fns/locale';

type DeliveryMethod =
  | 'sms'
  | 'call'
  | 'both'
  | 'morning_call'
  | 'evening_call'
  | 'both_calls';

const METHOD_LABELS: Record<DeliveryMethod, string> = {
  sms: '📱 SMS-viesti',
  call: '📞 Erillinen puhelu',
  both: '📱+📞 SMS + erillinen puhelu',
  morning_call: '🌅 Mainitaan aamupuhelussa',
  evening_call: '🌙 Mainitaan iltapuhelussa',
  both_calls: '🌅+🌙 Aamu- ja iltapuhelussa',
};

const METHOD_SHORT: Record<string, string> = {
  sms: 'SMS',
  call: 'Puhelu',
  both: 'SMS+puhelu',
  morning_call: 'Aamupuhelu',
  evening_call: 'Iltapuhelu',
  both_calls: 'Aamu+ilta',
};

const isCallEmbedded = (m: string) =>
  m === 'morning_call' || m === 'evening_call' || m === 'both_calls';

const Reminders = () => {
  const { toast } = useToast();
  const [reminders, setReminders] = useState<any[]>([]);
  const [elders, setElders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [form, setForm] = useState<{
    elder_id: string;
    message: string;
    date: string;
    time: string;
    method: DeliveryMethod;
  }>({ elder_id: '', message: '', date: '', time: '09:00', method: 'morning_call' });

  const fetchData = async () => {
    const [{ data: eldersData }, { data: remindersData }] = await Promise.all([
      supabase.from('elders').select('id, full_name'),
      supabase.from('reminders').select('*, elders(full_name)').order('remind_at', { ascending: true }),
    ]);
    setElders(eldersData || []);
    setReminders(remindersData || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // For call-embedded methods, time is irrelevant — use noon as anchor for that date
    const time = isCallEmbedded(form.method) ? '12:00' : form.time;
    const remind_at = `${form.date}T${time}:00`;
    const { error } = await supabase.from('reminders').insert({
      elder_id: form.elder_id,
      message: form.message,
      remind_at,
      method: form.method,
    });
    if (error) {
      toast({ title: 'Virhe', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Muistutus lisätty!' });
      setDialogOpen(false);
      setForm({ elder_id: '', message: '', date: '', time: '09:00', method: 'morning_call' });
      fetchData();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('reminders').delete().eq('id', id);
    if (error) {
      toast({ title: 'Virhe', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Muistutus poistettu' });
      fetchData();
    }
  };

  // Group reminders by date string YYYY-MM-DD
  const remindersByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const r of reminders) {
      const key = new Date(r.remind_at).toISOString().split('T')[0];
      if (!map[key]) map[key] = [];
      map[key].push(r);
    }
    return map;
  }, [reminders]);

  const selectedKey = selectedDate.toISOString().split('T')[0];
  const selectedDayReminders = remindersByDate[selectedKey] || [];

  const datesWithReminders = useMemo(
    () => Object.keys(remindersByDate).map(k => new Date(k + 'T12:00:00')),
    [remindersByDate]
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-cream">Muistutukset</h1>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-md p-1">
            <button
              onClick={() => setView('calendar')}
              className={cn(
                'px-3 py-1.5 rounded text-sm flex items-center gap-1.5 transition-colors',
                view === 'calendar' ? 'bg-card text-cream' : 'text-muted-foreground hover:text-cream'
              )}
            >
              <CalendarDays className="w-4 h-4" /> Kalenteri
            </button>
            <button
              onClick={() => setView('list')}
              className={cn(
                'px-3 py-1.5 rounded text-sm flex items-center gap-1.5 transition-colors',
                view === 'list' ? 'bg-card text-cream' : 'text-muted-foreground hover:text-cream'
              )}
            >
              <ListIcon className="w-4 h-4" /> Lista
            </button>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gold text-primary-foreground hover:bg-gold/90">
                <Plus className="w-4 h-4 mr-2" /> Lisää muistutus
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-cream">Uusi muistutus</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="text-cream">Vanhus *</Label>
                  <select
                    value={form.elder_id}
                    onChange={e => setForm(f => ({ ...f, elder_id: e.target.value }))}
                    required
                    className="w-full bg-muted border border-border text-cream rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">Valitse...</option>
                    {elders.map(e => (
                      <option key={e.id} value={e.id}>{e.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-cream">Viesti *</Label>
                  <Textarea
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    required
                    placeholder="Esim. Lääkärin aika kello 14"
                    className="bg-muted border-border text-cream"
                  />
                </div>
                <div>
                  <Label className="text-cream">Toimitustapa *</Label>
                  <select
                    value={form.method}
                    onChange={e => setForm(f => ({ ...f, method: e.target.value as DeliveryMethod }))}
                    className="w-full bg-muted border border-border text-cream rounded-md px-3 py-2 text-sm"
                  >
                    <optgroup label="Erillinen yhteydenotto">
                      <option value="sms">{METHOD_LABELS.sms}</option>
                      <option value="call">{METHOD_LABELS.call}</option>
                      <option value="both">{METHOD_LABELS.both}</option>
                    </optgroup>
                    <optgroup label="Mainitaan päivittäisessä puhelussa">
                      <option value="morning_call">{METHOD_LABELS.morning_call}</option>
                      <option value="evening_call">{METHOD_LABELS.evening_call}</option>
                      <option value="both_calls">{METHOD_LABELS.both_calls}</option>
                    </optgroup>
                  </select>
                  {isCallEmbedded(form.method) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Aina mainitsee asian luonnollisesti kyseisen päivän puhelussa.
                    </p>
                  )}
                </div>
                <div className={cn('grid gap-4', isCallEmbedded(form.method) ? 'grid-cols-1' : 'grid-cols-2')}>
                  <div>
                    <Label className="text-cream">Päivämäärä *</Label>
                    <Input
                      type="date"
                      value={form.date}
                      onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                      required
                      className="bg-muted border-border text-cream"
                    />
                  </div>
                  {!isCallEmbedded(form.method) && (
                    <div>
                      <Label className="text-cream">Aika *</Label>
                      <Input
                        type="time"
                        value={form.time}
                        onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                        required
                        className="bg-muted border-border text-cream"
                      />
                    </div>
                  )}
                </div>
                <div className="flex gap-3 justify-end">
                  <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} className="text-cream">
                    Peruuta
                  </Button>
                  <Button type="submit" className="bg-gold text-primary-foreground hover:bg-gold/90">
                    Tallenna
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse bg-card rounded-lg h-48" />
      ) : view === 'calendar' ? (
        <div className="grid md:grid-cols-[auto_1fr] gap-6">
          <div className="bg-card rounded-lg border border-border p-2">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => d && setSelectedDate(d)}
              locale={fi}
              modifiers={{ hasReminder: datesWithReminders }}
              modifiersClassNames={{
                hasReminder: 'bg-gold/20 text-cream font-bold rounded-md',
              }}
              className={cn('p-3 pointer-events-auto')}
            />
          </div>
          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="text-lg font-bold text-cream mb-4">
              {selectedDate.toLocaleDateString('fi-FI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </h2>
            {selectedDayReminders.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="w-10 h-10 text-sage mx-auto mb-3" />
                <p className="text-muted-foreground">Ei muistutuksia tälle päivälle.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {selectedDayReminders.map(r => (
                  <li
                    key={r.id}
                    className="flex items-start justify-between gap-3 p-3 bg-muted rounded-lg border border-border"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-cream font-semibold">
                          {(r.elders as any)?.full_name || '—'}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gold/20 text-gold">
                          {METHOD_SHORT[r.method] || r.method}
                        </span>
                        {r.is_sent && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-sage/20 text-sage flex items-center gap-1">
                            <Check className="w-3 h-3" /> Hoidettu
                          </span>
                        )}
                      </div>
                      <p className="text-cream text-sm break-words">{r.message}</p>
                      {!isCallEmbedded(r.method) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Klo {new Date(r.remind_at).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      title="Poista"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : reminders.length === 0 ? (
        <div className="text-center bg-card rounded-lg p-12 border border-border">
          <Bell className="w-12 h-12 text-sage mx-auto mb-4" />
          <p className="text-muted-foreground">Ei muistutuksia vielä.</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-card rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-3 text-muted-foreground">Vanhus</th>
                <th className="p-3 text-muted-foreground">Viesti</th>
                <th className="p-3 text-muted-foreground">Aika</th>
                <th className="p-3 text-muted-foreground">Tapa</th>
                <th className="p-3 text-muted-foreground">Tila</th>
                <th className="p-3 text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {reminders.map(r => (
                <tr key={r.id} className="border-b border-border">
                  <td className="p-3 text-cream">{(r.elders as any)?.full_name || '—'}</td>
                  <td className="p-3 text-cream max-w-xs truncate">{r.message}</td>
                  <td className="p-3 text-cream">
                    {isCallEmbedded(r.method)
                      ? new Date(r.remind_at).toLocaleDateString('fi-FI')
                      : new Date(r.remind_at).toLocaleString('fi-FI')}
                  </td>
                  <td className="p-3 text-cream text-xs">{METHOD_SHORT[r.method] || r.method}</td>
                  <td className="p-3">
                    {r.is_sent ? <Check className="w-4 h-4 text-sage" /> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      title="Poista"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Reminders;
