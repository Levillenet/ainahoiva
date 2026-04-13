
-- Drop overly permissive policies
DROP POLICY "Authenticated users can update retry settings" ON public.retry_settings;
DROP POLICY "Authenticated users can insert retry settings" ON public.retry_settings;

-- More restrictive: only allow updating the existing default row
CREATE POLICY "Authenticated users can update retry settings" ON public.retry_settings
  FOR UPDATE TO authenticated USING (id = '00000000-0000-0000-0000-000000000001'::uuid);
