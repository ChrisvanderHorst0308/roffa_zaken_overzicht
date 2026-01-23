/* Verify reichskanzlier role setup */

/* Check if constraint allows reichskanzlier */
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'profiles'::regclass
  AND conname = 'profiles_role_check';

/* Check if maruits user exists */
SELECT 
  id,
  email,
  created_at
FROM auth.users
WHERE email = 'maruits@orderli.com';

/* Check if profile exists for maruits */
SELECT 
  p.id,
  p.name,
  p.role,
  p.active,
  u.email
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE u.email = 'maruits@orderli.com';

/* Check if is_admin function includes reichskanzlier */
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'is_admin';

/* Check admin_check table */
SELECT * FROM admin_check WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'maruits@orderli.com'
);
