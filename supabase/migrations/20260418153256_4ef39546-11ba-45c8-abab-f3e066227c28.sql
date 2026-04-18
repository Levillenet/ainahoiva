-- Taulu 1: book_chapters
CREATE TABLE public.book_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  life_stage TEXT NOT NULL,
  title TEXT NOT NULL,
  content_markdown TEXT DEFAULT '',
  word_count INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  status TEXT DEFAULT 'draft' CHECK (status IN ('empty', 'draft', 'reviewed', 'final')),
  last_generated_at TIMESTAMPTZ,
  last_edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(elder_id, life_stage)
);

CREATE INDEX idx_book_chapters_elder ON public.book_chapters(elder_id, chapter_number);

ALTER TABLE public.book_chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view book chapters for their elders"
  ON public.book_chapters FOR SELECT
  USING (
    elder_id IN (SELECT id FROM public.elders WHERE created_by = auth.uid())
  );

CREATE POLICY "Users can manage book chapters for their elders"
  ON public.book_chapters FOR ALL
  USING (
    elder_id IN (SELECT id FROM public.elders WHERE created_by = auth.uid())
  );

-- Taulu 2: chapter_revisions
CREATE TABLE public.chapter_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES public.book_chapters(id) ON DELETE CASCADE,
  content_markdown TEXT NOT NULL,
  word_count INTEGER DEFAULT 0,
  ai_model_used TEXT,
  prompt_version TEXT,
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by_ai BOOLEAN DEFAULT true
);

CREATE INDEX idx_chapter_revisions_chapter ON public.chapter_revisions(chapter_id, created_at DESC);

ALTER TABLE public.chapter_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view revisions for their elders' chapters"
  ON public.chapter_revisions FOR SELECT
  USING (
    chapter_id IN (
      SELECT bc.id FROM public.book_chapters bc
      JOIN public.elders e ON e.id = bc.elder_id
      WHERE e.created_by = auth.uid()
    )
  );

-- Taulu 3: profile_summary
CREATE TABLE public.profile_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID NOT NULL UNIQUE REFERENCES public.elders(id) ON DELETE CASCADE,
  personality_notes TEXT DEFAULT '',
  speaking_style TEXT DEFAULT '',
  key_themes TEXT DEFAULT '',
  recurring_people TEXT DEFAULT '',
  sensitive_areas_learned TEXT DEFAULT '',
  last_updated TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profile_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view profile summary for their elders"
  ON public.profile_summary FOR SELECT
  USING (
    elder_id IN (SELECT id FROM public.elders WHERE created_by = auth.uid())
  );

CREATE POLICY "Users can manage profile summary for their elders"
  ON public.profile_summary FOR ALL
  USING (
    elder_id IN (SELECT id FROM public.elders WHERE created_by = auth.uid())
  );

-- Trigger-funktio: seedaa 15 lukua + profile_summary kun uusi legacy_subscription luodaan
CREATE OR REPLACE FUNCTION public.seed_book_chapters_for_elder()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chapters TEXT[][] := ARRAY[
    ARRAY['1', 'lapsuus', 'Lapsuus'],
    ARRAY['2', 'vanhemmat', 'Äiti ja isä'],
    ARRAY['3', 'sisarukset', 'Sisarukset'],
    ARRAY['4', 'koulu', 'Kouluvuodet'],
    ARRAY['5', 'nuoruus', 'Nuoruus'],
    ARRAY['6', 'kotoa_lahto', 'Kotoa lähtö'],
    ARRAY['7', 'tyo', 'Työelämä'],
    ARRAY['8', 'parisuhde', 'Rakkaus ja parisuhde'],
    ARRAY['9', 'lasten_synty', 'Lapset'],
    ARRAY['10', 'keski_ika', 'Keski-ikä'],
    ARRAY['11', 'harrastukset', 'Harrastukset ja mieltymykset'],
    ARRAY['12', 'matkat', 'Matkat ja seikkailut'],
    ARRAY['13', 'menetykset', 'Menetykset ja vaikeat ajat'],
    ARRAY['14', 'elakkeelle', 'Eläkkeelle jääminen'],
    ARRAY['15', 'arvot', 'Arvot ja elämänviisaudet']
  ];
  chapter TEXT[];
BEGIN
  FOREACH chapter SLICE 1 IN ARRAY chapters
  LOOP
    INSERT INTO public.book_chapters (elder_id, chapter_number, life_stage, title, status)
    VALUES (NEW.elder_id, chapter[1]::INTEGER, chapter[2], chapter[3], 'empty')
    ON CONFLICT (elder_id, life_stage) DO NOTHING;
  END LOOP;

  INSERT INTO public.profile_summary (elder_id)
  VALUES (NEW.elder_id)
  ON CONFLICT (elder_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER legacy_subscription_created_seeds_chapters
AFTER INSERT ON public.legacy_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.seed_book_chapters_for_elder();

-- Täydennys olemassa oleville tilauksille (Ritva ym.)
INSERT INTO public.book_chapters (elder_id, chapter_number, life_stage, title, status)
SELECT ls.elder_id, c.num, c.stage, c.label, 'empty'
FROM public.legacy_subscriptions ls
CROSS JOIN (VALUES
  (1, 'lapsuus', 'Lapsuus'),
  (2, 'vanhemmat', 'Äiti ja isä'),
  (3, 'sisarukset', 'Sisarukset'),
  (4, 'koulu', 'Kouluvuodet'),
  (5, 'nuoruus', 'Nuoruus'),
  (6, 'kotoa_lahto', 'Kotoa lähtö'),
  (7, 'tyo', 'Työelämä'),
  (8, 'parisuhde', 'Rakkaus ja parisuhde'),
  (9, 'lasten_synty', 'Lapset'),
  (10, 'keski_ika', 'Keski-ikä'),
  (11, 'harrastukset', 'Harrastukset ja mieltymykset'),
  (12, 'matkat', 'Matkat ja seikkailut'),
  (13, 'menetykset', 'Menetykset ja vaikeat ajat'),
  (14, 'elakkeelle', 'Eläkkeelle jääminen'),
  (15, 'arvot', 'Arvot ja elämänviisaudet')
) AS c(num, stage, label)
ON CONFLICT (elder_id, life_stage) DO NOTHING;

INSERT INTO public.profile_summary (elder_id)
SELECT elder_id FROM public.legacy_subscriptions
ON CONFLICT (elder_id) DO NOTHING;