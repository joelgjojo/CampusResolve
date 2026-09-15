-- ================================================================
-- CAMPUSRESOLVE DATABASE FIX SCRIPT
-- Run this in Supabase Dashboard -> SQL Editor -> Click RUN
-- This fixes:
-- 1. Infinite recursion on profiles (Error 42P17)
-- 2. Auth.users NULL string columns causing GoTrue 500 error
-- 3. Missing auth.identities records
-- 4. Ensures student and admin profiles are correctly linked
-- ================================================================

-- 1. Create a non-recursive SECURITY DEFINER helper function for admin checks
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- 2. Drop all recursive policies on profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;

-- 3. Recreate clean, non-recursive policies on profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage profiles" ON public.profiles
  FOR ALL USING (public.is_admin());

CREATE POLICY "Service and triggers can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (true);

-- 4. Update other tables that were referencing profiles recursively
DROP POLICY IF EXISTS "Admins can view all issues" ON public.issues;
CREATE POLICY "Admins can view all issues" ON public.issues
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update issues" ON public.issues;
CREATE POLICY "Admins can update issues" ON public.issues
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can upload any images" ON public.issue_images;
CREATE POLICY "Admins can upload any images" ON public.issue_images
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage departments" ON public.departments;
CREATE POLICY "Admins can manage departments" ON public.departments
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage locations" ON public.locations;
CREATE POLICY "Admins can manage locations" ON public.locations
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can create notes" ON public.issue_notes;
CREATE POLICY "Admins can create notes" ON public.issue_notes
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "View notes" ON public.issue_notes;
CREATE POLICY "View notes" ON public.issue_notes FOR SELECT USING (
  (visibility = 'public' AND EXISTS (SELECT 1 FROM public.issues WHERE issues.id = issue_notes.issue_id AND issues.reporter_id = auth.uid()))
  OR public.is_admin()
);

-- 5. Fix handle_new_user trigger function to be robust and safe
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, roll_number, department, year)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', '')::public.user_role, 'student'::public.user_role),
    NULLIF(NEW.raw_user_meta_data->>'roll_number', ''),
    NULLIF(NEW.raw_user_meta_data->>'department', ''),
    CASE 
      WHEN (NEW.raw_user_meta_data->>'year') ~ '^[0-9]+$' THEN (NEW.raw_user_meta_data->>'year')::integer
      ELSE NULL 
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role = EXCLUDED.role;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never fail auth user creation even if profile creation hits an issue
  RAISE WARNING 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Fix GoTrue 500 error: auth.users NULL string columns
UPDATE auth.users
SET
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change = COALESCE(email_change, ''),
  phone_change = COALESCE(phone_change, ''),
  phone = COALESCE(phone, ''),
  reauthentication_token = COALESCE(reauthentication_token, ''),
  is_sso_user = COALESCE(is_sso_user, false),
  is_anonymous = COALESCE(is_anonymous, false)
WHERE email IN ('student@campus.edu', 'admin@campus.edu');

-- 7. Ensure auth.identities exists for both demo accounts
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  id,
  id,
  jsonb_build_object('sub', id::text, 'email', email),
  'email',
  id::text,
  now(),
  now(),
  now()
FROM auth.users
WHERE email IN ('student@campus.edu', 'admin@campus.edu')
ON CONFLICT (provider, provider_id) DO NOTHING;

-- 8. Confirm profiles exist and have correct roles
INSERT INTO public.profiles (id, full_name, email, role, roll_number, department, year)
VALUES (
  'e0000000-0000-0000-0000-000000000001',
  'Alex Rivera',
  'student@campus.edu',
  'student',
  'CS2024001',
  'Computer Science',
  3
)
ON CONFLICT (id) DO UPDATE SET
  role = 'student',
  full_name = 'Alex Rivera',
  email = 'student@campus.edu';

INSERT INTO public.profiles (id, full_name, email, role)
VALUES (
  'e0000000-0000-0000-0000-000000000002',
  'Campus Operations Admin',
  'admin@campus.edu',
  'admin'
)
ON CONFLICT (id) DO UPDATE SET
  role = 'admin',
  full_name = 'Campus Operations Admin',
  email = 'admin@campus.edu';
