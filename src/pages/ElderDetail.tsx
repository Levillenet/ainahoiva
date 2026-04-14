import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Phone, Pill, Users, Smile, Utensils, Loader2, Trash2, Plus, Volume2, Pencil, Check, X } from 'lucide-react';
import EmergencySettings from '@/components/EmergencySettings';
import MemoriesSection from '@/components/MemoriesSection';
import MedicationLog from '@/components/MedicationLog';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { EmotionChart } from '@/components/EmotionChart';
import CareScores from '@/components/CareScores';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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


  const handleAddMed = async () => {
    if (!id || !medForm.name.trim()) return;
    const { error } = await supabase.from('medications').insert({
      elder_id: id,
      name: medForm.name.trim(),
      dosage: medForm.dosage.trim() || null,
      morning: medForm.morning,
      noon: medForm.noon,
      evening: medForm.evening,
      instructions: medForm.instructions.trim() || null,
    });
    if (error) {
      toast({ title: 'Virhe', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Lääke lisätty!' });
      setMedDialogOpen(false);
      setMedForm({ name: '', dosage: '', morning: false, noon: false, evening: false, instructions: '' });
      const { data } = await supabase.from('medications').select('*').eq('elder_id', id);
      setMeds(data || []);
    }
  };

  const handleDeleteMed = async (medId: string) => {
    const { error } = await supabase.from('medications').delete().eq('id', medId);
    if (error) {
      toast({ title: 'Virhe', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Lääke poistettu' });
      const { data } = await supabase.from('medications').select('*').eq('elder_id', id);
      setMeds(data || []);
    }
  };

  const handleAddFamily = async () => {
    if (!id || !familyForm.full_name.trim() || !familyForm.phone_number.trim()) return;
    const { error } = await supabase.from('family_members').insert({
      elder_id: id,
      full_name: familyForm.full_name.trim(),
      phone_number: familyForm.phone_number.trim(),
      email: familyForm.email.trim() || null,
      relationship: familyForm.relationship.trim() || null,
      receives_alerts: familyForm.receives_alerts,
      receives_daily_report: familyForm.receives_daily_report,
    });
    if (error) {
      toast({ title: 'Virhe', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Omainen lisätty!' });
      setFamilyDialogOpen(false);
      setFamilyForm({ full_name: '', phone_number: '', email: '', relationship: '', receives_alerts: true, receives_daily_report: true });
      const { data } = await supabase.from('family_members').select('*').eq('elder_id', id);
      setFamily(data || []);
    }
  };

  const handleDeleteFamily = async (familyId: string) => {
    const { error } = await supabase.from('family_members').delete().eq('id', familyId);
    if (error) {
      toast({ title: 'Virhe', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Omainen poistettu' });
      const { data } = await supabase.from('family_members').select('*').eq('elder_id', id);
      setFamily(data || []);
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
      <MemoriesSection
        elderId={id!}
        memories={memories}
        reports={reports}
        onMemoriesChanged={fetchMemories}
      />

      {/* Medication Log */}
      <MedicationLog elderId={id!} medications={meds} />

      {/* Medications */}
      <div className="bg-card rounded-lg p-6 border border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-cream"><Pill className="w-5 h-5 inline mr-2 text-sage" />Lääkkeet</h2>
          <Dialog open={medDialogOpen} onOpenChange={setMedDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="border-sage text-sage hover:bg-sage/10">
                <Plus className="w-4 h-4 mr-1" /> Lisää lääke
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-cream">Lisää lääke</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-cream">Nimi *</Label>
                  <input value={medForm.name} onChange={e => setMedForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-muted border border-border rounded px-3 py-2 text-cream" placeholder="Esim. Aspirin" />
                </div>
                <div>
                  <Label className="text-cream">Annostus</Label>
                  <input value={medForm.dosage} onChange={e => setMedForm(f => ({ ...f, dosage: e.target.value }))} className="w-full bg-muted border border-border rounded px-3 py-2 text-cream" placeholder="Esim. 100 mg" />
                </div>
                <div>
                  <Label className="text-cream">Ajoitus</Label>
                  <div className="flex gap-4 mt-1">
                    <label className="flex items-center gap-2 text-cream text-sm">
                      <input type="checkbox" checked={medForm.morning} onChange={e => setMedForm(f => ({ ...f, morning: e.target.checked }))} /> Aamu
                    </label>
                    <label className="flex items-center gap-2 text-cream text-sm">
                      <input type="checkbox" checked={medForm.noon} onChange={e => setMedForm(f => ({ ...f, noon: e.target.checked }))} /> Päivä
                    </label>
                    <label className="flex items-center gap-2 text-cream text-sm">
                      <input type="checkbox" checked={medForm.evening} onChange={e => setMedForm(f => ({ ...f, evening: e.target.checked }))} /> Ilta
                    </label>
                  </div>
                </div>
                <div>
                  <Label className="text-cream">Ohjeet</Label>
                  <Textarea value={medForm.instructions} onChange={e => setMedForm(f => ({ ...f, instructions: e.target.value }))} className="bg-muted border-border text-cream" placeholder="Esim. Ota ruoan yhteydessä" />
                </div>
                <div className="flex gap-3 justify-end">
                  <Button variant="ghost" onClick={() => setMedDialogOpen(false)} className="text-cream">Peruuta</Button>
                  <Button onClick={handleAddMed} className="bg-gold text-primary-foreground hover:bg-gold/90">Tallenna</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
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
                  {med.instructions && <p className="text-muted-foreground text-xs mt-1">{med.instructions}</p>}
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-terracotta shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-card border-border">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-cream">Poista lääke?</AlertDialogTitle>
                      <AlertDialogDescription>Haluatko varmasti poistaa lääkkeen {med.name}?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="text-cream">Peruuta</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteMed(med.id)} className="bg-terracotta text-cream hover:bg-terracotta/90">Poista</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Family */}
      <div className="bg-card rounded-lg p-6 border border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-cream"><Users className="w-5 h-5 inline mr-2 text-sage" />Omaiset</h2>
          <Dialog open={familyDialogOpen} onOpenChange={setFamilyDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="border-sage text-sage hover:bg-sage/10">
                <Plus className="w-4 h-4 mr-1" /> Lisää omainen
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-cream">Lisää omainen</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-cream">Nimi *</Label>
                  <input value={familyForm.full_name} onChange={e => setFamilyForm(f => ({ ...f, full_name: e.target.value }))} className="w-full bg-muted border border-border rounded px-3 py-2 text-cream" placeholder="Esim. Ritva Mäkinen" />
                </div>
                <div>
                  <Label className="text-cream">Puhelinnumero *</Label>
                  <input value={familyForm.phone_number} onChange={e => setFamilyForm(f => ({ ...f, phone_number: e.target.value }))} className="w-full bg-muted border border-border rounded px-3 py-2 text-cream" placeholder="+358..." />
                </div>
                <div>
                  <Label className="text-cream">Sähköposti</Label>
                  <input value={familyForm.email} onChange={e => setFamilyForm(f => ({ ...f, email: e.target.value }))} className="w-full bg-muted border border-border rounded px-3 py-2 text-cream" placeholder="ritva@esimerkki.fi" />
                </div>
                <div>
                  <Label className="text-cream">Suhde</Label>
                  <input value={familyForm.relationship} onChange={e => setFamilyForm(f => ({ ...f, relationship: e.target.value }))} className="w-full bg-muted border border-border rounded px-3 py-2 text-cream" placeholder="Esim. Tytär" />
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-cream text-sm">
                    <input type="checkbox" checked={familyForm.receives_alerts} onChange={e => setFamilyForm(f => ({ ...f, receives_alerts: e.target.checked }))} /> Vastaanottaa hälytykset
                  </label>
                  <label className="flex items-center gap-2 text-cream text-sm">
                    <input type="checkbox" checked={familyForm.receives_daily_report} onChange={e => setFamilyForm(f => ({ ...f, receives_daily_report: e.target.checked }))} /> Päivittäinen raportti
                  </label>
                </div>
                <div className="flex gap-3 justify-end">
                  <Button variant="ghost" onClick={() => setFamilyDialogOpen(false)} className="text-cream">Peruuta</Button>
                  <Button onClick={handleAddFamily} className="bg-gold text-primary-foreground hover:bg-gold/90">Tallenna</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        {family.length === 0 ? (
          <p className="text-muted-foreground">Ei omaisia lisätty.</p>
        ) : (
          <div className="space-y-3">
            {family.map(f => (
              <div key={f.id} className="bg-muted rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="text-cream font-medium">{f.full_name} {f.relationship && `(${f.relationship})`}</p>
                  <p className="text-muted-foreground text-sm">{f.phone_number} {f.email && `· ${f.email}`}</p>
                  <p className="text-muted-foreground text-xs">
                    {f.receives_alerts && '🔔 Hälytykset'} {f.receives_daily_report && '📊 Raportit'}
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
                      <AlertDialogTitle className="text-cream">Poista omainen?</AlertDialogTitle>
                      <AlertDialogDescription>Haluatko varmasti poistaa omaisen {f.full_name}?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="text-cream">Peruuta</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteFamily(f.id)} className="bg-terracotta text-cream hover:bg-terracotta/90">Poista</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Emergency Settings */}
      <EmergencySettings elderId={elder.id} />

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
                    <div className="flex items-center gap-4 text-sm flex-wrap">
                      <span className="text-cream">{r.called_at ? new Date(r.called_at).toLocaleString('fi-FI') : '—'}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        r.call_type === 'inbound' ? 'bg-blue-500/20 text-blue-300' :
                        r.call_type === 'retry' ? 'bg-orange-500/20 text-orange-300' :
                        r.call_type?.includes('skipped') ? 'bg-muted-foreground/20 text-muted-foreground' :
                        'bg-green-500/20 text-green-300'
                      }`}>{
                        r.call_type === 'inbound' ? '📲 Sisääntuleva' :
                        r.call_type === 'retry' ? '🔄 Uudelleensoitto' :
                        r.call_type?.includes('skipped') ? '⏭️ Ohitettu' :
                        '📞 Ajoitettu'
                      }</span>
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
                  {r.hume_raw ? (
                    <div className="mt-3 mb-3">
                      <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                        <Volume2 className="w-4 h-4" /> Tunneanalyysi (Hume AI)
                      </p>
                      {(() => {
                        const topEmotions: any[] = Array.isArray(r.hume_top_emotions) && r.hume_top_emotions.length > 0
                          ? r.hume_top_emotions
                          : null;
                        const emotionCards = topEmotions
                          ? topEmotions.slice(0, 6)
                          : [
                              { name_fi: 'Ilo', score: Math.round((r.hume_joy ?? 0) * 100) },
                              { name_fi: 'Suru', score: Math.round((r.hume_sadness ?? 0) * 100) },
                              { name_fi: 'Ahdistus', score: Math.round((r.hume_anxiety ?? 0) * 100) },
                              { name_fi: 'Väsymys', score: Math.round((r.hume_tiredness ?? 0) * 100) },
                              { name_fi: 'Turhautuminen', score: Math.round((r.hume_anger ?? 0) * 100) },
                              { name_fi: 'Hämmennys', score: Math.round((r.hume_confusion ?? 0) * 100) },
                            ];
                        return (
                          <>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
                              {emotionCards.map((e: any, i: number) => (
                                <div key={i} className="text-center bg-card rounded p-2">
                                  <div className="text-gold text-sm font-bold">{e.score}%</div>
                                  <div className="text-xs text-muted-foreground">{e.name_fi}</div>
                                </div>
                              ))}
                            </div>
                            <EmotionChart topEmotions={topEmotions ?? undefined} joy={r.hume_joy ?? 0} sadness={r.hume_sadness ?? 0} anxiety={r.hume_anxiety ?? 0} tiredness={r.hume_tiredness ?? 0} anger={r.hume_anger ?? 0} confusion={r.hume_confusion ?? 0} />
                            {(r.hume_wellbeing_score != null || r.hume_social_score != null || r.hume_distress_score != null) && (
                              <div className="mt-3">
                                <CareScores
                                  wellbeing={r.hume_wellbeing_score ?? 0}
                                  social={r.hume_social_score ?? 0}
                                  cognition={0}
                                  physical={0}
                                  lowMood={0}
                                  distress={r.hume_distress_score ?? 0}
                                />
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : r.duration_seconds && r.duration_seconds > 10 ? (
                    <p className="text-xs text-muted-foreground mt-2 italic">🔄 Tunneanalyysiä ei saatavilla tälle puhelulle</p>
                  ) : null}

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
