import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft, ArrowRight, Plus, Trash2, Heart } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { LIFE_STAGES } from '@/lib/legacy';

const schema = z.object({
  birth_year: z.coerce.number().min(1920).max(1970),
  birth_place: z.string().trim().min(1, 'Kerro syntymäpaikka').max(100),
  dialect_region: z.string().min(1, 'Valitse murre'),
  marital_status: z.string().min(1, 'Valitse siviilisääty'),
  spouse_name: z.string().max(100).optional().or(z.literal('')),
  spouse_status: z.string().optional().or(z.literal('')),
  has_children: z.enum(['yes', 'no']),
  children: z.array(z.object({ name: z.string().trim().max(80), birth_year: z.string().max(4).optional().or(z.literal('')) })),
  mother_name: z.string().max(100).optional().or(z.literal('')),
  mother_note: z.string().max(500).optional().or(z.literal('')),
  father_name: z.string().max(100).optional().or(z.literal('')),
  father_note: z.string().max(500).optional().or(z.literal('')),
  siblings: z.string().max(1000).optional().or(z.literal('')),
  sensitive_topics: z.string().max(2000).optional().or(z.literal('')),
  favorite_topics: z.string().max(2000).optional().or(z.literal('')),
  profession: z.string().max(1000).optional().or(z.literal('')),
  health_notes: z.string().min(1, 'Valitse'),
  special_notes: z.string().max(2000).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

const dialects = ['pääkaupunkiseutu', 'Turku', 'Tampere', 'Häme', 'Savo', 'Karjala', 'Pohjanmaa', 'Kainuu', 'Lappi', 'muu'];
const birthYears = Array.from({ length: 31 }, (_, i) => 1930 + i);

const LegacyOnboarding = () => {
  const { elderId } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      birth_year: 1942,
      birth_place: '',
      dialect_region: '',
      marital_status: '',
      spouse_name: '',
      spouse_status: '',
      has_children: 'no',
      children: [],
      mother_name: '',
      mother_note: '',
      father_name: '',
      father_note: '',
      siblings: '',
      sensitive_topics: '',
      favorite_topics: '',
      profession: '',
      health_notes: '',
      special_notes: '',
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'children' });
  const hasChildren = form.watch('has_children');
  const maritalStatus = form.watch('marital_status');
  const showSpouseFields = !!maritalStatus && maritalStatus !== 'naimaton';

  const stepFields: Record<number, (keyof FormValues)[]> = {
    1: ['birth_year', 'birth_place', 'dialect_region', 'marital_status'],
    2: ['has_children'],
    3: [],
    4: ['health_notes'],
  };

  const next = async () => {
    const valid = await form.trigger(stepFields[step]);
    if (valid) setStep(step + 1);
  };

  const onSubmit = async (values: FormValues) => {
    if (!elderId) {
      toast({
        title: 'Virhe',
        description: 'Vanhuksen tunniste puuttuu. Palaa etusivulle.',
        variant: 'destructive',
      });
      return;
    }

    // Validoi koko lomake ja ohjaa käyttäjä ensimmäiseen virheelliseen askeleeseen
    const valid = await form.trigger();
    if (!valid) {
      const errors = form.formState.errors;
      const firstErrorField = Object.keys(errors)[0] as keyof FormValues;
      const stepWithError = Object.entries(stepFields).find(
        ([, fields]) => fields.includes(firstErrorField),
      )?.[0];
      if (stepWithError) {
        setStep(Number(stepWithError));
      }
      toast({
        title: 'Tarkista tiedot',
        description: 'Osa pakollisista kentistä puuttuu.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error: profileErr } = await supabase.from('legacy_profile').upsert({
        elder_id: elderId,
        birth_year: values.birth_year,
        birth_place: values.birth_place,
        dialect_region: values.dialect_region,
        marital_status: values.marital_status,
        spouse_info: showSpouseFields && values.spouse_name
          ? { name: values.spouse_name, status: values.spouse_status }
          : null,
        children_info: values.has_children === 'yes' ? values.children : [],
        parents_info: {
          mother: { name: values.mother_name, note: values.mother_note },
          father: { name: values.father_name, note: values.father_note },
          siblings: values.siblings,
        },
        profession: values.profession,
        sensitive_topics: values.sensitive_topics,
        favorite_topics: values.favorite_topics,
        health_notes: values.health_notes,
        special_notes: values.special_notes,
        onboarding_completed: true,
      }, { onConflict: 'elder_id' });
      if (profileErr) {
        console.error('Profiilin tallennus epäonnistui:', profileErr);
        throw new Error('Profiilin tallennus: ' + profileErr.message);
      }

      const targetDate = new Date();
      targetDate.setFullYear(targetDate.getFullYear() + 1);

      const { error: subErr } = await supabase.from('legacy_subscriptions').upsert({
        elder_id: elderId,
        status: 'active',
        target_completion_date: targetDate.toISOString().slice(0, 10),
        book_target_chapters: 15,
        weekly_call_count: 2,
      }, { onConflict: 'elder_id' });
      if (subErr) {
        console.error('Tilauksen tallennus epäonnistui:', subErr);
        throw new Error('Tilauksen tallennus: ' + subErr.message);
      }

      const { data: existingCov, error: covCheckErr } = await supabase
        .from('coverage_map')
        .select('id')
        .eq('elder_id', elderId)
        .limit(1);
      if (covCheckErr) {
        console.error('Coverage-tarkistus epäonnistui:', covCheckErr);
        throw new Error('Coverage-tarkistus: ' + covCheckErr.message);
      }

      if (!existingCov?.length) {
        const rows = LIFE_STAGES.map((s) => ({
          elder_id: elderId,
          life_stage: s.key,
          theme: s.label,
          priority: s.priority,
          is_sensitive: !!s.sensitive,
          requires_trust_first: !!s.trustFirst,
          status: 'not_started',
          depth_score: 0,
        }));
        const { error: covErr } = await supabase.from('coverage_map').insert(rows);
        if (covErr) {
          console.error('Coverage-luonti epäonnistui:', covErr);
          throw new Error('Coverage-luonti: ' + covErr.message);
        }
      }

      toast({ title: 'Muistoissa aktivoitu', description: 'Aina aloittaa pian ensimmäiset haastattelut.' });
      navigate(`/dashboard/muistoissa/${elderId}`);
    } catch (err) {
      toast({ title: 'Tallennus epäonnistui', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const childrenCount = form.watch('children')?.length ?? 0;
  const sensitiveTopics = form.watch('sensitive_topics') ?? '';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link to="/dashboard/muistoissa" className="text-cream/60 hover:text-cream text-sm flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Takaisin
      </Link>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-cream flex items-center gap-2">
            <Heart className="w-5 h-5 text-gold" />
            Aloitetaan elämäntarinan kokoaminen
          </CardTitle>
          <p className="text-xs text-cream/60 mt-2">Askel {step} / 4</p>
          <Progress value={(step / 4) * 100} className="mt-2" />
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
            {step === 1 && (
              <>
                <Field label="Syntymävuosi" error={form.formState.errors.birth_year?.message}>
                  <Controller
                    control={form.control}
                    name="birth_year"
                    render={({ field }) => (
                      <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {birthYears.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <Field label="Syntymäpaikka" error={form.formState.errors.birth_place?.message}>
                  <Input {...form.register('birth_place')} placeholder="esim. Viipuri" />
                </Field>
                <Field label="Puhutun murteen alue" error={form.formState.errors.dialect_region?.message}>
                  <Controller
                    control={form.control}
                    name="dialect_region"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue placeholder="Valitse" /></SelectTrigger>
                        <SelectContent>
                          {dialects.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <Field label="Siviilisääty" error={form.formState.errors.marital_status?.message}>
                  <Controller
                    control={form.control}
                    name="marital_status"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue placeholder="Valitse" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="naimisissa">Naimisissa</SelectItem>
                          <SelectItem value="leski">Leski</SelectItem>
                          <SelectItem value="eronnut">Eronnut</SelectItem>
                          <SelectItem value="naimaton">Naimaton</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
              </>
            )}

            {step === 2 && (
              <>
                {showSpouseFields && (
                  <>
                    <Field label="Puolison nimi">
                      <Input {...form.register('spouse_name')} placeholder="esim. Paavo" />
                    </Field>
                    <Field label="Puolison tilanne">
                      <Controller
                        control={form.control}
                        name="spouse_status"
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger><SelectValue placeholder="Valitse" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="elossa">Elossa</SelectItem>
                              <SelectItem value="kuollut">Kuollut</SelectItem>
                              <SelectItem value="eronnut">Eronnut</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Field>
                  </>
                )}
                <Field label="Onko lapsia?">
                  <Controller
                    control={form.control}
                    name="has_children"
                    render={({ field }) => (
                      <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-6">
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="yes" id="ch-yes" />
                          <Label htmlFor="ch-yes" className="text-cream">Kyllä</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="no" id="ch-no" />
                          <Label htmlFor="ch-no" className="text-cream">Ei</Label>
                        </div>
                      </RadioGroup>
                    )}
                  />
                </Field>
                {hasChildren === 'yes' && (
                  <div className="space-y-2 p-3 rounded-md border border-border">
                    <p className="text-xs text-cream/60">Lapset</p>
                    {fields.map((f, i) => (
                      <div key={f.id} className="flex gap-2">
                        <Input {...form.register(`children.${i}.name`)} placeholder="Nimi" />
                        <Input {...form.register(`children.${i}.birth_year`)} placeholder="s. v." className="w-24" />
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ name: '', birth_year: '' })}>
                      <Plus className="w-3 h-3 mr-1" /> Lisää lapsi
                    </Button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Äidin nimi"><Input {...form.register('mother_name')} /></Field>
                  <Field label="Isän nimi"><Input {...form.register('father_name')} /></Field>
                </div>
                <Field label="Muistiinpano äidistä"><Textarea {...form.register('mother_note')} rows={2} /></Field>
                <Field label="Muistiinpano isästä"><Textarea {...form.register('father_note')} rows={2} /></Field>
                <Field label="Sisarukset"><Textarea {...form.register('siblings')} rows={2} placeholder="Nimet ja lyhyt kuvaus" /></Field>
              </>
            )}

            {step === 3 && (
              <>
                <div className="p-4 rounded-lg bg-sage/10 border border-sage/30 text-sm text-cream/90 leading-relaxed">
                  <p className="font-medium text-sage mb-1">Aina kunnioittaa rajoja.</p>
                  Kerro aiheista joita EI saa käsitellä, niin Aina ei koskaan ota niitä esille.
                  Esim. lapsen kuolema, sota-traumat, avioero, alkoholismi.
                </div>
                <Field label="Herkät aiheet — älä koskaan ota esille">
                  <Textarea {...form.register('sensitive_topics')} rows={4} placeholder="esim. nuorimman pojan kuolema 1998" />
                </Field>
                <Field label="Mieliaiheet — mistä hän pitää puhua?">
                  <Textarea {...form.register('favorite_topics')} rows={4} placeholder="harrastukset, mökki, lapsenlapset, ammatti…" />
                </Field>
              </>
            )}

            {step === 4 && (
              <>
                <Field label="Ammatti / työura lyhyesti">
                  <Textarea {...form.register('profession')} rows={3} placeholder="esim. opettaja Lauttasaaren ala-asteella 1965-2002" />
                </Field>
                <Field label="Terveydentila" error={form.formState.errors.health_notes?.message}>
                  <Controller
                    control={form.control}
                    name="health_notes"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue placeholder="Valitse" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="virkea">Virkeä</SelectItem>
                          <SelectItem value="lievat_muistihairiot">Lievät muistihäiriöt</SelectItem>
                          <SelectItem value="kuulovaikeuksia">Kuulovaikeuksia</SelectItem>
                          <SelectItem value="vasyy_nopeasti">Väsyy nopeasti</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <Field label="Erityistä Ainan tulisi tietää">
                  <Textarea {...form.register('special_notes')} rows={4} />
                </Field>
                <div className="p-4 rounded-md bg-muted/30 border border-border text-sm text-cream/80 space-y-2">
                  <p className="font-medium text-cream">Tarkista tiedot:</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div>
                      <span className="text-cream/50">Syntymävuosi:</span> {form.watch('birth_year')}
                      {' '}({new Date().getFullYear() - (form.watch('birth_year') || 0)} v)
                    </div>
                    <div><span className="text-cream/50">Paikka:</span> {form.watch('birth_place') || '—'}</div>
                    <div><span className="text-cream/50">Murre:</span> {form.watch('dialect_region') || '—'}</div>
                    <div><span className="text-cream/50">Siviilisääty:</span> {form.watch('marital_status') || '—'}</div>
                    <div><span className="text-cream/50">Lapsia:</span> {form.watch('has_children') === 'yes' ? childrenCount : 'ei'}</div>
                    <div><span className="text-cream/50">Terveys:</span> {form.watch('health_notes') || '—'}</div>
                  </div>
                  {sensitiveTopics && (
                    <div className="pt-2 border-t border-border">
                      <span className="text-cream/50 text-xs">Kielletyt aiheet: </span>
                      <span className="text-xs">{sensitiveTopics.slice(0, 100)}{sensitiveTopics.length > 100 ? '…' : ''}</span>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="flex justify-between pt-4 border-t border-border">
              <Button type="button" variant="ghost" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Takaisin
              </Button>
              {step < 4 ? (
                <Button type="button" onClick={next}>
                  Seuraava <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => onSubmit(form.getValues())}
                  disabled={submitting}
                  className="bg-gold text-navy hover:bg-gold/90"
                >
                  {submitting ? 'Tallennetaan…' : 'Tallenna ja aktivoi Muistoissa'}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-cream/80">{label}</Label>
    {children}
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
);

export default LegacyOnboarding;
