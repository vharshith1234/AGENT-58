import type { AppRole } from './roles'

export type QuickLoginRole = 'HR' | 'HOD' | 'DEAN' | 'FACULTY'

/** Quick-access accounts for the login portal hyperlinks (local/demo use). */
export const QUICK_LOGIN_ACCOUNTS: Record<
  QuickLoginRole,
  { email: string; password: string; label: string }
> = {
  HR: {
    email: 'uttejkumarn@vignan.ac.in',
    password: 'Vignan@44655544',
    label: 'HR',
  },
  HOD: {
    email: 'svphanikumar@vignan.ac.in',
    password: 'Vignan@79565614',
    label: 'HOD',
  },
  DEAN: {
    email: 'kvkrishnakishore@vignan.ac.in',
    password: 'Vignan@69135562',
    label: 'Dean',
  },
  FACULTY: {
    email: 'drjvr_cse@vignan.ac.in',
    password: 'Vignan@51854048',
    label: 'Faculty',
  },
}

export function quickLoginPortal(role: AppRole): QuickLoginRole {
  if (role === 'HR' || role === 'HOD' || role === 'DEAN' || role === 'FACULTY') {
    return role
  }
  return 'FACULTY'
}
