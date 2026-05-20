-- migration_001.sql
-- SSF Portal Production Hardening
-- Adds soft-delete supported columns and activity logging infrastructure

-- 1. Programs Table Enhancements
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Fund Receipts Table Enhancements
ALTER TABLE public.fund_receipts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 3. Activity Logs Table (Improved)
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    action TEXT NOT NULL,           -- login, logout, upload, delete, restore
    module TEXT NOT NULL,           -- results, funds, auth
    user_email TEXT,
    affected_record_id TEXT,
    meta JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- Enable RLS on Activity Logs
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only authenticated admins can read/write logs
CREATE POLICY "Admins manage activity logs" 
ON public.activity_logs FOR ALL 
TO authenticated 
USING (true);

-- 4. Result Version History Table
CREATE TABLE IF NOT EXISTS public.result_versions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    program_id UUID REFERENCES public.programs(id),
    poster_url TEXT,
    uploaded_by TEXT,
    size_reduction TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on Versions
ALTER TABLE public.result_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage result versions" 
ON public.result_versions FOR ALL 
TO authenticated 
USING (true);
