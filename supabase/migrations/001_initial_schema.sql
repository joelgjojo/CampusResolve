-- ============================================
-- CAMPUSRESOLVE DATABASE SCHEMA
-- Complete migration for Supabase
-- ============================================

-- ============================================
-- CUSTOM TYPES / ENUMS
-- ============================================

CREATE TYPE user_role AS ENUM ('student', 'admin');
CREATE TYPE issue_status AS ENUM ('reported', 'acknowledged', 'assigned', 'in_progress', 'resolved', 'verified', 'reopened');
CREATE TYPE issue_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE issue_category AS ENUM ('electrical', 'plumbing', 'sanitation', 'classroom', 'laboratory', 'it_network', 'furniture', 'safety', 'accessibility', 'other');
CREATE TYPE image_type AS ENUM ('report', 'resolution');
CREATE TYPE note_visibility AS ENUM ('public', 'internal');

-- ============================================
-- PROFILES TABLE
-- ============================================

CREATE TABLE profiles (
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

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_email ON profiles(email);

-- ============================================
-- DEPARTMENTS TABLE
-- ============================================

CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category_mapping issue_category[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- LOCATIONS TABLE
-- ============================================

CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'area',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_locations_parent ON locations(parent_id);

-- ============================================
-- SEQUENCE FOR HUMAN-READABLE ISSUE IDS
-- ============================================

CREATE SEQUENCE issue_human_id_seq START 1001;

-- ============================================
-- ISSUES TABLE
-- ============================================

CREATE TABLE issues (
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

CREATE INDEX idx_issues_status ON issues(status);
CREATE INDEX idx_issues_priority ON issues(priority);
CREATE INDEX idx_issues_category ON issues(category);
CREATE INDEX idx_issues_reporter ON issues(reporter_id);
CREATE INDEX idx_issues_department ON issues(assigned_department_id);
CREATE INDEX idx_issues_location ON issues(location_id);
CREATE INDEX idx_issues_created ON issues(created_at DESC);
CREATE INDEX idx_issues_human_id ON issues(human_id);

-- ============================================
-- ISSUE IMAGES TABLE
-- ============================================

CREATE TABLE issue_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_type image_type NOT NULL DEFAULT 'report',
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_issue_images_issue ON issue_images(issue_id);

-- ============================================
-- ISSUE STATUS HISTORY TABLE
-- ============================================

CREATE TABLE issue_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  old_status issue_status,
  new_status issue_status NOT NULL,
  changed_by UUID NOT NULL REFERENCES profiles(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_status_history_issue ON issue_status_history(issue_id);
CREATE INDEX idx_status_history_created ON issue_status_history(created_at);

-- ============================================
-- ISSUE CONFIRMATIONS TABLE
-- ============================================

CREATE TABLE issue_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(issue_id, user_id)
);

CREATE INDEX idx_confirmations_issue ON issue_confirmations(issue_id);

-- ============================================
-- ISSUE NOTES TABLE
-- ============================================

CREATE TABLE issue_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id),
  visibility note_visibility NOT NULL DEFAULT 'public',
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notes_issue ON issue_notes(issue_id);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, read);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at on issues
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_issues_updated_at
  BEFORE UPDATE ON issues
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'student')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

CREATE TRIGGER trigger_auto_assign_department
  BEFORE INSERT ON issues
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_department();

-- Create initial status history entry on issue creation
CREATE OR REPLACE FUNCTION create_initial_status_history()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO issue_status_history (issue_id, old_status, new_status, changed_by, note)
  VALUES (NEW.id, NULL, 'reported', NEW.reporter_id, 'Issue reported');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_initial_status_history
  AFTER INSERT ON issues
  FOR EACH ROW
  EXECUTE FUNCTION create_initial_status_history();

-- Create notification helper function
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_issue_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO notifications (user_id, title, message, issue_id)
  VALUES (p_user_id, p_title, p_message, p_issue_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- Priority level from score
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

-- Auto-calculate priority on insert/update
CREATE OR REPLACE FUNCTION auto_calculate_priority()
RETURNS TRIGGER AS $$
BEGIN
  NEW.priority_score := calculate_priority_score(NEW.impact_flags);
  NEW.priority := priority_from_score(NEW.priority_score);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_priority
  BEFORE INSERT OR UPDATE OF impact_flags ON issues
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_priority();

-- Find potential duplicate issues
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

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES POLICIES
-- ============================================

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM profiles WHERE id = auth.uid())
  );

-- ============================================
-- ISSUES POLICIES
-- ============================================

CREATE POLICY "Students can view own issues"
  ON issues FOR SELECT
  USING (reporter_id = auth.uid());

CREATE POLICY "Students can view issues they confirmed"
  ON issues FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM issue_confirmations
      WHERE issue_id = issues.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all issues"
  ON issues FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Students can create issues"
  ON issues FOR INSERT
  WITH CHECK (
    auth.uid() = reporter_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'student')
  );

CREATE POLICY "Admins can update issues"
  ON issues FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Students can verify own issues"
  ON issues FOR UPDATE
  USING (
    reporter_id = auth.uid()
    AND status = 'resolved'
  )
  WITH CHECK (
    reporter_id = auth.uid()
    AND (status = 'verified' OR status = 'reopened')
  );

-- ============================================
-- ISSUE IMAGES POLICIES
-- ============================================

CREATE POLICY "Anyone authenticated can view issue images"
  ON issue_images FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Students can upload report images"
  ON issue_images FOR INSERT
  WITH CHECK (
    auth.uid() = uploaded_by
    AND image_type = 'report'
  );

CREATE POLICY "Admins can upload any images"
  ON issue_images FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- STATUS HISTORY POLICIES
-- ============================================

CREATE POLICY "Users can view status history for their issues"
  ON issue_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM issues
      WHERE issues.id = issue_status_history.issue_id
      AND (issues.reporter_id = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

CREATE POLICY "Admins can create status history"
  ON issue_status_history FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR auth.uid() = changed_by
  );

-- ============================================
-- CONFIRMATIONS POLICIES
-- ============================================

CREATE POLICY "Anyone can view confirmations"
  ON issue_confirmations FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Students can confirm issues"
  ON issue_confirmations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- NOTES POLICIES
-- ============================================

CREATE POLICY "Public notes visible to issue reporter"
  ON issue_notes FOR SELECT
  USING (
    visibility = 'public'
    AND EXISTS (
      SELECT 1 FROM issues
      WHERE issues.id = issue_notes.issue_id
      AND (issues.reporter_id = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

CREATE POLICY "Internal notes visible to admins"
  ON issue_notes FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can create notes"
  ON issue_notes FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Students can create public notes on own issues"
  ON issue_notes FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND visibility = 'public'
    AND EXISTS (
      SELECT 1 FROM issues
      WHERE issues.id = issue_notes.issue_id
      AND issues.reporter_id = auth.uid()
    )
  );

-- ============================================
-- NOTIFICATIONS POLICIES
-- ============================================

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================
-- DEPARTMENTS & LOCATIONS POLICIES
-- ============================================

CREATE POLICY "Anyone authenticated can view departments"
  ON departments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage departments"
  ON departments FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Anyone authenticated can view locations"
  ON locations FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage locations"
  ON locations FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- ENABLE REALTIME
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE issues;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE issue_status_history;
