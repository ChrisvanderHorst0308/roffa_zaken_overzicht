/* ========== ORDERLI TAKE OVER - VOLLEDIGE SUPABASE SETUP ========== */
/* Plak dit HELE bestand in Supabase SQL Editor en klik Run */

/* ----- DEEL 1: TABELLEN ----- */
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'recruiter')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recruiter_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE(recruiter_id, project_id)
);

CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT,
  website TEXT,
  pos_system TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  pos_system TEXT NOT NULL,
  spoken_to TEXT NOT NULL,
  takeaway BOOLEAN DEFAULT false,
  delivery BOOLEAN DEFAULT false,
  takeaway_platforms TEXT,
  delivery_platforms TEXT,
  notes TEXT,
  status TEXT NOT NULL CHECK (status IN ('visited', 'interested', 'demo_planned', 'not_interested')),
  visit_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiter_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_visits_recruiter_id ON visits(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_visits_location_id ON visits(location_id);
CREATE INDEX IF NOT EXISTS idx_visits_project_id ON visits(project_id);
CREATE INDEX IF NOT EXISTS idx_visits_visit_date ON visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_recruiter_projects_recruiter_id ON recruiter_projects(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_recruiter_projects_project_id ON recruiter_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_locations_name_city ON locations(LOWER(name), LOWER(city));
CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_unique_name_city ON locations(LOWER(name), LOWER(city));

/* ----- DEEL 2: ADMIN_CHECK (voorkomt recursie) ----- */
CREATE TABLE IF NOT EXISTS public.admin_check (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.admin_check ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read for is_admin" ON public.admin_check;
CREATE POLICY "Allow read for is_admin" ON public.admin_check
  FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_check WHERE user_id = check_user_id);
$$;

/* ----- DEEL 3: TRIGGER VOOR NIEUWE USERS ----- */
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'recruiter'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

/* Sync bestaande admins naar admin_check */
INSERT INTO public.admin_check (user_id)
SELECT id FROM public.profiles WHERE role = 'admin'
ON CONFLICT (user_id) DO NOTHING;

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

/* ----- DEEL 4: RLS POLICIES (geen recursie) ----- */

DROP POLICY IF EXISTS "Recruiters can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile name" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can update all profiles" ON profiles FOR UPDATE USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Recruiters can view assigned projects" ON projects;
DROP POLICY IF EXISTS "Admins can view all projects" ON projects;
DROP POLICY IF EXISTS "Admins can insert projects" ON projects;
DROP POLICY IF EXISTS "Admins can update projects" ON projects;
DROP POLICY IF EXISTS "Admins can delete projects" ON projects;

CREATE POLICY "Recruiters can view assigned projects" ON projects FOR SELECT
  USING (EXISTS (SELECT 1 FROM recruiter_projects WHERE recruiter_id = auth.uid() AND project_id = projects.id));
CREATE POLICY "Admins can view all projects" ON projects FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can insert projects" ON projects FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update projects" ON projects FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete projects" ON projects FOR DELETE USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Recruiters can view own assignments" ON recruiter_projects;
DROP POLICY IF EXISTS "Admins can view all assignments" ON recruiter_projects;
DROP POLICY IF EXISTS "Admins can insert assignments" ON recruiter_projects;
DROP POLICY IF EXISTS "Admins can delete assignments" ON recruiter_projects;

CREATE POLICY "Recruiters can view own assignments" ON recruiter_projects FOR SELECT USING (recruiter_id = auth.uid());
CREATE POLICY "Admins can view all assignments" ON recruiter_projects FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can insert assignments" ON recruiter_projects FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete assignments" ON recruiter_projects FOR DELETE USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Everyone can view locations" ON locations;
DROP POLICY IF EXISTS "Users can insert locations" ON locations;
DROP POLICY IF EXISTS "Admins can update locations" ON locations;
DROP POLICY IF EXISTS "Admins can delete locations" ON locations;

CREATE POLICY "Everyone can view locations" ON locations FOR SELECT USING (true);
CREATE POLICY "Users can insert locations" ON locations FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND active = true));
CREATE POLICY "Admins can update locations" ON locations FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete locations" ON locations FOR DELETE USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Recruiters can view own visits" ON visits;
DROP POLICY IF EXISTS "Admins can view all visits" ON visits;
DROP POLICY IF EXISTS "Recruiters can insert own visits" ON visits;
DROP POLICY IF EXISTS "Admins can insert visits" ON visits;
DROP POLICY IF EXISTS "Recruiters can update own visits" ON visits;
DROP POLICY IF EXISTS "Admins can update all visits" ON visits;
DROP POLICY IF EXISTS "Admins can delete visits" ON visits;

CREATE POLICY "Recruiters can view own visits" ON visits FOR SELECT USING (recruiter_id = auth.uid());
CREATE POLICY "Admins can view all visits" ON visits FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Recruiters can insert own visits" ON visits FOR INSERT
  WITH CHECK (recruiter_id = auth.uid() AND EXISTS (SELECT 1 FROM recruiter_projects WHERE recruiter_id = auth.uid() AND project_id = visits.project_id));
CREATE POLICY "Admins can insert visits" ON visits FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Recruiters can update own visits" ON visits FOR UPDATE USING (recruiter_id = auth.uid()) WITH CHECK (recruiter_id = auth.uid());
CREATE POLICY "Admins can update all visits" ON visits FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete visits" ON visits FOR DELETE USING (public.is_admin(auth.uid()));

/* ----- KLAAR ----- */
