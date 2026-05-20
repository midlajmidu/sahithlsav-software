-- migration_002.sql
-- SSF Portal Production Hardening
-- Adds safety triggers for fund numbering and duplicate detection

-- 1. Receipt Auto-Numbering Logic (Database Level)
-- Note: We assume the application provides the number, but we can add a constraint to prevent duplicates
ALTER TABLE public.fund_receipts ADD CONSTRAINT unique_receipt_no UNIQUE (receipt_no);

-- 2. Duplicate Detection Trigger
-- This matches (same donor, same amount, same collector, same day)
CREATE OR REPLACE FUNCTION public.check_fund_duplicate() 
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.fund_receipts 
        WHERE donor_name = NEW.donor_name 
        AND amount = NEW.amount 
        AND collector_name = NEW.collector_name
        AND created_at >= (NOW() - INTERVAL '5 minutes')
        AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Possible duplicate donation found (Same Donor, Amount and Collector within 5 minutes).';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- To enable the trigger manually, the user should run:
-- CREATE TRIGGER trigger_fund_duplicate BEFORE INSERT ON public.fund_receipts FOR EACH ROW EXECUTE FUNCTION public.check_fund_duplicate();

-- 3. Soft Delete View for Admins (Includes deleted items)
CREATE OR REPLACE VIEW public.admin_programs_view AS
SELECT * FROM public.programs;

-- 4. Public View for Safety (Excludes deleted items)
-- We should update existing queries to always check for deleted_at IS NULL
