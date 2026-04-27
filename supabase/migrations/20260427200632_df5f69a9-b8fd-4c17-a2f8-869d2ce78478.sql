CREATE POLICY "Authenticated users can delete call reports"
  ON public.call_reports FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete sms logs"
  ON public.sms_log FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete cognitive assessments"
  ON public.cognitive_assessments FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete emergency alerts"
  ON public.emergency_alerts FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete chapter revisions"
  ON public.chapter_revisions FOR DELETE TO authenticated
  USING (chapter_id IN (SELECT id FROM public.book_chapters));