-- Päivitä legacy_observations-taulun CHECK-constraint sallimaan uusi tyyppi
ALTER TABLE public.legacy_observations 
DROP CONSTRAINT IF EXISTS legacy_observations_type_check;

ALTER TABLE public.legacy_observations 
ADD CONSTRAINT legacy_observations_type_check 
CHECK (type IN ('suggestion', 'milestone', 'sensitive_topic', 'boundary_respected', 'consistency_issue'));