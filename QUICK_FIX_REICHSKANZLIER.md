# Quick Fix: Reichskanzlier Rol

## Probleem: Rol is niet zichtbaar in dropdown

**Oplossing:** Voer deze stappen uit in Supabase SQL Editor:

### Stap 1: Update database constraint

```sql
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'recruiter', 'reichskanzlier'));
```

### Stap 2: Update is_admin functie

```sql
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
```

### Stap 3: Update sync trigger

```sql
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
```

### Stap 4: Verifieer

```sql
SELECT 
  conname,
  pg_get_constraintdef(oid) 
FROM pg_constraint
WHERE conrelid = 'profiles'::regclass
  AND conname = 'profiles_role_check';
```

Je zou moeten zien: `CHECK (role IN ('admin', 'recruiter', 'reichskanzlier'))`

## Na het uitvoeren:

1. **Refresh je browser** (hard refresh: Cmd+Shift+R)
2. Ga naar **Admin > Recruiters**
3. Je zou **"Reichskanzlier"** moeten zien in de role dropdown

## Als het nog steeds niet werkt:

Voer het verificatie script uit: `supabase/migrations/012_verify_reichskanzlier.sql`

Dit toont je:
- Of de constraint correct is
- Of de functies correct zijn
- Of er errors zijn
