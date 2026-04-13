CREATE TABLE public.elder_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id uuid NOT NULL REFERENCES public.elders(id) ON DELETE CASCADE,
  memory_type text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.elder_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view memories of their elders"
ON public.elder_memory FOR SELECT
USING (EXISTS (SELECT 1 FROM elders WHERE elders.id = elder_memory.elder_id AND elders.created_by = auth.uid()));

CREATE POLICY "Users can create memories for their elders"
ON public.elder_memory FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM elders WHERE elders.id = elder_memory.elder_id AND elders.created_by = auth.uid()));

CREATE POLICY "Users can update memories of their elders"
ON public.elder_memory FOR UPDATE
USING (EXISTS (SELECT 1 FROM elders WHERE elders.id = elder_memory.elder_id AND elders.created_by = auth.uid()));

CREATE POLICY "Users can delete memories of their elders"
ON public.elder_memory FOR DELETE
USING (EXISTS (SELECT 1 FROM elders WHERE elders.id = elder_memory.elder_id AND elders.created_by = auth.uid()));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_elder_memory_updated_at
BEFORE UPDATE ON public.elder_memory
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();