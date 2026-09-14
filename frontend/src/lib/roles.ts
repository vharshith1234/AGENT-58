export type AppRole = 'HR' | 'HOD' | 'DEAN' | 'PRINCIPAL' | 'FACULTY'

export interface RoleConfig {
  role: AppRole
  label: string
  shortLabel: string
  dashboardPath: string
  welcomeTitle: string
}

export const ROLE_CONFIGS: Record<AppRole, RoleConfig> = {
  HR: {
    role: 'HR',
    label: 'Human Resources',
    shortLabel: 'HR',
    dashboardPath: '/hr/dashboard',
    welcomeTitle: 'HR Dashboard',
  },
  HOD: {
    role: 'HOD',
    label: 'Heads of Department',
    shortLabel: 'HOD',
    dashboardPath: '/hod/dashboard',
    welcomeTitle: 'HOD Dashboard',
  },
  DEAN: {
    role: 'DEAN',
    label: 'Deans',
    shortLabel: 'Dean',
    dashboardPath: '/dean/dashboard',
    welcomeTitle: 'Dean Dashboard',
  },
  PRINCIPAL: {
    role: 'PRINCIPAL',
    label: 'Principal',
    shortLabel: 'Principal',
    dashboardPath: '/principal/dashboard',
    welcomeTitle: 'Principal Dashboard',
  },
  FACULTY: {
    role: 'FACULTY',
    label: 'Faculty',
    shortLabel: 'Faculty',
    dashboardPath: '/faculty/dashboard',
    welcomeTitle: 'Faculty Dashboard',
  },
}

/** Primary login portals shown on the login page */
export const LOGIN_PORTALS: AppRole[] = ['HR', 'HOD', 'DEAN', 'FACULTY']

/** Login portal order (visual indicators) */
export const ROLE_INDICATORS: AppRole[] = [
  'HR',
  'HOD',
  'DEAN',
  'PRINCIPAL',
  'FACULTY',
]

export function parseLoginPortal(value: string | null | undefined): AppRole {
  const v = String(value || '').toUpperCase()
  if (v === 'HR' || v === 'HOD' || v === 'DEAN' || v === 'FACULTY') return v
  return 'FACULTY'
}
