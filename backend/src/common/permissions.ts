export type Role = 'HR' | 'HOD' | 'DEAN' | 'PRINCIPAL' | 'FACULTY';
export type Action = 'manage' | 'view' | 'approve' | 'submit' | 'run';

export type Resource =
  | 'faculty'
  | 'departments'
  | 'courses'
  | 'allocations'
  | 'timetable'
  | 'projects'
  | 'phd'
  | 'research'
  | 'admin_roles'
  | 'committees'
  | 'workload'
  | 'whatif'
  | 'balancing'
  | 'corrections'
  | 'approvals'
  | 'reports'
  | 'norms'
  | 'policies'
  | 'analytics';

const ALL: Action[] = ['manage', 'view', 'approve', 'submit', 'run'];

/**
 * HR / Uttej = operational controller (CREATE / ASSIGN / ACCEPT / REJECT).
 * Faculty = view own data + submit requests.
 * HOD / Dean / Principal = monitoring only (no assign / approve).
 */
export const PERMISSIONS: Record<Role, Partial<Record<Resource, Action[]>>> = {
  HR: {
    faculty: ['manage', 'view'],
    departments: ['manage', 'view'],
    norms: ['manage', 'view'],
    policies: ['manage', 'view'],
    corrections: ['manage', 'view', 'approve'],
    reports: ['manage', 'view'],
    courses: ['view', 'manage'],
    allocations: ['manage', 'view'],
    timetable: ['manage', 'view'],
    workload: ['manage', 'view', 'run', 'approve'],
    whatif: ['run', 'view'],
    balancing: ['manage', 'run', 'view', 'approve'],
    phd: ['view'],
    research: ['view'],
    admin_roles: ['view'],
    committees: ['view'],
    analytics: ['view', 'manage'],
    approvals: ['view', 'approve'],
  },
  HOD: {
    faculty: ['view'],
    departments: ['view'],
    courses: ['view'],
    allocations: ['view'],
    timetable: ['view'],
    projects: ['view'],
    research: ['view'],
    admin_roles: ['view'],
    committees: ['view'],
    phd: ['view'],
    workload: ['view'],
    whatif: ['view'],
    balancing: ['view'],
    corrections: ['view'],
    approvals: ['view'],
    reports: ['view'],
    analytics: ['view'],
  },
  DEAN: {
    faculty: ['view'],
    departments: ['view'],
    courses: ['view'],
    allocations: ['view'],
    timetable: ['view'],
    projects: ['view'],
    phd: ['view'],
    research: ['view'],
    admin_roles: ['view'],
    committees: ['view'],
    workload: ['view'],
    whatif: ['view'],
    balancing: ['view'],
    corrections: ['view'],
    approvals: ['view'],
    reports: ['view'],
    analytics: ['view'],
  },
  PRINCIPAL: {
    faculty: ['view'],
    departments: ['view'],
    courses: ['view'],
    allocations: ['view'],
    timetable: ['view'],
    projects: ['view'],
    phd: ['view'],
    research: ['view'],
    admin_roles: ['view'],
    committees: ['view'],
    workload: ['view'],
    whatif: ['view'],
    balancing: ['view'],
    corrections: ['view'],
    approvals: ['view'],
    reports: ['view'],
    analytics: ['view'],
  },
  FACULTY: {
    faculty: ['view'],
    courses: ['view'],
    allocations: ['view'],
    timetable: ['view'],
    projects: ['view'],
    phd: ['view'],
    research: ['view'],
    admin_roles: ['view'],
    committees: ['view'],
    workload: ['view', 'submit'],
    balancing: ['view', 'submit'],
    corrections: ['submit', 'view'],
    reports: ['view'],
  },
};

export function can(role: Role, resource: Resource, action: Action): boolean {
  const allowed = PERMISSIONS[role]?.[resource] ?? [];
  return allowed.includes(action) || (action !== 'manage' && allowed.includes('manage'));
}

export { ALL };
