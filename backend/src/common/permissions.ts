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

/** Declarative RBAC: role × resource → allowed actions */
export const PERMISSIONS: Record<Role, Partial<Record<Resource, Action[]>>> = {
  HR: {
    faculty: ['manage', 'view'],
    departments: ['manage', 'view'],
    norms: ['manage', 'view'],
    policies: ['manage', 'view'],
    corrections: ['manage', 'view', 'approve'],
    reports: ['manage', 'view'],
    workload: ['view'],
    whatif: ['run', 'view'],
    phd: ['view'],
    research: ['view'],
    admin_roles: ['view'],
    committees: ['view'],
    analytics: ['view', 'manage'],
    approvals: ['view'],
  },
  HOD: {
    faculty: ['view'],
    departments: ['view'],
    courses: ['manage', 'view'],
    allocations: ['manage', 'view'],
    timetable: ['manage', 'view'],
    projects: ['manage', 'view'],
    research: ['manage', 'view'],
    admin_roles: ['manage', 'view'],
    committees: ['manage', 'view'],
    phd: ['view'],
    workload: ['manage', 'view', 'run'],
    whatif: ['manage', 'run', 'view'],
    balancing: ['manage', 'run', 'view'],
    corrections: ['manage', 'view', 'approve'],
    approvals: ['submit', 'view'],
    reports: ['view'],
    analytics: ['view'],
  },
  DEAN: {
    faculty: ['view'],
    departments: ['view'],
    courses: ['view'],
    allocations: ['view', 'approve'],
    timetable: ['view'],
    projects: ['view'],
    phd: ['view'],
    research: ['view'],
    admin_roles: ['view', 'approve'],
    committees: ['view'],
    workload: ['view', 'run'],
    whatif: ['view', 'run'],
    balancing: ['view', 'approve'],
    corrections: ['view'],
    approvals: ['approve', 'view'],
    reports: ['view', 'manage'],
    analytics: ['view', 'manage'],
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
    admin_roles: ['view', 'approve'],
    committees: ['view'],
    workload: ['view', 'run'],
    whatif: ['view', 'run'],
    balancing: ['view'],
    corrections: ['view'],
    approvals: ['approve', 'view'],
    reports: ['view', 'manage'],
    analytics: ['view', 'manage'],
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
    workload: ['view'],
    corrections: ['submit', 'view'],
    reports: ['view'],
  },
};

export function can(role: Role, resource: Resource, action: Action): boolean {
  const allowed = PERMISSIONS[role]?.[resource] ?? [];
  return allowed.includes(action) || (action !== 'manage' && allowed.includes('manage'));
}

export { ALL };
