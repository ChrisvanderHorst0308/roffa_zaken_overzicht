/* Create profiles table */
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'recruiter')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

/* Create projects table */
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

/* Create recruiter_projects junction table */
CREATE TABLE IF NOT EXISTS recruiter_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE(recruiter_id, project_id)
);

/* Create locations table */
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT,
  website TEXT,
  pos_system TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

/* Create visits table */
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

/* Enable Row Level Security */
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiter_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

/* RLS Policies for profiles */
/* Recruiters can view their own profile */
CREATE POLICY "Recruiters can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

/* Admins can view all profiles */
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

/* Users can update their own profile name */
CREATE POLICY "Users can update own profile name"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

/* Admins can update all profiles */
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

/* RLS Policies for projects */
/* Recruiters can view projects they are assigned to */
CREATE POLICY "Recruiters can view assigned projects"
  ON projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recruiter_projects
      WHERE recruiter_id = auth.uid() AND project_id = projects.id
    )
  );

/* Admins can view all projects */
CREATE POLICY "Admins can view all projects"
  ON projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

/* Admins can insert projects */
CREATE POLICY "Admins can insert projects"
  ON projects FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

/* Admins can update projects */
CREATE POLICY "Admins can update projects"
  ON projects FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

/* Admins can delete projects */
CREATE POLICY "Admins can delete projects"
  ON projects FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

/* RLS Policies for recruiter_projects */
/* Recruiters can view their own assignments */
CREATE POLICY "Recruiters can view own assignments"
  ON recruiter_projects FOR SELECT
  USING (recruiter_id = auth.uid());

/* Admins can view all assignments */
CREATE POLICY "Admins can view all assignments"
  ON recruiter_projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

/* Admins can insert assignments */
CREATE POLICY "Admins can insert assignments"
  ON recruiter_projects FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

/* Admins can delete assignments */
CREATE POLICY "Admins can delete assignments"
  ON recruiter_projects FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

/* RLS Policies for locations */
/* Everyone can view locations */
CREATE POLICY "Everyone can view locations"
  ON locations FOR SELECT
  USING (true);

/* Recruiters and admins can insert locations */
CREATE POLICY "Users can insert locations"
  ON locations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND active = true
    )
  );

/* Admins can update locations */
CREATE POLICY "Admins can update locations"
  ON locations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

/* Admins can delete locations */
CREATE POLICY "Admins can delete locations"
  ON locations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

/* RLS Policies for visits */
/* Recruiters can view their own visits */
CREATE POLICY "Recruiters can view own visits"
  ON visits FOR SELECT
  USING (recruiter_id = auth.uid());

/* Admins can view all visits */
CREATE POLICY "Admins can view all visits"
  ON visits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

/* Recruiters can insert their own visits */
CREATE POLICY "Recruiters can insert own visits"
  ON visits FOR INSERT
  WITH CHECK (
    recruiter_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM recruiter_projects
      WHERE recruiter_id = auth.uid() AND project_id = visits.project_id
    )
  );

/* Admins can insert visits */
CREATE POLICY "Admins can insert visits"
  ON visits FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

/* Recruiters can update their own visits */
CREATE POLICY "Recruiters can update own visits"
  ON visits FOR UPDATE
  USING (recruiter_id = auth.uid())
  WITH CHECK (recruiter_id = auth.uid());

/* Admins can update all visits */
CREATE POLICY "Admins can update all visits"
  ON visits FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

/* Admins can delete visits */
CREATE POLICY "Admins can delete visits"
  ON visits FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

/* Create indexes for better performance */
CREATE INDEX IF NOT EXISTS idx_visits_recruiter_id ON visits(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_visits_location_id ON visits(location_id);
CREATE INDEX IF NOT EXISTS idx_visits_project_id ON visits(project_id);
CREATE INDEX IF NOT EXISTS idx_visits_visit_date ON visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_recruiter_projects_recruiter_id ON recruiter_projects(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_recruiter_projects_project_id ON recruiter_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_locations_name_city ON locations(LOWER(name), LOWER(city));

/* Create unique constraint on location name and city (case-insensitive) */
CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_unique_name_city ON locations(LOWER(name), LOWER(city));
