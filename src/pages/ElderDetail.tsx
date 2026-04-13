import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Phone, Pill, Users, Smile, Utensils, Loader2, Trash2, Plus, Brain, Volume2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { EmotionChart } from '@/components/EmotionChart';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const moodEmoji = (s: number) => ['😢', '😟', '😐', '🙂', '😊'][s - 1] || '—';

const memoryTypeConfig: Record<string, { icon: string; label: string }> = {
  person: { icon: '👥', label: 'Henkilöt' },
  health: { icon: '🏥', label: 'Terveys' },
  event: { icon: '📅', label: 'Tapahtumat' },
  preference: { icon: '⭐', label: 'Mieltymykset' },
  family: { icon: '👨‍👩‍👧', label: 'Perhe' },
};

const ElderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [elder, setElder] = useState<any>(null);
  const [meds, setMeds] = useState<any[]>([]);
  const [family, setFamily] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [memories, setMemories] = useState<any[]>([]);
  const [moodData, setMoodData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState(false);
  const [memoryDialogOpen, setMemoryDialogOpen] = useState(false);
  const [memoryForm, setMemoryForm] = useState({ memory_type: 'person', content: '' });
  const [medDialogOpen, setMedDialogOpen] = useState(false);
  const [medForm, setMedForm] = useState({ name: '', dosage: '', morning: false, noon: false, evening: false, instructions: '' });
  const [familyDialogOpen, setFamilyDialogOpen] = useState(false);
  const [familyForm, setFamilyForm] = useState({ full_name: '', phone_number: '', email: '', relationship: '', receives_alerts: true, receives_daily_report: true });

  const fetchReports = async () => {
    if (!id) return;
    const { data } = await supabase.from('call_reports').select('*').eq('elder_id', id).order('called_at', { ascending: false }).limit(20);
    setReports(data || []);
  };

  const fetchMemories = async () => {
    if (!id) return;
    const { data } = await supabase.from('elder_memory').select('*').eq('elder_id', id).order('updated_at', { ascending: false });
    setMemories(data || []);
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

      await Promise.all([fetchReports(), fetchMemories()]);

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

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`call_reports_${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_reports', filter: `elder_id=eq.${id}` }, () => { fetchReports(); })
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
      const { error } = await supabase.functions.invoke('outbound-call', { body: { elder_id: elder.id } });
      if (error) throw error;
      toast({ title: 'Soitto käynnistetty!', description: `Soitetaan: ${elder.full_name}` });
    } catch (err: any) {
      toast({ title: 'Virhe', description: err.message || 'Soittoa ei voitu käynnistää', variant: 'destructive' });
    } finally {
      setCalling(false);
    }
  };

  const handleAddMemory = async () => {
    if (!id || !memoryForm.content.trim()) return;
    const { error } = await supabase.from('elder_memory').insert({
      elder_id: id,
      memory_type: memoryForm.memory_type,
      content: memoryForm.content.trim(),
    });
    if (error) {
      toast({ title: 'Virhe', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Muisto lisätty!' });
      setMemoryDialogOpen(false);
      setMemoryForm({ memory_type: 'person', content: '' });
      fetchMemories();
    }
  };

  const handleDeleteMemory = async (memoryId: string) => {
    const { error } = await supabase.from('elder_memory').delete().eq('id', memoryId);
    if (error) {
      toast({ title: 'Virhe', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Muisto poistettu' });
      fetchMemories();
    }
  };

  if (loading) return <div className="animate-pulse text-cream p-8">Ladataan...</div>;
  if (!elder) return <div className="text-cream p-8">Vanhusta ei löytynyt.</div>;

  const latestReport = reports[0];
  const age = elder.date_of_birth ? Math.floor((Date.now() - new Date(elder.date_of_birth).getTime()) / 31557600000) : null;

  const memoryTypes = ['all', 'person', 'health', 'event', 'preference', 'family'];

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
              <Legend />
              <Line type="monotone" dataKey="mood" name="Yhdistetty" stroke="hsl(43, 50%, 54%)" strokeWidth={2} dot={{ fill: 'hsl(43, 50%, 54%)' }} />
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

      {/* Memories */}
      <div className="bg-card rounded-lg p-6 border border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-cream flex items-center gap-2">
            <Brain className="w-5 h-5 text-sage" /> Muistit
            {memories.length > 0 && (
              <span className="text-xs bg-gold/20 text-gold px-2 py-0.5 rounded-full">{memories.length}</span>
            )}
          </h2>
          <Dialog open={memoryDialogOpen} onOpenChange={setMemoryDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="border-sage text-sage hover:bg-sage/10">
                <Plus className="w-4 h-4 mr-1" /> Lisää muisto
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-cream">Lisää muisto</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-cream">Tyyppi</Label>
                  <Select value={memoryForm.memory_type} onValueChange={v => setMemoryForm(f => ({ ...f, memory_type: v }))}>
                    <SelectTrigger className="bg-muted border-border text-cream">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="person">👥 Henkilö</SelectItem>
                      <SelectItem value="health">🏥 Terveys</SelectItem>
                      <SelectItem value="event">📅 Tapahtuma</SelectItem>
                      <SelectItem value="preference">⭐ Mieltymys</SelectItem>
                      <SelectItem value="family">👨‍👩‍👧 Perhe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-cream">Muisto</Label>
                  <Textarea
                    value={memoryForm.content}
                    onChange={e => setMemoryForm(f => ({ ...f, content: e.target.value }))}
                    placeholder="Esim. Tyttären nimi on Ritva, asuu Tampereella"
                    className="bg-muted border-border text-cream"
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <Button variant="ghost" onClick={() => setMemoryDialogOpen(false)} className="text-cream">Peruuta</Button>
                  <Button onClick={handleAddMemory} className="bg-gold text-primary-foreground hover:bg-gold/90">Tallenna</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {memories.length === 0 ? (
          <p className="text-muted-foreground text-center py-6">Ei muistoja vielä. Muistot kertyvät automaattisesti puheluista tai voit lisätä niitä manuaalisesti.</p>
        ) : (
          <Tabs defaultValue="all">
            <TabsList className="bg-muted border-border mb-4">
              <TabsTrigger value="all" className="text-cream data-[state=active]:bg-card">Kaikki</TabsTrigger>
              {Object.entries(memoryTypeConfig).map(([type, cfg]) => {
                const count = memories.filter(m => m.memory_type === type).length;
                if (count === 0) return null;
                return (
                  <TabsTrigger key={type} value={type} className="text-cream data-[state=active]:bg-card">
                    {cfg.icon} {cfg.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {memoryTypes.map(tab => (
              <TabsContent key={tab} value={tab} className="space-y-2">
                {memories
                  .filter(m => tab === 'all' || m.memory_type === tab)
                  .map(m => (
                    <div key={m.id} className="bg-muted rounded-lg p-4 flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span>{memoryTypeConfig[m.memory_type]?.icon || '📝'}</span>
                          <span className="text-xs text-muted-foreground">{memoryTypeConfig[m.memory_type]?.label || m.memory_type}</span>
                        </div>
                        <p className="text-cream text-sm">{m.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(m.updated_at).toLocaleDateString('fi-FI')}
                        </p>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-terracotta shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-card border-border">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-cream">Poista muisto?</AlertDialogTitle>
                            <AlertDialogDescription>Haluatko varmasti poistaa tämän muiston?</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="text-cream">Peruuta</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteMemory(m.id)} className="bg-terracotta text-cream hover:bg-terracotta/90">Poista</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>

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
                      <span className="text-muted-foreground">{r.duration_seconds ? `${Math.floor(r.duration_seconds / 60)} min ${r.duration_seconds % 60} sek` : ''}</span>
                      <span>{r.mood_score ? `${moodEmoji(r.mood_score)} ${r.mood_score}/5` : ''}</span>
                      {r.mood_source === 'hume+gpt' ? (
                        <span className="text-xs bg-gold/20 text-gold px-2 py-0.5 rounded-full">Hume AI + GPT</span>
                      ) : (
                        <span className="text-xs bg-muted-foreground/20 text-muted-foreground px-2 py-0.5 rounded-full">GPT-analyysi</span>
                      )}
                    </div>
                    {r.alert_sent && <span className="text-terracotta text-xs">⚠️ Hälytys</span>}
                  </div>
                  {r.ai_summary && <p className="text-cream text-sm mb-2">{r.ai_summary}</p>}

                  {/* Emotion chart if Hume data exists */}
                  {r.hume_raw && (
                    <div className="mt-3 mb-3">
                      <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                        <Volume2 className="w-4 h-4" /> Tunneanalyysi
                      </p>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
                        {[
                          { label: 'Ilo', value: r.hume_joy, emoji: '😊' },
                          { label: 'Suru', value: r.hume_sadness, emoji: '😢' },
                          { label: 'Ahdistus', value: r.hume_anxiety, emoji: '😰' },
                          { label: 'Väsymys', value: r.hume_tiredness, emoji: '😴' },
                          { label: 'Turhautuminen', value: r.hume_anger, emoji: '😤' },
                          { label: 'Hämmennys', value: r.hume_confusion, emoji: '😕' },
                        ].map(e => (
                          <div key={e.label} className="text-center bg-card rounded p-2">
                            <div className="text-lg">{e.emoji}</div>
                            <div className="text-gold text-sm font-bold">{Math.round((e.value ?? 0) * 100)}%</div>
                            <div className="text-xs text-muted-foreground">{e.label}</div>
                          </div>
                        ))}
                      </div>
                      <EmotionChart
                        joy={r.hume_joy ?? 0}
                        sadness={r.hume_sadness ?? 0}
                        anxiety={r.hume_anxiety ?? 0}
                        tiredness={r.hume_tiredness ?? 0}
                        anger={r.hume_anger ?? 0}
                        confusion={r.hume_confusion ?? 0}
                      />
                    </div>
                  )}

                  {r.audio_url && (
                    <a href={r.audio_url} target="_blank" rel="noopener noreferrer" className="text-sage text-xs hover:underline inline-flex items-center gap-1 mr-3">
                      <Volume2 className="w-3 h-3" /> Kuuntele tallenne
                    </a>
                  )}
                  {r.transcript && (
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-sage text-xs">📄 Lue koko litterointi</Button>
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
