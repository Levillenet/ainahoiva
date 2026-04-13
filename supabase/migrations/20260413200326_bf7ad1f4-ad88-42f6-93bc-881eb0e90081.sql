
-- Emergency settings per elder
CREATE TABLE public.emergency_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id uuid REFERENCES public.elders(id) ON DELETE CASCADE UNIQUE NOT NULL,
  alert_primary_phone text,
  alert_secondary_phone text,
  alert_email text,
  alert_method text DEFAULT 'both',
  followup_call_enabled boolean DEFAULT true,
  followup_delay_minutes integer DEFAULT 2,
  followup_max_attempts integer DEFAULT 3,
  detect_fall boolean DEFAULT true,
  detect_pain boolean DEFAULT true,
  detect_confusion boolean DEFAULT true,
  detect_loneliness boolean DEFAULT false,
  custom_keywords text,
  auto_end_call boolean DEFAULT true,
  speak_reassurance boolean DEFAULT true,
  reassurance_message text DEFAULT 'Lopettakaa puhelu ja odottakaa rauhassa — omainen soittaa Teille pian.',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.emergency_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view emergency settings of their elders"
  ON public.emergency_settings FOR SELECT
  USING (EXISTS (SELECT 1 FROM elders WHERE elders.id = emergency_settings.elder_id AND elders.created_by = auth.uid()));

CREATE POLICY "Users can create emergency settings for their elders"
  ON public.emergency_settings FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM elders WHERE elders.id = emergency_settings.elder_id AND elders.created_by = auth.uid()));

CREATE POLICY "Users can update emergency settings of their elders"
  ON public.emergency_settings FOR UPDATE
  USING (EXISTS (SELECT 1 FROM elders WHERE elders.id = emergency_settings.elder_id AND elders.created_by = auth.uid()));

CREATE POLICY "Users can delete emergency settings of their elders"
  ON public.emergency_settings FOR DELETE
  USING (EXISTS (SELECT 1 FROM elders WHERE elders.id = emergency_settings.elder_id AND elders.created_by = auth.uid()));

-- Emergency alerts log
CREATE TABLE public.emergency_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id uuid REFERENCES public.elders(id) ON DELETE CASCADE NOT NULL,
  alert_type text,
  alert_reason text,
  alert_time timestamptz DEFAULT now(),
  followup_call_at timestamptz,
  followup_attempt integer DEFAULT 0,
  followup_done boolean DEFAULT false,
  omainen_notified boolean DEFAULT false,
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by text,
  notes text
);

ALTER TABLE public.emergency_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view emergency alerts of their elders"
  ON public.emergency_alerts FOR SELECT
  USING (EXISTS (SELECT 1 FROM elders WHERE elders.id = emergency_alerts.elder_id AND elders.created_by = auth.uid()));

CREATE POLICY "Users can update emergency alerts of their elders"
  ON public.emergency_alerts FOR UPDATE
  USING (EXISTS (SELECT 1 FROM elders WHERE elders.id = emergency_alerts.elder_id AND elders.created_by = auth.uid()));

CREATE POLICY "Service role can insert emergency alerts"
  ON public.emergency_alerts FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update emergency alerts"
  ON public.emergency_alerts FOR UPDATE TO service_role
  USING (true);

-- Enable realtime for emergency alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_alerts;

-- Trigger for updated_at on emergency_settings
CREATE TRIGGER update_emergency_settings_updated_at
  BEFORE UPDATE ON public.emergency_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
