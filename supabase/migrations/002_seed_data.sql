-- ============================================
-- CAMPUSRESOLVE SEED DATA
-- Run after schema migration
-- ============================================

-- ============================================
-- DEPARTMENTS
-- ============================================

INSERT INTO departments (id, name, category_mapping) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'Electrical & Maintenance', '{electrical}'),
  ('d1000000-0000-0000-0000-000000000002', 'Plumbing & Maintenance', '{plumbing}'),
  ('d1000000-0000-0000-0000-000000000003', 'Housekeeping & Sanitation', '{sanitation}'),
  ('d1000000-0000-0000-0000-000000000004', 'IT Support', '{it_network}'),
  ('d1000000-0000-0000-0000-000000000005', 'Lab Support', '{laboratory}'),
  ('d1000000-0000-0000-0000-000000000006', 'General Administration', '{classroom,furniture,safety,accessibility,other}');

-- ============================================
-- LOCATIONS
-- ============================================

-- Top-level buildings/areas
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
  ('a1000000-0000-0000-0000-000000000010', 'Parking Area', NULL, 'area');

-- Sub-locations: Main Block
INSERT INTO locations (id, name, parent_id, type) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Ground Floor', 'a1000000-0000-0000-0000-000000000001', 'floor'),
  ('b1000000-0000-0000-0000-000000000002', 'First Floor', 'a1000000-0000-0000-0000-000000000001', 'floor'),
  ('b1000000-0000-0000-0000-000000000003', 'Second Floor', 'a1000000-0000-0000-0000-000000000001', 'floor'),
  ('b1000000-0000-0000-0000-000000000004', 'Entrance Lobby', 'a1000000-0000-0000-0000-000000000001', 'area'),
  ('b1000000-0000-0000-0000-000000000005', 'Corridor', 'a1000000-0000-0000-0000-000000000001', 'area'),
  ('b1000000-0000-0000-0000-000000000006', 'Washroom Area', 'a1000000-0000-0000-0000-000000000001', 'area');

-- Sub-locations: CSE Department
INSERT INTO locations (id, name, parent_id, type) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Classroom 101', 'a1000000-0000-0000-0000-000000000002', 'room'),
  ('c1000000-0000-0000-0000-000000000002', 'Classroom 102', 'a1000000-0000-0000-0000-000000000002', 'room'),
  ('c1000000-0000-0000-0000-000000000003', 'Computer Lab 1', 'a1000000-0000-0000-0000-000000000002', 'lab'),
  ('c1000000-0000-0000-0000-000000000004', 'Computer Lab 2', 'a1000000-0000-0000-0000-000000000002', 'lab'),
  ('c1000000-0000-0000-0000-000000000005', 'Seminar Hall', 'a1000000-0000-0000-0000-000000000002', 'room'),
  ('c1000000-0000-0000-0000-000000000006', 'CSE Corridor', 'a1000000-0000-0000-0000-000000000002', 'area'),
  ('c1000000-0000-0000-0000-000000000007', 'Staff Room', 'a1000000-0000-0000-0000-000000000002', 'room'),
  ('c1000000-0000-0000-0000-000000000008', 'CSE Washroom', 'a1000000-0000-0000-0000-000000000002', 'area');

-- Sub-locations: ECE Department
INSERT INTO locations (id, name, parent_id, type) VALUES
  ('c2000000-0000-0000-0000-000000000001', 'Electronics Lab', 'a1000000-0000-0000-0000-000000000003', 'lab'),
  ('c2000000-0000-0000-0000-000000000002', 'Classroom 201', 'a1000000-0000-0000-0000-000000000003', 'room'),
  ('c2000000-0000-0000-0000-000000000003', 'ECE Corridor', 'a1000000-0000-0000-0000-000000000003', 'area');

-- Sub-locations: Library
INSERT INTO locations (id, name, parent_id, type) VALUES
  ('c3000000-0000-0000-0000-000000000001', 'Reading Hall', 'a1000000-0000-0000-0000-000000000004', 'room'),
  ('c3000000-0000-0000-0000-000000000002', 'Digital Section', 'a1000000-0000-0000-0000-000000000004', 'area');

-- Sub-locations: Canteen
INSERT INTO locations (id, name, parent_id, type) VALUES
  ('c4000000-0000-0000-0000-000000000001', 'Dining Area', 'a1000000-0000-0000-0000-000000000005', 'area'),
  ('c4000000-0000-0000-0000-000000000002', 'Food Counter', 'a1000000-0000-0000-0000-000000000005', 'area'),
  ('c4000000-0000-0000-0000-000000000003', 'Canteen Washroom', 'a1000000-0000-0000-0000-000000000005', 'area');

-- ============================================
-- NOTE: Demo users must be created via Supabase Auth
-- Use the setup script or dashboard to create:
--
-- Student: student@campus.edu / demo1234
-- Admin:   admin@campus.edu / admin1234
--
-- After creating auth users, update their profiles:
-- UPDATE profiles SET role = 'admin' WHERE email = 'admin@campus.edu';
-- UPDATE profiles SET roll_number = 'CS2024001', department = 'Computer Science', year = 3 WHERE email = 'student@campus.edu';
-- ============================================
