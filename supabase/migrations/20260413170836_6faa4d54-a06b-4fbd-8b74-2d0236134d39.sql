
-- Missed call retries tracking
CREATE TABLE public.missed_call_retries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id uuid REFERENCES public.elders(id) ON DELETE CASCADE NOT NULL,
  attempt_number integer DEFAULT 1,
  next_retry_at timestamptz,
  max_attempts integer DEFAULT 3,
  retry_interval_minutes integer DEFAULT 5,
  is_resolved boolean DEFAULT false,
  alert_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.missed_call_retries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view retries for their elders" ON public.missed_call_retries
  FOR SELECT USING (EXISTS (SELECT 1 FROM elders WHERE elders.id = missed_call_retries.elder_id AND elders.created_by = auth.uid()));

CREATE POLICY "Users can create retries for their elders" ON public.missed_call_retries
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM elders WHERE elders.id = missed_call_retries.elder_id AND elders.created_by = auth.uid()));

CREATE POLICY "Users can update retries for their elders" ON public.missed_call_retries
  FOR UPDATE USING (EXISTS (SELECT 1 FROM elders WHERE elders.id = missed_call_retries.elder_id AND elders.created_by = auth.uid()));

CREATE POLICY "Users can delete retries for their elders" ON public.missed_call_retries
  FOR DELETE USING (EXISTS (SELECT 1 FROM elders WHERE elders.id = missed_call_retries.elder_id AND elders.created_by = auth.uid()));

-- Global retry settings
CREATE TABLE public.retry_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  max_attempts integer DEFAULT 3,
  retry_interval_minutes integer DEFAULT 5,
  alert_after_attempts integer DEFAULT 3,
  alert_method text DEFAULT 'both',
  weekend_calls boolean DEFAULT true,
  retry_enabled boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.retry_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view retry settings" ON public.retry_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can update retry settings" ON public.retry_settings
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert retry settings" ON public.retry_settings
  FOR INSERT TO authenticated WITH CHECK (true);

-- Insert default settings
INSERT INTO public.retry_settings (id) VALUES ('00000000-0000-0000-0000-000000000001');
