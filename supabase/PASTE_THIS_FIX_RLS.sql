/* 
  PASTE THIS IN SUPABASE SQL EDITOR
  This fixes RLS to ensure recruiters can ONLY see their assigned projects
*/

/* ============================================
   HELPER FUNCTIONS
   ============================================ */

/* Function to auto-update updated_at timestamp */
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

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
  note TEXT DEFAULT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(run_id, item_key)
);

/* Add note column if it doesn't exist (for existing installations) */
ALTER TABLE public.fletcher_apk_check_items ADD COLUMN IF NOT EXISTS note TEXT DEFAULT NULL;

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
   FLETCHER LOCATIONS - Pre-populate with coordinates
   ============================================ */

INSERT INTO public.locations (name, city, latitude, longitude) VALUES
  ('Fletcher Wellness-Hotel Helmond', 'Helmond', 51.4756, 5.6553),
  ('Fletcher Wellness-Hotel Sittard', 'Sittard', 50.9983, 5.8697),
  ('Fletcher Hotel Veerse Meer', 'Arnemuiden', 51.5000, 3.6833),
  ('Fletcher Kloosterhotel Willibrordhaeghe', 'Deurne', 51.4617, 5.7933),
  ('Fletcher Boutique Hotel Duinoord', 'Wassenaar', 52.1450, 4.3700),
  ('Fletcher Hotel-Restaurant Teugel Uden-Veghel', 'Uden', 51.6617, 5.6200),
  ('Fletcher Hotel-Restaurant Wings-Rotterdam', 'Rotterdam', 51.9533, 4.4400),
  ('Fletcher Hotel-Restaurant De Wageningsche Berg', 'Wageningen', 51.9700, 5.6650),
  ('Fletcher Strandhotel Haamstede', 'Burgh-Haamstede', 51.6967, 3.7417),
  ('Fletcher Hotel-Restaurant Frerikshof', 'Winterswijk', 51.9717, 6.7200),
  ('Fletcher Landgoed Hotel Avegoor', 'Ellecom', 52.0350, 6.0917),
  ('Fletcher Hotel-Restaurant Doorwerth', 'Doorwerth', 51.9783, 5.7917),
  ('Fletcher Arion', 'Vlissingen', 51.4417, 3.5750),
  ('Fletcher Hotel-Paleis Stadhouderlijk Hof', 'Leeuwarden', 53.2017, 5.7950),
  ('Fletcher Nautisch Kwartier', 'Huizen', 52.2983, 5.2450),
  ('Fletcher Hotel-Restaurant Jagershorst-Eindhoven', 'Leende', 51.3550, 5.5567),
  ('Fletcher Hotel-Restaurant Arnsberg-Sauerland', 'Arnsberg', 51.3967, 8.0633),
  ('Fletcher Boutique Hotel Slaak-Rotterdam', 'Rotterdam', 51.9267, 4.4900),
  ('Fletcher Parkhotel Val Monte', 'Berg en Dal', 51.8267, 5.9200),
  ('Fletcher Scheveningen', 'Scheveningen', 52.1083, 4.2700),
  ('Fletcher Hotel-Restaurant ByZoo Emmen', 'Emmen', 52.7833, 6.9000),
  ('Fletcher Loosdrecht', 'Loosdrecht', 52.2050, 5.0717),
  ('Fletcher Hotel-Restaurant Amersfoort', 'Amersfoort', 52.1550, 5.3867),
  ('Fletcher Zutphen', 'Zutphen', 52.1383, 6.2000),
  ('Fletcher Hotel-Restaurant Oss', 'Oss', 51.7650, 5.5183),
  ('Fletcher Hotel-Restaurant ''s-Hertogenbosch', '''s-Hertogenbosch', 51.6900, 5.3033),
  ('Fletcher NEXT Vlissingen', 'Vlissingen', 51.4433, 3.5717),
  ('Fletcher Hotel-Restaurant De Oude Gevangenis-Alkmaar', 'Alkmaar', 52.6317, 4.7533),
  ('Fletcher Hotel-Restaurant Marknesse', 'Marknesse', 52.7117, 5.8583),
  ('Fletcher Wellness-Hotel Leiden', 'Leiden', 52.1600, 4.4900),
  ('Fletcher Hotel-Restaurant Sparrenhorst-Veluwe', 'Nunspeet', 52.3683, 5.7850),
  ('Fletcher Badhotel Callantsoog', 'Callantsoog', 52.8400, 4.6967),
  ('Fletcher Zuiderduin Beachhotel', 'Egmond aan Zee', 52.6233, 4.6267),
  ('Fletcher Hotel-Restaurant Duinzicht', 'Ouddorp', 51.8217, 3.9283),
  ('Fletcher Hotel-Restaurant De Mallejan', 'Vierhouten', 52.3367, 5.8167),
  ('Laguna Huizen Fletcher hotel', 'Huizen', 52.3000, 5.2383),
  ('Fletcher Hotel-Restaurant De Eese-Giethoorn', 'Giethoorn', 52.7233, 6.0783),
  ('Beachclub Zuiderduin', 'Egmond aan Zee', 52.6217, 4.6250),
  ('Fletcher Hotel Amsterdam', 'Amsterdam', 52.3667, 4.9000),
  ('Fletcher hoofdkantoor test kassa', 'Nieuwegein', 52.0283, 5.0833),
  ('Fletcher Hotel-Restaurant Jan van Scorel', 'Schoorl', 52.7017, 4.6750)
ON CONFLICT DO NOTHING;

/* Update existing Fletcher locations with coordinates */
UPDATE public.locations SET latitude = 51.4756, longitude = 5.6553 WHERE name = 'Fletcher Wellness-Hotel Helmond' AND latitude IS NULL;
UPDATE public.locations SET latitude = 50.9983, longitude = 5.8697 WHERE name = 'Fletcher Wellness-Hotel Sittard' AND latitude IS NULL;
UPDATE public.locations SET latitude = 51.5000, longitude = 3.6833 WHERE name = 'Fletcher Hotel Veerse Meer' AND latitude IS NULL;
UPDATE public.locations SET latitude = 51.4617, longitude = 5.7933 WHERE name = 'Fletcher Kloosterhotel Willibrordhaeghe' AND latitude IS NULL;
UPDATE public.locations SET latitude = 52.1450, longitude = 4.3700 WHERE name = 'Fletcher Boutique Hotel Duinoord' AND latitude IS NULL;
UPDATE public.locations SET latitude = 51.6617, longitude = 5.6200 WHERE name = 'Fletcher Hotel-Restaurant Teugel Uden-Veghel' AND latitude IS NULL;
UPDATE public.locations SET latitude = 51.9533, longitude = 4.4400 WHERE name = 'Fletcher Hotel-Restaurant Wings-Rotterdam' AND latitude IS NULL;
UPDATE public.locations SET latitude = 51.9700, longitude = 5.6650 WHERE name = 'Fletcher Hotel-Restaurant De Wageningsche Berg' AND latitude IS NULL;
UPDATE public.locations SET latitude = 51.6967, longitude = 3.7417 WHERE name = 'Fletcher Strandhotel Haamstede' AND latitude IS NULL;
UPDATE public.locations SET latitude = 51.9717, longitude = 6.7200 WHERE name = 'Fletcher Hotel-Restaurant Frerikshof' AND latitude IS NULL;
UPDATE public.locations SET latitude = 52.0350, longitude = 6.0917 WHERE name = 'Fletcher Landgoed Hotel Avegoor' AND latitude IS NULL;
UPDATE public.locations SET latitude = 51.9783, longitude = 5.7917 WHERE name = 'Fletcher Hotel-Restaurant Doorwerth' AND latitude IS NULL;
UPDATE public.locations SET latitude = 51.4417, longitude = 3.5750 WHERE name = 'Fletcher Arion' AND latitude IS NULL;
UPDATE public.locations SET latitude = 53.2017, longitude = 5.7950 WHERE name = 'Fletcher Hotel-Paleis Stadhouderlijk Hof' AND latitude IS NULL;
UPDATE public.locations SET latitude = 52.2983, longitude = 5.2450 WHERE name = 'Fletcher Nautisch Kwartier' AND latitude IS NULL;
UPDATE public.locations SET latitude = 51.3550, longitude = 5.5567 WHERE name = 'Fletcher Hotel-Restaurant Jagershorst-Eindhoven' AND latitude IS NULL;
UPDATE public.locations SET latitude = 51.3967, longitude = 8.0633 WHERE name = 'Fletcher Hotel-Restaurant Arnsberg-Sauerland' AND latitude IS NULL;
UPDATE public.locations SET latitude = 51.9267, longitude = 4.4900 WHERE name = 'Fletcher Boutique Hotel Slaak-Rotterdam' AND latitude IS NULL;
UPDATE public.locations SET latitude = 51.8267, longitude = 5.9200 WHERE name = 'Fletcher Parkhotel Val Monte' AND latitude IS NULL;
UPDATE public.locations SET latitude = 52.1083, longitude = 4.2700 WHERE name = 'Fletcher Scheveningen' AND latitude IS NULL;
UPDATE public.locations SET latitude = 52.7833, longitude = 6.9000 WHERE name = 'Fletcher Hotel-Restaurant ByZoo Emmen' AND latitude IS NULL;
UPDATE public.locations SET latitude = 52.2050, longitude = 5.0717 WHERE name = 'Fletcher Loosdrecht' AND latitude IS NULL;
UPDATE public.locations SET latitude = 52.1550, longitude = 5.3867 WHERE name = 'Fletcher Hotel-Restaurant Amersfoort' AND latitude IS NULL;
UPDATE public.locations SET latitude = 52.1383, longitude = 6.2000 WHERE name = 'Fletcher Zutphen' AND latitude IS NULL;
UPDATE public.locations SET latitude = 51.7650, longitude = 5.5183 WHERE name = 'Fletcher Hotel-Restaurant Oss' AND latitude IS NULL;
UPDATE public.locations SET latitude = 51.6900, longitude = 5.3033 WHERE name LIKE 'Fletcher Hotel-Restaurant%s-Hertogenbosch' AND latitude IS NULL;
UPDATE public.locations SET latitude = 51.4433, longitude = 3.5717 WHERE name = 'Fletcher NEXT Vlissingen' AND latitude IS NULL;
UPDATE public.locations SET latitude = 52.6317, longitude = 4.7533 WHERE name = 'Fletcher Hotel-Restaurant De Oude Gevangenis-Alkmaar' AND latitude IS NULL;
UPDATE public.locations SET latitude = 52.7117, longitude = 5.8583 WHERE name = 'Fletcher Hotel-Restaurant Marknesse' AND latitude IS NULL;
UPDATE public.locations SET latitude = 52.1600, longitude = 4.4900 WHERE name = 'Fletcher Wellness-Hotel Leiden' AND latitude IS NULL;
UPDATE public.locations SET latitude = 52.3683, longitude = 5.7850 WHERE name = 'Fletcher Hotel-Restaurant Sparrenhorst-Veluwe' AND latitude IS NULL;
UPDATE public.locations SET latitude = 52.8400, longitude = 4.6967 WHERE name = 'Fletcher Badhotel Callantsoog' AND latitude IS NULL;
UPDATE public.locations SET latitude = 52.6233, longitude = 4.6267 WHERE name = 'Fletcher Zuiderduin Beachhotel' AND latitude IS NULL;
UPDATE public.locations SET latitude = 51.8217, longitude = 3.9283 WHERE name = 'Fletcher Hotel-Restaurant Duinzicht' AND latitude IS NULL;
UPDATE public.locations SET latitude = 52.3367, longitude = 5.8167 WHERE name = 'Fletcher Hotel-Restaurant De Mallejan' AND latitude IS NULL;
UPDATE public.locations SET latitude = 52.3000, longitude = 5.2383 WHERE name = 'Laguna Huizen Fletcher hotel' AND latitude IS NULL;
UPDATE public.locations SET latitude = 52.7233, longitude = 6.0783 WHERE name = 'Fletcher Hotel-Restaurant De Eese-Giethoorn' AND latitude IS NULL;
UPDATE public.locations SET latitude = 52.6217, longitude = 4.6250 WHERE name = 'Beachclub Zuiderduin' AND latitude IS NULL;
UPDATE public.locations SET latitude = 52.3667, longitude = 4.9000 WHERE name = 'Fletcher Hotel Amsterdam' AND latitude IS NULL;
UPDATE public.locations SET latitude = 52.0283, longitude = 5.0833 WHERE name = 'Fletcher hoofdkantoor test kassa' AND latitude IS NULL;
UPDATE public.locations SET latitude = 52.7017, longitude = 4.6750 WHERE name = 'Fletcher Hotel-Restaurant Jan van Scorel' AND latitude IS NULL;

/* ============================================
   FLETCHER PROJECT & VISITS - Mark all as "already_client"
   ============================================ */

/* CLEANUP: Remove duplicate Fletcher APK 2026 projects */
DO $$
DECLARE
  keep_project_id UUID;
  dup_project RECORD;
BEGIN
  /* Get the first (oldest) Fletcher APK 2026 project to keep */
  SELECT id INTO keep_project_id 
  FROM public.projects 
  WHERE name = 'Fletcher APK 2026' 
  ORDER BY created_at ASC 
  LIMIT 1;
  
  IF keep_project_id IS NOT NULL THEN
    /* Update all visits from duplicate projects to the main project */
    UPDATE public.visits 
    SET project_id = keep_project_id
    WHERE project_id IN (
      SELECT id FROM public.projects 
      WHERE name = 'Fletcher APK 2026' AND id != keep_project_id
    );
    
    /* Update all recruiter_projects from duplicates to main project */
    UPDATE public.recruiter_projects 
    SET project_id = keep_project_id
    WHERE project_id IN (
      SELECT id FROM public.projects 
      WHERE name = 'Fletcher APK 2026' AND id != keep_project_id
    );
    
    /* Delete duplicate recruiter_projects entries (that now have same recruiter+project) */
    DELETE FROM public.recruiter_projects a
    USING public.recruiter_projects b
    WHERE a.id < b.id 
    AND a.recruiter_id = b.recruiter_id 
    AND a.project_id = b.project_id;
    
    /* Delete all duplicate Fletcher APK 2026 projects */
    DELETE FROM public.projects 
    WHERE name = 'Fletcher APK 2026' AND id != keep_project_id;
  END IF;
END $$;

/* Create Fletcher APK 2026 project if not exists (only creates if none exist) */
INSERT INTO public.projects (name, active)
SELECT 'Fletcher APK 2026', true
WHERE NOT EXISTS (SELECT 1 FROM public.projects WHERE name = 'Fletcher APK 2026');

/* Assign niam@orderli.com to Fletcher project and set as fletcher_admin */
DO $$
DECLARE
  fletcher_project_id UUID;
  niam_user_id UUID;
BEGIN
  /* Get the Fletcher project ID */
  SELECT id INTO fletcher_project_id FROM public.projects WHERE name = 'Fletcher APK 2026' LIMIT 1;
  
  /* Get niam@orderli.com user ID */
  SELECT p.id INTO niam_user_id 
  FROM public.profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE u.email = 'niam@orderli.com' 
  LIMIT 1;
  
  IF fletcher_project_id IS NOT NULL AND niam_user_id IS NOT NULL THEN
    /* Set niam as fletcher_admin */
    UPDATE public.profiles SET role = 'fletcher_admin' WHERE id = niam_user_id;
    
    /* Assign niam to Fletcher project */
    INSERT INTO public.recruiter_projects (recruiter_id, project_id)
    VALUES (niam_user_id, fletcher_project_id)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

/* Create visits for all Fletcher locations with status "already_client" */
DO $$
DECLARE
  fletcher_project_id UUID;
  niam_user_id UUID;
  loc RECORD;
BEGIN
  /* Get the Fletcher project ID */
  SELECT id INTO fletcher_project_id FROM public.projects WHERE name = 'Fletcher APK 2026' LIMIT 1;
  
  /* Get niam@orderli.com user ID */
  SELECT p.id INTO niam_user_id 
  FROM public.profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE u.email = 'niam@orderli.com' 
  LIMIT 1;
  
  /* Only proceed if we have both */
  IF fletcher_project_id IS NOT NULL AND niam_user_id IS NOT NULL THEN
    /* Loop through all Fletcher locations and create 1 visit per location (42 total) */
    FOR loc IN 
      SELECT id FROM public.locations 
      WHERE name LIKE 'Fletcher%' OR name LIKE 'Beachclub Zuiderduin' OR name LIKE 'Laguna Huizen%'
    LOOP
      /* Create 1 visit per location */
      INSERT INTO public.visits (recruiter_id, project_id, location_id, status, pos_system, spoken_to, takeaway, delivery, notes, visit_date)
      VALUES (niam_user_id, fletcher_project_id, loc.id, 'already_client', 'QR Ordering', 'Fletcher', false, false, 'Bestaande klant - Fletcher QR Ordering', CURRENT_DATE - INTERVAL '7 days')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END $$;

/* ============================================
   FLETCHER APK RUNS - Create APK runs for all Fletcher locations
   ============================================ */

DO $$
DECLARE
  niam_user_id UUID;
  loc RECORD;
  new_run_id UUID;
  checklist_item RECORD;
BEGIN
  /* Get niam@orderli.com user ID */
  SELECT p.id INTO niam_user_id 
  FROM public.profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE u.email = 'niam@orderli.com' 
  LIMIT 1;
  
  /* Only proceed if we have the user */
  IF niam_user_id IS NOT NULL THEN
    /* Loop through all Fletcher locations */
    FOR loc IN 
      SELECT id, name FROM public.locations 
      WHERE name LIKE 'Fletcher%' OR name LIKE 'Beachclub Zuiderduin' OR name LIKE 'Laguna Huizen%'
    LOOP
      /* Check if APK run already exists for this location */
      IF NOT EXISTS (SELECT 1 FROM public.fletcher_apk_runs WHERE location_id = loc.id) THEN
        /* Create the APK run */
        INSERT INTO public.fletcher_apk_runs (location_id, created_by, status)
        VALUES (loc.id, niam_user_id, 'draft')
        RETURNING id INTO new_run_id;
        
        /* Create checklist items for this run */
        /* General section */
        INSERT INTO public.fletcher_apk_check_items (run_id, item_key, section, label, checked) VALUES
          (new_run_id, 'general_1', 'general', 'Hotel algemeen schoon en netjes', false),
          (new_run_id, 'general_2', 'general', 'Personeel vriendelijk en behulpzaam', false),
          (new_run_id, 'general_3', 'general', 'QR codes goed zichtbaar', false),
          (new_run_id, 'general_4', 'general', 'QR codes scanbaar', false),
          (new_run_id, 'general_5', 'general', 'Menu up-to-date', false),
          (new_run_id, 'general_6', 'general', 'Prijzen correct', false),
          (new_run_id, 'general_7', 'general', 'Foto kwaliteit goed', false),
          (new_run_id, 'general_8', 'general', 'Beschrijvingen duidelijk', false),
          (new_run_id, 'general_9', 'general', 'Allergenen info aanwezig', false),
          (new_run_id, 'general_10', 'general', 'Betaalproces werkt', false),
          (new_run_id, 'general_11', 'general', 'Bon printer werkt', false),
          (new_run_id, 'general_12', 'general', 'Keuken display werkt', false);
          
        /* Areas section */
        INSERT INTO public.fletcher_apk_check_items (run_id, item_key, section, label, checked) VALUES
          (new_run_id, 'areas_1', 'areas', 'Lobby/receptie QR actief', false),
          (new_run_id, 'areas_2', 'areas', 'Bar QR actief', false),
          (new_run_id, 'areas_3', 'areas', 'Restaurant QR actief', false),
          (new_run_id, 'areas_4', 'areas', 'Terras QR actief', false);
          
        /* Roomservice section */
        INSERT INTO public.fletcher_apk_check_items (run_id, item_key, section, label, checked) VALUES
          (new_run_id, 'roomservice_1', 'roomservice', 'Roomservice menu beschikbaar', false),
          (new_run_id, 'roomservice_2', 'roomservice', 'Kamernummer invoer werkt', false),
          (new_run_id, 'roomservice_3', 'roomservice', 'Levertijd info zichtbaar', false),
          (new_run_id, 'roomservice_4', 'roomservice', 'Speciale wensen mogelijk', false);
          
        /* Restaurant section */
        INSERT INTO public.fletcher_apk_check_items (run_id, item_key, section, label, checked) VALUES
          (new_run_id, 'restaurant_1', 'restaurant', 'Tafelnummer systeem werkt', false),
          (new_run_id, 'restaurant_2', 'restaurant', 'Menukaart compleet', false),
          (new_run_id, 'restaurant_3', 'restaurant', 'Wijnkaart aanwezig', false),
          (new_run_id, 'restaurant_4', 'restaurant', 'Kinderenu beschikbaar', false),
          (new_run_id, 'restaurant_5', 'restaurant', 'Dessertkaart aanwezig', false);
          
        /* Terras section */
        INSERT INTO public.fletcher_apk_check_items (run_id, item_key, section, label, checked) VALUES
          (new_run_id, 'terras_1', 'terras', 'Terras QR codes weerbestendig', false),
          (new_run_id, 'terras_2', 'terras', 'Terras menu beschikbaar', false),
          (new_run_id, 'terras_3', 'terras', 'Bediening op de hoogte', false),
          (new_run_id, 'terras_4', 'terras', 'Snacks/drinks menu compleet', false);
      END IF;
    END LOOP;
  END IF;
END $$;

/* ============================================
   UPDATE EXISTING FLETCHER DATA TO NIAM
   ============================================ */

/* Update all existing Fletcher visits to be owned by niam */
DO $$
DECLARE
  niam_user_id UUID;
  fletcher_project_id UUID;
BEGIN
  /* Get niam@orderli.com user ID */
  SELECT p.id INTO niam_user_id 
  FROM public.profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE u.email = 'niam@orderli.com' 
  LIMIT 1;
  
  /* Get the Fletcher project ID */
  SELECT id INTO fletcher_project_id FROM public.projects WHERE name = 'Fletcher APK 2026' LIMIT 1;
  
  IF niam_user_id IS NOT NULL THEN
    /* Update all Fletcher visits to niam */
    UPDATE public.visits 
    SET recruiter_id = niam_user_id
    WHERE location_id IN (
      SELECT id FROM public.locations 
      WHERE name LIKE 'Fletcher%' OR name LIKE 'Beachclub Zuiderduin' OR name LIKE 'Laguna Huizen%'
    );
    
    /* Update all Fletcher APK runs to niam */
    UPDATE public.fletcher_apk_runs 
    SET created_by = niam_user_id
    WHERE location_id IN (
      SELECT id FROM public.locations 
      WHERE name LIKE 'Fletcher%' OR name LIKE 'Beachclub Zuiderduin' OR name LIKE 'Laguna Huizen%'
    );
    
    /* Also update visits to be linked to Fletcher project if not already */
    IF fletcher_project_id IS NOT NULL THEN
      UPDATE public.visits 
      SET project_id = fletcher_project_id
      WHERE location_id IN (
        SELECT id FROM public.locations 
        WHERE name LIKE 'Fletcher%' OR name LIKE 'Beachclub Zuiderduin' OR name LIKE 'Laguna Huizen%'
      )
      AND project_id IS NULL;
    END IF;
  END IF;
END $$;

/* Clean up: Keep only 1 visit per Fletcher location for niam */
DO $$
DECLARE
  niam_user_id UUID;
  loc RECORD;
  keep_visit_id UUID;
BEGIN
  /* Get niam@orderli.com user ID */
  SELECT p.id INTO niam_user_id 
  FROM public.profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE u.email = 'niam@orderli.com' 
  LIMIT 1;
  
  IF niam_user_id IS NOT NULL THEN
    /* For each Fletcher location, keep only the most recent visit */
    FOR loc IN 
      SELECT id FROM public.locations 
      WHERE name LIKE 'Fletcher%' OR name LIKE 'Beachclub Zuiderduin' OR name LIKE 'Laguna Huizen%'
    LOOP
      /* Get the ID of the most recent visit to keep */
      SELECT id INTO keep_visit_id 
      FROM public.visits 
      WHERE location_id = loc.id AND recruiter_id = niam_user_id
      ORDER BY created_at DESC
      LIMIT 1;
      
      /* Delete all other visits for this location by niam */
      IF keep_visit_id IS NOT NULL THEN
        DELETE FROM public.visits 
        WHERE location_id = loc.id 
        AND recruiter_id = niam_user_id 
        AND id != keep_visit_id;
      END IF;
    END LOOP;
  END IF;
END $$;

/* ============================================
   VERIFICATION
   ============================================ */

/* Show Fletcher project stats */
SELECT 
  p.name as project_name,
  p.id as project_id,
  COUNT(DISTINCT v.id) as total_visits,
  COUNT(DISTINCT l.id) as unique_locations,
  COUNT(DISTINCT r.id) as apk_runs
FROM public.projects p
LEFT JOIN public.visits v ON v.project_id = p.id
LEFT JOIN public.locations l ON v.location_id = l.id
LEFT JOIN public.fletcher_apk_runs r ON r.location_id = l.id
WHERE p.name = 'Fletcher APK 2026'
GROUP BY p.id, p.name;

/* Show all projects (should only have 1 Fletcher APK 2026) */
SELECT name, active, COUNT(*) as count 
FROM public.projects 
GROUP BY name, active
ORDER BY name;

/* Show niam stats */
SELECT 
  pr.name,
  pr.role,
  (SELECT COUNT(*) FROM public.visits WHERE recruiter_id = pr.id) as visits,
  (SELECT COUNT(*) FROM public.fletcher_apk_runs WHERE created_by = pr.id) as apk_runs,
  (SELECT COUNT(*) FROM public.fletcher_apk_runs WHERE created_by = pr.id AND status = 'completed') as completed_apk_runs
FROM public.profiles pr
JOIN auth.users u ON pr.id = u.id
WHERE u.email = 'niam@orderli.com';

/* Verify: show current policies */
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('projects', 'visits', 'profiles', 'fletcher_apk_runs', 'fletcher_apk_check_items', 'fletcher_apk_todos', 'fletcher_apk_errors')
ORDER BY tablename, policyname;
