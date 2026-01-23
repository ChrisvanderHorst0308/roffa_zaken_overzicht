/* Add reichskanzlier role and assign to maruits@orderli.com */

/* Update the CHECK constraint to allow reichskanzlier role */
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'recruiter', 'reichskanzlier'));

/* Assign reichskanzlier role to maruits@orderli.com */
UPDATE profiles
SET role = 'reichskanzlier'
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'maruits@orderli.com'
);

/* Add to admin_check table (reichskanzlier has same permissions as admin) */
INSERT INTO admin_check (user_id)
SELECT id FROM auth.users WHERE email = 'maruits@orderli.com'
ON CONFLICT (user_id) DO NOTHING;

/* Verify the update */
SELECT 
  p.id,
  p.name,
  p.role,
  p.active,
  u.email
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE u.email = 'maruits@orderli.com';
