import { IssueCategory, IssueStatus, IssuePriority } from '@/types/database';

export const CATEGORY_CONFIG: Record<IssueCategory, { label: string; icon: string; color: string }> = {
  electrical: { label: 'Electrical', icon: 'Zap', color: '#eab308' },
  plumbing: { label: 'Plumbing / Water', icon: 'Droplets', color: '#3b82f6' },
  sanitation: { label: 'Sanitation / Waste', icon: 'Trash2', color: '#22c55e' },
  classroom: { label: 'Classroom', icon: 'BookOpen', color: '#8b5cf6' },
  laboratory: { label: 'Laboratory', icon: 'FlaskConical', color: '#ec4899' },
  it_network: { label: 'IT / Network', icon: 'Wifi', color: '#06b6d4' },
  furniture: { label: 'Furniture / Fixtures', icon: 'Armchair', color: '#f97316' },
  safety: { label: 'Safety Hazard', icon: 'ShieldAlert', color: '#ef4444' },
  accessibility: { label: 'Accessibility', icon: 'Accessibility', color: '#14b8a6' },
  other: { label: 'Other', icon: 'MoreHorizontal', color: '#64748b' },
};

export const STATUS_CONFIG: Record<IssueStatus, { label: string; color: string; bgColor: string; textColor: string; description: string }> = {
  reported: { label: 'Reported', color: '#94a3b8', bgColor: 'bg-slate-100', textColor: 'text-slate-600', description: 'Issue has been submitted' },
  acknowledged: { label: 'Acknowledged', color: '#60a5fa', bgColor: 'bg-blue-50', textColor: 'text-blue-600', description: 'Staff has reviewed the issue' },
  assigned: { label: 'Assigned', color: '#a78bfa', bgColor: 'bg-purple-50', textColor: 'text-purple-600', description: 'Assigned to a department' },
  in_progress: { label: 'In Progress', color: '#f59e0b', bgColor: 'bg-amber-50', textColor: 'text-amber-600', description: 'Work is underway' },
  resolved: { label: 'Resolved', color: '#22c55e', bgColor: 'bg-green-50', textColor: 'text-green-600', description: 'Issue has been fixed' },
  verified: { label: 'Verified', color: '#10b981', bgColor: 'bg-emerald-50', textColor: 'text-emerald-600', description: 'Resolution confirmed by reporter' },
  reopened: { label: 'Reopened', color: '#ef4444', bgColor: 'bg-red-50', textColor: 'text-red-600', description: 'Issue needs further attention' },
};

export const PRIORITY_CONFIG: Record<IssuePriority, { label: string; color: string; bgColor: string; textColor: string }> = {
  low: { label: 'Low', color: '#3b82f6', bgColor: 'bg-blue-50', textColor: 'text-blue-700' },
  medium: { label: 'Medium', color: '#f59e0b', bgColor: 'bg-amber-50', textColor: 'text-amber-700' },
  high: { label: 'High', color: '#ef4444', bgColor: 'bg-red-50', textColor: 'text-red-700' },
  critical: { label: 'Critical', color: '#991b1b', bgColor: 'bg-red-100', textColor: 'text-red-900' },
};

export const IMPACT_FLAGS = [
  { id: 'safety_risk', label: 'Safety Risk', description: 'Could harm someone', score: 4, icon: 'ShieldAlert' },
  { id: 'blocks_access', label: 'Blocks Access', description: 'Prevents entry or movement', score: 4, icon: 'Ban' },
  { id: 'disrupts_class', label: 'Disrupts Class/Lab', description: 'Interferes with teaching or lab work', score: 3, icon: 'BookX' },
  { id: 'hygiene_issue', label: 'Hygiene Issue', description: 'Unsanitary or unhygienic conditions', score: 3, icon: 'Bug' },
  { id: 'water_waste', label: 'Water/Resource Wastage', description: 'Water or energy being wasted', score: 2, icon: 'Droplets' },
  { id: 'equipment_unavailable', label: 'Equipment Unavailable', description: 'Equipment or facility cannot be used', score: 2, icon: 'MonitorX' },
  { id: 'normal_maintenance', label: 'Normal Maintenance', description: 'Routine maintenance required', score: 1, icon: 'Wrench' },
];

export const STATUS_ORDER: IssueStatus[] = [
  'reported',
  'acknowledged',
  'assigned',
  'in_progress',
  'resolved',
  'verified',
];

export const DEPARTMENT_CATEGORY_MAP: Record<string, IssueCategory[]> = {
  'Electrical & Maintenance': ['electrical'],
  'Plumbing & Maintenance': ['plumbing'],
  'Housekeeping & Sanitation': ['sanitation'],
  'IT Support': ['it_network'],
  'Lab Support': ['laboratory'],
  'General Administration': ['classroom', 'furniture', 'safety', 'accessibility', 'other'],
};
