-- ================================================================
-- CAMPUSRESOLVE MASTER SETUP SCRIPT
-- RUN THIS ENTIRE SCRIPT IN YOUR SUPABASE SQL EDITOR
-- It creates the complete schema, RLS policies, storage bucket,
-- departments, locations, pre-confirmed demo users, and demo issues.
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================================
-- 1. ENUMS & TYPES
-- ================================================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('student', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE issue_status AS ENUM ('reported', 'acknowledged', 'assigned', 'in_progress', 'resolved', 'verified', 'reopened');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE issue_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE issue_category AS ENUM ('electrical', 'plumbing', 'sanitation', 'classroom', 'laboratory', 'it_network', 'furniture', 'safety', 'accessibility', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE image_type AS ENUM ('report', 'resolution');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE note_visibility AS ENUM ('public', 'internal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ================================================================
-- 2. CORE TABLES
-- ================================================================

-- Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'student',
  roll_number TEXT,
  department TEXT,
  year INTEGER CHECK (year IS NULL OR (year >= 1 AND year <= 6)),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Departments Table
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category_mapping issue_category[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Locations Table
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'area',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_locations_parent ON locations(parent_id);

-- Human-readable Sequence
CREATE SEQUENCE IF NOT EXISTS issue_human_id_seq START 1001;

-- Issues Table
CREATE TABLE IF NOT EXISTS issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  human_id TEXT NOT NULL UNIQUE DEFAULT 'CR-' || nextval('issue_human_id_seq')::TEXT,
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category issue_category NOT NULL,
  location_id UUID NOT NULL REFERENCES locations(id),
  priority issue_priority NOT NULL DEFAULT 'medium',
  priority_score INTEGER NOT NULL DEFAULT 0,
  impact_flags TEXT[] NOT NULL DEFAULT '{}',
  assigned_department_id UUID REFERENCES departments(id),
  status issue_status NOT NULL DEFAULT 'reported',
  confirmation_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  is_reopened BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority);
CREATE INDEX IF NOT EXISTS idx_issues_category ON issues(category);
CREATE INDEX IF NOT EXISTS idx_issues_reporter ON issues(reporter_id);
CREATE INDEX IF NOT EXISTS idx_issues_department ON issues(assigned_department_id);
CREATE INDEX IF NOT EXISTS idx_issues_location ON issues(location_id);
CREATE INDEX IF NOT EXISTS idx_issues_created ON issues(created_at DESC);

-- Issue Images Table
CREATE TABLE IF NOT EXISTS issue_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_type image_type NOT NULL DEFAULT 'report',
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_images_issue ON issue_images(issue_id);

-- Issue Status History Table
CREATE TABLE IF NOT EXISTS issue_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  old_status issue_status,
  new_status issue_status NOT NULL,
  changed_by UUID NOT NULL REFERENCES profiles(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_status_history_issue ON issue_status_history(issue_id);
CREATE INDEX IF NOT EXISTS idx_status_history_created ON issue_status_history(created_at);

-- Issue Confirmations Table
CREATE TABLE IF NOT EXISTS issue_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(issue_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_confirmations_issue ON issue_confirmations(issue_id);

-- Issue Notes Table
CREATE TABLE IF NOT EXISTS issue_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id),
  visibility note_visibility NOT NULL DEFAULT 'public',
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_issue ON issue_notes(issue_id);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);

-- ================================================================
-- 3. FUNCTIONS & TRIGGERS
-- ================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_issues_updated_at ON issues;
CREATE TRIGGER trigger_issues_updated_at
  BEFORE UPDATE ON issues
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Auto-create profile when user signs up in auth.users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email, role, roll_number, department, year)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)),
    NEW.email,
    'student'::user_role, -- ALWAYS default to student securely
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
    role = profiles.role;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Auto-assign department based on category
CREATE OR REPLACE FUNCTION auto_assign_department()
RETURNS TRIGGER AS $$
DECLARE
  dept_id UUID;
BEGIN
  IF NEW.assigned_department_id IS NULL THEN
    SELECT id INTO dept_id
    FROM departments
    WHERE NEW.category = ANY(category_mapping)
    AND active = true
    LIMIT 1;
    
    IF dept_id IS NOT NULL THEN
      NEW.assigned_department_id = dept_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_assign_department ON issues;
