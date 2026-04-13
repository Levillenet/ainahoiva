import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Phone, Smile, Pill, Clock, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const moodEmoji = (score: number | null) => {
  if (!score) return '—';
  const emojis = ['😢', '😟', '😐', '🙂', '😊'];
  return `${emojis[score - 1]} ${score}/5`;
};

const EldersList = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [elders, setElders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: '', phone_number: '', date_of_birth: '', address: '',
    call_time_morning: '08:00', call_time_evening: '19:00', notes: '',
  });

  const fetchElders = async () => {
    const { data } = await supabase.from('elders').select('*').order('created_at', { ascending: false });
    if (data) {
      const withExtras = await Promise.all(data.map(async (elder) => {
        const [reportsRes, memoriesRes] = await Promise.all([
          supabase.from('call_reports').select('*').eq('elder_id', elder.id).order('called_at', { ascending: false }).limit(1),
          supabase.from('elder_memory').select('id').eq('elder_id', elder.id),
        ]);
        return { ...elder, latestReport: reportsRes.data?.[0] || null, memoryCount: memoriesRes.data?.length || 0 };
      }));
      setElders(withExtras);
    }
    setLoading(false);
  };

  useEffect(() => { fetchElders(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from('elders').insert({
      ...form,
      created_by: user.id,
      date_of_birth: form.date_of_birth || null,
    });
    if (error) {
      toast({ title: 'Virhe', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Vanhus lisätty!' });
      setDialogOpen(false);
      setForm({ full_name: '', phone_number: '', date_of_birth: '', address: '', call_time_morning: '08:00', call_time_evening: '19:00', notes: '' });
      fetchElders();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-cream">Vanhukset</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gold text-primary-foreground hover:bg-gold/90">
              <Plus className="w-4 h-4 mr-2" /> Lisää vanhus
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-cream">Lisää uusi vanhus</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-cream">Koko nimi *</Label>
                <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required className="bg-muted border-border text-cream" />
              </div>
              <div>
                <Label className="text-cream">Puhelinnumero *</Label>
                <Input value={form.phone_number} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))} required placeholder="+358..." className="bg-muted border-border text-cream" />
              </div>
              <div>
                <Label className="text-cream">Syntymäaika</Label>
                <Input type="date" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} className="bg-muted border-border text-cream" />
              </div>
              <div>
                <Label className="text-cream">Osoite</Label>
                <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="bg-muted border-border text-cream" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-cream">Aamusoitto</Label>
                  <Input type="time" value={form.call_time_morning} onChange={e => setForm(f => ({ ...f, call_time_morning: e.target.value }))} className="bg-muted border-border text-cream" />
                </div>
                <div>
                  <Label className="text-cream">Iltasoitto</Label>
                  <Input type="time" value={form.call_time_evening} onChange={e => setForm(f => ({ ...f, call_time_evening: e.target.value }))} className="bg-muted border-border text-cream" />
                </div>
              </div>
              <div>
                <Label className="text-cream">Muistiinpanot</Label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="bg-muted border-border text-cream" />
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
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3].map(i => <div key={i} className="bg-card rounded-lg p-6 animate-pulse h-36" />)}
        </div>
      ) : elders.length === 0 ? (
        <div className="text-center bg-card rounded-lg p-12 border border-border">
          <p className="text-muted-custom text-lg">Ei vanhuksia vielä. Lisää ensimmäinen!</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {elders.map((elder) => (
            <div key={elder.id} className="bg-card rounded-lg p-5 border border-border hover:border-gold/30 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-bold text-cream">{elder.full_name}</h3>
                  <p className="text-muted-custom text-sm flex items-center gap-1"><Phone className="w-3 h-3" /> {elder.phone_number}</p>
                </div>
                {elder.latestReport?.alert_sent && (
                  <span className="bg-terracotta/20 text-terracotta text-xs px-2 py-1 rounded flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Hälytys
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-custom mb-4">
                <span className="flex items-center gap-1"><Smile className="w-4 h-4" /> {moodEmoji(elder.latestReport?.mood_score)}</span>
                <span className="flex items-center gap-1"><Pill className="w-4 h-4" /> {elder.latestReport?.medications_taken ? '✅' : '❌'}</span>
                {elder.latestReport?.called_at && (
                  <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {new Date(elder.latestReport.called_at).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}</span>
                )}
                {elder.memoryCount > 0 && (
                  <span className="flex items-center gap-1 text-gold">🧠 {elder.memoryCount} muistoa</span>
                )}
              </div>
              <div className="flex gap-2">
                <Link to={`/dashboard/vanhukset/${elder.id}`}>
                  <Button size="sm" variant="outline" className="border-sage text-sage hover:bg-sage/10">Avaa tiedot</Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EldersList;
