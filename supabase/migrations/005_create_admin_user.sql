/* Create admin user - Run this AFTER creating the user via Supabase Auth Dashboard */

/* First, create the user via Supabase Auth Dashboard:
   1. Go to Authentication > Users
   2. Click "Add user"
   3. Email: chris@orderli.com
   4. Password: premium
   5. Auto Confirm User: ON
   6. Click "Create user"
*/

/* Then run this SQL to set the user as admin: */
UPDATE profiles
SET role = 'admin'
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'chris@orderli.com'
);

/* Verify the admin was created: */
SELECT 
  p.id,
  p.name,
  p.role,
  p.active,
  u.email
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE u.email = 'chris@orderli.com';
