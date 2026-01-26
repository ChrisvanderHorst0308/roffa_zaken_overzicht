/* 
  PASTE THIS IN SUPABASE SQL EDITOR
  This fixes RLS to ensure recruiters can ONLY see their assigned projects
*/

/* Update the profiles table to allow reichskanzlier role */
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'recruiter', 'reichskanzlier'));

/* Update is_admin function to also include reichskanzlier */
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
    WHERE id = check_user_id AND role IN ('admin', 'reichskanzlier')
  );
$$;

/* Sync existing admin/reichskanzlier users to admin_check */
INSERT INTO public.admin_check (user_id)
SELECT id FROM public.profiles WHERE role IN ('admin', 'reichskanzlier')
ON CONFLICT (user_id) DO NOTHING;

/* Update trigger to also sync reichskanzlier */
CREATE OR REPLACE FUNCTION public.sync_admin_check()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IN ('admin', 'reichskanzlier') THEN
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

/* Verify: show current policies */
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('projects', 'visits', 'profiles')
ORDER BY tablename, policyname;
