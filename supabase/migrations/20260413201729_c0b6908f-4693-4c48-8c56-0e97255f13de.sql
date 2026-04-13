
-- Drop old restrictive policies and replace with open authenticated access

-- ELDERS
DROP POLICY IF EXISTS "Users can view their own elders" ON public.elders;
DROP POLICY IF EXISTS "Users can create elders" ON public.elders;
DROP POLICY IF EXISTS "Users can update their own elders" ON public.elders;
DROP POLICY IF EXISTS "Users can delete their own elders" ON public.elders;

CREATE POLICY "Authenticated users can view all elders" ON public.elders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create elders" ON public.elders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update elders" ON public.elders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete elders" ON public.elders FOR DELETE TO authenticated USING (true);

-- CALL_REPORTS
DROP POLICY IF EXISTS "Users can view call reports of their elders" ON public.call_reports;
DROP POLICY IF EXISTS "Users can create call reports for their elders" ON public.call_reports;
DROP POLICY IF EXISTS "Users can update call reports of their elders" ON public.call_reports;

CREATE POLICY "Authenticated users can view all call reports" ON public.call_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create call reports" ON public.call_reports FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update call reports" ON public.call_reports FOR UPDATE TO authenticated USING (true);

-- MEDICATIONS
DROP POLICY IF EXISTS "Users can view medications of their elders" ON public.medications;
DROP POLICY IF EXISTS "Users can create medications for their elders" ON public.medications;
DROP POLICY IF EXISTS "Users can update medications of their elders" ON public.medications;
DROP POLICY IF EXISTS "Users can delete medications of their elders" ON public.medications;

CREATE POLICY "Authenticated users can view all medications" ON public.medications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create medications" ON public.medications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update medications" ON public.medications FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete medications" ON public.medications FOR DELETE TO authenticated USING (true);

-- FAMILY_MEMBERS
DROP POLICY IF EXISTS "Users can view family members of their elders" ON public.family_members;
DROP POLICY IF EXISTS "Users can create family members for their elders" ON public.family_members;
DROP POLICY IF EXISTS "Users can update family members of their elders" ON public.family_members;
DROP POLICY IF EXISTS "Users can delete family members of their elders" ON public.family_members;

CREATE POLICY "Authenticated users can view all family members" ON public.family_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create family members" ON public.family_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update family members" ON public.family_members FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete family members" ON public.family_members FOR DELETE TO authenticated USING (true);

-- ELDER_MEMORY
DROP POLICY IF EXISTS "Users can view memories of their elders" ON public.elder_memory;
DROP POLICY IF EXISTS "Users can create memories for their elders" ON public.elder_memory;
DROP POLICY IF EXISTS "Users can update memories of their elders" ON public.elder_memory;
DROP POLICY IF EXISTS "Users can delete memories of their elders" ON public.elder_memory;

CREATE POLICY "Authenticated users can view all memories" ON public.elder_memory FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create memories" ON public.elder_memory FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update memories" ON public.elder_memory FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete memories" ON public.elder_memory FOR DELETE TO authenticated USING (true);

-- REMINDERS
DROP POLICY IF EXISTS "Users can view reminders of their elders" ON public.reminders;
DROP POLICY IF EXISTS "Users can create reminders for their elders" ON public.reminders;
DROP POLICY IF EXISTS "Users can update reminders of their elders" ON public.reminders;
DROP POLICY IF EXISTS "Users can delete reminders of their elders" ON public.reminders;

CREATE POLICY "Authenticated users can view all reminders" ON public.reminders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create reminders" ON public.reminders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update reminders" ON public.reminders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete reminders" ON public.reminders FOR DELETE TO authenticated USING (true);

-- EMERGENCY_ALERTS
DROP POLICY IF EXISTS "Users can view emergency alerts of their elders" ON public.emergency_alerts;
DROP POLICY IF EXISTS "Users can update emergency alerts of their elders" ON public.emergency_alerts;

CREATE POLICY "Authenticated users can view all emergency alerts" ON public.emergency_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update emergency alerts" ON public.emergency_alerts FOR UPDATE TO authenticated USING (true);

-- EMERGENCY_SETTINGS
DROP POLICY IF EXISTS "Users can view emergency settings of their elders" ON public.emergency_settings;
DROP POLICY IF EXISTS "Users can create emergency settings for their elders" ON public.emergency_settings;
DROP POLICY IF EXISTS "Users can update emergency settings of their elders" ON public.emergency_settings;
DROP POLICY IF EXISTS "Users can delete emergency settings of their elders" ON public.emergency_settings;

CREATE POLICY "Authenticated users can view all emergency settings" ON public.emergency_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create emergency settings" ON public.emergency_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update emergency settings" ON public.emergency_settings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete emergency settings" ON public.emergency_settings FOR DELETE TO authenticated USING (true);

-- MISSED_CALL_RETRIES
DROP POLICY IF EXISTS "Users can view retries for their elders" ON public.missed_call_retries;
DROP POLICY IF EXISTS "Users can create retries for their elders" ON public.missed_call_retries;
DROP POLICY IF EXISTS "Users can update retries for their elders" ON public.missed_call_retries;
DROP POLICY IF EXISTS "Users can delete retries for their elders" ON public.missed_call_retries;

CREATE POLICY "Authenticated users can view all retries" ON public.missed_call_retries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create retries" ON public.missed_call_retries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update retries" ON public.missed_call_retries FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete retries" ON public.missed_call_retries FOR DELETE TO authenticated USING (true);

-- SMS_LOG
DROP POLICY IF EXISTS "Users can view sms logs of their elders" ON public.sms_log;
DROP POLICY IF EXISTS "Service can insert sms_log" ON public.sms_log;

CREATE POLICY "Authenticated users can view all sms logs" ON public.sms_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert sms logs" ON public.sms_log FOR INSERT TO authenticated WITH CHECK (true);
