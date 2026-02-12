/* Create contacts table for storing contact persons at locations */
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  function TEXT, -- e.g. "eigenaar", "manager", "bedrijfsleider"
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

/* Add contact_id to visits table */
ALTER TABLE visits ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

/* Enable Row Level Security */
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

/* RLS Policies for contacts */
/* Everyone can view contacts */
CREATE POLICY "Everyone can view contacts"
  ON contacts FOR SELECT
  USING (true);

/* Authenticated users can insert contacts */
CREATE POLICY "Authenticated users can insert contacts"
  ON contacts FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

/* Users can update contacts they created */
CREATE POLICY "Users can update own contacts"
  ON contacts FOR UPDATE
  USING (created_by = auth.uid());

/* Admins can update all contacts */
CREATE POLICY "Admins can update all contacts"
  ON contacts FOR UPDATE
  USING (public.is_admin(auth.uid()));

/* Admins can delete contacts */
CREATE POLICY "Admins can delete contacts"
  ON contacts FOR DELETE
  USING (public.is_admin(auth.uid()));

/* Create indexes for better performance */
CREATE INDEX IF NOT EXISTS idx_contacts_location_id ON contacts(location_id);
CREATE INDEX IF NOT EXISTS idx_contacts_created_by ON contacts(created_by);
