/* ============================================
   ADD SECTION NOTES TO FLETCHER APK RUNS
   ============================================ */

-- Add section_notes column as JSONB to store notes per section
ALTER TABLE public.fletcher_apk_runs 
ADD COLUMN IF NOT EXISTS section_notes JSONB DEFAULT '{}'::jsonb;

-- Comment for documentation
COMMENT ON COLUMN public.fletcher_apk_runs.section_notes IS 'JSON object storing notes per checklist section, e.g. {"hardware": "Note text", "software": "Note text"}';
