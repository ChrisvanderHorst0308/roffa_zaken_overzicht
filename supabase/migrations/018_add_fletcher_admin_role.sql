/* Add fletcher_admin role */

/* Update the profiles table to allow fletcher_admin role */
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'recruiter', 'reichskanzlier', 'fletcher_admin'));

/* Update is_admin function to include fletcher_admin */
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

/* Sync existing fletcher_admin users to admin_check */
INSERT INTO public.admin_check (user_id)
SELECT id FROM public.profiles WHERE role IN ('admin', 'reichskanzlier', 'fletcher_admin')
ON CONFLICT (user_id) DO NOTHING;

/* Update trigger to sync fletcher_admin */
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
