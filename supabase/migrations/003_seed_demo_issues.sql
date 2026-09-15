-- ============================================
-- CAMPUSRESOLVE DEMO ISSUES SEED
-- Run AFTER creating demo auth users
-- ============================================

-- This script assumes demo users already exist in profiles.
-- Replace the UUIDs below with actual auth user IDs after signup.
-- Or use this script with the setup helper that creates users first.

-- We'll use DO block to fetch user IDs dynamically
DO $$
DECLARE
  v_student_id UUID;
  v_admin_id UUID;
  v_issue1_id UUID := gen_random_uuid();
  v_issue2_id UUID := gen_random_uuid();
  v_issue3_id UUID := gen_random_uuid();
  v_issue4_id UUID := gen_random_uuid();
  v_issue5_id UUID := gen_random_uuid();
  v_issue6_id UUID := gen_random_uuid();
  v_issue7_id UUID := gen_random_uuid();
BEGIN
  -- Get demo user IDs
  SELECT id INTO v_student_id FROM profiles WHERE email = 'student@campus.edu';
  SELECT id INTO v_admin_id FROM profiles WHERE email = 'admin@campus.edu';

  IF v_student_id IS NULL OR v_admin_id IS NULL THEN
    RAISE NOTICE 'Demo users not found. Create them first via Supabase Auth.';
    RETURN;
  END IF;

  -- ============================================
  -- ISSUE 1: Water Leakage - IN PROGRESS (HIGH)
  -- ============================================
  INSERT INTO issues (id, human_id, reporter_id, title, description, category, location_id, priority, priority_score, impact_flags, assigned_department_id, status, confirmation_count, created_at, updated_at)
  VALUES (
    v_issue1_id,
    'CR-1001',
    v_student_id,
    'Water leaking near classroom entrance',
    'Water has been leaking from the ceiling pipe near the classroom entrance since this morning. The floor is getting slippery and could be a safety hazard.',
    'plumbing',
    'c1000000-0000-0000-0000-000000000006', -- CSE Corridor
    'high', 6,
    '{water_waste,safety_risk}',
    'd1000000-0000-0000-0000-000000000002', -- Plumbing
    'in_progress',
    3,
    now() - interval '2 days',
    now() - interval '6 hours'
  );

  -- Status history for Issue 1
  INSERT INTO issue_status_history (issue_id, old_status, new_status, changed_by, note, created_at) VALUES
    (v_issue1_id, NULL, 'reported', v_student_id, 'Issue reported', now() - interval '2 days'),
    (v_issue1_id, 'reported', 'acknowledged', v_admin_id, 'We have noted this issue. Maintenance team will inspect.', now() - interval '1 day 20 hours'),
    (v_issue1_id, 'acknowledged', 'assigned', v_admin_id, 'Assigned to Plumbing & Maintenance team.', now() - interval '1 day 18 hours'),
    (v_issue1_id, 'assigned', 'in_progress', v_admin_id, 'Maintenance crew is on site inspecting the pipe.', now() - interval '6 hours');

  -- Confirmations for Issue 1
  INSERT INTO issue_confirmations (issue_id, user_id) VALUES
    (v_issue1_id, v_student_id);

  -- ============================================
  -- ISSUE 2: Projector Not Working - ACKNOWLEDGED (MEDIUM)
  -- ============================================
  INSERT INTO issues (id, human_id, reporter_id, title, description, category, location_id, priority, priority_score, impact_flags, assigned_department_id, status, confirmation_count, created_at, updated_at)
  VALUES (
    v_issue2_id,
    'CR-1002',
    v_student_id,
    'Projector not working in Classroom 101',
    'The projector in Classroom 101 is not turning on. Multiple faculty members have reported this during lectures today.',
    'classroom',
    'c1000000-0000-0000-0000-000000000001', -- Classroom 101
    'medium', 3,
    '{disrupts_class}',
    'd1000000-0000-0000-0000-000000000006', -- General Administration
    'acknowledged',
    1,
    now() - interval '1 day',
    now() - interval '18 hours'
  );

  INSERT INTO issue_status_history (issue_id, old_status, new_status, changed_by, note, created_at) VALUES
    (v_issue2_id, NULL, 'reported', v_student_id, 'Issue reported', now() - interval '1 day'),
    (v_issue2_id, 'reported', 'acknowledged', v_admin_id, 'Acknowledged. Will check projector equipment.', now() - interval '18 hours');

  -- ============================================
  -- ISSUE 3: Exposed Electrical Socket - ASSIGNED (CRITICAL)
  -- ============================================
  INSERT INTO issues (id, human_id, reporter_id, title, description, category, location_id, priority, priority_score, impact_flags, assigned_department_id, status, confirmation_count, created_at, updated_at)
  VALUES (
    v_issue3_id,
    'CR-1003',
    v_student_id,
    'Exposed electrical socket in Electronics Lab',
    'An electrical socket near workstation 5 in the Electronics Lab has its cover broken off, exposing live wires. This is an immediate safety hazard.',
    'electrical',
    'c2000000-0000-0000-0000-000000000001', -- Electronics Lab
    'critical', 8,
    '{safety_risk,blocks_access}',
    'd1000000-0000-0000-0000-000000000001', -- Electrical
    'assigned',
    2,
    now() - interval '4 hours',
    now() - interval '3 hours'
  );

  INSERT INTO issue_status_history (issue_id, old_status, new_status, changed_by, note, created_at) VALUES
    (v_issue3_id, NULL, 'reported', v_student_id, 'Issue reported', now() - interval '4 hours'),
    (v_issue3_id, 'reported', 'acknowledged', v_admin_id, 'URGENT: Safety hazard noted. Electrical team dispatched.', now() - interval '3 hours 30 minutes'),
    (v_issue3_id, 'acknowledged', 'assigned', v_admin_id, 'Assigned to Electrical & Maintenance with HIGH PRIORITY.', now() - interval '3 hours');

  -- ============================================
  -- ISSUE 4: Overflowing Waste Bin - RESOLVED (MEDIUM)
  -- ============================================
  INSERT INTO issues (id, human_id, reporter_id, title, description, category, location_id, priority, priority_score, impact_flags, assigned_department_id, status, confirmation_count, created_at, updated_at, resolved_at)
  VALUES (
    v_issue4_id,
    'CR-1004',
    v_student_id,
    'Overflowing waste bin near canteen entrance',
    'The large waste bin near the canteen dining area entrance is overflowing. Waste is spilling onto the walkway causing an unpleasant smell.',
    'sanitation',
    'c4000000-0000-0000-0000-000000000001', -- Canteen dining area
    'medium', 3,
    '{hygiene_issue}',
    'd1000000-0000-0000-0000-000000000003', -- Housekeeping
    'resolved',
    1,
    now() - interval '3 days',
    now() - interval '2 days',
    now() - interval '2 days'
  );

  INSERT INTO issue_status_history (issue_id, old_status, new_status, changed_by, note, created_at) VALUES
    (v_issue4_id, NULL, 'reported', v_student_id, 'Issue reported', now() - interval '3 days'),
    (v_issue4_id, 'reported', 'acknowledged', v_admin_id, 'Noted. Housekeeping informed.', now() - interval '2 days 22 hours'),
    (v_issue4_id, 'acknowledged', 'assigned', v_admin_id, 'Assigned to Housekeeping & Sanitation.', now() - interval '2 days 21 hours'),
    (v_issue4_id, 'assigned', 'in_progress', v_admin_id, 'Housekeeping team dispatched for cleanup.', now() - interval '2 days 6 hours'),
    (v_issue4_id, 'in_progress', 'resolved', v_admin_id, 'Waste bin emptied and area cleaned. Additional bin placed nearby to prevent overflow.', now() - interval '2 days');

  -- ============================================
  -- ISSUE 5: Wi-Fi Unavailable - REPORTED (HIGH)
  -- ============================================
  INSERT INTO issues (id, human_id, reporter_id, title, description, category, location_id, priority, priority_score, impact_flags, assigned_department_id, status, confirmation_count, created_at, updated_at)
  VALUES (
    v_issue5_id,
    'CR-1005',
    v_student_id,
    'Wi-Fi unavailable in Computer Lab 1',
    'The campus Wi-Fi network is down in Computer Lab 1. Students cannot access online resources needed for the current lab assignment.',
    'it_network',
    'c1000000-0000-0000-0000-000000000003', -- Computer Lab 1
    'high', 5,
    '{disrupts_class,equipment_unavailable}',
    'd1000000-0000-0000-0000-000000000004', -- IT Support
    'reported',
    2,
    now() - interval '2 hours',
    now() - interval '2 hours'
  );

  INSERT INTO issue_status_history (issue_id, old_status, new_status, changed_by, note, created_at) VALUES
    (v_issue5_id, NULL, 'reported', v_student_id, 'Issue reported', now() - interval '2 hours');

  -- ============================================
  -- ISSUE 6: Blocked Access Ramp - REPORTED (HIGH)
  -- ============================================
  INSERT INTO issues (id, human_id, reporter_id, title, description, category, location_id, priority, priority_score, impact_flags, assigned_department_id, status, confirmation_count, created_at, updated_at)
  VALUES (
    v_issue6_id,
    'CR-1006',
    v_student_id,
    'Wheelchair ramp blocked at Main Block entrance',
    'Construction materials have been placed on the wheelchair access ramp at the Main Block entrance, blocking access for wheelchair users.',
    'accessibility',
    'b1000000-0000-0000-0000-000000000004', -- Main Block Entrance
    'high', 4,
    '{blocks_access}',
    'd1000000-0000-0000-0000-000000000006', -- General Administration
    'reported',
    1,
    now() - interval '1 hour',
    now() - interval '1 hour'
  );

  INSERT INTO issue_status_history (issue_id, old_status, new_status, changed_by, note, created_at) VALUES
    (v_issue6_id, NULL, 'reported', v_student_id, 'Issue reported', now() - interval '1 hour');

  -- ============================================
  -- ISSUE 7: Broken Fan - VERIFIED (LOW)
  -- ============================================
  INSERT INTO issues (id, human_id, reporter_id, title, description, category, location_id, priority, priority_score, impact_flags, assigned_department_id, status, confirmation_count, created_at, updated_at, resolved_at, verified_at)
  VALUES (
    v_issue7_id,
    'CR-1007',
    v_student_id,
    'Broken ceiling fan in Classroom 102',
    'One of the ceiling fans in Classroom 102 is not working. The classroom gets warm during afternoon lectures.',
    'electrical',
    'c1000000-0000-0000-0000-000000000002', -- Classroom 102
    'low', 1,
    '{normal_maintenance}',
    'd1000000-0000-0000-0000-000000000001', -- Electrical
    'verified',
    1,
    now() - interval '5 days',
    now() - interval '1 day',
    now() - interval '2 days',
    now() - interval '1 day'
  );

  INSERT INTO issue_status_history (issue_id, old_status, new_status, changed_by, note, created_at) VALUES
    (v_issue7_id, NULL, 'reported', v_student_id, 'Issue reported', now() - interval '5 days'),
    (v_issue7_id, 'reported', 'acknowledged', v_admin_id, 'Fan issue noted.', now() - interval '4 days 20 hours'),
    (v_issue7_id, 'acknowledged', 'assigned', v_admin_id, 'Assigned to Electrical & Maintenance.', now() - interval '4 days 18 hours'),
    (v_issue7_id, 'assigned', 'in_progress', v_admin_id, 'Electrician dispatched.', now() - interval '3 days'),
    (v_issue7_id, 'in_progress', 'resolved', v_admin_id, 'Fan motor replaced and tested. Working normally now.', now() - interval '2 days'),
    (v_issue7_id, 'resolved', 'verified', v_student_id, 'Confirmed - fan is working properly.', now() - interval '1 day');

  -- Reset the sequence to continue after our seeded issues
  PERFORM setval('issue_human_id_seq', 1008);

  RAISE NOTICE 'Demo issues seeded successfully!';
END $$;
