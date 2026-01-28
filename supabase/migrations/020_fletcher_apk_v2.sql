/* 
  Fletcher APK Checklist v2 - Complete rewrite
  This replaces the previous fletcher_apk_checks table with a proper run-based system
*/

/* Drop old table if exists */
DROP TABLE IF EXISTS public.fletcher_apk_checks CASCADE;

/* ============================================
   FLETCHER APK RUNS - Main table for APK sessions
   ============================================ */
CREATE TABLE IF NOT EXISTS public.fletcher_apk_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  
  /* Open questions */
  open_q1_knelpunten TEXT,
  open_q2_meerwaarde TEXT,
  
  /* Errors section */
  errors TEXT,
  
  /* Meeting notes */
  meeting_notes TEXT,
  
  /* Timestamps */
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

/* ============================================
   FLETCHER APK CHECKLIST ITEMS - Individual check items
   ============================================ */
CREATE TABLE IF NOT EXISTS public.fletcher_apk_check_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.fletcher_apk_runs(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  section TEXT NOT NULL,
  label TEXT NOT NULL,
  checked BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  /* Unique constraint per run */
  UNIQUE(run_id, item_key)
);

/* ============================================
   FLETCHER APK TODOS - Action items
   ============================================ */
CREATE TABLE IF NOT EXISTS public.fletcher_apk_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.fletcher_apk_runs(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  done BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

/* ============================================
   RLS POLICIES
   ============================================ */

/* Enable RLS */
ALTER TABLE public.fletcher_apk_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fletcher_apk_check_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fletcher_apk_todos ENABLE ROW LEVEL SECURITY;

/* Fletcher APK Runs policies */
DROP POLICY IF EXISTS "Admins can view all fletcher runs" ON public.fletcher_apk_runs;
CREATE POLICY "Admins can view all fletcher runs"
  ON public.fletcher_apk_runs FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert fletcher runs" ON public.fletcher_apk_runs;
CREATE POLICY "Admins can insert fletcher runs"
  ON public.fletcher_apk_runs FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update fletcher runs" ON public.fletcher_apk_runs;
CREATE POLICY "Admins can update fletcher runs"
  ON public.fletcher_apk_runs FOR UPDATE
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete fletcher runs" ON public.fletcher_apk_runs;
CREATE POLICY "Admins can delete fletcher runs"
  ON public.fletcher_apk_runs FOR DELETE
  USING (public.is_admin(auth.uid()));

/* Fletcher APK Check Items policies */
DROP POLICY IF EXISTS "Admins can view all fletcher check items" ON public.fletcher_apk_check_items;
CREATE POLICY "Admins can view all fletcher check items"
  ON public.fletcher_apk_check_items FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert fletcher check items" ON public.fletcher_apk_check_items;
CREATE POLICY "Admins can insert fletcher check items"
  ON public.fletcher_apk_check_items FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update fletcher check items" ON public.fletcher_apk_check_items;
CREATE POLICY "Admins can update fletcher check items"
  ON public.fletcher_apk_check_items FOR UPDATE
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete fletcher check items" ON public.fletcher_apk_check_items;
CREATE POLICY "Admins can delete fletcher check items"
  ON public.fletcher_apk_check_items FOR DELETE
  USING (public.is_admin(auth.uid()));

/* Fletcher APK Todos policies */
DROP POLICY IF EXISTS "Admins can view all fletcher todos" ON public.fletcher_apk_todos;
CREATE POLICY "Admins can view all fletcher todos"
  ON public.fletcher_apk_todos FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert fletcher todos" ON public.fletcher_apk_todos;
CREATE POLICY "Admins can insert fletcher todos"
  ON public.fletcher_apk_todos FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update fletcher todos" ON public.fletcher_apk_todos;
CREATE POLICY "Admins can update fletcher todos"
  ON public.fletcher_apk_todos FOR UPDATE
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete fletcher todos" ON public.fletcher_apk_todos;
CREATE POLICY "Admins can delete fletcher todos"
  ON public.fletcher_apk_todos FOR DELETE
  USING (public.is_admin(auth.uid()));

/* ============================================
   INDEXES
   ============================================ */
CREATE INDEX IF NOT EXISTS idx_fletcher_apk_runs_location ON public.fletcher_apk_runs(location_id);
CREATE INDEX IF NOT EXISTS idx_fletcher_apk_runs_created_by ON public.fletcher_apk_runs(created_by);
CREATE INDEX IF NOT EXISTS idx_fletcher_apk_runs_created_at ON public.fletcher_apk_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fletcher_apk_check_items_run ON public.fletcher_apk_check_items(run_id);
CREATE INDEX IF NOT EXISTS idx_fletcher_apk_todos_run ON public.fletcher_apk_todos(run_id);

/* ============================================
   TRIGGERS
   ============================================ */
CREATE OR REPLACE FUNCTION update_fletcher_apk_runs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_fletcher_apk_runs_updated_at ON public.fletcher_apk_runs;
CREATE TRIGGER trigger_update_fletcher_apk_runs_updated_at
  BEFORE UPDATE ON public.fletcher_apk_runs
  FOR EACH ROW EXECUTE FUNCTION update_fletcher_apk_runs_updated_at();

CREATE OR REPLACE FUNCTION update_fletcher_apk_check_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_fletcher_apk_check_items_updated_at ON public.fletcher_apk_check_items;
CREATE TRIGGER trigger_update_fletcher_apk_check_items_updated_at
  BEFORE UPDATE ON public.fletcher_apk_check_items
  FOR EACH ROW EXECUTE FUNCTION update_fletcher_apk_check_items_updated_at();

CREATE OR REPLACE FUNCTION update_fletcher_apk_todos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_fletcher_apk_todos_updated_at ON public.fletcher_apk_todos;
CREATE TRIGGER trigger_update_fletcher_apk_todos_updated_at
  BEFORE UPDATE ON public.fletcher_apk_todos
  FOR EACH ROW EXECUTE FUNCTION update_fletcher_apk_todos_updated_at();
