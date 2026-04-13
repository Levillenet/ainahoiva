
-- Create elders table
CREATE TABLE public.elders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  full_name text NOT NULL,
  phone_number text UNIQUE NOT NULL,
  date_of_birth date,
  address text,
  call_time_morning time DEFAULT '08:00',
  call_time_evening time DEFAULT '19:00',
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.elders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own elders" ON public.elders FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "Users can create elders" ON public.elders FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update their own elders" ON public.elders FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Users can delete their own elders" ON public.elders FOR DELETE USING (auth.uid() = created_by);

-- Create medications table
CREATE TABLE public.medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id uuid REFERENCES public.elders(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  dosage text,
  times_per_day integer DEFAULT 1,
  morning boolean DEFAULT false,
  noon boolean DEFAULT false,
  evening boolean DEFAULT false,
  instructions text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view medications of their elders" ON public.medications FOR SELECT USING (EXISTS (SELECT 1 FROM public.elders WHERE elders.id = medications.elder_id AND elders.created_by = auth.uid()));
CREATE POLICY "Users can create medications for their elders" ON public.medications FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.elders WHERE elders.id = medications.elder_id AND elders.created_by = auth.uid()));
CREATE POLICY "Users can update medications of their elders" ON public.medications FOR UPDATE USING (EXISTS (SELECT 1 FROM public.elders WHERE elders.id = medications.elder_id AND elders.created_by = auth.uid()));
CREATE POLICY "Users can delete medications of their elders" ON public.medications FOR DELETE USING (EXISTS (SELECT 1 FROM public.elders WHERE elders.id = medications.elder_id AND elders.created_by = auth.uid()));

-- Create call_reports table
CREATE TABLE public.call_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id uuid REFERENCES public.elders(id) ON DELETE CASCADE NOT NULL,
  called_at timestamptz DEFAULT now(),
  duration_seconds integer,
  mood_score integer CHECK (mood_score BETWEEN 1 AND 5),
  medications_taken boolean,
  ate_today boolean,
  transcript text,
  ai_summary text,
  alert_sent boolean DEFAULT false,
  alert_reason text,
  call_type text DEFAULT 'scheduled'
);

ALTER TABLE public.call_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view call reports of their elders" ON public.call_reports FOR SELECT USING (EXISTS (SELECT 1 FROM public.elders WHERE elders.id = call_reports.elder_id AND elders.created_by = auth.uid()));
CREATE POLICY "Users can create call reports for their elders" ON public.call_reports FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.elders WHERE elders.id = call_reports.elder_id AND elders.created_by = auth.uid()));

-- Create reminders table
CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id uuid REFERENCES public.elders(id) ON DELETE CASCADE NOT NULL,
  message text NOT NULL,
  remind_at timestamptz NOT NULL,
  method text DEFAULT 'sms',
  is_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view reminders of their elders" ON public.reminders FOR SELECT USING (EXISTS (SELECT 1 FROM public.elders WHERE elders.id = reminders.elder_id AND elders.created_by = auth.uid()));
CREATE POLICY "Users can create reminders for their elders" ON public.reminders FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.elders WHERE elders.id = reminders.elder_id AND elders.created_by = auth.uid()));
CREATE POLICY "Users can update reminders of their elders" ON public.reminders FOR UPDATE USING (EXISTS (SELECT 1 FROM public.elders WHERE elders.id = reminders.elder_id AND elders.created_by = auth.uid()));
CREATE POLICY "Users can delete reminders of their elders" ON public.reminders FOR DELETE USING (EXISTS (SELECT 1 FROM public.elders WHERE elders.id = reminders.elder_id AND elders.created_by = auth.uid()));

-- Create sms_log table
CREATE TABLE public.sms_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id uuid REFERENCES public.elders(id),
  to_number text,
  message text,
  type text,
  sent_at timestamptz DEFAULT now()
);

ALTER TABLE public.sms_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view sms logs of their elders" ON public.sms_log FOR SELECT USING (EXISTS (SELECT 1 FROM public.elders WHERE elders.id = sms_log.elder_id AND elders.created_by = auth.uid()));

-- Create family_members table
CREATE TABLE public.family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id uuid REFERENCES public.elders(id) ON DELETE CASCADE NOT NULL,
  full_name text NOT NULL,
  phone_number text NOT NULL,
  email text,
  relationship text,
  receives_daily_report boolean DEFAULT true,
  receives_alerts boolean DEFAULT true
);

ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view family members of their elders" ON public.family_members FOR SELECT USING (EXISTS (SELECT 1 FROM public.elders WHERE elders.id = family_members.elder_id AND elders.created_by = auth.uid()));
CREATE POLICY "Users can create family members for their elders" ON public.family_members FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.elders WHERE elders.id = family_members.elder_id AND elders.created_by = auth.uid()));
CREATE POLICY "Users can update family members of their elders" ON public.family_members FOR UPDATE USING (EXISTS (SELECT 1 FROM public.elders WHERE elders.id = family_members.elder_id AND elders.created_by = auth.uid()));
CREATE POLICY "Users can delete family members of their elders" ON public.family_members FOR DELETE USING (EXISTS (SELECT 1 FROM public.elders WHERE elders.id = family_members.elder_id AND elders.created_by = auth.uid()));
