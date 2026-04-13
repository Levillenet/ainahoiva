-- Enable realtime for call_reports table
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_reports;

-- Add INSERT policy for sms_log so edge functions with service role can write
-- (service role bypasses RLS, but let's also allow authenticated users to insert)
CREATE POLICY "Service can insert sms_log"
ON public.sms_log
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM elders WHERE elders.id = sms_log.elder_id AND elders.created_by = auth.uid()
));