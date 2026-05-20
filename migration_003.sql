-- migration_003.sql
-- SSF Portal Production Hardening
-- Preparing infrastructure for Global Search and Version History

-- 1. Global Search Helper View
-- This view consolidates multiple tables for easier keyword searching
CREATE OR REPLACE VIEW public.global_search_view AS
SELECT 
    'program' as type,
    id::text as record_id,
    program_name as title,
    category_id as detail,
    created_at
FROM public.programs 
WHERE deleted_at IS NULL
UNION ALL
SELECT 
    'fund' as type,
    id::text as record_id,
    donor_name as title,
    receipt_no as detail,
    created_at
FROM public.fund_receipts 
WHERE deleted_at IS NULL;

-- 2. Version Tracking Functionality
-- Automatically captures changes to programs before they are updated
CREATE OR REPLACE FUNCTION public.capture_program_version()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.result_versions (program_id, poster_url, uploaded_by, size_reduction)
    VALUES (OLD.id, OLD.poster_url, 'system', 'auto-backup');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- To enable:
-- CREATE TRIGGER trigger_program_version BEFORE UPDATE ON public.programs FOR EACH ROW EXECUTE FUNCTION public.capture_program_version();
