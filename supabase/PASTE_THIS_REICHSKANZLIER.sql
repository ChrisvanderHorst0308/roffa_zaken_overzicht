/* ========== VOLLEDIGE FIX VOOR REICHSKANZLIER ROL ========== */
/* Plak dit HELE bestand in Supabase SQL Editor en klik Run */

/* 1. Update constraint om reichskanzlier toe te staan */
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'recruiter', 'reichskanzlier'));

/* 2. Update is_admin functie om reichskanzlier te erkennen */
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
    WHERE id = check_user_id AND role IN ('admin', 'reichskanzlier')
  );
$$;

/* 3. Update sync trigger om reichskanzlier te syncen */
CREATE OR REPLACE FUNCTION public.sync_admin_check()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IN ('admin', 'reichskanzlier') THEN
    INSERT INTO public.admin_check (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    DELETE FROM public.admin_check WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

/* 4. Sync bestaande reichskanzlier users naar admin_check */
INSERT INTO admin_check (user_id)
SELECT id FROM profiles WHERE role = 'reichskanzlier'
ON CONFLICT (user_id) DO NOTHING;

/* 5. Verifieer - dit zou moeten tonen dat de constraint correct is */
SELECT 
  'Constraint check' as check_type,
  pg_get_constraintdef(oid) as constraint_def
FROM pg_constraint
WHERE conrelid = 'profiles'::regclass
  AND conname = 'profiles_role_check';

/* KLAAR - Refresh nu je browser en de rol zou zichtbaar moeten zijn! */
