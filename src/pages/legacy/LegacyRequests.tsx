import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Send } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Req {
  id: string;
  topic: string;
  note: string | null;
  status: string | null;
  created_at: string;
}

const STATUS = {
  pending: { label: 'Odottaa', cls: 'text-cream/60 bg-muted/40 border-border' },
  in_progress: { label: 'Käsittelyssä', cls: 'text-sage bg-sage/10 border-sage/30' },
  addressed: { label: 'Käsitelty', cls: 'text-gold bg-gold/10 border-gold/30' },
} as const;

const placeholders = [
  'Kerro isoäidistäni Mariasta',
  'Mitä äiti muistaa sotavuosista (vanhempiensa kautta)',
  "Isän viimeiset vuodet",
];

const LegacyRequests = () => {
  const { elderId } = useParams();
  const [topic, setTopic] = useState('');
  const [note, setNote] = useState('');
  const [items, setItems] = useState<Req[]>([]);
  const [loading, setLoading] = useState(false);
  const placeholder = placeholders[Math.floor(Math.random() * placeholders.length)];

  const load = async () => {
    if (!elderId) return;
    const { data } = await supabase
      .from('legacy_topic_requests')
      .select('id, topic, note, status, created_at')
      .eq('elder_id', elderId)
      .order('created_at', { ascending: false });
    setItems(data ?? []);
  };

  useEffect(() => { load(); }, [elderId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!elderId || !topic.trim()) return;
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('legacy_topic_requests').insert({
      elder_id: elderId,
      topic: topic.trim().slice(0, 200),
      note: note.trim().slice(0, 1000) || null,
      requested_by: user?.id ?? '00000000-0000-0000-0000-000000000000',
      status: 'pending',
    });
    setLoading(false);
    if (error) {
      toast({ title: 'Tallennus epäonnistui', description: error.message, variant: 'destructive' });
      return;
    }
    setTopic(''); setNote('');
    toast({ title: 'Pyyntö lähetetty', description: 'Aina ottaa aiheen huomioon seuraavissa puheluissa.' });
    load();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link to={`/dashboard/muistoissa/${elderId}`} className="text-cream/60 hover:text-cream text-sm flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Takaisin
      </Link>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-cream">Pyydä Ainaa kysymään aiheesta</CardTitle>
          <p className="text-xs text-cream/60 mt-1">Aina sisällyttää ehdotuksenne luonnollisesti seuraaviin puheluihin.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label className="text-cream/80">Aihe</Label>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={placeholder} maxLength={200} />
            </div>
            <div>
              <Label className="text-cream/80">Lisätieto (valinnainen)</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} placeholder="Konteksti tai miksi tämä on tärkeää" />
            </div>
            <Button type="submit" disabled={loading || !topic.trim()} className="bg-gold text-navy hover:bg-gold/90">
              <Send className="w-4 h-4 mr-2" /> Lähetä pyyntö
            </Button>
          </form>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-sm text-cream/70 mb-3">Aiemmat pyynnöt</h2>
        {items.length === 0 && <p className="text-cream/50 text-sm">Ei vielä pyyntöjä.</p>}
        <div className="space-y-2">
          {items.map((r) => {
            const s = STATUS[(r.status ?? 'pending') as keyof typeof STATUS] ?? STATUS.pending;
            return (
              <Card key={r.id} className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-cream font-medium">{r.topic}</p>
                      {r.note && <p className="text-cream/60 text-xs mt-1">{r.note}</p>}
                      <p className="text-cream/40 text-[10px] mt-2">{new Date(r.created_at).toLocaleDateString('fi-FI')}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded border ${s.cls}`}>{s.label}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LegacyRequests;
