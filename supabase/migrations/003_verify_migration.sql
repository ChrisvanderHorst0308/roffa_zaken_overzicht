/* Verification script - Check if migrations were successful */

/* Check if all tables exist */
SELECT 
  'Tables Check' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') 
      AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects')
      AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'recruiter_projects')
      AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'locations')
      AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'visits')
    THEN '✓ All tables exist'
    ELSE '✗ Some tables are missing'
  END as status;

/* Check if RLS is enabled on all tables */
SELECT 
  'RLS Check' as check_type,
  CASE 
    WHEN (SELECT relrowsecurity FROM pg_class WHERE relname = 'profiles') = true
      AND (SELECT relrowsecurity FROM pg_class WHERE relname = 'projects') = true
      AND (SELECT relrowsecurity FROM pg_class WHERE relname = 'recruiter_projects') = true
      AND (SELECT relrowsecurity FROM pg_class WHERE relname = 'locations') = true
      AND (SELECT relrowsecurity FROM pg_class WHERE relname = 'visits') = true
    THEN '✓ RLS enabled on all tables'
    ELSE '✗ RLS not enabled on all tables'
  END as status;

/* Check if unique index on locations exists */
SELECT 
  'Unique Index Check' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE indexname = 'idx_locations_unique_name_city'
    )
    THEN '✓ Unique index on locations exists'
    ELSE '✗ Unique index on locations missing'
  END as status;

/* Check if trigger function exists */
SELECT 
  'Trigger Check' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'handle_new_user'
    )
    THEN '✓ Trigger function exists'
    ELSE '✗ Trigger function missing'
  END as status;

/* Count policies on each table */
SELECT 
  'Policies Count' as check_type,
  schemaname || '.' || tablename as table_name,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('profiles', 'projects', 'recruiter_projects', 'locations', 'visits')
GROUP BY schemaname, tablename
ORDER BY tablename;

/* Summary */
SELECT 
  'Summary' as check_type,
  (SELECT COUNT(*) FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('profiles', 'projects', 'recruiter_projects', 'locations', 'visits')
  ) || ' tables created' as status;
