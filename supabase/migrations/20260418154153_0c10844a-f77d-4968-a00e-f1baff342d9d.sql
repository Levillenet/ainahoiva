-- Nightly batch log table
CREATE TABLE public.nightly_batch_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at TIMESTAMPTZ DEFAULT now(),
  calls_processed INTEGER DEFAULT 0,
  calls_failed INTEGER DEFAULT 0,
  chapters_generated INTEGER DEFAULT 0,
  chapters_failed INTEGER DEFAULT 0,
  total_tokens_in INTEGER DEFAULT 0,
  total_tokens_out INTEGER DEFAULT 0,
  estimated_cost_usd NUMERIC(10, 4) DEFAULT 0,
  duration_ms INTEGER,
  errors TEXT[]
);

CREATE INDEX idx_nightly_batch_log_ran_at ON public.nightly_batch_log(ran_at DESC);

ALTER TABLE public.nightly_batch_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view batch log"
  ON public.nightly_batch_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert batch log"
  ON public.nightly_batch_log FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Enable pg_cron and pg_net
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule nightly batch at 23:00 UTC (02:00 Helsinki winter, 01:00 Helsinki summer)
SELECT cron.schedule(
  'muistoissa-nightly-batch',
  '0 23 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bjsthjvpotfcxgqxtoiy.supabase.co/functions/v1/muistoissa-nightly-batch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);