CREATE TRIGGER trigger_auto_assign_department
  BEFORE INSERT ON issues
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_department();

-- Priority calculation function
CREATE OR REPLACE FUNCTION calculate_priority_score(p_impact_flags TEXT[])
RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
  flag TEXT;
BEGIN
  FOREACH flag IN ARRAY p_impact_flags
  LOOP
    CASE flag
      WHEN 'safety_risk' THEN score := score + 4;
      WHEN 'blocks_access' THEN score := score + 4;
      WHEN 'disrupts_class' THEN score := score + 3;
      WHEN 'hygiene_issue' THEN score := score + 3;
      WHEN 'water_waste' THEN score := score + 2;
      WHEN 'equipment_unavailable' THEN score := score + 2;
      WHEN 'normal_maintenance' THEN score := score + 1;
      ELSE score := score + 1;
    END CASE;
  END LOOP;
  RETURN score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION priority_from_score(score INTEGER)
RETURNS issue_priority AS $$
BEGIN
  IF score >= 7 THEN RETURN 'critical';
  ELSIF score >= 5 THEN RETURN 'high';
  ELSIF score >= 3 THEN RETURN 'medium';
  ELSE RETURN 'low';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION auto_calculate_priority()
RETURNS TRIGGER AS $$
BEGIN
  NEW.priority_score := calculate_priority_score(NEW.impact_flags);
  NEW.priority := priority_from_score(NEW.priority_score);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_priority ON issues;
CREATE TRIGGER trigger_auto_priority
  BEFORE INSERT OR UPDATE OF impact_flags ON issues
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_priority();

-- Create initial status history entry
CREATE OR REPLACE FUNCTION create_initial_status_history()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO issue_status_history (issue_id, old_status, new_status, changed_by, note)
  VALUES (NEW.id, NULL, 'reported', NEW.reporter_id, 'Issue reported');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_initial_status_history ON issues;
CREATE TRIGGER trigger_initial_status_history
  AFTER INSERT ON issues
  FOR EACH ROW
  EXECUTE FUNCTION create_initial_status_history();

-- Potential duplicate issues finder
CREATE OR REPLACE FUNCTION find_potential_duplicates(
  p_category issue_category,
  p_location_id UUID,
  p_hours_window INTEGER DEFAULT 72
)
RETURNS SETOF issues AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM issues
  WHERE category = p_category
    AND location_id = p_location_id
    AND status NOT IN ('resolved', 'verified')
    AND created_at > now() - (p_hours_window || ' hours')::INTERVAL
  ORDER BY created_at DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- 4. ROW LEVEL SECURITY
-- ================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to be idempotent
DO $$ 
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Non-recursive helper for admin checks
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

-- Profiles Policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id OR public.is_admin());
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id AND role = public.get_user_role(auth.uid()));
CREATE POLICY "Admins can manage profiles" ON profiles FOR ALL USING (public.is_admin());
CREATE POLICY "Users can insert own student profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id AND role = 'student');

-- Issues Policies
CREATE POLICY "Students can view own issues" ON issues FOR SELECT USING (reporter_id = auth.uid());
CREATE POLICY "Students can view confirmed issues" ON issues FOR SELECT USING (EXISTS (SELECT 1 FROM issue_confirmations WHERE issue_id = issues.id AND user_id = auth.uid()));
CREATE POLICY "Admins can view all issues" ON issues FOR SELECT USING (public.is_admin());
CREATE POLICY "Students can create issues" ON issues FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Admins can update issues" ON issues FOR UPDATE USING (public.is_admin());
CREATE POLICY "Students can verify own issues" ON issues FOR UPDATE USING (reporter_id = auth.uid() AND status = 'resolved') WITH CHECK (reporter_id = auth.uid() AND (status = 'verified' OR status = 'reopened'));

-- Issue Images Policies
CREATE POLICY "Authenticated users can view issue images" ON issue_images FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Students can upload report images" ON issue_images FOR INSERT WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "Admins can upload any images" ON issue_images FOR INSERT WITH CHECK (public.is_admin());

