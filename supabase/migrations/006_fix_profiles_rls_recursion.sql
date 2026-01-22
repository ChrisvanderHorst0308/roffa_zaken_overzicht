/* Fix infinite recursion in profiles RLS policies */

/* Drop the problematic policies */
DROP POLICY IF EXISTS "Recruiters can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile name" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

/* Create a function to check if user is admin (SECURITY DEFINER bypasses RLS) */
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'admin'
  );
$$;

/* Recreate policies without recursion */
/* Everyone can view their own profile */
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

/* Admins can view all profiles (using the function to avoid recursion) */
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (public.is_admin(auth.uid()));

/* Users can update their own profile */
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

/* Admins can update all profiles (using the function to avoid recursion) */
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (public.is_admin(auth.uid()));
