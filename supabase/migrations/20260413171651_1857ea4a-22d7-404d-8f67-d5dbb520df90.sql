
ALTER TABLE public.call_reports
ADD COLUMN IF NOT EXISTS hume_joy float,
ADD COLUMN IF NOT EXISTS hume_sadness float,
ADD COLUMN IF NOT EXISTS hume_anxiety float,
ADD COLUMN IF NOT EXISTS hume_tiredness float,
ADD COLUMN IF NOT EXISTS hume_anger float,
ADD COLUMN IF NOT EXISTS hume_confusion float,
ADD COLUMN IF NOT EXISTS hume_raw jsonb,
ADD COLUMN IF NOT EXISTS audio_url text,
ADD COLUMN IF NOT EXISTS mood_source text DEFAULT 'gpt';
