/* Add profile_picture column to profiles table */

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS profile_picture TEXT;

COMMENT ON COLUMN public.profiles.profile_picture IS 'URL to profile picture';
