
ALTER TABLE public.call_reports ADD COLUMN vapi_call_id text;

CREATE INDEX idx_call_reports_vapi_call_id ON public.call_reports (vapi_call_id);

CREATE POLICY "Users can update call reports of their elders"
ON public.call_reports
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM elders
  WHERE elders.id = call_reports.elder_id AND elders.created_by = auth.uid()
));

CREATE POLICY "Service role can update call reports"
ON public.call_reports
FOR UPDATE
TO service_role
USING (true);

CREATE POLICY "Service role can insert call reports"
ON public.call_reports
FOR INSERT
TO service_role
WITH CHECK (true);
