ALTER TABLE call_reports
ADD COLUMN IF NOT EXISTS hume_top_emotions jsonb,
ADD COLUMN IF NOT EXISTS hume_all_emotions jsonb,
ADD COLUMN IF NOT EXISTS hume_wellbeing_score double precision,
ADD COLUMN IF NOT EXISTS hume_social_score double precision,
ADD COLUMN IF NOT EXISTS hume_distress_score double precision;