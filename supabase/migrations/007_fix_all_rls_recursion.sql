/* Complete fix for infinite recursion in all RLS policies */

/* First, create the is_admin function if it doesn't exist */
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'admin'
  );
$$;

/* Fix profiles policies */
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

/* Fix recruiter_projects policies */
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

/* Fix locations policies */
DROP POLICY IF EXISTS "Admins can update locations" ON locations;
DROP POLICY IF EXISTS "Admins can delete locations" ON locations;

CREATE POLICY "Admins can update locations"
  ON locations FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete locations"
  ON locations FOR DELETE
  USING (public.is_admin(auth.uid()));

/* Fix visits policies */
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
