import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Phone, Pill, Users, Smile, Utensils, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';

const moodEmoji = (s: number) => ['😢', '😟', '😐', '🙂', '😊'][s - 1] || '—';

const ElderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [elder, setElder] = useState<any>(null);
  const [meds, setMeds] = useState<any[]>([]);
  const [family, setFamily] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [moodData, setMoodData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState(false);

  const fetchReports = async () => {
    if (!id) return;
    const { data } = await supabase.from('call_reports').select('*').eq('elder_id', id).order('called_at', { ascending: false }).limit(20);
    setReports(data || []);
  };

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      const [elderRes, medsRes, familyRes] = await Promise.all([
        supabase.from('elders').select('*').eq('id', id).single(),
        supabase.from('medications').select('*').eq('elder_id', id),
        supabase.from('family_members').select('*').eq('elder_id', id),
      ]);
      setElder(elderRes.data);
      setMeds(medsRes.data || []);
      setFamily(familyRes.data || []);

      await fetchReports();

      // mood chart data (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: moodReports } = await supabase.from('call_reports')
        .select('called_at, mood_score').eq('elder_id', id)
        .gte('called_at', thirtyDaysAgo.toISOString())
        .not('mood_score', 'is', null)
        .order('called_at', { ascending: true });
      setMoodData((moodReports || []).map(r => ({
        date: new Date(r.called_at!).toLocaleDateString('fi-FI', { day: 'numeric', month: 'numeric' }),
        mood: r.mood_score,
      })));
      setLoading(false);
    };
    fetchData();
  }, [id]);

  // Realtime subscription for call reports
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`call_reports_${id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'call_reports',
        filter: `elder_id=eq.${id}`,
      }, () => {
        fetchReports();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const toggleActive = async () => {
    if (!elder) return;
    await supabase.from('elders').update({ is_active: !elder.is_active }).eq('id', elder.id);
    setElder({ ...elder, is_active: !elder.is_active });
  };

  const handleCallNow = async () => {
    if (!elder) return;
    setCalling(true);
    try {
      const { data, error } = await supabase.functions.invoke('outbound-call', {
        body: { elder_id: elder.id },
      });
      if (error) throw error;
      toast({ title: 'Soitto käynnistetty!', description: `Soitetaan: ${elder.full_name}` });
    } catch (err: any) {
      toast({ title: 'Virhe', description: err.message || 'Soittoa ei voitu käynnistää', variant: 'destructive' });
    } finally {
      setCalling(false);
    }
  };

  if (loading) return <div className="animate-pulse text-cream p-8">Ladataan...</div>;
  if (!elder) return <div className="text-cream p-8">Vanhusta ei löytynyt.</div>;

  const latestReport = reports[0];
  const age = elder.date_of_birth ? Math.floor((Date.now() - new Date(elder.date_of_birth).getTime()) / 31557600000) : null;

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate('/dashboard/vanhukset')} className="text-cream">
        <ArrowLeft className="w-4 h-4 mr-2" /> Takaisin
      </Button>

      {/* Header */}
      <div className="bg-card rounded-lg p-6 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-cream">{elder.full_name}</h1>
          <p className="text-muted-foreground flex items-center gap-2"><Phone className="w-4 h-4" /> {elder.phone_number} {age && `· ${age} vuotta`}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleCallNow} disabled={calling} className="bg-sage text-primary-foreground hover:bg-sage/90">
            {calling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Phone className="w-4 h-4 mr-2" />}
            {calling ? 'Soitetaan...' : 'Soita nyt'}
          </Button>
          <span className="text-sm text-muted-foreground">{elder.is_active ? 'Aktiivinen' : 'Ei aktiivinen'}</span>
          <Switch checked={elder.is_active} onCheckedChange={toggleActive} />
        </div>
      </div>

      {/* Mood chart */}
      <div className="bg-card rounded-lg p-6 border border-border">
        <h2 className="text-lg font-bold text-cream mb-4">Mielialatrendit (30 pv)</h2>
        {moodData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={moodData}>
              <XAxis dataKey="date" tick={{ fill: 'hsl(25, 10%, 44%)', fontSize: 12 }} />
              <YAxis domain={[1, 5]} tick={{ fill: 'hsl(25, 10%, 44%)', fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(210, 24%, 24%)', border: 'none', color: '#F5F0E8' }} />
              <Line type="monotone" dataKey="mood" stroke="hsl(43, 50%, 54%)" strokeWidth={2} dot={{ fill: 'hsl(43, 50%, 54%)' }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-muted-foreground text-center py-8">Ei mielialadataa vielä.</p>
        )}
      </div>

      {/* Today status */}
      {latestReport && (
        <div className="bg-card rounded-lg p-6 border border-border">
          <h2 className="text-lg font-bold text-cream mb-4">Viimeisin raportti</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <Smile className="w-6 h-6 text-sage mx-auto mb-1" />
              <div className="text-gold text-xl font-bold">{latestReport.mood_score ? `${moodEmoji(latestReport.mood_score)} ${latestReport.mood_score}/5` : '—'}</div>
              <p className="text-xs text-muted-foreground">Mieliala</p>
            </div>
            <div className="text-center">
              <Pill className="w-6 h-6 text-sage mx-auto mb-1" />
              <div className="text-xl font-bold text-cream">{latestReport.medications_taken ? '✅' : '❌'}</div>
              <p className="text-xs text-muted-foreground">Lääkkeet</p>
            </div>
            <div className="text-center">
              <Utensils className="w-6 h-6 text-sage mx-auto mb-1" />
              <div className="text-xl font-bold text-cream">{latestReport.ate_today ? '✅' : '❌'}</div>
              <p className="text-xs text-muted-foreground">Syönyt</p>
            </div>
            <div className="text-center">
              <Phone className="w-6 h-6 text-sage mx-auto mb-1" />
              <div className="text-gold text-sm font-bold">{latestReport.called_at ? new Date(latestReport.called_at).toLocaleString('fi-FI') : '—'}</div>
              <p className="text-xs text-muted-foreground">Soitettu</p>
            </div>
          </div>
        </div>
      )}

      {/* Medications */}
      <div className="bg-card rounded-lg p-6 border border-border">
        <h2 className="text-lg font-bold text-cream mb-4"><Pill className="w-5 h-5 inline mr-2 text-sage" />Lääkkeet</h2>
        {meds.length === 0 ? (
          <p className="text-muted-foreground">Ei lääkkeitä lisätty.</p>
        ) : (
          <div className="space-y-3">
            {meds.map(med => (
              <div key={med.id} className="bg-muted rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="text-cream font-medium">{med.name} {med.dosage && `— ${med.dosage}`}</p>
                  <p className="text-muted-foreground text-sm">
                    {[med.morning && 'Aamu', med.noon && 'Päivä', med.evening && 'Ilta'].filter(Boolean).join(', ') || 'Ei ajoitusta'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Family */}
      <div className="bg-card rounded-lg p-6 border border-border">
        <h2 className="text-lg font-bold text-cream mb-4"><Users className="w-5 h-5 inline mr-2 text-sage" />Omaiset</h2>
        {family.length === 0 ? (
          <p className="text-muted-foreground">Ei omaisia lisätty.</p>
        ) : (
          <div className="space-y-3">
            {family.map(f => (
              <div key={f.id} className="bg-muted rounded-lg p-4">
                <p className="text-cream font-medium">{f.full_name} {f.relationship && `(${f.relationship})`}</p>
                <p className="text-muted-foreground text-sm">{f.phone_number} {f.email && `· ${f.email}`}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Call reports */}
      <div className="bg-card rounded-lg p-6 border border-border">
        <h2 className="text-lg font-bold text-cream mb-4">Puheluraportit</h2>
        {reports.length === 0 ? (
          <p className="text-muted-foreground">Ei raportteja vielä.</p>
        ) : (
          <div className="space-y-3">
            {reports.map(r => (
              <Collapsible key={r.id}>
                <div className="bg-muted rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-cream">{r.called_at ? new Date(r.called_at).toLocaleString('fi-FI') : '—'}</span>
                      <span className="text-muted-foreground">{r.duration_seconds ? `${Math.floor(r.duration_seconds / 60)} min` : ''}</span>
                      <span>{r.mood_score ? `${moodEmoji(r.mood_score)} ${r.mood_score}/5` : ''}</span>
                    </div>
                    {r.alert_sent && <span className="text-terracotta text-xs">⚠️ Hälytys</span>}
                  </div>
                  {r.ai_summary && <p className="text-cream text-sm mb-2">{r.ai_summary}</p>}
                  {r.transcript && (
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-sage text-xs">Lue koko litterointi</Button>
                    </CollapsibleTrigger>
                  )}
                  <CollapsibleContent>
                    <p className="text-muted-foreground text-sm mt-2 whitespace-pre-wrap">{r.transcript}</p>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ElderDetail;
