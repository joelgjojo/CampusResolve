-- ================================================================
-- CAMPUSRESOLVE DATABASE FIX SCRIPT
-- Run this in Supabase Dashboard -> SQL Editor -> Click RUN
-- ================================================================

-- ----------------------------------------------------------------
-- 1. FIX AUTH.USERS PHONE & TOKEN NORMALIZATION
-- ----------------------------------------------------------------
-- Safely convert any existing empty-string phone values back to NULL
UPDATE auth.users
SET phone = NULL
WHERE phone = '';

-- Ensure demo auth accounts exist with pre-confirmed email and correct passwords
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  phone_change, phone, reauthentication_token, is_sso_user, is_anonymous
)
VALUES (
  'e0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'student@campus.edu',
  crypt('demo1234', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Alex Rivera","role":"student","roll_number":"CS2024001","department":"Computer Science","year":3}'::jsonb,
  now(), now(), 'authenticated', 'authenticated',
  '', '', '', '', '', NULL, '', false, false
)
ON CONFLICT (id) DO UPDATE SET
  encrypted_password = crypt('demo1234', gen_salt('bf')),
  email_confirmed_at = now(),
  confirmation_token = COALESCE(auth.users.confirmation_token, ''),
  recovery_token = COALESCE(auth.users.recovery_token, ''),
  email_change_token_new = COALESCE(auth.users.email_change_token_new, ''),
  email_change = COALESCE(auth.users.email_change, ''),
  phone = NULLIF(auth.users.phone, '');

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  phone_change, phone, reauthentication_token, is_sso_user, is_anonymous
)
VALUES (
  'e0000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'admin@campus.edu',
  crypt('admin1234', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Campus Operations Admin","role":"admin"}'::jsonb,
  now(), now(), 'authenticated', 'authenticated',
  '', '', '', '', '', NULL, '', false, false
)
ON CONFLICT (id) DO UPDATE SET
  encrypted_password = crypt('admin1234', gen_salt('bf')),
  email_confirmed_at = now(),
  confirmation_token = COALESCE(auth.users.confirmation_token, ''),
  recovery_token = COALESCE(auth.users.recovery_token, ''),
  email_change_token_new = COALESCE(auth.users.email_change_token_new, ''),
  email_change = COALESCE(auth.users.email_change, ''),
  phone = NULLIF(auth.users.phone, '');

-- ----------------------------------------------------------------
-- 2. ENSURE AUTH.IDENTITIES FOR DEMO ACCOUNTS
-- ----------------------------------------------------------------
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

-- ----------------------------------------------------------------
-- 3. SECURITY DEFINER HELPERS (PREVENTS RLS RECURSION)
-- ----------------------------------------------------------------
-- Check if user is an admin without triggering RLS recursion on profiles
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Safely retrieve user role without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID DEFAULT auth.uid())
RETURNS public.user_role AS $$
  SELECT role FROM public.profiles
  WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- ----------------------------------------------------------------
-- 4. SECURE HANDLE_NEW_USER TRIGGER
-- ----------------------------------------------------------------
-- Normal signups must ALWAYS receive role = 'student'.
-- Never trust user-controlled metadata for admin privileges.
-- On conflict, NEVER downgrade an existing admin back to student.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, roll_number, department, year)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)),
    NEW.email,
    'student'::public.user_role, -- ALWAYS default to student securely
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
    -- Preserve existing role! Never overwrite with student if user was promoted to admin.
    role = profiles.role;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------
-- 5. RECREATE CLEAN, NON-RECURSIVE RLS POLICIES ON PROFILES
-- ----------------------------------------------------------------
-- Drop all existing policies on profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "Service and triggers can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own student profile" ON public.profiles;

-- Select: users can view own profile; admins can view all profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

-- Update: students can update safe profile fields, but CANNOT alter their role.
-- Role immutability is enforced using get_user_role() to prevent escalation.
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = public.get_user_role(auth.uid()));

-- Admins can update/manage any profile
CREATE POLICY "Admins can manage profiles" ON public.profiles
  FOR ALL USING (public.is_admin());

-- Insert: restricted so normal users can only insert their own profile with role = 'student'
CREATE POLICY "Users can insert own student profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id AND role = 'student');

-- ----------------------------------------------------------------
-- 6. CLEAN UP OTHER ADMIN POLICIES (NO RECURSION)
-- ----------------------------------------------------------------
-- Issues
DROP POLICY IF EXISTS "Admins can view all issues" ON public.issues;
CREATE POLICY "Admins can view all issues" ON public.issues FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update issues" ON public.issues;
CREATE POLICY "Admins can update issues" ON public.issues FOR UPDATE USING (public.is_admin());

-- Issue Images
DROP POLICY IF EXISTS "Admins can upload any images" ON public.issue_images;
CREATE POLICY "Admins can upload any images" ON public.issue_images FOR INSERT WITH CHECK (public.is_admin());

-- Departments & Locations
DROP POLICY IF EXISTS "Admins can manage departments" ON public.departments;
CREATE POLICY "Admins can manage departments" ON public.departments FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage locations" ON public.locations;
CREATE POLICY "Admins can manage locations" ON public.locations FOR ALL USING (public.is_admin());

-- Issue Notes
DROP POLICY IF EXISTS "View notes" ON public.issue_notes;
CREATE POLICY "View notes" ON public.issue_notes FOR SELECT USING (
  (visibility = 'public' AND EXISTS (
    SELECT 1 FROM public.issues 
    WHERE issues.id = issue_notes.issue_id 
    AND issues.reporter_id = auth.uid()
  ))
  OR public.is_admin()
);

DROP POLICY IF EXISTS "Admins can create notes" ON public.issue_notes;
CREATE POLICY "Admins can create notes" ON public.issue_notes FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Students can create public notes on own issues" ON public.issue_notes;
CREATE POLICY "Students can create public notes on own issues" ON public.issue_notes FOR INSERT WITH CHECK (
  auth.uid() = author_id 
  AND visibility = 'public' 
  AND EXISTS (
    SELECT 1 FROM public.issues 
    WHERE issues.id = issue_notes.issue_id 
    AND issues.reporter_id = auth.uid()
  )
);

-- Status History
DROP POLICY IF EXISTS "Users can view status history" ON public.issue_status_history;
CREATE POLICY "Users can view status history" ON public.issue_status_history FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.issues
    WHERE issues.id = issue_status_history.issue_id
    AND issues.reporter_id = auth.uid()
  )
  OR public.is_admin()
);

DROP POLICY IF EXISTS "Admins and reporters can insert status history" ON public.issue_status_history;
CREATE POLICY "Admins and reporters can insert status history" ON public.issue_status_history FOR INSERT WITH CHECK (
  auth.uid() = changed_by OR public.is_admin()
);

-- ----------------------------------------------------------------
-- 7. CONFIRM DEMO PROFILES WITH CORRECT ROLES
-- ----------------------------------------------------------------
-- Student Profile
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

-- Admin Profile
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