-- Status History Policies
CREATE POLICY "Users can view status history" ON issue_status_history FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM issues
    WHERE issues.id = issue_status_history.issue_id
    AND issues.reporter_id = auth.uid()
  )
  OR public.is_admin()
);
CREATE POLICY "Admins and reporters can insert status history" ON issue_status_history FOR INSERT WITH CHECK (
  auth.uid() = changed_by OR public.is_admin()
);

-- Confirmations Policies
CREATE POLICY "Anyone authenticated can view confirmations" ON issue_confirmations FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Students can confirm issues" ON issue_confirmations FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Notes Policies
CREATE POLICY "View notes" ON issue_notes FOR SELECT USING (
  (visibility = 'public' AND EXISTS (SELECT 1 FROM issues WHERE issues.id = issue_notes.issue_id AND issues.reporter_id = auth.uid()))
  OR public.is_admin()
);
CREATE POLICY "Admins can create notes" ON issue_notes FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Students can create public notes on own issues" ON issue_notes FOR INSERT WITH CHECK (
  auth.uid() = author_id AND visibility = 'public' AND EXISTS (SELECT 1 FROM issues WHERE issues.id = issue_notes.issue_id AND issues.reporter_id = auth.uid())
);

-- Notifications Policies
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "System and admins can insert notifications" ON notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Departments & Locations Policies
CREATE POLICY "Authenticated can view departments" ON departments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage departments" ON departments FOR ALL USING (public.is_admin());
CREATE POLICY "Authenticated can view locations" ON locations FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage locations" ON locations FOR ALL USING (public.is_admin());

-- ================================================================
-- 5. STORAGE BUCKET FOR ISSUE IMAGES
-- ================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('issue-images', 'issue-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies
DROP POLICY IF EXISTS "Public access to issue images" ON storage.objects;
CREATE POLICY "Public access to issue images" ON storage.objects
  FOR SELECT USING (bucket_id = 'issue-images');

DROP POLICY IF EXISTS "Authenticated users can upload issue images" ON storage.objects;
CREATE POLICY "Authenticated users can upload issue images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'issue-images' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update own issue images" ON storage.objects;
CREATE POLICY "Users can update own issue images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'issue-images' AND auth.role() = 'authenticated');

-- ================================================================
-- 6. SEED DEPARTMENTS
-- ================================================================
INSERT INTO departments (id, name, category_mapping) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'Electrical & Maintenance', '{electrical}'),
  ('d1000000-0000-0000-0000-000000000002', 'Plumbing & Maintenance', '{plumbing}'),
  ('d1000000-0000-0000-0000-000000000003', 'Housekeeping & Sanitation', '{sanitation}'),
  ('d1000000-0000-0000-0000-000000000004', 'IT Support', '{it_network}'),
  ('d1000000-0000-0000-0000-000000000005', 'Lab Support', '{laboratory}'),
  ('d1000000-0000-0000-0000-000000000006', 'General Administration', '{classroom,furniture,safety,accessibility,other}')
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- 7. SEED LOCATIONS
-- ================================================================
INSERT INTO locations (id, name, parent_id, type) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Main Block', NULL, 'building'),
  ('a1000000-0000-0000-0000-000000000002', 'CSE Department', NULL, 'building'),
  ('a1000000-0000-0000-0000-000000000003', 'ECE Department', NULL, 'building'),
  ('a1000000-0000-0000-0000-000000000004', 'Library', NULL, 'building'),
  ('a1000000-0000-0000-0000-000000000005', 'Canteen', NULL, 'building'),
  ('a1000000-0000-0000-0000-000000000006', 'Hostel Block A', NULL, 'building'),
  ('a1000000-0000-0000-0000-000000000007', 'Hostel Block B', NULL, 'building'),
  ('a1000000-0000-0000-0000-000000000008', 'Sports Complex', NULL, 'building'),
  ('a1000000-0000-0000-0000-000000000009', 'Auditorium', NULL, 'building'),
  ('a1000000-0000-0000-0000-000000000010', 'Parking Area', NULL, 'area')
ON CONFLICT (id) DO NOTHING;

