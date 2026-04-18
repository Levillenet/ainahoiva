import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen, Clock, Sparkles, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

type ChapterStatus = 'empty' | 'draft' | 'reviewed' | 'final';

type Chapter = {
  id: string;
  chapter_number: number;
  life_stage: string;
  title: string;
  content_markdown: string;
  word_count: number;
  status: ChapterStatus;
  last_generated_at: string | null;
  last_edited_at: string | null;
};

type ProfileSummary = {
  personality_notes: string;
  speaking_style: string;
  key_themes: string;
  recurring_people: string;
  sensitive_areas_learned: string;
  last_updated: string;
};

type UnprocessedCall = {
  id: string;
  called_at: string;
  duration_seconds: number;
  transcript_length: number;
};

const STATUS_LABELS: Record<ChapterStatus, { label: string; className: string }> = {
  empty: { label: 'Ei vielä aloitettu', className: 'bg-muted text-muted-foreground border-border' },
  draft: { label: 'Luonnos', className: 'bg-amber-900/30 text-amber-200 border-amber-800/50' },
  reviewed: { label: 'Tarkistettu', className: 'bg-blue-900/30 text-blue-200 border-blue-800/50' },
  final: { label: 'Valmis', className: 'bg-green-900/30 text-green-200 border-green-800/50' },
};

