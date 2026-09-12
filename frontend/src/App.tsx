import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ForgotPasswordPage, LoginPage } from './pages/LoginPage'
import { DashboardShell } from './components/DashboardShell'

function lazyNamed<T extends Record<string, any>>(loader: () => Promise<T>, name: keyof T) {
  return lazy(() => loader().then((mod) => ({ default: mod[name] as React.ComponentType<any> })))
}

const ProfilePage = lazyNamed(() => import('./pages/ProfilePage'), 'ProfilePage')
const NotificationsPage = lazyNamed(() => import('./pages/shared/NotificationsPage'), 'NotificationsPage')
const HrOverview = lazyNamed(() => import('./pages/hr/HrPages'), 'HrOverview')
const HrFacultyPage = lazyNamed(() => import('./pages/hr/HrPages'), 'HrFacultyPage')
const HrFacultyDetailPage = lazyNamed(() => import('./pages/hr/HrPages'), 'HrFacultyDetailPage')
const HrDepartmentsPage = lazyNamed(() => import('./pages/hr/HrPages'), 'HrDepartmentsPage')
const HrPoliciesPage = lazyNamed(() => import('./pages/hr/HrPages'), 'HrPoliciesPage')
const HrWeightingsPage = lazyNamed(() => import('./pages/hr/HrPages'), 'HrWeightingsPage')
const HrCorrectionsPage = lazyNamed(() => import('./pages/hr/HrPages'), 'HrCorrectionsPage')
const HrCompliancePage = lazyNamed(() => import('./pages/hr/HrPages'), 'HrCompliancePage')
const HrReportsPage = lazyNamed(() => import('./pages/hr/HrPages'), 'HrReportsPage')
const HrAnalyticsPage = lazyNamed(() => import('./pages/hr/HrPages'), 'HrAnalyticsPage')
const HrHistoryPage = lazyNamed(() => import('./pages/hr/HrPages'), 'HrHistoryPage')
const HrSettingsPage = lazyNamed(() => import('./pages/hr/HrPages'), 'HrSettingsPage')
const HodOverview = lazyNamed(() => import('./pages/hod/HodPages'), 'HodOverview')
const HodFacultyPage = lazyNamed(() => import('./pages/hod/HodPages'), 'HodFacultyPage')
const HodFacultyDetailPage = lazyNamed(() => import('./pages/hod/HodPages'), 'HodFacultyDetailPage')
const HodCoursesPage = lazyNamed(() => import('./pages/hod/HodPages'), 'HodCoursesPage')
const HodAllocationsPage = lazyNamed(() => import('./pages/hod/HodPages'), 'HodAllocationsPage')
const HodTimetablePage = lazyNamed(() => import('./pages/hod/HodPages'), 'HodTimetablePage')
const HodProjectsPage = lazyNamed(() => import('./pages/hod/HodPages'), 'HodProjectsPage')
const HodResearchPage = lazyNamed(() => import('./pages/hod/HodPages'), 'HodResearchPage')
const HodAdminCommitteesPage = lazyNamed(() => import('./pages/hod/HodPages'), 'HodAdminCommitteesPage')
const HodWorkloadPage = lazyNamed(() => import('./pages/hod/HodPages'), 'HodWorkloadPage')
const HodWhatIfPage = lazyNamed(() => import('./pages/hod/HodPages'), 'HodWhatIfPage')
const HodBalancingPage = lazyNamed(() => import('./pages/hod/HodPages'), 'HodBalancingPage')
const HodAnalyticsPage = lazyNamed(() => import('./pages/hod/HodPages'), 'HodAnalyticsPage')
const HodReportsPage = lazyNamed(() => import('./pages/hod/HodPages'), 'HodReportsPage')
const HodCorrectionsPage = lazyNamed(() => import('./pages/hod/HodPages'), 'HodCorrectionsPage')
const FacultyOverview = lazyNamed(() => import('./pages/faculty/FacultyPages'), 'FacultyOverview')
const FacultyCoursesPage = lazyNamed(() => import('./pages/faculty/FacultyPages'), 'FacultyCoursesPage')
const FacultyTimetablePage = lazyNamed(() => import('./pages/faculty/FacultyPages'), 'FacultyTimetablePage')
const FacultyProjectsPage = lazyNamed(() => import('./pages/faculty/FacultyPages'), 'FacultyProjectsPage')
const FacultyResearchPage = lazyNamed(() => import('./pages/faculty/FacultyPages'), 'FacultyResearchPage')
const FacultyResponsibilitiesPage = lazyNamed(() => import('./pages/faculty/FacultyPages'), 'FacultyResponsibilitiesPage')
const FacultyWorkloadPage = lazyNamed(() => import('./pages/faculty/FacultyPages'), 'FacultyWorkloadPage')
const FacultyStatementPage = lazyNamed(() => import('./pages/faculty/FacultyPages'), 'FacultyStatementPage')
const FacultyCorrectionsPage = lazyNamed(() => import('./pages/faculty/FacultyPages'), 'FacultyCorrectionsPage')
const DeanOverview = lazyNamed(() => import('./pages/dean/DeanPages'), 'DeanOverview')
const DeanDepartmentsPage = lazyNamed(() => import('./pages/dean/DeanPages'), 'DeanDepartmentsPage')
const DeanComparisonPage = lazyNamed(() => import('./pages/dean/DeanPages'), 'DeanComparisonPage')
const DeanAnalysisPage = lazyNamed(() => import('./pages/dean/DeanPages'), 'DeanAnalysisPage')
const DeanApprovalsPage = lazyNamed(() => import('./pages/dean/DeanPages'), 'DeanApprovalsPage')
const DeanOverloadPage = lazyNamed(() => import('./pages/dean/DeanPages'), 'DeanOverloadPage')
const DeanUnderloadPage = lazyNamed(() => import('./pages/dean/DeanPages'), 'DeanUnderloadPage')
const DeanTrendsPage = lazyNamed(() => import('./pages/dean/DeanPages'), 'DeanTrendsPage')
const DeanReportsPage = lazyNamed(() => import('./pages/dean/DeanPages'), 'DeanReportsPage')
const PrincipalOverview = lazyNamed(() => import('./pages/principal/PrincipalPages'), 'PrincipalOverview')
const PrincipalInstitutionPage = lazyNamed(() => import('./pages/principal/PrincipalPages'), 'PrincipalInstitutionPage')
const PrincipalDepartmentsPage = lazyNamed(() => import('./pages/principal/PrincipalPages'), 'PrincipalDepartmentsPage')
const PrincipalFacultyPage = lazyNamed(() => import('./pages/principal/PrincipalPages'), 'PrincipalFacultyPage')
const PrincipalCompliancePage = lazyNamed(() => import('./pages/principal/PrincipalPages'), 'PrincipalCompliancePage')
const PrincipalApprovalsPage = lazyNamed(() => import('./pages/principal/PrincipalPages'), 'PrincipalApprovalsPage')
const PrincipalAnalyticsPage = lazyNamed(() => import('./pages/principal/PrincipalPages'), 'PrincipalAnalyticsPage')
const PrincipalOverloadPage = lazyNamed(() => import('./pages/principal/PrincipalPages'), 'PrincipalOverloadPage')
const PrincipalUnderloadPage = lazyNamed(() => import('./pages/principal/PrincipalPages'), 'PrincipalUnderloadPage')
const PrincipalTrendsPage = lazyNamed(() => import('./pages/principal/PrincipalPages'), 'PrincipalTrendsPage')
const PrincipalReportsPage = lazyNamed(() => import('./pages/principal/PrincipalPages'), 'PrincipalReportsPage')

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
          <Route path="profile" element={<ProfilePage role="HR" />} />
          <Route path="faculty" element={<HrFacultyPage />} />
          <Route path="faculty/:facultyId" element={<HrFacultyDetailPage />} />
          <Route path="departments" element={<HrDepartmentsPage />} />
          <Route path="policies" element={<HrPoliciesPage />} />
          <Route path="weightings" element={<HrWeightingsPage />} />
          <Route path="analytics" element={<HrAnalyticsPage />} />
          <Route path="history" element={<HrHistoryPage />} />
          <Route path="corrections" element={<HrCorrectionsPage />} />
          <Route path="compliance" element={<HrCompliancePage />} />
          <Route path="reports" element={<HrReportsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<HrSettingsPage />} />
        </Route>

        <Route path="/hod" element={<DashboardShell role="HOD" />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<HodOverview />} />
          <Route path="profile" element={<ProfilePage role="HOD" />} />
          <Route path="faculty" element={<HodFacultyPage />} />
          <Route path="faculty/:facultyId" element={<HodFacultyDetailPage />} />
          <Route path="courses" element={<HodCoursesPage />} />
          <Route path="allocations" element={<HodAllocationsPage />} />
          <Route path="timetable" element={<HodTimetablePage />} />
          <Route path="projects" element={<HodProjectsPage />} />
          <Route path="research" element={<HodResearchPage />} />
          <Route path="admin-committees" element={<HodAdminCommitteesPage />} />
          <Route path="admin" element={<Navigate to="/hod/admin-committees" replace />} />
          <Route path="committees" element={<Navigate to="/hod/admin-committees" replace />} />
          <Route path="workload" element={<HodWorkloadPage />} />
          <Route path="what-if" element={<HodWhatIfPage />} />
          <Route path="balancing" element={<HodBalancingPage />} />
          <Route path="corrections" element={<HodCorrectionsPage />} />
          <Route path="analytics" element={<HodAnalyticsPage />} />
          <Route path="reports" element={<HodReportsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>

        <Route path="/faculty" element={<DashboardShell role="FACULTY" />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<FacultyOverview />} />
          <Route path="profile" element={<ProfilePage role="FACULTY" />} />
          <Route path="courses" element={<FacultyCoursesPage />} />
          <Route path="timetable" element={<FacultyTimetablePage />} />
          <Route path="projects" element={<FacultyProjectsPage />} />
          <Route path="research" element={<FacultyResearchPage />} />
          <Route path="responsibilities" element={<FacultyResponsibilitiesPage />} />
          <Route path="workload" element={<FacultyWorkloadPage />} />
          <Route path="statement" element={<FacultyStatementPage />} />
          <Route path="corrections" element={<FacultyCorrectionsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>

        <Route path="/dean" element={<DashboardShell role="DEAN" />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DeanOverview />} />
          <Route path="profile" element={<ProfilePage role="DEAN" />} />
          <Route path="departments" element={<DeanDepartmentsPage />} />
          <Route path="comparison" element={<DeanComparisonPage />} />
          <Route path="analysis" element={<DeanAnalysisPage />} />
          <Route path="approvals" element={<DeanApprovalsPage />} />
          <Route path="overload" element={<DeanOverloadPage />} />
          <Route path="underload" element={<DeanUnderloadPage />} />
          <Route path="trends" element={<DeanTrendsPage />} />
          <Route path="reports" element={<DeanReportsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>

        <Route path="/principal" element={<DashboardShell role="PRINCIPAL" />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<PrincipalOverview />} />
          <Route path="profile" element={<ProfilePage role="PRINCIPAL" />} />
          <Route path="overview" element={<PrincipalInstitutionPage />} />
          <Route path="schools" element={<Navigate to="/principal/overview" replace />} />
          <Route path="departments" element={<PrincipalDepartmentsPage />} />
          <Route path="faculty" element={<PrincipalFacultyPage />} />
          <Route path="compliance" element={<PrincipalCompliancePage />} />
          <Route path="approvals" element={<PrincipalApprovalsPage />} />
          <Route path="analytics" element={<PrincipalAnalyticsPage />} />
          <Route path="overload" element={<PrincipalOverloadPage />} />
          <Route path="underload" element={<PrincipalUnderloadPage />} />
          <Route path="trends" element={<PrincipalTrendsPage />} />
          <Route path="reports" element={<PrincipalReportsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>

        <Route path="/login/*" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