-- Sub-locations: Main Block
INSERT INTO locations (id, name, parent_id, type) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Ground Floor', 'a1000000-0000-0000-0000-000000000001', 'floor'),
  ('b1000000-0000-0000-0000-000000000002', 'First Floor', 'a1000000-0000-0000-0000-000000000001', 'floor'),
  ('b1000000-0000-0000-0000-000000000003', 'Second Floor', 'a1000000-0000-0000-0000-000000000001', 'floor'),
  ('b1000000-0000-0000-0000-000000000004', 'Entrance Lobby', 'a1000000-0000-0000-0000-000000000001', 'area'),
  ('b1000000-0000-0000-0000-000000000005', 'Corridor', 'a1000000-0000-0000-0000-000000000001', 'area'),
  ('b1000000-0000-0000-0000-000000000006', 'Washroom Area', 'a1000000-0000-0000-0000-000000000001', 'area')
ON CONFLICT (id) DO NOTHING;

-- Sub-locations: CSE Department
INSERT INTO locations (id, name, parent_id, type) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Classroom 101', 'a1000000-0000-0000-0000-000000000002', 'room'),
  ('c1000000-0000-0000-0000-000000000002', 'Classroom 102', 'a1000000-0000-0000-0000-000000000002', 'room'),
  ('c1000000-0000-0000-0000-000000000003', 'Computer Lab 1', 'a1000000-0000-0000-0000-000000000002', 'lab'),
  ('c1000000-0000-0000-0000-000000000004', 'Computer Lab 2', 'a1000000-0000-0000-0000-000000000002', 'lab'),
  ('c1000000-0000-0000-0000-000000000005', 'Seminar Hall', 'a1000000-0000-0000-0000-000000000002', 'room'),
  ('c1000000-0000-0000-0000-000000000006', 'CSE Corridor', 'a1000000-0000-0000-0000-000000000002', 'area'),
  ('c1000000-0000-0000-0000-000000000007', 'Staff Room', 'a1000000-0000-0000-0000-000000000002', 'room'),
  ('c1000000-0000-0000-0000-000000000008', 'CSE Washroom', 'a1000000-0000-0000-0000-000000000002', 'area')
ON CONFLICT (id) DO NOTHING;

-- Sub-locations: ECE Department
INSERT INTO locations (id, name, parent_id, type) VALUES
  ('c2000000-0000-0000-0000-000000000001', 'Electronics Lab', 'a1000000-0000-0000-0000-000000000003', 'lab'),
  ('c2000000-0000-0000-0000-000000000002', 'Classroom 201', 'a1000000-0000-0000-0000-000000000003', 'room'),
  ('c2000000-0000-0000-0000-000000000003', 'ECE Corridor', 'a1000000-0000-0000-0000-000000000003', 'area')
ON CONFLICT (id) DO NOTHING;

-- Sub-locations: Library
INSERT INTO locations (id, name, parent_id, type) VALUES
  ('c3000000-0000-0000-0000-000000000001', 'Reading Hall', 'a1000000-0000-0000-0000-000000000004', 'room'),
  ('c3000000-0000-0000-0000-000000000002', 'Digital Section', 'a1000000-0000-0000-0000-000000000004', 'area')
ON CONFLICT (id) DO NOTHING;

-- Sub-locations: Canteen
INSERT INTO locations (id, name, parent_id, type) VALUES
  ('c4000000-0000-0000-0000-000000000001', 'Dining Area', 'a1000000-0000-0000-0000-000000000005', 'area'),
  ('c4000000-0000-0000-0000-000000000002', 'Food Counter', 'a1000000-0000-0000-0000-000000000005', 'area'),
  ('c4000000-0000-0000-0000-000000000003', 'Canteen Washroom', 'a1000000-0000-0000-0000-000000000005', 'area')
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- 8. PRE-CONFIRMED DEMO ACCOUNTS
-- Creates demo accounts directly in auth.users, auth.identities, and profiles
-- Passwords:
-- Student: demo1234
-- Admin:   admin1234
-- ================================================================

-- Safely clear any duplicate empty-string phone values
UPDATE auth.users SET phone = NULL WHERE phone = '';

