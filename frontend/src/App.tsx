import { lazy, Suspense, type ComponentType } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ForgotPasswordPage, LoginPage } from './pages/LoginPage'
import { DashboardShell } from './components/DashboardShell'
import { WorkspaceBaseProvider } from './lib/workspaceBase'

function lazyNamed<T extends Record<string, any>>(loader: () => Promise<T>, name: keyof T) {
  return lazy(() => loader().then((mod) => ({ default: mod[name] as React.ComponentType<any> })))
}

/** Shared HR workspace pages under /hod, /dean, or /principal (same UI as HR). */
function SharedHr({ base, Page }: { base: string; Page: ComponentType<any> }) {
  return (
    <WorkspaceBaseProvider base={base}>
      <Page />
    </WorkspaceBaseProvider>
  )
}

function HodShared({ Page }: { Page: ComponentType<any> }) {
  return <SharedHr base="/hod" Page={Page} />
}

function DeanShared({ Page }: { Page: ComponentType<any> }) {
  return <SharedHr base="/dean" Page={Page} />
}

function PrincipalShared({ Page }: { Page: ComponentType<any> }) {
  return <SharedHr base="/principal" Page={Page} />
}

const ProfilePage = lazyNamed(() => import('./pages/ProfilePage'), 'ProfilePage')
const NotificationsPage = lazyNamed(() => import('./pages/shared/NotificationsPage'), 'NotificationsPage')
const HrOverview = lazyNamed(() => import('./pages/hr/HrPages'), 'HrOverview')
const HrFacultyPage = lazyNamed(() => import('./pages/hr/HrPages'), 'HrFacultyPage')
const HrFacultyDetailPage = lazyNamed(() => import('./pages/hr/HrPages'), 'HrFacultyDetailPage')
const HrDepartmentsPage = lazyNamed(() => import('./pages/hr/HrPages'), 'HrDepartmentsPage')
const HrAnalyticsPage = lazyNamed(() => import('./pages/hr/HrPages'), 'HrAnalyticsPage')
const HrHistoryPage = lazyNamed(() => import('./pages/hr/HrPages'), 'HrHistoryPage')
const HrSettingsPage = lazyNamed(() => import('./pages/hr/HrPages'), 'HrSettingsPage')
const HrAssignmentsPage = lazyNamed(() => import('./pages/hr/HrWorkflowPages'), 'HrAssignmentsPage')
const HrTimetablePage = lazyNamed(() => import('./pages/hr/HrWorkflowPages'), 'HrTimetablePage')
const HrFacultyWorkloadPage = lazyNamed(() => import('./pages/hr/HrWorkflowPages'), 'HrFacultyWorkloadPage')
const HrCoursesPage = lazyNamed(() => import('./pages/hr/HrWorkflowPages'), 'HrCoursesPage')
const HrRequestsPage = lazyNamed(() => import('./pages/hr/HrWorkflowPages'), 'HrRequestsPage')
const PeriodReportsPage = lazyNamed(() => import('./pages/shared/PeriodReportsPage'), 'PeriodReportsPage')
const HodPersonalDashboard = lazyNamed(
  () => import('./pages/hod/HodPersonalPages'),
  'HodPersonalDashboard',
)
const HodMyWorkloadPage = lazyNamed(() => import('./pages/hod/HodPersonalPages'), 'HodMyWorkloadPage')
const HodMyCoursesPage = lazyNamed(() => import('./pages/hod/HodPersonalPages'), 'HodMyCoursesPage')
const HodMyClassesPage = lazyNamed(() => import('./pages/hod/HodPersonalPages'), 'HodMyClassesPage')
const FacultyPersonalDashboard = lazyNamed(
  () => import('./pages/faculty/FacultyPersonalPages'),
  'FacultyPersonalDashboard',
)
const FacultyMyWorkloadPage = lazyNamed(
  () => import('./pages/faculty/FacultyPersonalPages'),
  'FacultyMyWorkloadPage',
)
const FacultyMyCoursesPage = lazyNamed(
  () => import('./pages/faculty/FacultyPersonalPages'),
  'FacultyMyCoursesPage',
)
const FacultyMyClassesPage = lazyNamed(
  () => import('./pages/faculty/FacultyPersonalPages'),
  'FacultyMyClassesPage',
)
const FacultyTimetablePage = lazyNamed(
  () => import('./pages/faculty/FacultyPersonalPages'),
  'FacultyTimetablePage',
)
const FacultyHistoryPage = lazyNamed(
  () => import('./pages/faculty/FacultyPersonalPages'),
  'FacultyHistoryPage',
)
const FacultyLeaveReassignPage = lazyNamed(
  () => import('./pages/faculty/FacultyRequestsPage'),
  'FacultyRequestsPage',
)
const FacultyProjectsPage = lazyNamed(() => import('./pages/faculty/FacultyPages'), 'FacultyProjectsPage')
const FacultyResearchPage = lazyNamed(() => import('./pages/faculty/FacultyPages'), 'FacultyResearchPage')
const FacultyResponsibilitiesPage = lazyNamed(
  () => import('./pages/faculty/FacultyPages'),
  'FacultyResponsibilitiesPage',
)

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="empty-state">Loading workspace…</div>}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          <Route path="/hr" element={<DashboardShell role="HR" />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<HrOverview />} />
            <Route path="workload-control" element={<Navigate to="/hr/assignments" replace />} />
            <Route path="assignments" element={<HrAssignmentsPage />} />
            <Route path="timetable" element={<HrTimetablePage />} />
            <Route path="faculty-workload" element={<HrFacultyWorkloadPage />} />
            <Route path="courses" element={<HrCoursesPage />} />
            <Route path="requests" element={<HrRequestsPage />} />
            <Route path="profile" element={<ProfilePage role="HR" />} />
            <Route path="faculty" element={<HrFacultyPage />} />
            <Route path="faculty/:facultyId" element={<HrFacultyDetailPage />} />
            <Route path="departments" element={<HrDepartmentsPage />} />
            <Route path="policies" element={<Navigate to="/hr/assignments" replace />} />
            <Route path="weightings" element={<Navigate to="/hr/assignments" replace />} />
            <Route path="analytics" element={<HrAnalyticsPage />} />
            <Route path="history" element={<HrHistoryPage />} />
            <Route path="corrections" element={<Navigate to="/hr/requests" replace />} />
            <Route path="compliance" element={<Navigate to="/hr/analytics" replace />} />
            <Route path="reports" element={<PeriodReportsPage role="HR" />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings" element={<HrSettingsPage />} />
          </Route>

          <Route path="/hod" element={<DashboardShell role="HOD" />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<HodPersonalDashboard />} />
            <Route path="my-workload" element={<HodMyWorkloadPage />} />
            <Route path="my-courses" element={<HodMyCoursesPage />} />
            <Route path="my-classes" element={<HodMyClassesPage />} />
            <Route path="profile" element={<ProfilePage role="HOD" />} />
            <Route path="faculty-workload" element={<HodShared Page={HrFacultyWorkloadPage} />} />
            <Route path="assignments" element={<HodShared Page={HrAssignmentsPage} />} />
            <Route path="allocations" element={<Navigate to="/hod/assignments" replace />} />
            <Route path="faculty" element={<HodShared Page={HrFacultyPage} />} />
            <Route path="faculty/:facultyId" element={<HodShared Page={HrFacultyDetailPage} />} />
            <Route path="courses" element={<HodShared Page={HrCoursesPage} />} />
            <Route path="analytics" element={<HodShared Page={HrAnalyticsPage} />} />
            <Route path="requests" element={<HodShared Page={HrRequestsPage} />} />
            <Route path="history" element={<HodShared Page={HrHistoryPage} />} />
            <Route path="reports" element={<PeriodReportsPage role="HOD" />} />
            <Route path="reassignments" element={<Navigate to="/hod/requests" replace />} />
            <Route path="corrections" element={<Navigate to="/hod/requests" replace />} />
            <Route path="workload" element={<Navigate to="/hod/my-workload" replace />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>

          <Route path="/faculty" element={<DashboardShell role="FACULTY" />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<FacultyPersonalDashboard />} />
            <Route path="profile" element={<ProfilePage role="FACULTY" />} />
            <Route path="my-workload" element={<FacultyMyWorkloadPage />} />
            <Route path="my-courses" element={<FacultyMyCoursesPage />} />
            <Route path="my-classes" element={<FacultyMyClassesPage />} />
            <Route path="timetable" element={<FacultyTimetablePage />} />
            <Route path="courses" element={<Navigate to="/faculty/my-courses" replace />} />
            <Route path="workload" element={<Navigate to="/faculty/my-workload" replace />} />
            <Route path="leave-transfer" element={<Navigate to="/faculty/requests" replace />} />
            <Route path="leave-requests" element={<Navigate to="/faculty/requests" replace />} />
            <Route path="requests" element={<FacultyLeaveReassignPage />} />
            <Route path="projects" element={<FacultyProjectsPage />} />
            <Route path="research" element={<FacultyResearchPage />} />
            <Route path="responsibilities" element={<FacultyResponsibilitiesPage />} />
            <Route path="history" element={<FacultyHistoryPage />} />
            <Route path="statement" element={<Navigate to="/faculty/history" replace />} />
            <Route path="corrections" element={<Navigate to="/faculty/requests" replace />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>

          {/* Dean — same HR workspace modules (as-is) */}
          <Route path="/dean" element={<DashboardShell role="DEAN" />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DeanShared Page={HrOverview} />} />
            <Route path="workload-control" element={<Navigate to="/dean/assignments" replace />} />
            <Route path="assignments" element={<DeanShared Page={HrAssignmentsPage} />} />
            <Route path="timetable" element={<DeanShared Page={HrTimetablePage} />} />
            <Route path="faculty-workload" element={<DeanShared Page={HrFacultyWorkloadPage} />} />
            <Route path="courses" element={<DeanShared Page={HrCoursesPage} />} />
            <Route path="requests" element={<DeanShared Page={HrRequestsPage} />} />
            <Route path="profile" element={<ProfilePage role="DEAN" />} />
            <Route path="faculty" element={<DeanShared Page={HrFacultyPage} />} />
            <Route path="faculty/:facultyId" element={<DeanShared Page={HrFacultyDetailPage} />} />
            <Route path="departments" element={<DeanShared Page={HrDepartmentsPage} />} />
            <Route path="analytics" element={<DeanShared Page={HrAnalyticsPage} />} />
            <Route path="history" element={<DeanShared Page={HrHistoryPage} />} />
            <Route path="reports" element={<PeriodReportsPage role="DEAN" />} />
            <Route path="reassignments" element={<Navigate to="/dean/requests" replace />} />
            <Route path="corrections" element={<Navigate to="/dean/requests" replace />} />
            <Route path="comparison" element={<Navigate to="/dean/departments" replace />} />
            <Route path="analysis" element={<Navigate to="/dean/faculty-workload" replace />} />
            <Route path="approvals" element={<Navigate to="/dean/requests" replace />} />
            <Route path="overload" element={<Navigate to="/dean/faculty-workload" replace />} />
            <Route path="underload" element={<Navigate to="/dean/faculty-workload" replace />} />
            <Route path="trends" element={<Navigate to="/dean/analytics" replace />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>

          {/* Principal — same HR workspace modules (as-is) */}
          <Route path="/principal" element={<DashboardShell role="PRINCIPAL" />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<PrincipalShared Page={HrOverview} />} />
            <Route path="workload-control" element={<Navigate to="/principal/assignments" replace />} />
            <Route path="assignments" element={<PrincipalShared Page={HrAssignmentsPage} />} />
            <Route path="timetable" element={<PrincipalShared Page={HrTimetablePage} />} />
            <Route
              path="faculty-workload"
              element={<PrincipalShared Page={HrFacultyWorkloadPage} />}
            />
            <Route path="courses" element={<PrincipalShared Page={HrCoursesPage} />} />
            <Route path="requests" element={<PrincipalShared Page={HrRequestsPage} />} />
            <Route path="profile" element={<ProfilePage role="PRINCIPAL" />} />
            <Route path="faculty" element={<PrincipalShared Page={HrFacultyPage} />} />
            <Route
              path="faculty/:facultyId"
              element={<PrincipalShared Page={HrFacultyDetailPage} />}
            />
            <Route path="departments" element={<PrincipalShared Page={HrDepartmentsPage} />} />
            <Route path="analytics" element={<PrincipalShared Page={HrAnalyticsPage} />} />
            <Route path="history" element={<PrincipalShared Page={HrHistoryPage} />} />
            <Route path="reports" element={<PeriodReportsPage role="PRINCIPAL" />} />
            <Route path="overview" element={<Navigate to="/principal/faculty-workload" replace />} />
            <Route
              path="university-workload"
              element={<Navigate to="/principal/faculty-workload" replace />}
            />
            <Route path="schools" element={<Navigate to="/principal/departments" replace />} />
            <Route path="compliance" element={<Navigate to="/principal/reports" replace />} />
            <Route path="approvals" element={<Navigate to="/principal/requests" replace />} />
            <Route path="overload" element={<Navigate to="/principal/faculty-workload" replace />} />
            <Route path="underload" element={<Navigate to="/principal/faculty-workload" replace />} />
            <Route path="trends" element={<Navigate to="/principal/analytics" replace />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>

          <Route path="/login/*" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
