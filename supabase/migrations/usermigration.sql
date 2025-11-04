-- Create the user_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'auditor', 'client')),
  company_id TEXT,
  assigned_locations JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on the table
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create a helper function to get the user's role safely, bypassing RLS.
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role FROM public.user_profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- == POLICIES ==

-- SELECT Policy: Users can see their own profile, admins can see all.
CREATE POLICY "Enable read access for authenticated users and admins"
  ON public.user_profiles
  FOR SELECT
  USING (
    (auth.uid() = id) OR (get_user_role() = 'admin')
  );

-- INSERT Policy: Only admins can create new profiles.
CREATE POLICY "Admins can insert profiles"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK ( get_user_role() = 'admin' );

-- UPDATE Policy: Only admins can update profiles.
CREATE POLICY "Admins can update profiles"
  ON public.user_profiles
  FOR UPDATE
  USING ( get_user_role() = 'admin' );

-- DELETE Policy: Only admins can delete profiles.
CREATE POLICY "Admins can delete profiles"
  ON public.user_profiles
  FOR DELETE
  USING ( get_user_role() = 'admin' );