ALTER TABLE public.elders 
ADD COLUMN IF NOT EXISTS cognitive_tracking_enabled boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS public.cognitive_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id uuid NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,
  call_report_id uuid REFERENCES public.call_reports(id),
  assessed_at timestamptz DEFAULT now(),
  orientation_score integer CHECK (orientation_score BETWEEN 0 AND 3),
  memory_score integer CHECK (memory_score BETWEEN 0 AND 3),
  fluency_score integer CHECK (fluency_score BETWEEN 0 AND 3),
  overall_impression text,
  observations text,
  flags text[],
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.cognitive_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view cognitive assessments of their elders"
ON public.cognitive_assessments FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.elders 
  WHERE elders.id = cognitive_assessments.elder_id 
  AND elders.created_by = auth.uid()
));

CREATE POLICY "Service role can manage cognitive assessments"
ON public.cognitive_assessments FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_cognitive_assessments_elder_id 
ON public.cognitive_assessments(elder_id, assessed_at DESC);