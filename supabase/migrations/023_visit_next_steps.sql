/* Vervolgstappen per visit (CRM) — JSON array van stappen met optionele datum/tijd voor agenda */
ALTER TABLE visits ADD COLUMN IF NOT EXISTS next_steps JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN visits.next_steps IS 'Array van { id, title, due_date, due_time, notes } voor vervolgacties';