export default function LegacyBookView() {
  const { elderId } = useParams<{ elderId: string }>();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [elderName, setElderName] = useState('');
  const [loading, setLoading] = useState(true);
  const [unprocessedCalls, setUnprocessedCalls] = useState<UnprocessedCall[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);

  const loadAll = async () => {
    if (!elderId) return;
    setLoading(true);
    const [elderRes, chaptersRes, profileRes, callsRes] = await Promise.all([
      supabase.from('elders').select('full_name').eq('id', elderId).maybeSingle(),
      supabase
        .from('book_chapters')
        .select('*')
        .eq('elder_id', elderId)
        .order('chapter_number'),
      supabase
        .from('profile_summary')
        .select('*')
        .eq('elder_id', elderId)
        .maybeSingle(),
      supabase
        .from('call_reports')
        .select('id, called_at, duration_seconds, transcript')
        .eq('elder_id', elderId)
        .eq('call_type', 'muistoissa')
        .is('processed_at', null)
        .order('called_at', { ascending: false }),
    ]);

    if (elderRes.data) setElderName(elderRes.data.full_name);
    if (chaptersRes.data) {
      const list = chaptersRes.data as Chapter[];
      setChapters(list);
      setSelectedChapter((prev) => {
        if (prev) {
          const refreshed = list.find((c) => c.id === prev.id);
          if (refreshed) return refreshed;
        }
        const firstWithContent = list.find((c) => c.content_markdown?.trim().length > 0);
        return firstWithContent ?? list[0] ?? null;
      });
    }
    if (profileRes.data) setProfile(profileRes.data as ProfileSummary);
    if (callsRes.data) {
      setUnprocessedCalls(
        callsRes.data.map((c) => ({
          id: c.id,
          called_at: c.called_at ?? '',
          duration_seconds: c.duration_seconds || 0,
          transcript_length: (c.transcript || '').length,
        })),
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elderId]);

  const processCall = async (callId: string) => {
    setProcessing(callId);
    try {
      const { data, error } = await supabase.functions.invoke('muistoissa-process-call', {
        body: { call_report_id: callId },
      });
      if (error) throw error;
      toast({
        title: 'Puhelu käsitelty',
        description: `${data?.chapters_updated ?? 0} lukua päivitettiin. ${data?.summary ?? ''}`,
      });
      await loadAll();
    } catch (err) {
      toast({
        title: 'Käsittely epäonnistui',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return <div className="text-cream/60">Ladataan kirjaa…</div>;
  }

  const totalWords = chapters.reduce((sum, c) => sum + (c.word_count || 0), 0);
  const completedChapters = chapters.filter(
    (c) => c.status === 'final' || c.status === 'reviewed',
  ).length;
  const draftChapters = chapters.filter((c) => c.status === 'draft').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to={`/dashboard/muistoissa/${elderId}`}
          className="text-cream/60 hover:text-cream text-sm flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Takaisin vanhuksen sivulle
        </Link>
        <h1 className="text-xl text-cream font-medium flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-gold" />
          {elderName ? `${elderName}n elämäntarinakirja` : 'Elämäntarinakirja'}
        </h1>
        <span />
      </div>

      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-cream/70">
            <span>
              <span className="text-cream font-medium">{totalWords.toLocaleString('fi-FI')}</span>{' '}
              sanaa
            </span>
            <span>
              <span className="text-cream font-medium">{completedChapters}</span>/15 lukua valmiina
            </span>
            <span>
              <span className="text-cream font-medium">{draftChapters}</span> luonnosta
            </span>
          </div>
        </CardContent>
      </Card>

      {unprocessedCalls.length > 0 && (
        <Card className="bg-amber-950/20 border-amber-800/50">
          <CardHeader>
            <CardTitle className="text-amber-200 text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Käsittelemättömät puhelut ({unprocessedCalls.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {unprocessedCalls.map((call) => (
              <div
                key={call.id}
                className="flex items-center justify-between gap-3 p-3 rounded-md bg-amber-950/30 border border-amber-800/30"
              >
                <div className="min-w-0">
                  <div className="text-sm text-amber-100">
                    {new Date(call.called_at).toLocaleDateString('fi-FI')}
                    <span className="text-amber-200/60"> · </span>
                    {Math.round(call.duration_seconds / 60)} min
                  </div>
                  <div className="text-xs text-amber-200/60 mt-0.5">
                    Transkripti {call.transcript_length.toLocaleString('fi-FI')} merkkiä
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => processCall(call.id)}
                  disabled={processing === call.id}
                  className="bg-amber-700 hover:bg-amber-600 text-amber-50 shrink-0"
                >
                  {processing === call.id ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                      Käsitellään…
                    </>
                  ) : (
                    'Käsittele kirjailijalla'
                  )}
                </Button>
              </div>
            ))}
            <p className="text-xs text-amber-200/50 leading-relaxed">
              Kirjailija-AI (Claude Haiku 4.5) analysoi puhelun ja päivittää kirjan luvut
              jäsennellyillä muistiinpanoilla. Tämä vie noin 10–20 sekuntia per puhelu.
            </p>
          </CardContent>
        </Card>
      )}

      {profile && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-cream text-base">Kirjailijan muistiinpanot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {profile.personality_notes && (
                <ProfileBlock label="Persoonallisuus" value={profile.personality_notes} />
              )}
              {profile.speaking_style && (
                <ProfileBlock label="Puhetyyli" value={profile.speaking_style} />
              )}
              {profile.key_themes && (
                <ProfileBlock label="Kantavat teemat" value={profile.key_themes} />
              )}
              {profile.recurring_people && (
                <ProfileBlock label="Toistuvat henkilöt" value={profile.recurring_people} />
              )}
              {profile.sensitive_areas_learned && (
                <ProfileBlock
                  label="Herkät alueet"
                  value={profile.sensitive_areas_learned}
                  fullWidth
                />
              )}
            </div>
            {!profile.personality_notes &&
              !profile.speaking_style &&
              !profile.key_themes &&
              !profile.recurring_people &&
              !profile.sensitive_areas_learned && (
                <p className="text-sm text-cream/50">
                  Kirjailija-AI täyttää nämä muistiinpanot kun puhelumateriaalia kertyy.
                </p>
              )}
            {profile.last_updated && (
              <p className="text-xs text-cream/40">
                Päivitetty {new Date(profile.last_updated).toLocaleDateString('fi-FI')}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-cream text-base">Luvut</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {chapters.map((chapter) => {
              const statusInfo = STATUS_LABELS[chapter.status];
              const isSelected = selectedChapter?.id === chapter.id;
              return (
                <button
                  key={chapter.id}
                  onClick={() => setSelectedChapter(chapter)}
                  className={`w-full text-left p-3 rounded-md border transition-colors ${
                    isSelected
                      ? 'bg-muted/30 border-gold/50'
                      : 'bg-muted/5 border-border hover:bg-muted/15'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-cream/50">Luku {chapter.chapter_number}</span>
                    <Badge variant="outline" className={`text-[10px] ${statusInfo.className}`}>
                      {statusInfo.label}
                    </Badge>
                  </div>
                  <div className="text-sm text-cream font-medium">{chapter.title}</div>
                  {chapter.word_count > 0 && (
                    <div className="text-xs text-cream/50 mt-1">{chapter.word_count} sanaa</div>
                  )}
                </button>
              );
            })}
            {chapters.length === 0 && (
              <p className="text-sm text-cream/50">
                Lukuja ei vielä ole. Aktivoi Muistoissa-tilaus ensin.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border min-h-[400px]">
          <CardContent className="pt-6">
            {!selectedChapter ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <BookOpen className="w-10 h-10 text-cream/30 mb-3" />
                <p className="text-cream/60">
                  Valitse luku vasemmalta nähdäksesi sen sisällön
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3 pb-4 border-b border-border/50">
                  <div>
                    <p className="text-xs text-cream/50 uppercase tracking-wide">
                      Luku {selectedChapter.chapter_number}
                    </p>
                    <h2 className="text-2xl text-cream font-medium mt-1">
                      {selectedChapter.title}
                    </h2>
                  </div>
                  <Badge
                    variant="outline"
                    className={STATUS_LABELS[selectedChapter.status].className}
                  >
                    {STATUS_LABELS[selectedChapter.status].label}
                  </Badge>
                </div>

                {selectedChapter.last_generated_at && (
                  <div className="flex items-center gap-2 text-xs text-cream/50">
                    <Clock className="w-3 h-3" />
                    <span>
                      Kirjailija päivitti{' '}
                      {new Date(selectedChapter.last_generated_at).toLocaleDateString('fi-FI')}
                    </span>
                  </div>
                )}

                {selectedChapter.content_markdown ? (
                  <div className="prose prose-invert max-w-none text-cream/90 leading-relaxed whitespace-pre-wrap">
                    {selectedChapter.content_markdown}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-cream/60 mb-2">Tämä luku on vielä tyhjä</p>
                    <p className="text-sm text-cream/40">
                      Kirjailija-AI aloittaa luvun kun aiheen puhelumateriaalia on riittävästi
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProfileBlock({
  label,
  value,
  fullWidth,
}: {
  label: string;
  value: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? 'md:col-span-2' : ''}>
      <p className="text-xs text-cream/50 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-cream/90 leading-relaxed">{value}</p>
    </div>
  );
}
