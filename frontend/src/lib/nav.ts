import type { AppRole } from './roles'
import { ROLE_CONFIGS } from './roles'

export interface NavItem {
  label: string
  path: string
  icon: string
}

export const ROLE_NAV: Record<AppRole, NavItem[]> = {
  HR: [
    { label: 'Dashboard', path: '/hr/dashboard', icon: 'fa-solid fa-gauge-high' },
    { label: 'Faculty Management', path: '/hr/faculty', icon: 'fa-solid fa-users' },
    { label: 'Departments', path: '/hr/departments', icon: 'fa-solid fa-building' },
    { label: 'Workload Policies', path: '/hr/policies', icon: 'fa-solid fa-sliders' },
    { label: 'Weightings', path: '/hr/weightings', icon: 'fa-solid fa-scale-balanced' },
    { label: 'Workload Analytics', path: '/hr/analytics', icon: 'fa-solid fa-chart-column' },
    { label: 'Workload History', path: '/hr/history', icon: 'fa-solid fa-clock-rotate-left' },
    { label: 'Correction Requests', path: '/hr/corrections', icon: 'fa-solid fa-clipboard-check' },
    { label: 'Compliance', path: '/hr/compliance', icon: 'fa-solid fa-shield-halved' },
    { label: 'Reports', path: '/hr/reports', icon: 'fa-solid fa-file-lines' },
    { label: 'Notifications', path: '/hr/notifications', icon: 'fa-solid fa-bell' },
    { label: 'Profile', path: '/hr/profile', icon: 'fa-solid fa-user' },
    { label: 'Settings', path: '/hr/settings', icon: 'fa-solid fa-gear' },
  ],
  HOD: [
    { label: 'Dashboard', path: '/hod/dashboard', icon: 'fa-solid fa-gauge-high' },
    { label: 'Faculty', path: '/hod/faculty', icon: 'fa-solid fa-users' },
    { label: 'Courses', path: '/hod/courses', icon: 'fa-solid fa-book' },
    { label: 'Course Allocation', path: '/hod/allocations', icon: 'fa-solid fa-diagram-project' },
    { label: 'Timetable', path: '/hod/timetable', icon: 'fa-solid fa-calendar-days' },
    { label: 'Project Supervision', path: '/hod/projects', icon: 'fa-solid fa-graduation-cap' },
    { label: 'Research', path: '/hod/research', icon: 'fa-solid fa-flask' },
    { label: 'Administration & Committees', path: '/hod/admin-committees', icon: 'fa-solid fa-briefcase' },
    { label: 'Workload', path: '/hod/workload', icon: 'fa-solid fa-chart-pie' },
    { label: 'Workload Balancing', path: '/hod/balancing', icon: 'fa-solid fa-scale-balanced' },
    { label: 'Correction Requests', path: '/hod/corrections', icon: 'fa-solid fa-clipboard-check' },
    { label: 'What-if Simulation', path: '/hod/what-if', icon: 'fa-solid fa-flask-vial' },
    { label: 'Analytics', path: '/hod/analytics', icon: 'fa-solid fa-chart-column' },
    { label: 'Reports', path: '/hod/reports', icon: 'fa-solid fa-file-lines' },
    { label: 'Notifications', path: '/hod/notifications', icon: 'fa-solid fa-bell' },
    { label: 'Profile', path: '/hod/profile', icon: 'fa-solid fa-user' },
  ],
  FACULTY: [
    { label: 'Dashboard', path: '/faculty/dashboard', icon: 'fa-solid fa-gauge-high' },
    { label: 'My Courses', path: '/faculty/courses', icon: 'fa-solid fa-book' },
    { label: 'My Timetable', path: '/faculty/timetable', icon: 'fa-solid fa-calendar-days' },
    { label: 'My Projects', path: '/faculty/projects', icon: 'fa-solid fa-graduation-cap' },
    { label: 'My Research', path: '/faculty/research', icon: 'fa-solid fa-flask' },
    { label: 'My Responsibilities', path: '/faculty/responsibilities', icon: 'fa-solid fa-briefcase' },
    { label: 'My Workload', path: '/faculty/workload', icon: 'fa-solid fa-chart-pie' },
    { label: 'Workload Statement', path: '/faculty/statement', icon: 'fa-solid fa-file-lines' },
    { label: 'Correction Requests', path: '/faculty/corrections', icon: 'fa-solid fa-clipboard-check' },
    { label: 'Notifications', path: '/faculty/notifications', icon: 'fa-solid fa-bell' },
    { label: 'Profile', path: '/faculty/profile', icon: 'fa-solid fa-user' },
  ],
  DEAN: [
    { label: 'Dashboard', path: '/dean/dashboard', icon: 'fa-solid fa-gauge-high' },
    { label: 'Departments', path: '/dean/departments', icon: 'fa-solid fa-building' },
    { label: 'Department Comparison', path: '/dean/comparison', icon: 'fa-solid fa-table-columns' },
    { label: 'Workload Analysis', path: '/dean/analysis', icon: 'fa-solid fa-chart-line' },
    { label: 'Overload', path: '/dean/overload', icon: 'fa-solid fa-arrow-trend-up' },
    { label: 'Underload', path: '/dean/underload', icon: 'fa-solid fa-arrow-trend-down' },
    { label: 'Approvals', path: '/dean/approvals', icon: 'fa-solid fa-stamp' },
    { label: 'Trends', path: '/dean/trends', icon: 'fa-solid fa-chart-area' },
    { label: 'Reports', path: '/dean/reports', icon: 'fa-solid fa-file-lines' },
    { label: 'Notifications', path: '/dean/notifications', icon: 'fa-solid fa-bell' },
    { label: 'Profile', path: '/dean/profile', icon: 'fa-solid fa-user' },
  ],
  PRINCIPAL: [
    { label: 'Dashboard', path: '/principal/dashboard', icon: 'fa-solid fa-gauge-high' },
    { label: 'Institution Overview', path: '/principal/overview', icon: 'fa-solid fa-city' },
    { label: 'Departments', path: '/principal/departments', icon: 'fa-solid fa-building' },
    { label: 'Faculty', path: '/principal/faculty', icon: 'fa-solid fa-users' },
    { label: 'Workload Analytics', path: '/principal/analytics', icon: 'fa-solid fa-chart-column' },
    { label: 'Compliance', path: '/principal/compliance', icon: 'fa-solid fa-shield-halved' },
    { label: 'Overload', path: '/principal/overload', icon: 'fa-solid fa-arrow-trend-up' },
    { label: 'Underload', path: '/principal/underload', icon: 'fa-solid fa-arrow-trend-down' },
    { label: 'Approvals', path: '/principal/approvals', icon: 'fa-solid fa-stamp' },
    { label: 'Trends', path: '/principal/trends', icon: 'fa-solid fa-chart-area' },
    { label: 'Reports', path: '/principal/reports', icon: 'fa-solid fa-file-lines' },
    { label: 'Notifications', path: '/principal/notifications', icon: 'fa-solid fa-bell' },
    { label: 'Profile', path: '/principal/profile', icon: 'fa-solid fa-user' },
  ],
}

export function roleBasePath(role: AppRole) {
  return ROLE_CONFIGS[role].dashboardPath.replace(/\/dashboard$/, '')
}
