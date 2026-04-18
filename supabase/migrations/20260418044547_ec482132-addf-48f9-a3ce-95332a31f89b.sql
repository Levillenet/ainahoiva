-- Aina Muistoissa: subscription per elder
CREATE TABLE public.legacy_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id uuid REFERENCES public.elders(id) ON DELETE CASCADE NOT NULL UNIQUE,
  status text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended', 'completed')),
  started_at timestamptz DEFAULT now(),
  target_completion_date date,
  book_target_chapters int DEFAULT 15,
  weekly_call_count int DEFAULT 2,
  created_at timestamptz DEFAULT now()
);

-- Onboarding profile
CREATE TABLE public.legacy_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id uuid REFERENCES public.elders(id) ON DELETE CASCADE NOT NULL UNIQUE,
  birth_year int,
  birth_place text,
  dialect_region text,
  marital_status text,
  spouse_info jsonb,
  children_info jsonb,
  parents_info jsonb,
  profession text,
  hobbies text,
  sensitive_topics text,
  favorite_topics text,
  health_notes text,
  special_notes text,
  onboarding_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Life-stage coverage map
CREATE TABLE public.coverage_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id uuid REFERENCES public.elders(id) ON DELETE CASCADE NOT NULL,
  life_stage text NOT NULL,
  theme text,
  depth_score int DEFAULT 0 CHECK (depth_score BETWEEN 0 AND 100),
  status text DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'well_covered', 'declined')),
  priority int DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  is_sensitive boolean DEFAULT false,
  requires_trust_first boolean DEFAULT false,
  last_discussed timestamptz,
  questions_asked int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_coverage_map_elder ON public.coverage_map(elder_id);

-- Weekly highlights
CREATE TABLE public.legacy_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id uuid REFERENCES public.elders(id) ON DELETE CASCADE NOT NULL,
  week_start date NOT NULL,
  quote text NOT NULL,
  context text,
  target_chapter text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_legacy_highlights_elder ON public.legacy_highlights(elder_id, week_start DESC);

-- Observations for family
CREATE TABLE public.legacy_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id uuid REFERENCES public.elders(id) ON DELETE CASCADE NOT NULL,
  type text CHECK (type IN ('suggestion', 'milestone', 'sensitive_topic', 'boundary_respected')),
  title text NOT NULL,
  description text,
  read_by_family boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_legacy_observations_elder ON public.legacy_observations(elder_id, created_at DESC);

-- Topic requests from family
CREATE TABLE public.legacy_topic_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id uuid REFERENCES public.elders(id) ON DELETE CASCADE NOT NULL,
  requested_by uuid NOT NULL,
  topic text NOT NULL,
  note text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'addressed')),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_legacy_topic_requests_elder ON public.legacy_topic_requests(elder_id, created_at DESC);

-- Enable RLS on all new tables
ALTER TABLE public.legacy_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coverage_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_topic_requests ENABLE ROW LEVEL SECURITY;

-- Permissive policies matching existing pattern (authenticated users can do everything)
CREATE POLICY "Authenticated can view legacy_subscriptions" ON public.legacy_subscriptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert legacy_subscriptions" ON public.legacy_subscriptions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update legacy_subscriptions" ON public.legacy_subscriptions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete legacy_subscriptions" ON public.legacy_subscriptions FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated can view legacy_profile" ON public.legacy_profile FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert legacy_profile" ON public.legacy_profile FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update legacy_profile" ON public.legacy_profile FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete legacy_profile" ON public.legacy_profile FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated can view coverage_map" ON public.coverage_map FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert coverage_map" ON public.coverage_map FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update coverage_map" ON public.coverage_map FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete coverage_map" ON public.coverage_map FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated can view legacy_highlights" ON public.legacy_highlights FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert legacy_highlights" ON public.legacy_highlights FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update legacy_highlights" ON public.legacy_highlights FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete legacy_highlights" ON public.legacy_highlights FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated can view legacy_observations" ON public.legacy_observations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert legacy_observations" ON public.legacy_observations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update legacy_observations" ON public.legacy_observations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete legacy_observations" ON public.legacy_observations FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated can view legacy_topic_requests" ON public.legacy_topic_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert legacy_topic_requests" ON public.legacy_topic_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update legacy_topic_requests" ON public.legacy_topic_requests FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete legacy_topic_requests" ON public.legacy_topic_requests FOR DELETE TO authenticated USING (true);