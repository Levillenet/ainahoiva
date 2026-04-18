CREATE INDEX IF NOT EXISTS idx_call_reports_elder_type 
ON public.call_reports(elder_id, call_type, called_at DESC);