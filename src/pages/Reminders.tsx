import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Bell, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Reminders = () => {
  const { toast } = useToast();
  const [reminders, setReminders] = useState<any[]>([]);
  const [elders, setElders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ elder_id: '', message: '', date: '', time: '09:00', method: 'sms' });

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
    const remind_at = `${form.date}T${form.time}:00`;
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
      setForm({ elder_id: '', message: '', date: '', time: '09:00', method: 'sms' });
      fetchData();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-cream">Muistutukset</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gold text-primary-foreground hover:bg-gold/90">
              <Plus className="w-4 h-4 mr-2" /> Lisää muistutus
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-cream">Uusi muistutus</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-cream">Vanhus *</Label>
                <select value={form.elder_id} onChange={e => setForm(f => ({ ...f, elder_id: e.target.value }))} required className="w-full bg-muted border border-border text-cream rounded-md px-3 py-2 text-sm">
                  <option value="">Valitse...</option>
                  {elders.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-cream">Viesti *</Label>
                <Textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} required className="bg-muted border-border text-cream" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-cream">Päivämäärä *</Label>
                  <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required className="bg-muted border-border text-cream" />
                </div>
                <div>
                  <Label className="text-cream">Aika *</Label>
                  <Input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} required className="bg-muted border-border text-cream" />
                </div>
              </div>
              <div>
                <Label className="text-cream">Tapa</Label>
                <select value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))} className="w-full bg-muted border border-border text-cream rounded-md px-3 py-2 text-sm">
                  <option value="sms">SMS</option>
                  <option value="call">Puhelu</option>
                  <option value="both">Molemmat</option>
                </select>
              </div>
              <div className="flex gap-3 justify-end">
                <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} className="text-cream">Peruuta</Button>
                <Button type="submit" className="bg-gold text-primary-foreground hover:bg-gold/90">Tallenna</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="animate-pulse bg-card rounded-lg h-48" />
      ) : reminders.length === 0 ? (
        <div className="text-center bg-card rounded-lg p-12 border border-border">
          <Bell className="w-12 h-12 text-sage mx-auto mb-4" />
          <p className="text-muted-custom">Ei muistutuksia vielä.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-3 text-muted-custom">Vanhus</th>
                <th className="p-3 text-muted-custom">Viesti</th>
                <th className="p-3 text-muted-custom">Aika</th>
                <th className="p-3 text-muted-custom">Tapa</th>
                <th className="p-3 text-muted-custom">Lähetetty</th>
              </tr>
            </thead>
            <tbody>
              {reminders.map(r => (
                <tr key={r.id} className="border-b border-border">
                  <td className="p-3 text-cream">{(r.elders as any)?.full_name || '—'}</td>
                  <td className="p-3 text-cream max-w-xs truncate">{r.message}</td>
                  <td className="p-3 text-cream">{new Date(r.remind_at).toLocaleString('fi-FI')}</td>
                  <td className="p-3 text-cream capitalize">{r.method}</td>
                  <td className="p-3">{r.is_sent ? <Check className="w-4 h-4 text-sage" /> : '—'}</td>
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
