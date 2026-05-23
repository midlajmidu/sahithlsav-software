-- MIGRATION: ENABLE PUBLIC WEBSITE TRACKING
-- This allows anonymous visitors to log page views in the activity_logs table.

-- 1. Grant INSERT permission to the 'anon' role for activity_logs
-- This allows the tracker script to save the visit.
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- 2. Create policy to allow anybody to INSERT (publicly)
-- Note: They cannot READ, UPDATE or DELETE. Only INSERT.
CREATE POLICY "Allow public visit logging" 
ON public.activity_logs
FOR INSERT 
TO anon 
WITH CHECK (action = 'visit');

-- 3. Ensure authenticated users (Admins) can still do everything
CREATE POLICY "Allow admins full access" 
ON public.activity_logs
FOR ALL 
TO authenticated 
USING (true);
