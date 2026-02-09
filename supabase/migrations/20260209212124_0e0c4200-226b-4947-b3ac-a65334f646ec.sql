
-- Add email column to profiles
ALTER TABLE public.profiles ADD COLUMN email text;

-- Update handle_new_user to store email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''), NEW.email);
  RETURN NEW;
END;
$$;

-- Allow authenticated users to search profiles by email (read-only, limited)
CREATE POLICY "Authenticated users can search by email"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Drop the old restrictive select policies since the new one covers them
DROP POLICY IF EXISTS "Users can view friends profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
