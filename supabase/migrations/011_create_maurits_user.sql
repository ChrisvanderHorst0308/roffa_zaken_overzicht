/* Create user maruits@orderli.com and assign reichskanzlier role */

/* 
IMPORTANT: Je moet eerst de gebruiker aanmaken via Supabase Auth Dashboard:
1. Ga naar Authentication > Users
2. Klik "Add user"
3. Email: maruits@orderli.com
4. Password: (kies een wachtwoord)
5. Auto Confirm User: ON
6. Klik "Create user"

Daarna voer je deze SQL uit om de rol toe te wijzen:
*/

/* Assign reichskanzlier role */
UPDATE profiles
SET role = 'reichskanzlier'
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'maruits@orderli.com'
);

/* Add to admin_check table */
INSERT INTO admin_check (user_id)
SELECT id FROM auth.users WHERE email = 'maruits@orderli.com'
ON CONFLICT (user_id) DO NOTHING;

/* Verify */
SELECT 
  p.id,
  p.name,
  p.role,
  p.active,
  u.email
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE u.email = 'maruits@orderli.com';
