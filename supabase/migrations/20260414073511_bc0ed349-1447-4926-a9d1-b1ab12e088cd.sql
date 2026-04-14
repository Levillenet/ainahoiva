ALTER TABLE public.medication_logs
ADD CONSTRAINT medication_logs_elder_med_time_date_unique
UNIQUE (elder_id, medication_id, scheduled_time, log_date);