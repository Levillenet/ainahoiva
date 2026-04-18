import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, BookOpen, Clock, Sparkles, Loader2, PenLine, History, Wand2, ShieldCheck } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  calculateBookProgress,
  formatProgressDescription,
  BOOK_FORMATS,
  type BookFormat,
  type BookProgress,
} from '@/lib/bookProgress';

type ChapterStatus = 'empty' | 'draft' | 'reviewed' | 'final';

type Chapter = {
  id: string;
  chapter_number: number;
  life_stage: string;
  title: string;
  content_markdown: string;
  word_count: number;
  target_word_count: number;
  included_in_novella: boolean;
  status: ChapterStatus;
  last_generated_at: string | null;
  last_edited_at: string | null;
};

type CoverageRow = {
  life_stage: string;
  depth_score: number;
  status: string;
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

type Revision = {
  id: string;
  created_at: string;
  word_count: number | null;
  ai_model_used: string | null;
  change_reason: string | null;
  created_by_ai: boolean | null;
};

type ChapterNotes = {
  id: string;
  notes_markdown: string;
  word_count: number;
  last_updated_at: string;
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
  const [generating, setGenerating] = useState(false);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [chapterNotes, setChapterNotes] = useState<Record<string, ChapterNotes>>({});
  const [showNotes, setShowNotes] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [checking, setChecking] = useState(false);
  const [bookFormat, setBookFormat] = useState<BookFormat>('book');
  const [progress, setProgress] = useState<BookProgress | null>(null);
  const [consistencyIssues, setConsistencyIssues] = useState<Array<{
    severity: string;
    title: string;
    description: string;
    affected_chapters?: string[];
    suggested_action?: string;
  }>>([]);

  const loadAll = async () => {
    if (!elderId) return;
    setLoading(true);
    const [elderRes, chaptersRes, profileRes, callsRes, notesRes, coverageRes, subRes] = await Promise.all([
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
      supabase
        .from('chapter_notes')
        .select('*')
        .eq('elder_id', elderId),
      supabase
        .from('coverage_map')
        .select('life_stage, depth_score, status')
        .eq('elder_id', elderId),
      supabase
        .from('legacy_subscriptions')
        .select('book_format')
        .eq('elder_id', elderId)
        .maybeSingle(),
    ]);

    if (notesRes.data) {
      const notesByStage: Record<string, ChapterNotes> = {};
      for (const n of notesRes.data) {
        notesByStage[n.life_stage] = n as ChapterNotes;
      }
      setChapterNotes(notesByStage);
    }

    const format = ((subRes.data as { book_format?: string } | null)?.book_format as BookFormat) || 'book';
    setBookFormat(format);

    if (elderRes.data) setElderName(elderRes.data.full_name);
    let chaptersData: Chapter[] = [];
    if (chaptersRes.data) {
      chaptersData = chaptersRes.data as Chapter[];
      setChapters(chaptersData);
      setSelectedChapter((prev) => {
        if (prev) {
          const refreshed = chaptersData.find((c) => c.id === prev.id);
          if (refreshed) return refreshed;
        }
        const firstWithContent = chaptersData.find((c) => c.content_markdown?.trim().length > 0);
        return firstWithContent ?? chaptersData[0] ?? null;
      });
    }

    const coverageData = (coverageRes.data as CoverageRow[]) || [];
    const calculatedProgress = calculateBookProgress(
      chaptersData.map(c => ({
        life_stage: c.life_stage,
        word_count: c.word_count || 0,
        target_word_count: c.target_word_count || 3300,
        status: c.status,
        included_in_novella: c.included_in_novella || false,
      })),
      coverageData,
      format
    );
    setProgress(calculatedProgress);

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

  const loadAll = async () => {
    if (!elderId) return;
    setLoading(true);
    const [elderRes, chaptersRes, profileRes, callsRes, notesRes] = await Promise.all([
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
      supabase
        .from('chapter_notes')
        .select('*')
        .eq('elder_id', elderId),
    ]);

    if (notesRes.data) {
      const notesByStage: Record<string, ChapterNotes> = {};
      for (const n of notesRes.data) {
        notesByStage[n.life_stage] = n as ChapterNotes;
      }
      setChapterNotes(notesByStage);
    }

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

  useEffect(() => {
    if (!selectedChapter) {
      setRevisions([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('chapter_revisions')
        .select('id, created_at, word_count, ai_model_used, change_reason, created_by_ai')
        .eq('chapter_id', selectedChapter.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (data) setRevisions(data as Revision[]);
    })();
  }, [selectedChapter]);

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

  const generateProse = async () => {
    if (!selectedChapter) return;
    const confirmed = confirm(
      selectedChapter.content_markdown
        ? `Kirjoitetaanko luku "${selectedChapter.title}" uudelleen proosaksi? Nykyinen versio tallennetaan historiaan.`
        : `Kirjoitetaanko luku "${selectedChapter.title}" proosaksi?`,
    );
    if (!confirmed) return;

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('muistoissa-generate-chapter', {
        body: { chapter_id: selectedChapter.id },
      });
      if (error) throw error;
      const eur = (data.estimated_cost_usd * 0.92).toFixed(3);
      toast({
        title: 'Luku kirjoitettu',
        description: `${data.word_count} sanaa. Kustannus noin ${eur} €.`,
      });
      await loadAll();
    } catch (err) {
      toast({
        title: 'Proosan kirjoitus epäonnistui',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const compileFullBook = async () => {
    const confirmed = confirm(
      'Kirjoitetaanko koko kirja uudelleen yhdellä kerralla? Kaikkien lukujen proosa päivitetään yhtenäiseksi. Kesto noin 1–2 minuuttia. Vanhat versiot tallennetaan historiaan.',
    );
    if (!confirmed) return;

    setCompiling(true);
    try {
      const { data, error } = await supabase.functions.invoke('muistoissa-compile-full-book', {
        body: { elder_id: elderId },
      });
      if (error) throw error;
      const eur = (data.estimated_cost_usd * 0.92).toFixed(3);
      toast({
        title: 'Koko kirja kirjoitettu',
        description: `${data.chapters_written} lukua päivitettiin. Kustannus noin ${eur} €.`,
      });
      await loadAll();
    } catch (err) {
      toast({
        title: 'Kirjan uudelleenkirjoitus epäonnistui',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setCompiling(false);
    }
  };

  const checkConsistency = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('muistoissa-check-consistency', {
        body: { elder_id: elderId },
      });
      if (error) throw error;
      setConsistencyIssues(data.issues || []);
      toast({
        title: 'Tarkistus valmis',
        description:
          (data.issues?.length || 0) === 0
            ? 'Ei ristiriitoja löytynyt.'
            : `${data.issues.length} ${data.issues.length === 1 ? 'ongelma' : 'ongelmaa'} löydetty — katso alta.`,
      });
    } catch (err) {
      toast({
        title: 'Tarkistus epäonnistui',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setChecking(false);
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

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-cream text-base flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-gold" />
            Kirjailijan kokonaistoiminnot
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button
              size="sm"
              onClick={compileFullBook}
              disabled={compiling || checking}
              className="bg-gold/80 hover:bg-gold text-background"
            >
              {compiling ? (
                <>
                  <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                  Kirjoitetaan koko kirjaa…
                </>
              ) : (
                <>
                  <Wand2 className="w-3 h-3 mr-2" />
                  Kirjoita koko kirja uudelleen
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={checkConsistency}
              disabled={compiling || checking}
              className="border-border text-cream hover:bg-muted/30"
            >
              {checking ? (
                <>
                  <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                  Tarkistetaan…
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3 h-3 mr-2" />
                  Tarkista johdonmukaisuus
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-cream/50 leading-relaxed">
            <strong className="text-cream/70">Kirjoita koko kirja uudelleen</strong> generoi kaikki
            luvut Claude Opus 4.7:llä yhdellä kutsulla — tyyliyhtenäisyys on taattu.{' '}
            <strong className="text-cream/70">Tarkista johdonmukaisuus</strong> etsii ristiriitoja
            muistiinpanoista (Claude Sonnet 4.6, halvempi).
          </p>

          {consistencyIssues.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border space-y-2">
              <p className="text-sm text-cream font-medium">
                Löydetyt ongelmat ({consistencyIssues.length}):
              </p>
              {consistencyIssues.map((issue, i) => {
                const severityClass =
                  issue.severity === 'error'
                    ? 'border-red-800/50 bg-red-950/20'
                    : issue.severity === 'warning'
                      ? 'border-amber-800/50 bg-amber-950/20'
                      : 'border-blue-800/50 bg-blue-950/20';
                const severityBadge =
                  issue.severity === 'error'
                    ? 'bg-red-900/40 text-red-200'
                    : issue.severity === 'warning'
                      ? 'bg-amber-900/40 text-amber-200'
                      : 'bg-blue-900/40 text-blue-200';
                return (
                  <div key={i} className={`p-3 rounded-md border ${severityClass}`}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm text-cream font-medium">{issue.title}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded ${severityBadge}`}>
                        {issue.severity}
                      </span>
                    </div>
                    <p className="text-xs text-cream/70 whitespace-pre-line">
                      {issue.description}
                    </p>
                    {issue.affected_chapters && issue.affected_chapters.length > 0 && (
                      <p className="text-[10px] text-cream/50 mt-2">
                        Luvut: {issue.affected_chapters.join(', ')}
                      </p>
                    )}
                    {issue.suggested_action && (
                      <p className="text-[10px] text-cream/50 mt-1">
                        Ehdotus: {issue.suggested_action}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
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

                {(() => {
                  const notes = selectedChapter ? chapterNotes[selectedChapter.life_stage] : undefined;
                  const hasNotes = !!notes?.notes_markdown && notes.notes_markdown.length >= 100;
                  const hasProse = !!selectedChapter.content_markdown && selectedChapter.content_markdown.length > 100;

                  return (
                    <>
                      <div className="flex items-center gap-3 flex-wrap pb-2">
                        <Button
                          size="sm"
                          onClick={generateProse}
                          disabled={generating || !hasNotes}
                          className="bg-gold/80 hover:bg-gold text-background"
                        >
                          {generating ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                              Kirjoitetaan…
                            </>
                          ) : (
                            <>
                              <PenLine className="w-3 h-3 mr-2" />
                              {hasProse ? 'Kirjoita uudelleen proosaksi' : 'Kirjoita proosaksi'}
                            </>
                          )}
                        </Button>
                        {generating && (
                          <span className="text-xs text-cream/50">
                            Claude Sonnet 4.5 työstää (~30–60 s)
                          </span>
                        )}
                      </div>

                      {/* Välilehdet: Proosa / Muistiinpanot */}
                      <div className="flex items-center gap-2 mb-4 border-b border-border">
                        <button
                          onClick={() => setShowNotes(false)}
                          className={`px-3 py-2 text-sm transition-colors ${
                            !showNotes
                              ? 'text-gold border-b-2 border-gold -mb-[1px]'
                              : 'text-cream/50 hover:text-cream/80'
                          }`}
                        >
                          Proosa
                        </button>
                        <button
                          onClick={() => setShowNotes(true)}
                          className={`px-3 py-2 text-sm transition-colors ${
                            showNotes
                              ? 'text-gold border-b-2 border-gold -mb-[1px]'
                              : 'text-cream/50 hover:text-cream/80'
                          }`}
                        >
                          Muistiinpanot {notes ? `(${notes.word_count} sanaa)` : ''}
                        </button>
                      </div>

                      {showNotes ? (
                        notes?.notes_markdown ? (
                          <div className="bg-muted/5 p-4 rounded-md">
                            <pre className="text-sm text-cream/90 whitespace-pre-wrap font-mono leading-relaxed">
                              {notes.notes_markdown}
                            </pre>
                            <p className="text-xs text-cream/40 mt-4 pt-3 border-t border-border">
                              Muistiinpanot päivitetty{' '}
                              {new Date(notes.last_updated_at).toLocaleString('fi-FI')}
                            </p>
                          </div>
                        ) : (
                          <div className="py-12 text-center text-cream/40">
                            <p>Tästä aiheesta ei ole vielä muistiinpanoja.</p>
                            <p className="text-xs mt-2">
                              Muistiinpanot syntyvät kun vanhus kertoo tästä aiheesta puheluissa
                              ja puhelu käsitellään kirjailijalla.
                            </p>
                          </div>
                        )
                      ) : hasProse ? (
                        <div className="prose prose-invert max-w-none font-serif text-cream/90 leading-relaxed space-y-4">
                          {selectedChapter.content_markdown.split('\n\n').map((paragraph, i) => (
                            <p key={i}>{paragraph}</p>
                          ))}
                        </div>
                      ) : (
                        <div className="py-12 text-center text-cream/40">
                          <p>Tämä luku ei ole vielä kirjoitettu proosaksi.</p>
                          <p className="text-xs mt-2">
                            {hasNotes
                              ? 'Muistiinpanoja on olemassa — klikkaa "Kirjoita proosaksi" yllä.'
                              : 'Odottaa että aiheesta syntyy puhelumateriaalia.'}
                          </p>
                        </div>
                      )}
                    </>
                  );
                })()}

                {revisions.length > 0 && (
                  <details className="mt-6 pt-4 border-t border-border/50">
                    <summary className="text-sm text-cream/60 cursor-pointer flex items-center gap-2 hover:text-cream">
                      <History className="w-4 h-4" />
                      Versiohistoria ({revisions.length})
                    </summary>
                    <div className="space-y-2 mt-3">
                      {revisions.map((rev) => (
                        <div
                          key={rev.id}
                          className="text-xs p-3 rounded-md bg-muted/10 border border-border/50"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-cream/80">
                              {new Date(rev.created_at).toLocaleString('fi-FI')}
                            </span>
                            <span className="text-cream/50">
                              {rev.word_count ?? 0} sanaa · {rev.ai_model_used || 'ei AI'}
                            </span>
                          </div>
                          <p className="text-cream/60">{rev.change_reason || '—'}</p>
                        </div>
                      ))}
                    </div>
                  </details>
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
