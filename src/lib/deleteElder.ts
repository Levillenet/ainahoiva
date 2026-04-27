import { supabase } from '@/integrations/supabase/client';

// Tables that reference elder_id directly. Order matters only for FK-like
// relations; here there are no FKs but we delete dependent rows first.
const ELDER_TABLES = [
  'medication_logs',
  'cognitive_assessments',
  'chapter_revisions', // via book_chapters policy
  'book_chapters',
  'chapter_notes',
  'coverage_map',
  'legacy_highlights',
  'legacy_observations',
  'legacy_topic_requests',
  'legacy_profile',
  'legacy_subscriptions',
  'profile_summary',
  'medications',
  'reminders',
  'sms_log',
  'emergency_alerts',
  'emergency_settings',
  'family_members',
  'missed_call_retries',
  'elder_memory',
  'call_reports',
] as const;

export async function deleteElderCascade(
  elderId: string
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  // chapter_revisions has no elder_id — delete by chapter_id first
  const { data: chapters } = await supabase
    .from('book_chapters')
    .select('id')
    .eq('elder_id', elderId);
  const chapterIds = (chapters || []).map((c) => c.id);
  if (chapterIds.length > 0) {
    const { error } = await supabase
      .from('chapter_revisions')
      .delete()
      .in('chapter_id', chapterIds);
    if (error) errors.push(`chapter_revisions: ${error.message}`);
  }

  for (const table of ELDER_TABLES) {
    if (table === 'chapter_revisions') continue; // already handled
    const { error } = await supabase
      .from(table as any)
      .delete()
      .eq('elder_id', elderId);
    if (error) errors.push(`${table}: ${error.message}`);
  }

  const { error: elderErr } = await supabase
    .from('elders')
    .delete()
    .eq('id', elderId);
  if (elderErr) {
    errors.push(`elders: ${elderErr.message}`);
    return { success: false, errors };
  }

  return { success: true, errors };
}