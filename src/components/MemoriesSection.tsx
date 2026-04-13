import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Brain, ChevronDown, ChevronRight, Plus, Trash2, Archive, Calendar, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const memoryTypeConfig: Record<string, { icon: string; label: string }> = {
  person: { icon: '👥', label: 'Henkilöt' },
  health: { icon: '🏥', label: 'Terveys' },
  event: { icon: '📅', label: 'Tapahtumat' },
  preference: { icon: '⭐', label: 'Mieltymykset' },
  family: { icon: '👨‍👩‍👧', label: 'Perhe' },
};

interface Memory {
  id: string;
  memory_type: string;
  content: string;
  updated_at: string;
  created_at: string;
}

interface CallReport {
  id: string;
  called_at: string;
  ai_summary: string | null;
  mood_score: number | null;
  medications_taken: boolean | null;
  ate_today: boolean | null;
  transcript: string | null;
  call_type: string | null;
}

interface Props {
  elderId: string;
  memories: Memory[];
  reports: CallReport[];
  onMemoriesChanged: () => void;
}

function getDayKey(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fi-FI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function getDayDate(dateStr: string): string {
  return new Date(dateStr).toISOString().split('T')[0];
}

function isWithinDays(dateStr: string, days: number): boolean {
  const date = new Date(dateStr);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  return date >= cutoff;
}

const moodEmoji = (s: number) => ['😢', '😟', '😐', '🙂', '😊'][s - 1] || '—';

export default function MemoriesSection({ elderId, memories, reports, onMemoriesChanged }: Props) {
  const { toast } = useToast();
  const [memoryDialogOpen, setMemoryDialogOpen] = useState(false);
  const [memoryForm, setMemoryForm] = useState({ memory_type: 'person', content: '' });
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [showArchive, setShowArchive] = useState(false);

  // Group memories by day
  const { recentDays, archiveDays, keySummary } = useMemo(() => {
    // Build key summary from all memories grouped by type
    const summaryByType: Record<string, string[]> = {};
    memories.forEach(m => {
      if (!summaryByType[m.memory_type]) summaryByType[m.memory_type] = [];
      summaryByType[m.memory_type].push(m.content);
    });

    // Group memories by day
    const dayMap: Record<string, { memories: Memory[]; reports: CallReport[]; dateKey: string }> = {};

    memories.forEach(m => {
      const dayDate = getDayDate(m.updated_at);
      if (!dayMap[dayDate]) dayMap[dayDate] = { memories: [], reports: [], dateKey: getDayKey(m.updated_at) };
      dayMap[dayDate].memories.push(m);
    });

    // Also group reports by day
    reports.forEach(r => {
      if (!r.called_at) return;
      const dayDate = getDayDate(r.called_at);
      if (!dayMap[dayDate]) dayMap[dayDate] = { memories: [], reports: [], dateKey: getDayKey(r.called_at) };
      dayMap[dayDate].reports.push(r);
    });

    const sortedDays = Object.entries(dayMap).sort(([a], [b]) => b.localeCompare(a));

    const recent = sortedDays.filter(([date]) => isWithinDays(date, 7));
    const archive = sortedDays.filter(([date]) => !isWithinDays(date, 7));

    return { recentDays: recent, archiveDays: archive, keySummary: summaryByType };
  }, [memories, reports]);

  const toggleDay = (dayDate: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayDate)) next.delete(dayDate);
      else next.add(dayDate);
      return next;
    });
  };

  const handleAddMemory = async () => {
    if (!memoryForm.content.trim()) return;
    const { error } = await supabase.from('elder_memory').insert({
      elder_id: elderId,
      memory_type: memoryForm.memory_type,
      content: memoryForm.content.trim(),
    });
    if (error) {
      toast({ title: 'Virhe', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Muisto lisätty!' });
      setMemoryDialogOpen(false);
      setMemoryForm({ memory_type: 'person', content: '' });
      onMemoriesChanged();
    }
  };

  const handleDeleteMemory = async (memoryId: string) => {
    const { error } = await supabase.from('elder_memory').delete().eq('id', memoryId);
    if (error) {
      toast({ title: 'Virhe', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Muisto poistettu' });
      onMemoriesChanged();
    }
  };

  const renderDayCallSummary = (dayReports: CallReport[]) => {
    if (dayReports.length === 0) return null;
    const answeredReports = dayReports.filter(r => r.ai_summary && r.ai_summary !== 'Soitto käynnistetty — odottaa vastausta' && r.ai_summary !== 'Ei vastattu puheluun');
    if (answeredReports.length === 0) return null;

    return (
      <div className="bg-background/50 rounded-lg p-3 mb-3 border border-border/50">
        <p className="text-xs font-semibold text-sage mb-2 flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Päivän puheluiden kooste
        </p>
        {answeredReports.map(r => (
          <div key={r.id} className="mb-2 last:mb-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <span>{new Date(r.called_at).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}</span>
              {r.mood_score && <span>{moodEmoji(r.mood_score)} {r.mood_score}/5</span>}
              {r.medications_taken !== null && <span>{r.medications_taken ? '💊✅' : '💊❌'}</span>}
              {r.ate_today !== null && <span>{r.ate_today ? '🍽️✅' : '🍽️❌'}</span>}
            </div>
            <p className="text-sm text-cream">{r.ai_summary}</p>
          </div>
        ))}
      </div>
    );
  };

  const renderDayBlock = (dayDate: string, data: { memories: Memory[]; reports: CallReport[]; dateKey: string }) => {
    const isOpen = expandedDays.has(dayDate);
    const memCount = data.memories.length;
    const reportCount = data.reports.filter(r => r.ai_summary && r.ai_summary !== 'Soitto käynnistetty — odottaa vastausta').length;

    return (
      <div key={dayDate} className="border border-border/50 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleDay(dayDate)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            {isOpen ? <ChevronDown className="w-4 h-4 text-sage" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            <Calendar className="w-4 h-4 text-gold" />
            <span className="text-cream text-sm font-medium capitalize">{data.dateKey}</span>
          </div>
          <div className="flex items-center gap-2">
            {reportCount > 0 && <span className="text-xs bg-sage/20 text-sage px-2 py-0.5 rounded-full">{reportCount} puhelu{reportCount > 1 ? 'a' : ''}</span>}
            {memCount > 0 && <span className="text-xs bg-gold/20 text-gold px-2 py-0.5 rounded-full">{memCount} muisto{memCount > 1 ? 'a' : ''}</span>}
          </div>
        </button>
        {isOpen && (
          <div className="px-4 pb-4 space-y-2">
            {renderDayCallSummary(data.reports)}
            {data.memories.map(m => (
              <div key={m.id} className="bg-muted rounded-lg p-3 flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span>{memoryTypeConfig[m.memory_type]?.icon || '📝'}</span>
                    <span className="text-xs text-muted-foreground">{memoryTypeConfig[m.memory_type]?.label || m.memory_type}</span>
                  </div>
                  <p className="text-cream text-sm">{m.content}</p>
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
          </div>
        )}
      </div>
    );
  };

  return (
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

      {/* Key Summary */}
      {Object.keys(keySummary).length > 0 && (
        <div className="bg-muted/50 rounded-lg p-4 mb-4 border border-border/50">
          <p className="text-sm font-semibold text-gold mb-2 flex items-center gap-1">
            <Sparkles className="w-4 h-4" /> Keskeiset tiedot
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(keySummary).map(([type, items]) => (
              <div key={type} className="flex items-start gap-2">
                <span className="shrink-0">{memoryTypeConfig[type]?.icon || '📝'}</span>
                <p className="text-xs text-cream">{items.slice(0, 3).join(' · ')}{items.length > 3 ? ` (+${items.length - 3})` : ''}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {memories.length === 0 && recentDays.length === 0 ? (
        <p className="text-muted-foreground text-center py-6">Ei muistoja vielä. Muistot kertyvät automaattisesti puheluista tai voit lisätä niitä manuaalisesti.</p>
      ) : (
        <div className="space-y-2">
          {/* Recent 7 days */}
          {recentDays.map(([dayDate, data]) => renderDayBlock(dayDate, data))}

          {/* Archive */}
          {archiveDays.length > 0 && (
            <Collapsible open={showArchive} onOpenChange={setShowArchive}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full text-muted-foreground hover:text-cream flex items-center gap-2 mt-2">
                  <Archive className="w-4 h-4" />
                  Arkisto ({archiveDays.length} päivää)
                  {showArchive ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 mt-2">
                {archiveDays.map(([dayDate, data]) => renderDayBlock(dayDate, data))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}
    </div>
  );
}
