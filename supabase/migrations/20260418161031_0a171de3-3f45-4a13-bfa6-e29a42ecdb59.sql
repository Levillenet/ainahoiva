-- Uusi taulu: chapter_notes (raakadata, jäsennelty)
CREATE TABLE public.chapter_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,
  life_stage TEXT NOT NULL,
  chapter_id UUID REFERENCES public.book_chapters(id) ON DELETE SET NULL,
  notes_markdown TEXT DEFAULT '',
  word_count INTEGER DEFAULT 0,
  last_updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(elder_id, life_stage)
);

CREATE INDEX idx_chapter_notes_elder ON public.chapter_notes(elder_id);

ALTER TABLE public.chapter_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view chapter_notes for their elders"
  ON public.chapter_notes FOR SELECT
  USING (
    elder_id IN (SELECT id FROM public.elders WHERE created_by = auth.uid())
  );

CREATE POLICY "Users can manage chapter_notes for their elders"
  ON public.chapter_notes FOR ALL
  USING (
    elder_id IN (SELECT id FROM public.elders WHERE created_by = auth.uid())
  );

-- Lisää book_chapters-tauluun uudet kentät
ALTER TABLE public.book_chapters
ADD COLUMN IF NOT EXISTS prose_generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS prose_source_notes_version INTEGER;

-- Siirrä olemassa olevat content_markdown-arvot chapter_notes-tauluun
INSERT INTO public.chapter_notes (elder_id, life_stage, chapter_id, notes_markdown, word_count, last_updated_at)
SELECT 
  elder_id, 
  life_stage, 
  id as chapter_id,
  content_markdown,
  word_count,
  COALESCE(last_generated_at, created_at)
FROM public.book_chapters
WHERE content_markdown LIKE '%FAKTOJA:%'
   OR content_markdown LIKE '%ANEKDOOTTEJA:%'
   OR content_markdown LIKE '%TUNNELMIA:%'
ON CONFLICT (elder_id, life_stage) DO NOTHING;

-- Tyhjennä content_markdown niiltä riveiltä jotka olivat muistiinpanoja
UPDATE public.book_chapters
SET content_markdown = '',
    word_count = 0,
    status = 'empty'
WHERE content_markdown LIKE '%FAKTOJA:%'
   OR content_markdown LIKE '%ANEKDOOTTEJA:%'
   OR content_markdown LIKE '%TUNNELMIA:%';

-- Varmista että jokaisella legacy_subscriptions-rivillä on 15 chapter_notes-riviä
INSERT INTO public.chapter_notes (elder_id, life_stage)
SELECT ls.elder_id, c.stage
FROM public.legacy_subscriptions ls
CROSS JOIN (VALUES
  ('lapsuus'), ('vanhemmat'), ('sisarukset'), ('koulu'), ('nuoruus'),
  ('kotoa_lahto'), ('tyo'), ('parisuhde'), ('lasten_synty'), ('keski_ika'),
  ('harrastukset'), ('matkat'), ('menetykset'), ('elakkeelle'), ('arvot')
) AS c(stage)
ON CONFLICT (elder_id, life_stage) DO NOTHING;

-- Päivitä seed_book_chapters_for_elder-funktio
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
  created_chapter_id UUID;
BEGIN
  FOREACH chapter SLICE 1 IN ARRAY chapters
  LOOP
    INSERT INTO public.book_chapters (elder_id, chapter_number, life_stage, title, status)
    VALUES (NEW.elder_id, chapter[1]::INTEGER, chapter[2], chapter[3], 'empty')
    ON CONFLICT (elder_id, life_stage) DO NOTHING
    RETURNING id INTO created_chapter_id;
    
    INSERT INTO public.chapter_notes (elder_id, life_stage, chapter_id)
    VALUES (NEW.elder_id, chapter[2], created_chapter_id)
    ON CONFLICT (elder_id, life_stage) DO UPDATE
    SET chapter_id = EXCLUDED.chapter_id
    WHERE public.chapter_notes.chapter_id IS NULL;
  END LOOP;
  
  INSERT INTO public.profile_summary (elder_id)
  VALUES (NEW.elder_id)
  ON CONFLICT (elder_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Linkkaa olemassa olevat chapter_notes-rivit oikeisiin book_chapters-rivehin
UPDATE public.chapter_notes cn
SET chapter_id = bc.id
FROM public.book_chapters bc
WHERE cn.chapter_id IS NULL
  AND cn.elder_id = bc.elder_id
  AND cn.life_stage = bc.life_stage;