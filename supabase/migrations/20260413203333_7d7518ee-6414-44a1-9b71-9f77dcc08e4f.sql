-- Medication daily log
CREATE TABLE public.medication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id uuid NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,
  medication_id uuid NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  medication_name text NOT NULL,
  scheduled_time text NOT NULL,
  taken boolean DEFAULT false,
  not_taken boolean DEFAULT false,
  confirmed_by text DEFAULT 'aina',
  log_date date DEFAULT current_date,
  taken_at timestamptz,
  notes text,
  call_report_id uuid REFERENCES public.call_reports(id)
);

-- Unique: one entry per medication per time per day
CREATE UNIQUE INDEX medication_logs_unique 
ON public.medication_logs(elder_id, medication_id, scheduled_time, log_date);

-- Enable RLS
ALTER TABLE public.medication_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view medication logs"
ON public.medication_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create medication logs"
ON public.medication_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update medication logs"
ON public.medication_logs FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete medication logs"
ON public.medication_logs FOR DELETE TO authenticated USING (true);

CREATE POLICY "Service role can manage medication logs"
ON public.medication_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Add dosette field to medications
ALTER TABLE public.medications ADD COLUMN IF NOT EXISTS has_dosette boolean DEFAULT false;