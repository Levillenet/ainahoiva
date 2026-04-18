ALTER TABLE public.call_reports 
DROP CONSTRAINT IF EXISTS call_reports_call_type_check;

ALTER TABLE public.call_reports
ADD CONSTRAINT call_reports_call_type_check
CHECK (call_type IS NULL OR call_type IN (
  'basic', 'reminder', 'emergency', 'muistoissa', 'scheduled', 
  'test_chat', 'inbound', 'outbound_scheduled', 'outbound'
));