-- Student demo user: student@campus.edu / demo1234
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

INSERT INTO profiles (id, full_name, email, role, roll_number, department, year)
VALUES (
  'e0000000-0000-0000-0000-000000000001',
  'Alex Rivera',
  'student@campus.edu',
  'student',
  'CS2024001',
  'Computer Science',
  3
)
ON CONFLICT (id) DO UPDATE SET role = 'student', full_name = 'Alex Rivera';

-- Admin demo user: admin@campus.edu / admin1234
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

INSERT INTO profiles (id, full_name, email, role)
VALUES (
  'e0000000-0000-0000-0000-000000000002',
  'Campus Operations Admin',
  'admin@campus.edu',
  'admin'
)
ON CONFLICT (id) DO UPDATE SET role = 'admin', full_name = 'Campus Operations Admin';

-- Ensure auth.identities exist for both demo accounts
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

-- ================================================================
-- 9. SEED REALISTIC DEMO ISSUES
-- ================================================================

-- Issue 1: Water Leakage (In Progress, High)
INSERT INTO issues (
  id, human_id, reporter_id, title, description, category, location_id,
  priority, priority_score, impact_flags, assigned_department_id, status, confirmation_count, created_at, updated_at
) VALUES (
  'f0000000-0000-0000-0000-000000000001',
  'CR-1001',
  'e0000000-0000-0000-0000-000000000001',
  'Water leaking near CSE classroom entrance',
  'Active water leakage from ceiling pipe near the classroom entrance. Floor is slippery and poses a safety risk.',
  'plumbing',
  'c1000000-0000-0000-0000-000000000006', -- CSE Corridor
  'high', 6,
  '{water_waste,safety_risk}',
  'd1000000-0000-0000-0000-000000000002', -- Plumbing
  'in_progress', 3,
  now() - interval '2 days', now() - interval '6 hours'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO issue_status_history (issue_id, old_status, new_status, changed_by, note, created_at) VALUES
  ('f0000000-0000-0000-0000-000000000001', NULL, 'reported', 'e0000000-0000-0000-0000-000000000001', 'Issue reported by student', now() - interval '2 days'),
  ('f0000000-0000-0000-0000-000000000001', 'reported', 'acknowledged', 'e0000000-0000-0000-0000-000000000002', 'Staff reviewed. Inspection scheduled.', now() - interval '1 day 20 hours'),
  ('f0000000-0000-0000-0000-000000000001', 'acknowledged', 'assigned', 'e0000000-0000-0000-0000-000000000002', 'Assigned to Plumbing & Maintenance team', now() - interval '1 day 18 hours'),
  ('f0000000-0000-0000-0000-000000000001', 'assigned', 'in_progress', 'e0000000-0000-0000-0000-000000000002', 'Plumbers on site fixing the overhead pipe joint', now() - interval '6 hours')
ON CONFLICT DO NOTHING;

-- Issue 2: Projector Not Working (Acknowledged, Medium)
INSERT INTO issues (
  id, human_id, reporter_id, title, description, category, location_id,
  priority, priority_score, impact_flags, assigned_department_id, status, confirmation_count, created_at, updated_at
) VALUES (
  'f0000000-0000-0000-0000-000000000002',
  'CR-1002',
  'e0000000-0000-0000-0000-000000000001',
  'Projector not turning on in Classroom 101',
  'The ceiling projector in Classroom 101 will not power on despite cable check. Disrupting morning lectures.',
  'classroom',
  'c1000000-0000-0000-0000-000000000001', -- Classroom 101
  'medium', 3,
  '{disrupts_class}',
  'd1000000-0000-0000-0000-000000000006', -- General Admin
  'acknowledged', 1,
  now() - interval '1 day', now() - interval '18 hours'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO issue_status_history (issue_id, old_status, new_status, changed_by, note, created_at) VALUES
  ('f0000000-0000-0000-0000-000000000002', NULL, 'reported', 'e0000000-0000-0000-0000-000000000001', 'Issue reported by student', now() - interval '1 day'),
  ('f0000000-0000-0000-0000-000000000002', 'reported', 'acknowledged', 'e0000000-0000-0000-0000-000000000002', 'Acknowledged. AV technician alerted.', now() - interval '18 hours')
ON CONFLICT DO NOTHING;

-- Issue 3: Exposed Socket (Assigned, Critical)
INSERT INTO issues (
  id, human_id, reporter_id, title, description, category, location_id,
  priority, priority_score, impact_flags, assigned_department_id, status, confirmation_count, created_at, updated_at
) VALUES (
  'f0000000-0000-0000-0000-000000000003',
  'CR-1003',
  'e0000000-0000-0000-0000-000000000001',
  'Exposed live wires in Electronics Lab',
  'Socket switchplate broken near bench 4 with bare wires visible. Severe electric shock hazard.',
  'electrical',
  'c2000000-0000-0000-0000-000000000001', -- Electronics Lab
  'critical', 8,
  '{safety_risk,blocks_access}',
  'd1000000-0000-0000-0000-000000000001', -- Electrical
  'assigned', 2,
  now() - interval '4 hours', now() - interval '3 hours'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO issue_status_history (issue_id, old_status, new_status, changed_by, note, created_at) VALUES
  ('f0000000-0000-0000-0000-000000000003', NULL, 'reported', 'e0000000-0000-0000-0000-000000000001', 'Issue reported by student', now() - interval '4 hours'),
  ('f0000000-0000-0000-0000-000000000003', 'reported', 'acknowledged', 'e0000000-0000-0000-0000-000000000002', 'SAFETY ALERT: Immediate response required', now() - interval '3 hours 30 mins'),
  ('f0000000-0000-0000-0000-000000000003', 'acknowledged', 'assigned', 'e0000000-0000-0000-0000-000000000002', 'Assigned to Electrical Department with emergency priority', now() - interval '3 hours')
ON CONFLICT DO NOTHING;

-- Issue 4: Overflowing Waste Bin (Resolved, Medium)
INSERT INTO issues (
  id, human_id, reporter_id, title, description, category, location_id,
  priority, priority_score, impact_flags, assigned_department_id, status, confirmation_count, created_at, updated_at, resolved_at
) VALUES (
  'f0000000-0000-0000-0000-000000000004',
  'CR-1004',
  'e0000000-0000-0000-0000-000000000001',
  'Overflowing food waste bin near Canteen',
  'Main recycling and waste bins by the canteen entrance are overflowing onto walkway.',
  'sanitation',
  'c4000000-0000-0000-0000-000000000001', -- Dining Area
  'medium', 3,
  '{hygiene_issue}',
  'd1000000-0000-0000-0000-000000000003', -- Housekeeping
  'resolved', 1,
  now() - interval '3 days', now() - interval '1 day', now() - interval '1 day'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO issue_status_history (issue_id, old_status, new_status, changed_by, note, created_at) VALUES
  ('f0000000-0000-0000-0000-000000000001', NULL, 'reported', 'e0000000-0000-0000-0000-000000000001', 'Issue reported by student', now() - interval '3 days'),
  ('f0000000-0000-0000-0000-000000000004', 'reported', 'acknowledged', 'e0000000-0000-0000-0000-000000000002', 'Housekeeping alerted', now() - interval '2 days 20 hours'),
  ('f0000000-0000-0000-0000-000000000004', 'acknowledged', 'assigned', 'e0000000-0000-0000-0000-000000000002', 'Assigned to Housekeeping', now() - interval '2 days 18 hours'),
  ('f0000000-0000-0000-0000-000000000004', 'assigned', 'in_progress', 'e0000000-0000-0000-0000-000000000002', 'Cleaning crew deployed', now() - interval '1 day 12 hours'),
  ('f0000000-0000-0000-0000-000000000004', 'in_progress', 'resolved', 'e0000000-0000-0000-0000-000000000002', 'Bins emptied and sanitized. Area disinfected.', now() - interval '1 day')
ON CONFLICT DO NOTHING;

-- Issue 5: Wi-Fi Down (Reported, High)
INSERT INTO issues (
  id, human_id, reporter_id, title, description, category, location_id,
  priority, priority_score, impact_flags, assigned_department_id, status, confirmation_count, created_at, updated_at
) VALUES (
  'f0000000-0000-0000-0000-000000000005',
  'CR-1005',
  'e0000000-0000-0000-0000-000000000001',
  'Wi-Fi router down in Computer Lab 1',
  'Students cannot connect to Eduroam / Campus Wi-Fi in Lab 1. Practical coding exam scheduled in 2 hours.',
  'it_network',
  'c1000000-0000-0000-0000-000000000003', -- Computer Lab 1
  'high', 5,
  '{disrupts_class,equipment_unavailable}',
  'd1000000-0000-0000-0000-000000000004', -- IT Support
  'reported', 2,
  now() - interval '2 hours', now() - interval '2 hours'
) ON CONFLICT (id) DO NOTHING;

-- Issue 6: Blocked Access Ramp (Reported, High)
INSERT INTO issues (
  id, human_id, reporter_id, title, description, category, location_id,
  priority, priority_score, impact_flags, assigned_department_id, status, confirmation_count, created_at, updated_at
) VALUES (
  'f0000000-0000-0000-0000-000000000006',
  'CR-1006',
  'e0000000-0000-0000-0000-000000000001',
  'Wheelchair ramp blocked at Main Block entrance',
  'Construction boxes dumped right across the accessible ramp preventing wheelchair access.',
  'accessibility',
  'b1000000-0000-0000-0000-000000000004', -- Entrance Lobby
  'high', 4,
  '{blocks_access}',
  'd1000000-0000-0000-0000-000000000006', -- General Admin
  'reported', 1,
  now() - interval '1 hour', now() - interval '1 hour'
) ON CONFLICT (id) DO NOTHING;

-- Issue 7: Broken Ceiling Fan (Verified, Low)
INSERT INTO issues (
  id, human_id, reporter_id, title, description, category, location_id,
  priority, priority_score, impact_flags, assigned_department_id, status, confirmation_count, created_at, updated_at, resolved_at, verified_at
) VALUES (
  'f0000000-0000-0000-0000-000000000007',
  'CR-1007',
  'e0000000-0000-0000-0000-000000000001',
  'Broken ceiling fan in Classroom 102',
  'Middle ceiling fan not spinning, emits clicking sound when switched on.',
  'electrical',
  'c1000000-0000-0000-0000-000000000002', -- Classroom 102
  'low', 1,
  '{normal_maintenance}',
  'd1000000-0000-0000-0000-000000000001', -- Electrical
  'verified', 1,
  now() - interval '5 days', now() - interval '1 day', now() - interval '2 days', now() - interval '1 day'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO issue_status_history (issue_id, old_status, new_status, changed_by, note, created_at) VALUES
  ('f0000000-0000-0000-0000-000000000007', NULL, 'reported', 'e0000000-0000-0000-0000-000000000001', 'Issue reported by student', now() - interval '5 days'),
  ('f0000000-0000-0000-0000-000000000007', 'reported', 'acknowledged', 'e0000000-0000-0000-0000-000000000002', 'Maintenance scheduled', now() - interval '4 days'),
  ('f0000000-0000-0000-0000-000000000007', 'acknowledged', 'assigned', 'e0000000-0000-0000-0000-000000000002', 'Assigned to Electrical', now() - interval '3 days 18 hours'),
  ('f0000000-0000-0000-0000-000000000007', 'assigned', 'in_progress', 'e0000000-0000-0000-0000-000000000002', 'Electrician replaced capacitor and tested speeds', now() - interval '3 days'),
  ('f0000000-0000-0000-0000-000000000007', 'in_progress', 'resolved', 'e0000000-0000-0000-0000-000000000002', 'Fan repaired and functioning properly', now() - interval '2 days'),
  ('f0000000-0000-0000-0000-000000000007', 'resolved', 'verified', 'e0000000-0000-0000-0000-000000000001', 'Reporter verified: Fan is working smoothly at full speed', now() - interval '1 day')
ON CONFLICT DO NOTHING;

-- Advance human ID sequence
SELECT setval('issue_human_id_seq', 1008, true);

-- ================================================================
-- 10. REALTIME CONFIGURATION
-- ================================================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE issues;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE issue_status_history;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE issue_notes;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
