-- Add book_format to legacy_subscriptions
ALTER TABLE public.legacy_subscriptions
ADD COLUMN IF NOT EXISTS book_format TEXT DEFAULT 'book' 
CHECK (book_format IN ('book', 'novella'));

-- Add target_word_count and included_in_novella to book_chapters
ALTER TABLE public.book_chapters
ADD COLUMN IF NOT EXISTS target_word_count INTEGER DEFAULT 3300;

ALTER TABLE public.book_chapters
ADD COLUMN IF NOT EXISTS included_in_novella BOOLEAN DEFAULT false;

-- Update existing chapters with weighted targets and novella inclusion
UPDATE public.book_chapters SET 
  target_word_count = CASE life_stage
    WHEN 'lapsuus' THEN 4000
    WHEN 'vanhemmat' THEN 4000
    WHEN 'sisarukset' THEN 2700
    WHEN 'koulu' THEN 3300
    WHEN 'nuoruus' THEN 5000
    WHEN 'kotoa_lahto' THEN 2700
    WHEN 'tyo' THEN 5000
    WHEN 'parisuhde' THEN 4300
    WHEN 'lasten_synty' THEN 3300
    WHEN 'keski_ika' THEN 2700
    WHEN 'harrastukset' THEN 3000
    WHEN 'matkat' THEN 2300
    WHEN 'menetykset' THEN 2700
    WHEN 'elakkeelle' THEN 2000
    WHEN 'arvot' THEN 2700
    ELSE 3300
  END,
  included_in_novella = life_stage IN (
    'lapsuus', 'vanhemmat', 'nuoruus', 'kotoa_lahto', 
    'tyo', 'parisuhde', 'lasten_synty', 'arvot'
  );

-- Update seed function to include new fields
CREATE OR REPLACE FUNCTION public.seed_book_chapters_for_elder()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chapters_data RECORD;
  created_chapter_id UUID;
BEGIN
  FOR chapters_data IN 
    SELECT * FROM (VALUES
      (1, 'lapsuus', 'Lapsuus', 4000, true),
      (2, 'vanhemmat', 'Äiti ja isä', 4000, true),
      (3, 'sisarukset', 'Sisarukset', 2700, false),
      (4, 'koulu', 'Kouluvuodet', 3300, false),
      (5, 'nuoruus', 'Nuoruus', 5000, true),
      (6, 'kotoa_lahto', 'Kotoa lähtö', 2700, true),
      (7, 'tyo', 'Työelämä', 5000, true),
      (8, 'parisuhde', 'Rakkaus ja parisuhde', 4300, true),
      (9, 'lasten_synty', 'Lapset', 3300, true),
      (10, 'keski_ika', 'Keski-ikä', 2700, false),
      (11, 'harrastukset', 'Harrastukset ja mieltymykset', 3000, false),
      (12, 'matkat', 'Matkat ja seikkailut', 2300, false),
      (13, 'menetykset', 'Menetykset ja vaikeat ajat', 2700, false),
      (14, 'elakkeelle', 'Eläkkeelle jääminen', 2000, false),
      (15, 'arvot', 'Arvot ja elämänviisaudet', 2700, true)
    ) AS t(num, stage, title, target, in_novella)
  LOOP
    INSERT INTO public.book_chapters (
      elder_id, chapter_number, life_stage, title, 
      target_word_count, included_in_novella, status
    )
    VALUES (
      NEW.elder_id, chapters_data.num, chapters_data.stage, chapters_data.title, 
      chapters_data.target, chapters_data.in_novella, 'empty'
    )
    ON CONFLICT (elder_id, life_stage) DO NOTHING
    RETURNING id INTO created_chapter_id;
    
    INSERT INTO public.chapter_notes (elder_id, life_stage, chapter_id)
    VALUES (NEW.elder_id, chapters_data.stage, created_chapter_id)
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