export type UserRole = 'student' | 'admin';
export type IssueStatus = 'reported' | 'acknowledged' | 'assigned' | 'in_progress' | 'resolved' | 'verified' | 'reopened';
export type IssuePriority = 'low' | 'medium' | 'high' | 'critical';
export type IssueCategory = 'electrical' | 'plumbing' | 'sanitation' | 'classroom' | 'laboratory' | 'it_network' | 'furniture' | 'safety' | 'accessibility' | 'other';
export type ImageType = 'report' | 'resolution';
export type NoteVisibility = 'public' | 'internal';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  roll_number: string | null;
  department: string | null;
  year: number | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Issue {
  id: string;
  human_id: string;
  reporter_id: string;
  title: string;
  description: string;
  category: IssueCategory;
  location_id: string;
  priority: IssuePriority;
  priority_score: number;
  impact_flags: string[];
  assigned_department_id: string | null;
  status: IssueStatus;
  confirmation_count: number;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  verified_at: string | null;
  is_reopened: boolean;
  reporter?: Profile;
  location?: Location;
  department?: Department;
  images?: IssueImage[];
}

export interface Location {
  id: string;
  name: string;
  parent_id: string | null;
  type: string;
  active: boolean;
  children?: Location[];
}

export interface Department {
  id: string;
  name: string;
  category_mapping: IssueCategory[];
  active: boolean;
}

export interface IssueImage {
  id: string;
  issue_id: string;
  image_url: string;
  image_type: ImageType;
  uploaded_by: string;
  created_at: string;
}

export interface IssueStatusHistory {
  id: string;
  issue_id: string;
  old_status: IssueStatus | null;
  new_status: IssueStatus;
  changed_by: string;
  note: string | null;
  created_at: string;
  changer?: Profile;
}

export interface IssueConfirmation {
  id: string;
  issue_id: string;
  user_id: string;
  created_at: string;
}

export interface IssueNote {
  id: string;
  issue_id: string;
  author_id: string;
  visibility: NoteVisibility;
  note: string;
  created_at: string;
  author?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  issue_id: string | null;
  read: boolean;
  created_at: string;
}
