ALTER TABLE public.call_reports 
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_call_reports_unprocessed 
ON public.call_reports(elder_id, called_at DESC) 
WHERE processed_at IS NULL AND call_type = 'muistoissa';