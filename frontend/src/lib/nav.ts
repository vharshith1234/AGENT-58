import type { AppRole } from './roles'
import { ROLE_CONFIGS } from './roles'

export interface NavItem {
  label: string
  path: string
  icon: string
}

export interface NavSection {
  /** Section heading shown above links. Empty = top-level (Dashboard). */
  heading?: string
  items: NavItem[]
}

export const ROLE_NAV: Record<AppRole, NavSection[]> = {
  HR: [
    {
      items: [
        { label: 'Dashboard', path: '/hr/dashboard', icon: 'fa-solid fa-gauge-high' },
      ],
    },
    {
      heading: 'Workload',
      items: [
        { label: 'Faculty Workload', path: '/hr/faculty-workload', icon: 'fa-solid fa-chart-pie' },
        { label: 'Assignments', path: '/hr/assignments', icon: 'fa-solid fa-diagram-project' },
        { label: 'Timetable', path: '/hr/timetable', icon: 'fa-solid fa-calendar-days' },
      ],
    },
    {
      heading: 'Management',
      items: [
        { label: 'Faculty', path: '/hr/faculty', icon: 'fa-solid fa-users' },
        { label: 'Courses', path: '/hr/courses', icon: 'fa-solid fa-book' },
        { label: 'Requests', path: '/hr/requests', icon: 'fa-solid fa-inbox' },
      ],
    },
    {
      heading: 'Insights',
      items: [
        { label: 'Analytics', path: '/hr/analytics', icon: 'fa-solid fa-chart-column' },
        { label: 'History', path: '/hr/history', icon: 'fa-solid fa-clock-rotate-left' },
        { label: 'Reports', path: '/hr/reports', icon: 'fa-solid fa-file-lines' },
        { label: 'Profile', path: '/hr/profile', icon: 'fa-solid fa-user' },
      ],
    },
  ],
  FACULTY: [
    {
      items: [
        { label: 'Dashboard', path: '/faculty/dashboard', icon: 'fa-solid fa-gauge-high' },
        { label: 'My Workload', path: '/faculty/my-workload', icon: 'fa-solid fa-chart-pie' },
        { label: 'My Courses', path: '/faculty/my-courses', icon: 'fa-solid fa-book' },
        { label: 'My Classes', path: '/faculty/my-classes', icon: 'fa-solid fa-chalkboard-user' },
        { label: 'Timetable', path: '/faculty/timetable', icon: 'fa-solid fa-calendar-days' },
        { label: 'Requests', path: '/faculty/requests', icon: 'fa-solid fa-inbox' },
        { label: 'History', path: '/faculty/history', icon: 'fa-solid fa-clock-rotate-left' },
        { label: 'Profile', path: '/faculty/profile', icon: 'fa-solid fa-user' },
      ],
    },
  ],
  HOD: [
    {
      items: [
        { label: 'Dashboard', path: '/hod/dashboard', icon: 'fa-solid fa-gauge-high' },
        { label: 'My Workload', path: '/hod/my-workload', icon: 'fa-solid fa-gauge' },
        { label: 'My Courses', path: '/hod/my-courses', icon: 'fa-solid fa-book-open' },
        { label: 'My Classes', path: '/hod/my-classes', icon: 'fa-solid fa-chalkboard-user' },
        { label: 'Faculty Workload', path: '/hod/faculty-workload', icon: 'fa-solid fa-chart-pie' },
        { label: 'Assignments', path: '/hod/assignments', icon: 'fa-solid fa-diagram-project' },
        { label: 'Faculty', path: '/hod/faculty', icon: 'fa-solid fa-users' },
        { label: 'Courses', path: '/hod/courses', icon: 'fa-solid fa-book' },
        { label: 'Analytics', path: '/hod/analytics', icon: 'fa-solid fa-chart-column' },
        { label: 'Requests', path: '/hod/requests', icon: 'fa-solid fa-inbox' },
        { label: 'History', path: '/hod/history', icon: 'fa-solid fa-clock-rotate-left' },
        { label: 'Reports', path: '/hod/reports', icon: 'fa-solid fa-file-lines' },
        { label: 'Profile', path: '/hod/profile', icon: 'fa-solid fa-user' },
      ],
    },
  ],
  DEAN: [
    {
      items: [
        { label: 'Dashboard', path: '/dean/dashboard', icon: 'fa-solid fa-gauge-high' },
      ],
    },
    {
      heading: 'Workload',
      items: [
        { label: 'Faculty Workload', path: '/dean/faculty-workload', icon: 'fa-solid fa-chart-pie' },
        { label: 'Assignments', path: '/dean/assignments', icon: 'fa-solid fa-diagram-project' },
        { label: 'Timetable', path: '/dean/timetable', icon: 'fa-solid fa-calendar-days' },
      ],
    },
    {
      heading: 'Management',
      items: [
        { label: 'Faculty', path: '/dean/faculty', icon: 'fa-solid fa-users' },
        { label: 'Courses', path: '/dean/courses', icon: 'fa-solid fa-book' },
        { label: 'Requests', path: '/dean/requests', icon: 'fa-solid fa-inbox' },
      ],
    },
    {
      heading: 'Insights',
      items: [
        { label: 'Analytics', path: '/dean/analytics', icon: 'fa-solid fa-chart-column' },
        { label: 'History', path: '/dean/history', icon: 'fa-solid fa-clock-rotate-left' },
        { label: 'Reports', path: '/dean/reports', icon: 'fa-solid fa-file-lines' },
        { label: 'Profile', path: '/dean/profile', icon: 'fa-solid fa-user' },
      ],
    },
  ],
  PRINCIPAL: [
    {
      items: [
        { label: 'Dashboard', path: '/principal/dashboard', icon: 'fa-solid fa-gauge-high' },
      ],
    },
    {
      heading: 'Workload',
      items: [
        {
          label: 'Faculty Workload',
          path: '/principal/faculty-workload',
          icon: 'fa-solid fa-chart-pie',
        },
        { label: 'Assignments', path: '/principal/assignments', icon: 'fa-solid fa-diagram-project' },
        { label: 'Timetable', path: '/principal/timetable', icon: 'fa-solid fa-calendar-days' },
      ],
    },
    {
      heading: 'Management',
      items: [
        { label: 'Faculty', path: '/principal/faculty', icon: 'fa-solid fa-users' },
        { label: 'Courses', path: '/principal/courses', icon: 'fa-solid fa-book' },
        { label: 'Requests', path: '/principal/requests', icon: 'fa-solid fa-inbox' },
      ],
    },
    {
      heading: 'Insights',
      items: [
        { label: 'Analytics', path: '/principal/analytics', icon: 'fa-solid fa-chart-column' },
        { label: 'History', path: '/principal/history', icon: 'fa-solid fa-clock-rotate-left' },
        { label: 'Reports', path: '/principal/reports', icon: 'fa-solid fa-file-lines' },
        { label: 'Profile', path: '/principal/profile', icon: 'fa-solid fa-user' },
      ],
    },
  ],
}

/** Flat list for redirects / mobile pills */
export function flattenNav(role: AppRole): NavItem[] {
  return ROLE_NAV[role].flatMap((s) => s.items)
}

export function roleBasePath(role: AppRole) {
  return ROLE_CONFIGS[role].dashboardPath.replace(/\/dashboard$/, '')
}
