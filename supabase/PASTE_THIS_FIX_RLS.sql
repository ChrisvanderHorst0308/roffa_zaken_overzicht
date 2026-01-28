/* 
  PASTE THIS IN SUPABASE SQL EDITOR
  This fixes RLS to ensure recruiters can ONLY see their assigned projects
*/

/* Update the profiles table to allow all roles */
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'recruiter', 'reichskanzlier', 'fletcher_admin'));

/* Update is_admin function to include all admin roles */
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_check WHERE user_id = check_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = check_user_id AND role IN ('admin', 'reichskanzlier', 'fletcher_admin')
  );
$$;

/* Sync existing admin users to admin_check */
INSERT INTO public.admin_check (user_id)
SELECT id FROM public.profiles WHERE role IN ('admin', 'reichskanzlier', 'fletcher_admin')
ON CONFLICT (user_id) DO NOTHING;

/* Update trigger to sync all admin roles */
CREATE OR REPLACE FUNCTION public.sync_admin_check()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IN ('admin', 'reichskanzlier', 'fletcher_admin') THEN
    INSERT INTO public.admin_check (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    DELETE FROM public.admin_check WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

/* Ensure trigger exists */
DROP TRIGGER IF EXISTS sync_admin_check_trigger ON public.profiles;
CREATE TRIGGER sync_admin_check_trigger
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_admin_check();

/* Drop and recreate project policies */
DROP POLICY IF EXISTS "Recruiters can view assigned projects" ON projects;
DROP POLICY IF EXISTS "Admins can view all projects" ON projects;

/* Recruiters can ONLY view projects they are assigned to */
CREATE POLICY "Recruiters can view assigned projects"
  ON projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recruiter_projects
      WHERE recruiter_id = auth.uid() AND project_id = projects.id
    )
  );

/* Admins and Reichskanzlier can view all projects */
CREATE POLICY "Admins can view all projects"
  ON projects FOR SELECT
  USING (public.is_admin(auth.uid()));

/* Ensure visits policy is correct */
DROP POLICY IF EXISTS "Recruiters can view own visits" ON visits;
DROP POLICY IF EXISTS "Recruiters can view project visits" ON visits;
DROP POLICY IF EXISTS "Admins can view all visits" ON visits;

/* Recruiters can see ALL visits for projects they are assigned to */
CREATE POLICY "Recruiters can view project visits"
  ON visits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recruiter_projects
      WHERE recruiter_id = auth.uid() AND project_id = visits.project_id
    )
  );

/* Admins and Reichskanzlier can view all visits */
CREATE POLICY "Admins can view all visits"
  ON visits FOR SELECT
  USING (public.is_admin(auth.uid()));

/* Also allow reichskanzlier to view all profiles */
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (public.is_admin(auth.uid()));

/* Add new visit statuses: potential and already_client */
ALTER TABLE visits DROP CONSTRAINT IF EXISTS visits_status_check;
ALTER TABLE visits ADD CONSTRAINT visits_status_check 
  CHECK (status IN ('visited', 'interested', 'demo_planned', 'not_interested', 'potential', 'already_client'));

/* ============================================
   FLETCHER APK V2 - Complete Checklist System
   ============================================ */

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

/* Add errors column if table already exists */
ALTER TABLE public.fletcher_apk_runs ADD COLUMN IF NOT EXISTS errors TEXT;

/* ============================================
   FLETCHER APK ERRORS - Individual error entries
   ============================================ */
CREATE TABLE IF NOT EXISTS public.fletcher_apk_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.fletcher_apk_runs(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

/* RLS for errors */
ALTER TABLE public.fletcher_apk_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fletcher_apk_errors_admin_all" ON public.fletcher_apk_errors;
CREATE POLICY "fletcher_apk_errors_admin_all" ON public.fletcher_apk_errors
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'fletcher_admin')
    )
  );

/* Index for errors */
CREATE INDEX IF NOT EXISTS idx_fletcher_apk_errors_run_id ON public.fletcher_apk_errors(run_id);

/* Trigger for errors updated_at */
DROP TRIGGER IF EXISTS update_fletcher_apk_errors_updated_at ON public.fletcher_apk_errors;
CREATE TRIGGER update_fletcher_apk_errors_updated_at
  BEFORE UPDATE ON public.fletcher_apk_errors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

/* ============================================
   FLETCHER APK CHECKLIST ITEMS
   ============================================ */
CREATE TABLE IF NOT EXISTS public.fletcher_apk_check_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.fletcher_apk_runs(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  section TEXT NOT NULL,
  label TEXT NOT NULL,
  checked BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(run_id, item_key)
);

/* ============================================
   FLETCHER APK TODOS
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

/* ============================================
   VERIFICATION
   ============================================ */

/* Verify: show current policies */
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('projects', 'visits', 'profiles', 'fletcher_apk_runs', 'fletcher_apk_check_items', 'fletcher_apk_todos')
ORDER BY tablename, policyname;
