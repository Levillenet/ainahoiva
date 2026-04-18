import { useEffect, useState } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft, Plus, Trash2, Save, User, BookOpen } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const schema = z.object({
  // Elders-tiedot
  full_name: z.string().trim().min(1, 'Nimi vaaditaan').max(120),
  phone_number: z.string().trim().min(5, 'Puhelinnumero vaaditaan').max(40),
  date_of_birth: z.string().optional().or(z.literal('')),
  address: z.string().max(200).optional().or(z.literal('')),
  postal_code: z.string().max(20).optional().or(z.literal('')),
  // Legacy_profile
  birth_year: z.coerce.number().min(1900).max(2010),
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
const birthYears = Array.from({ length: 111 }, (_, i) => 1900 + i);

const LegacyEdit = () => {
  const { elderId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      full_name: '',
      phone_number: '',
      date_of_birth: '',
      address: '',
      postal_code: '',
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
  const birthYear = form.watch('birth_year');

  useEffect(() => {
    if (!elderId) return;
    let cancelled = false;
    (async () => {
      const [{ data: elder }, { data: profile }] = await Promise.all([
        supabase.from('elders').select('full_name, phone_number, date_of_birth, address, postal_code').eq('id', elderId).maybeSingle(),
        supabase.from('legacy_profile').select('*').eq('elder_id', elderId).maybeSingle(),
      ]);
      if (cancelled) return;

      const spouse = (profile?.spouse_info ?? null) as { name?: string; status?: string } | null;
      const parents = (profile?.parents_info ?? null) as { mother?: { name?: string; note?: string }; father?: { name?: string; note?: string }; siblings?: string } | null;
      const childrenArr = Array.isArray(profile?.children_info) ? (profile?.children_info as Array<{ name?: string; birth_year?: string | number }>) : [];

      form.reset({
        full_name: elder?.full_name ?? '',
        phone_number: elder?.phone_number ?? '',
        date_of_birth: elder?.date_of_birth ?? '',
        address: elder?.address ?? '',
        postal_code: elder?.postal_code ?? '',
        birth_year: profile?.birth_year ?? 1942,
        birth_place: profile?.birth_place ?? '',
        dialect_region: profile?.dialect_region ?? '',
        marital_status: profile?.marital_status ?? '',
        spouse_name: spouse?.name ?? '',
        spouse_status: spouse?.status ?? '',
        has_children: childrenArr.length > 0 ? 'yes' : 'no',
        children: childrenArr.map((c) => ({ name: c.name ?? '', birth_year: c.birth_year != null ? String(c.birth_year) : '' })),
        mother_name: parents?.mother?.name ?? '',
        mother_note: parents?.mother?.note ?? '',
        father_name: parents?.father?.name ?? '',
        father_note: parents?.father?.note ?? '',
        siblings: parents?.siblings ?? '',
        sensitive_topics: profile?.sensitive_topics ?? '',
        favorite_topics: profile?.favorite_topics ?? '',
        profession: profile?.profession ?? '',
        health_notes: profile?.health_notes ?? '',
        special_notes: profile?.special_notes ?? '',
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [elderId, form]);

  const onSubmit = async (values: FormValues) => {
    if (!elderId) return;
    setSubmitting(true);
    try {
      const { error: elderErr } = await supabase
        .from('elders')
        .update({
          full_name: values.full_name,
          phone_number: values.phone_number,
          date_of_birth: values.date_of_birth || null,
          address: values.address || null,
          postal_code: values.postal_code || null,
        })
        .eq('id', elderId);
      if (elderErr) throw new Error('Perustiedot: ' + elderErr.message);

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
      if (profileErr) throw new Error('Profiili: ' + profileErr.message);

      toast({ title: 'Tiedot päivitetty', description: 'Muutokset tulevat voimaan seuraavalla puhelulla.' });
      navigate(`/dashboard/muistoissa/${elderId}`);
    } catch (err) {
      toast({ title: 'Tallennus epäonnistui', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-cream/60 text-sm p-8">Ladataan tietoja…</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link to={`/dashboard/muistoissa/${elderId}`} className="text-cream/60 hover:text-cream text-sm flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Takaisin
      </Link>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Perustiedot */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-cream flex items-center gap-2 text-base">
              <User className="w-5 h-5 text-sage" />
              Perustiedot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Koko nimi" error={form.formState.errors.full_name?.message}>
                <Input {...form.register('full_name')} />
              </Field>
              <Field label="Puhelinnumero" error={form.formState.errors.phone_number?.message}>
                <Input {...form.register('phone_number')} placeholder="+358..." />
              </Field>
              <Field label="Syntymäaika">
                <Input type="date" {...form.register('date_of_birth')} />
              </Field>
              <Field label="Postinumero">
                <Input {...form.register('postal_code')} />
              </Field>
            </div>
            <Field label="Osoite">
              <Input {...form.register('address')} />
            </Field>
          </CardContent>
        </Card>

        {/* Muistoissa-profiili */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-cream flex items-center gap-2 text-base">
              <BookOpen className="w-5 h-5 text-gold" />
              Muistoissa-profiili
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={`Syntymävuosi (${new Date().getFullYear() - (birthYear || 0)} v)`} error={form.formState.errors.birth_year?.message}>
                <Controller
                  control={form.control}
                  name="birth_year"
                  render={({ field }) => (
                    <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {birthYears.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Syntymäpaikka" error={form.formState.errors.birth_place?.message}>
                <Input {...form.register('birth_place')} placeholder="esim. Viipuri" />
              </Field>
              <Field label="Murre" error={form.formState.errors.dialect_region?.message}>
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
            </div>

            {showSpouseFields && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/50">
                <Field label="Puolison nimi">
                  <Input {...form.register('spouse_name')} />
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
              </div>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Äidin nimi"><Input {...form.register('mother_name')} /></Field>
              <Field label="Isän nimi"><Input {...form.register('father_name')} /></Field>
            </div>
            <Field label="Muistiinpano äidistä"><Textarea {...form.register('mother_note')} rows={2} /></Field>
            <Field label="Muistiinpano isästä"><Textarea {...form.register('father_note')} rows={2} /></Field>
            <Field label="Sisarukset"><Textarea {...form.register('siblings')} rows={2} placeholder="Nimet ja lyhyt kuvaus" /></Field>

            <Field label="Ammatti / työura">
              <Textarea {...form.register('profession')} rows={3} />
            </Field>

            <Field label="Herkät aiheet — älä koskaan ota esille">
              <Textarea {...form.register('sensitive_topics')} rows={3} />
            </Field>
            <Field label="Mieliaiheet — mistä hän pitää puhua">
              <Textarea {...form.register('favorite_topics')} rows={3} />
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
              <Textarea {...form.register('special_notes')} rows={3} />
            </Field>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2 sticky bottom-0 bg-background/80 backdrop-blur py-3 border-t border-border">
          <Button type="button" variant="ghost" onClick={() => navigate(`/dashboard/muistoissa/${elderId}`)}>
            Peruuta
          </Button>
          <Button type="submit" disabled={submitting} className="bg-gold text-navy hover:bg-gold/90">
            <Save className="w-4 h-4 mr-2" />
            {submitting ? 'Tallennetaan…' : 'Tallenna muutokset'}
          </Button>
        </div>
      </form>
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

export default LegacyEdit;
