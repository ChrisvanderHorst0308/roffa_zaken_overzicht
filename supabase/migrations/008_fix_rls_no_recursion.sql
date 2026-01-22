/* Fix RLS recursion: use separate admin_check table that never references profiles */

/* Create small table for admin check (no RLS = no recursion) */
CREATE TABLE IF NOT EXISTS public.admin_check (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.admin_check ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read for is_admin" ON public.admin_check;
CREATE POLICY "Allow read for is_admin" ON public.admin_check
  FOR SELECT USING (true);

/* Function reads admin_check, NOT profiles - no recursion */
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_check WHERE user_id = check_user_id);
$$;

/* Sync admin users from profiles into admin_check */
INSERT INTO public.admin_check (user_id)
SELECT id FROM public.profiles WHERE role = 'admin'
ON CONFLICT (user_id) DO NOTHING;

/* Trigger: keep admin_check in sync when profile role changes */
CREATE OR REPLACE FUNCTION public.sync_admin_check()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'admin' THEN
    INSERT INTO public.admin_check (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    DELETE FROM public.admin_check WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_admin_check_trigger ON public.profiles;
CREATE TRIGGER sync_admin_check_trigger
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_admin_check();

/* Fix profiles policies - use is_admin (reads admin_check, not profiles) */
DROP POLICY IF EXISTS "Recruiters can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile name" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (public.is_admin(auth.uid()));

/* Fix projects policies */
DROP POLICY IF EXISTS "Recruiters can view assigned projects" ON projects;
DROP POLICY IF EXISTS "Admins can view all projects" ON projects;
DROP POLICY IF EXISTS "Admins can insert projects" ON projects;
DROP POLICY IF EXISTS "Admins can update projects" ON projects;
DROP POLICY IF EXISTS "Admins can delete projects" ON projects;

CREATE POLICY "Recruiters can view assigned projects"
  ON projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recruiter_projects
      WHERE recruiter_id = auth.uid() AND project_id = projects.id
    )
  );

CREATE POLICY "Admins can view all projects"
  ON projects FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert projects"
  ON projects FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update projects"
  ON projects FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete projects"
  ON projects FOR DELETE
  USING (public.is_admin(auth.uid()));

/* Fix recruiter_projects */
DROP POLICY IF EXISTS "Recruiters can view own assignments" ON recruiter_projects;
DROP POLICY IF EXISTS "Admins can view all assignments" ON recruiter_projects;
DROP POLICY IF EXISTS "Admins can insert assignments" ON recruiter_projects;
DROP POLICY IF EXISTS "Admins can delete assignments" ON recruiter_projects;

CREATE POLICY "Recruiters can view own assignments"
  ON recruiter_projects FOR SELECT
  USING (recruiter_id = auth.uid());

CREATE POLICY "Admins can view all assignments"
  ON recruiter_projects FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert assignments"
  ON recruiter_projects FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete assignments"
  ON recruiter_projects FOR DELETE
  USING (public.is_admin(auth.uid()));

/* Fix locations */
DROP POLICY IF EXISTS "Admins can update locations" ON locations;
DROP POLICY IF EXISTS "Admins can delete locations" ON locations;

CREATE POLICY "Admins can update locations"
  ON locations FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete locations"
  ON locations FOR DELETE
  USING (public.is_admin(auth.uid()));

/* Fix visits */
DROP POLICY IF EXISTS "Recruiters can view own visits" ON visits;
DROP POLICY IF EXISTS "Admins can view all visits" ON visits;
DROP POLICY IF EXISTS "Recruiters can insert own visits" ON visits;
DROP POLICY IF EXISTS "Admins can insert visits" ON visits;
DROP POLICY IF EXISTS "Recruiters can update own visits" ON visits;
DROP POLICY IF EXISTS "Admins can update all visits" ON visits;
DROP POLICY IF EXISTS "Admins can delete visits" ON visits;

CREATE POLICY "Recruiters can view own visits"
  ON visits FOR SELECT
  USING (recruiter_id = auth.uid());

CREATE POLICY "Admins can view all visits"
  ON visits FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Recruiters can insert own visits"
  ON visits FOR INSERT
  WITH CHECK (
    recruiter_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM recruiter_projects
      WHERE recruiter_id = auth.uid() AND project_id = visits.project_id
    )
  );

CREATE POLICY "Admins can insert visits"
  ON visits FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Recruiters can update own visits"
  ON visits FOR UPDATE
  USING (recruiter_id = auth.uid())
  WITH CHECK (recruiter_id = auth.uid());

CREATE POLICY "Admins can update all visits"
  ON visits FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete visits"
  ON visits FOR DELETE
  USING (public.is_admin(auth.uid()));
