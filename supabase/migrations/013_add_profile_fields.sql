/* Add nickname and profile_picture_url to profiles table */

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS nickname TEXT,
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

/* Create storage bucket for profile pictures */
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', true)
ON CONFLICT (id) DO NOTHING;

/* Drop existing policies if they exist */
DROP POLICY IF EXISTS "Users can upload own profile picture" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own profile picture" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own profile picture" ON storage.objects;
DROP POLICY IF EXISTS "Everyone can view profile pictures" ON storage.objects;

/* Policy: Users can upload their own profile picture */
CREATE POLICY "Users can upload own profile picture"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profile-pictures' AND
  name LIKE auth.uid()::text || '/%'
);

/* Policy: Users can update their own profile picture */
CREATE POLICY "Users can update own profile picture"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'profile-pictures' AND
  name LIKE auth.uid()::text || '/%'
)
WITH CHECK (
  bucket_id = 'profile-pictures' AND
  name LIKE auth.uid()::text || '/%'
);

/* Policy: Users can delete their own profile picture */
CREATE POLICY "Users can delete own profile picture"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'profile-pictures' AND
  name LIKE auth.uid()::text || '/%'
);

/* Policy: Everyone can view profile pictures */
CREATE POLICY "Everyone can view profile pictures"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-pictures');
