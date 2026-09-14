import { useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  PageHeader,
  Panel,
  Stat,
  ErrorRetry,
  TableSkeleton,
  filterByQuery,
  paginate,
  Pager,
  useApiData,
} from '../../components/DashboardShell'
import { BarChart, DonutBreakdown } from '../../components/OverviewCharts'
import { PersonAvatar, StatusPill, DataSourceBadge } from '../../components/PersonAvatar'
import { api, apiBlob, triggerDownload } from '../../lib/api'
import { authService } from '../../lib/auth'
import { workloadHoursFrom, ClassTypeBadge, classTypeLabel } from '../../lib/workloadHours'
import { formatSectionDisplay, sectionMatchesFilter } from '../../lib/sections'
import {
  ACADEMIC_SEMESTERS,
  ACADEMIC_YEARS,
  courseYear,
  matchesAcademicFilters,
  sectionsForYear,
  yearLabel,
} from '../../lib/academic'

import {
  HodDeptDashboard,
  HodDeptFacultyPage,
  HodDeptCoursesPage,
  HodDeptAssignmentsPage,
  HodDeptAnalyticsPage,
  HodDeptHistoryPage,
  HodDeptRequestsPage,
} from '../shared/DeptMonitorPages'

function useHodDept() {
  return authService.getSession()?.user.departmentId
}

/** HOD department views — same as HR, monitor only. */
export function HodOverview() {
  return <HodDeptDashboard />
}
export function HodFacultyPage() {
  return <HodDeptFacultyPage />
}
export function HodCoursesPage() {
  return <HodDeptCoursesPage />
}
export function HodAllocationsPage() {
  return <HodDeptAssignmentsPage />
}
export function HodAnalyticsPage() {
  return <HodDeptAnalyticsPage />
}
export function HodHistoryPage() {
  return <HodDeptHistoryPage />
}
export function HodRequestsMonitorPage() {
  return <HodDeptRequestsPage />
}

function AcademicFilterBar({
  year,
  semester,
  section,
  onYear,
  onSemester,
  onSection,
  showSemester = true,
}: {
  year: string
  semester?: string
  section: string
  onYear: (v: string) => void
  onSemester?: (v: string) => void
  onSection: (v: string) => void
  showSemester?: boolean
}) {
  const sectionOptions = sectionsForYear(year)
  return (
    <div className="form-grid report-filter-grid" style={{ marginBottom: '0.85rem' }}>
      <label className="field-label">
        <span>Year</span>
        <select
          className="dash-input"
          value={year}
          onChange={(e) => {
            onYear(e.target.value)
            onSection('ALL')
          }}
        >
          <option value="ALL">All years</option>
          {ACADEMIC_YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {yearLabel(y)}
            </option>
          ))}
        </select>
      </label>
      {showSemester && onSemester ? (
        <label className="field-label">
          <span>Semester</span>
          <select className="dash-input" value={semester || 'ALL'} onChange={(e) => onSemester(e.target.value)}>
            <option value="ALL">All semesters</option>
            {ACADEMIC_SEMESTERS.map((s) => (
              <option key={s} value={String(s)}>
                Semester {s}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="field-label">
        <span>Section</span>
        <select className="dash-input" value={section} onChange={(e) => onSection(e.target.value)}>
          <option value="ALL">All sections</option>
          {sectionOptions.map((s) => (
            <option key={s} value={s}>
              Section {s}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

function HodCourseTable({
  courses,
  onReload,
}: {
  courses: any[]
  onReload: () => void
}) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [yearFilter, setYearFilter] = useState('ALL')
  const [sectionFilter, setSectionFilter] = useState('ALL')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const rows = filterByQuery(
    courses.filter((c) => {
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false
      if (yearFilter !== 'ALL' && String(courseYear(c)) !== yearFilter) return false
      if (courseYear(c) === 1) return false
      if (sectionFilter !== 'ALL') {
        const secs = [c.section, ...(c.allocations || []).map((a: any) => a.section)].filter(Boolean)
        if (!secs.some((s) => sectionMatchesFilter(s, sectionFilter))) return false
      }
      return true
    }),
    query,
    (c) => `${c.code} ${c.name} ${c.type || ''} ${c.section || ''} ${c.semester || ''} ${c.status || ''}`,
  )

  async function saveName(id: string) {
    await api(`/hod/courses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: editName }),
    })
    setEditId(null)
    onReload()
  }

  async function setStatus(id: string, status: string) {
    await api(`/hod/courses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
    onReload()
  }

  return (
    <>
      <div className="form-grid" style={{ marginBottom: '0.75rem' }}>
        <input
          className="dash-input"
          placeholder="Search courses"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="dash-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <select className="dash-input" value={yearFilter} onChange={(e) => { setYearFilter(e.target.value); setSectionFilter('ALL') }}>
          <option value="ALL">All years</option>
          {ACADEMIC_YEARS.map((y) => (
            <option key={y} value={String(y)}>{yearLabel(y)}</option>
          ))}
        </select>
        <select className="dash-input" value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)}>
          <option value="ALL">All sections</option>
          {sectionsForYear(yearFilter).map((s) => (
            <option key={s} value={s}>Section {s}</option>
          ))}
        </select>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Type</th>
            <th>Year</th>
            <th>Section</th>
            <th>Hours</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td>
                <strong>{c.code}</strong>
              </td>
              <td>
                {editId === c.id ? (
                  <input className="dash-input" value={editName} onChange={(e) => setEditName(e.target.value)} />
                ) : (
                  c.name
                )}
              </td>
              <td>{c.type || '—'}</td>
              <td>{courseYear(c) ? `Y${courseYear(c)}` : '—'}</td>
              <td>
                {Array.from(
                  new Set(
                    [c.section, ...(c.allocations || []).map((a: any) => a.section)].filter(Boolean),
                  ),
                ).join(', ') || '—'}
              </td>
              <td>{c.hoursPerWeek}h/w</td>
              <td>
                <StatusPill status={c.status || 'ACTIVE'} />
              </td>
              <td>
                {editId === c.id ? (
                  <button type="button" className="btn btn-primary" onClick={() => void saveName(c.id)}>
                    Save
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setEditId(c.id)
                        setEditName(c.name)
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() =>
                        void setStatus(c.id, c.status === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE')
                      }
                    >
                      {c.status === 'INACTIVE' ? 'Activate' : 'Deactivate'}
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="empty-state">
                No courses found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  )
}

export function HodTimetablePage() {
  const timetable = useApiData(() => api<any[]>('/hod/timetable'))
  const [year, setYear] = useState('ALL')
  const [semester, setSemester] = useState('ALL')
  const [section, setSection] = useState('ALL')
  const [page, setPage] = useState(1)
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const slotRows = (timetable.data || []).filter((t: any) =>
    matchesAcademicFilters(
      t.course || {},
      { year, semester, section },
      t.batchLabel || t.course?.section,
    ),
  )
  const paged = paginate(slotRows, page, 10)

  return (
    <>
      <PageHeader
        title="Department Timetable"
        subtitle="Department timetable slots (Years 2–4)."
      />
      <ErrorRetry error={timetable.error} onRetry={() => void timetable.reload()} />
      <Panel title="Slots" action={<span className="meta-chip">{slotRows.length}</span>}>
        <AcademicFilterBar
          year={year}
          semester={semester}
          section={section}
          onYear={(v) => {
            setYear(v)
            setPage(1)
          }}
          onSemester={(v) => {
            setSemester(v)
            setPage(1)
          }}
          onSection={(v) => {
            setSection(v)
            setPage(1)
          }}
        />
        {timetable.loading && <TableSkeleton />}
        {paged.rows.length === 0 && !timetable.loading && (
          <p className="empty-state">No timetable slots for this filter.</p>
        )}
        <table className="data-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>Time</th>
              <th>Course</th>
              <th>Year</th>
              <th>Section</th>
              <th>Faculty</th>
              <th>Room</th>
            </tr>
          </thead>
          <tbody>
            {paged.rows.map((t: any) => (
              <tr key={t.id}>
                <td>{DAYS[t.dayOfWeek] || t.dayOfWeek}</td>
                <td>
                  {t.startTime}–{t.endTime}
                </td>
                <td>{t.course?.code}</td>
                <td>{courseYear(t.course || {}) ? yearLabel(courseYear(t.course || {})) : '—'}</td>
                <td>{formatSectionDisplay(t.batchLabel || t.course?.section)}</td>
                <td>{t.faculty?.name}</td>
                <td>{t.room || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pager page={paged.page} pages={paged.pages} total={paged.total} onPage={setPage} />
      </Panel>
    </>
  )
}

export function HodProjectsPage() {
  const deptId = useHodDept()
  const projects = useApiData(() => api<any[]>('/hod/projects'))
  const balance = useApiData(
    () =>
      deptId
        ? api<any>(`/workload/department/${deptId}/balance`)
        : Promise.resolve(null),
    [deptId],
  )
  const faculty = balance.data?.faculty || []
  const [form, setForm] = useState({ title: '', guideId: '', studentCount: '1' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function addProject(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await api('/hod/projects', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          guideId: form.guideId,
          studentCount: Number(form.studentCount),
          level: 'UG',
        }),
      })
      setForm({ title: '', guideId: '', studentCount: '1' })
      setMessage('Project added.')
      await projects.reload()
    } catch (err: any) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Projects" subtitle="UG/PG project guidance assignments." />
      {message && <div className="alert-banner">{message}</div>}
      <Panel title="Add project">
        <form onSubmit={(e) => void addProject(e)} className="form-grid">
          <input
            className="dash-input"
            placeholder="Title"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <select
            className="dash-input"
            required
            value={form.guideId}
            onChange={(e) => setForm({ ...form, guideId: e.target.value })}
          >
            <option value="">Guide</option>
            {faculty.map((f: any) => (
              <option key={f.facultyId} value={f.facultyId}>
                {f.name}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-secondary" disabled={busy}>
            Add project
          </button>
        </form>
      </Panel>
      <Panel title="Project list">
        <ul className="plain-list">
          {(projects.data || []).map((p: any) => (
            <li key={p.id}>
              <strong>{p.title}</strong> · guide {p.guide?.name} · {p.studentCount}{' '}
              students
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}

export function HodWorkloadPage() {
  const deptId = useHodDept()
  const balance = useApiData(
    () =>
      deptId
        ? api<any>(`/workload/department/${deptId}/balance`)
        : Promise.resolve(null),
    [deptId],
  )
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const allFaculty = balance.data?.faculty || []
  const faculty = filterByQuery(
    allFaculty.filter((f: any) => (statusFilter === 'ALL' ? true : f.status === statusFilter)),
    query,
    (f: any) => `${f.facultyCode || ''} ${f.name || ''} ${f.status || ''}`,
  )
  const paged = paginate(faculty, page, 10)
  const kpi = {
    total: allFaculty.length,
    normal: allFaculty.filter((f: any) => f.status === 'NORMAL').length,
    underload: allFaculty.filter((f: any) => f.status === 'UNDERLOAD').length,
    overload: allFaculty.filter((f: any) => f.status === 'OVERLOAD').length,
  }
  return (
    <>
      <PageHeader
        title="Faculty Workload"
        subtitle="Department teaching load by faculty. Teaching is taken from Course Allocation only."
      />
      <ErrorRetry error={balance.error} onRetry={() => void balance.reload()} />
      {balance.loading && <TableSkeleton cols={10} />}
      <div className="stat-grid">
        <Stat label="Total Faculty" value={kpi.total} />
        <Stat label="Normal" value={kpi.normal} />
        <Stat label="Underload" value={kpi.underload} />
        <Stat label="Overload" value={kpi.overload} />
      </div>
      <Panel
        title="Faculty load"
        action={<span className="panel-meta">{faculty.length} matching</span>}
      >
        <div className="form-grid" style={{ marginBottom: '0.75rem' }}>
          <input
            className="dash-input"
            placeholder="Search faculty"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
          />
          <select
            className="dash-input"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="ALL">All statuses</option>
            <option value="NORMAL">Normal</option>
            <option value="OVERLOAD">Overload</option>
            <option value="UNDERLOAD">Underload</option>
          </select>
        </div>
        {paged.rows.length === 0 && (
          <p className="empty-state">No faculty match the selected filters.</p>
        )}
        {paged.rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="data-table compact-table">
              <thead>
                <tr>
                  <th>Faculty</th>
                  <th>Teaching</th>
                  <th>Total</th>
                  <th>Norm</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paged.rows.map((f: any) => (
                  <tr key={f.facultyId}>
                    <td>
                      <div className="person-cell">
                        <PersonAvatar name={f.name || f.facultyCode} email={f.email} photoUrl={f.photoUrl} />
                        <div className="person-meta">
                          <strong>
                            <Link to={`/hod/faculty/${f.facultyId}`}>{f.name}</Link>
                          </strong>
                          <span>
                            {f.designation || f.facultyCode}
                            {f.dataSource === 'DEMO' ? ' · ' : ''}
                            <DataSourceBadge source={f.dataSource} />
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>{Number(f.teachingWeighted || 0).toFixed(1)}</td>
                    <td>
                      <strong>{Number(f.total || 0).toFixed(1)}</strong>
                    </td>
                    <td>
                      {f.normMin}–{f.normMax}
                    </td>
                    <td>
                      <StatusPill status={f.status} />
                    </td>
                    <td>
                      <Link className="open-profile-link" to={`/hod/faculty/${f.facultyId}`}>
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={paged.page} pages={paged.pages} onPage={setPage} />
      </Panel>

      <Panel title="Detailed breakdown">
        <table className="data-table">
          <thead>
            <tr>
              <th>Faculty</th>
              <th>Theory</th>
              <th>Tutorial</th>
              <th>Lab</th>
              <th>UG</th>
              <th>PG</th>
              <th>PhD</th>
              <th>Research</th>
              <th>Admin</th>
              <th>Committee</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {paged.rows.map((f: any) => (
              <tr key={`detail-${f.facultyId}`}>
                <td>
                  <Link to={`/hod/faculty/${f.facultyId}`}>
                    {f.facultyCode} · {f.name}
                  </Link>
                </td>
                <td>{f.theoryWeighted?.toFixed?.(2) ?? '0.00'}</td>
                <td>{f.tutorialWeighted?.toFixed?.(2) ?? '0.00'}</td>
                <td>{f.labWeighted?.toFixed?.(2) ?? '0.00'}</td>
                <td>{f.ugProjectsWeighted?.toFixed?.(2) ?? '0.00'}</td>
                <td>{f.pgProjectsWeighted?.toFixed?.(2) ?? '0.00'}</td>
                <td>{f.phdWeighted?.toFixed?.(2)}</td>
                <td>{f.researchWeighted?.toFixed?.(2)}</td>
                <td>{f.adminWeighted?.toFixed?.(2)}</td>
                <td>{f.committeeWeighted?.toFixed?.(2)}</td>
                <td>
                  <strong>{f.total?.toFixed?.(2)}</strong>
                </td>
                <td>
                  <StatusPill status={f.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  )
}

export function HodWhatIfPage() {
  const deptId = useHodDept()
  const balance = useApiData(
    () =>
      deptId
        ? api<any>(`/workload/department/${deptId}/balance`)
        : Promise.resolve(null),
    [deptId],
  )
  const faculty = balance.data?.faculty || []
  const [facultyId, setFacultyId] = useState('')
  const [activityType, setActivityType] = useState('THEORY')
  const [additionalHours, setAdditionalHours] = useState('4')
  const [simResult, setSimResult] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function runSim(id = facultyId) {
    if (!id) return
    setBusy(true)
    try {
      const result = await api(`/workload/simulate`, {
        method: 'POST',
        body: JSON.stringify({
          facultyId: id,
          activityType,
          additionalHours: Number(additionalHours),
        }),
      })
      setFacultyId(id)
      setSimResult(result)
      setMessage('Simulation completed. No database changes were made.')
    } catch (e: any) {
      setMessage(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="What-if Simulation" subtitle="Test a proposed change before it is saved." />
      {message && <div className="alert-banner">{message}</div>}
      <Panel title="Inputs">
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault()
            void runSim()
          }}
        >
          <select className="dash-input" required value={facultyId} onChange={(e) => setFacultyId(e.target.value)}>
            <option value="">Faculty</option>
            {faculty.map((f: any) => (
              <option key={f.facultyId} value={f.facultyId}>
                {f.name} · {f.total?.toFixed?.(1)}
              </option>
            ))}
          </select>
          <select className="dash-input" value={activityType} onChange={(e) => setActivityType(e.target.value)}>
            <option value="THEORY">Theory</option>
            <option value="TUTORIAL">Tutorial</option>
            <option value="LABORATORY">Laboratory</option>
          </select>
          <input
            className="dash-input"
            type="number"
            min="0.5"
            step="0.5"
            value={additionalHours}
            onChange={(e) => setAdditionalHours(e.target.value)}
          />
          <button className="btn btn-primary" disabled={busy} type="submit">
            Simulate
          </button>
        </form>
      </Panel>
      {simResult && (
        <Panel title="Result">
          <div className="stat-grid">
            <Stat label="Current" value={simResult.current?.total?.toFixed?.(2)} />
            <Stat label="Additional" value={simResult.additional} />
            <Stat label="Projected" value={simResult.projected?.total?.toFixed?.(2)} />
            <Stat label="Maximum" value={simResult.maximum} />
            <Stat label="Status" value={simResult.status} />
          </div>
          {simResult.status === 'OVERLOAD' && (
            <>
              <p style={{ marginTop: '0.75rem' }}>Suitable faculty in the same department:</p>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Faculty</th>
                    <th>Current</th>
                    <th>Capacity</th>
                    <th>Projected</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(simResult.alternatives || []).map((a: any) => (
                    <tr key={a.targetFacultyId}>
                      <td>{a.name || a.facultyCode}</td>
                      <td>{a.current?.toFixed?.(1)}</td>
                      <td>{a.capacity?.toFixed?.(1)}</td>
                      <td>{a.projected?.toFixed?.(1)} {a.suitable ? 'Suitable' : 'Not suitable'}</td>
                      <td>
                        {a.suitable && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => void runSim(a.targetFacultyId)}
                          >
                            Simulate this faculty
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Panel>
      )}
    </>
  )
}

export function HodBalancingPage() {
  const deptId = useHodDept()
  const balance = useApiData(
    () =>
      deptId
        ? api<any>(`/workload/department/${deptId}/balance`)
        : Promise.resolve(null),
    [deptId],
  )
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const faculty = balance.data?.faculty || []
  const overloaded = faculty.filter((f: any) => f.status === 'OVERLOAD')
  const normal = faculty.filter((f: any) => f.status === 'NORMAL')
  const underloaded = faculty.filter((f: any) => f.status === 'UNDERLOAD')

  async function confirmMove(s: any) {
    setBusy(true)
    try {
      await api('/workload/balance/apply', {
        method: 'POST',
        body: JSON.stringify({
          moves: [
            {
              fromFacultyId: s.fromFacultyId,
              toFacultyId: s.toFacultyId,
              hours: s.suggestedHours,
            },
          ],
        }),
      })
      await balance.reload()
      setMessage('Reallocation applied after confirmation.')
    } catch (e: any) {
      setMessage(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Workload Balancing" subtitle="Suggestions preview. Leave transfers are accepted only by Uttej (Workload Controller)." />
      {message && <div className="alert-banner">{message}</div>}
      <div className="balancing-grid">
        <Panel
          title="Overloaded"
          action={<span className="meta-chip meta-chip-danger">{overloaded.length}</span>}
        >
          {overloaded.length === 0 ? (
            <p className="empty-state">No overloaded faculty.</p>
          ) : (
            <ul className="balance-roster">
              {overloaded
                .slice()
                .sort((a: any, b: any) => Number(b.total || 0) - Number(a.total || 0))
                .map((f: any) => (
                  <li key={f.facultyId} className="balance-roster-item is-overload">
                    <div className="balance-roster-main">
                      <strong>{f.name}</strong>
                      <span className="balance-roster-sub">Above max load</span>
                    </div>
                    <span className="balance-hours is-overload">{Number(f.total).toFixed(1)}h</span>
                  </li>
                ))}
            </ul>
          )}
        </Panel>
        <Panel
          title="Available capacity"
          action={
            <span className="meta-chip meta-chip-ok">
              {underloaded.concat(normal).length}
            </span>
          }
        >
          <ul className="balance-roster">
            {underloaded
              .concat(normal)
              .slice()
              .sort(
                (a: any, b: any) =>
                  Number(b.availableCapacity || 0) - Number(a.availableCapacity || 0),
              )
              .map((f: any) => (
                <li
                  key={f.facultyId}
                  className={`balance-roster-item ${f.status === 'UNDERLOAD' ? 'is-under' : 'is-normal'}`}
                >
                  <div className="balance-roster-main">
                    <strong>{f.name}</strong>
                    <span className="balance-roster-sub">
                      {f.status === 'UNDERLOAD' ? 'Underload' : 'Normal'} · room for{' '}
                      {Number(f.availableCapacity || 0).toFixed(1)}h
                    </span>
                  </div>
                  <div className="balance-metrics">
                    <span className="balance-hours">{Number(f.total).toFixed(1)}h</span>
                    <span className="balance-capacity">
                      +{Number(f.availableCapacity || 0).toFixed(1)}
                    </span>
                  </div>
                </li>
              ))}
          </ul>
        </Panel>
      </div>
      <Panel
        title="Proposed reallocations"
        action={
          <span className="meta-chip">{(balance.data?.suggestions || []).length}</span>
        }
      >
        {(balance.data?.suggestions || []).length === 0 ? (
          <p className="empty-state">No reallocation suggestions.</p>
        ) : (
          <div className="balance-suggestions">
            {(balance.data?.suggestions || []).map((s: any, i: number) => (
              <div key={i} className="balance-suggestion-card">
                <div className="balance-suggestion-move">
                  <div className="balance-suggestion-party">
                    <span className="balance-suggestion-label">From</span>
                    <strong>{s.fromName}</strong>
                    <span className="balance-suggestion-nums">
                      {s.beforeFrom?.toFixed?.(1)}h → {s.afterFrom?.toFixed?.(1)}h
                    </span>
                  </div>
                  <div className="balance-suggestion-arrow" aria-hidden>
                    → {s.suggestedHours}h
                  </div>
                  <div className="balance-suggestion-party">
                    <span className="balance-suggestion-label">To</span>
                    <strong>{s.toName}</strong>
                    <span className="balance-suggestion-nums">
                      {s.beforeTo?.toFixed?.(1)}h → {s.afterTo?.toFixed?.(1)}h
                    </span>
                  </div>
                </div>
                {s.reason && <p className="balance-suggestion-reason">{s.reason}</p>}
                <div className="balance-suggestion-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => void confirmMove(s)}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  )
}

export function HodReportsPage() {
  const deptId = useHodDept()
  async function exportFile(kind: 'excel' | 'csv') {
    if (!deptId) return
    const blob = await apiBlob(`/reports/department/${deptId}/${kind}`)
    triggerDownload(blob, kind === 'csv' ? 'department-workload.csv' : 'department-workload.xlsx')
  }
  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Department workload exports (monitor only)."
        action={
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => void exportFile('csv')}>
              Download CSV
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void exportFile('excel')}>
              Download Excel
            </button>
          </div>
        }
      />
      <Panel title="Exports">
        <p className="empty-state">
          Download Excel or CSV for the active period. Assignment and approval actions are handled by HR / Uttej.
        </p>
      </Panel>
    </>
  )
}

export function HodFacultyDetailPage() {
  const { facultyId } = useParams()
  const detail = useApiData(() => api<any>(`/hod/faculty/${facultyId}`), [facultyId])
  const allocations = useApiData(() => api<any[]>('/hod/allocations'), [facultyId])
  const timetable = useApiData(() => api<any[]>('/hod/timetable'), [facultyId])
  const f = detail.data?.faculty
  const b = detail.data?.breakdown
  const hours = workloadHoursFrom(b || {})
  const myAllocations = (allocations.data || []).filter(
    (a: any) => String(a.facultyId || a.faculty?.id) === String(facultyId),
  )
  const mySlots = (timetable.data || []).filter(
    (t: any) => String(t.facultyId || t.faculty?.id) === String(facultyId),
  )
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <>
      <PageHeader
        title="Faculty Profile"
        subtitle="Current workload and teaching focus."
        action={
          <Link to="/hod/faculty" className="btn btn-secondary btn-sm">
            ← Back
          </Link>
        }
      />
      {detail.loading && <TableSkeleton />}
      {f && (
        <section className="profile-hero-card profile-hero-compact">
          <PersonAvatar name={f.name} photoUrl={f.photoUrl} />
          <div className="profile-hero-meta">
            <h2 className="profile-hero-name">{f.name}</h2>
            <p className="profile-hero-title">
              {f.designation || '—'}
              {f.department?.code ? ` · ${f.department.code}` : ''}
            </p>
            <StatusPill status={hours.status || b?.status || '—'} />
          </div>
        </section>
      )}

      {b && (
        <div className="workload-highlight-panel">
          <Panel title="Current workload">
            <div className="stat-grid workload-highlight-grid">
              <Stat label="Required Hours" value={hours.requiredHours} />
              <Stat label="Assigned Hours" value={hours.assignedHours} />
              <Stat label="Remaining Hours" value={hours.remainingHours} />
              <Stat label="Workload Status" value={hours.status} />
            </div>
          </Panel>
        </div>
      )}

      <div className="grid-2">
        <Panel title="Current courses / subjects" action={<span className="meta-chip">{myAllocations.length}</span>}>
          <table className="data-table compact-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Section</th>
                <th>Type</th>
                <th>Hours</th>
              </tr>
            </thead>
            <tbody>
              {myAllocations.map((a: any) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.course?.code || '—'}</strong>
                  </td>
                  <td>{formatSectionDisplay(a.section || a.course?.section)}</td>
                  <td>
                    <ClassTypeBadge type={classTypeLabel(a.classType, a.course?.type)} />
                  </td>
                  <td>{a.hours ?? '—'}</td>
                </tr>
              ))}
              {myAllocations.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-state">
                    No current course allocations.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>
        <Panel title="Current classes / timetable" action={<span className="meta-chip">{mySlots.length}</span>}>
          <table className="data-table compact-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Time</th>
                <th>Course</th>
                <th>Room</th>
              </tr>
            </thead>
            <tbody>
              {mySlots.map((t: any) => (
                <tr key={t.id}>
                  <td>{DAYS[t.dayOfWeek] || t.dayOfWeek}</td>
                  <td>
                    {t.startTime}–{t.endTime}
                  </td>
                  <td>{t.course?.code || '—'}</td>
                  <td>{t.room || '—'}</td>
                </tr>
              ))}
              {mySlots.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-state">
                    No timetable slots assigned.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  )
}

function SimpleCrudPage({
  title,
  listPath,
  createPath,
  fields,
  renderRow,
  embedded,
}: {
  title: string
  listPath: string
  createPath: string
  fields: Array<{ name: string; placeholder: string; options?: string[] }>
  renderRow: (row: any) => ReactNode
  embedded?: boolean
}) {
  const rows = useApiData(() => api<any[]>(listPath))
  const deptId = useHodDept()
  const balance = useApiData(
    () => (deptId ? api<any>(`/workload/department/${deptId}/balance`) : Promise.resolve(null)),
    [deptId],
  )
  const [form, setForm] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const list = rows.data || []

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = { ...form }
    for (const f of fields) {
      if (f.options && !payload[f.name]) payload[f.name] = f.options[0]
    }
    await api(createPath, { method: 'POST', body: JSON.stringify(payload) })
    setMessage('Saved.')
    setForm({})
    await rows.reload()
  }

  const formPanel = (
    <Panel title={embedded ? `Add ${title.toLowerCase()}` : 'Add'}>
      <form className={`form-grid${embedded ? ' form-grid-stacked' : ''}`} onSubmit={(e) => void onSubmit(e)}>
        {fields.map((f) =>
          f.name === 'facultyId' || f.name === 'guideId' ? (
            <label key={f.name} className="field-label">
              <span>{f.placeholder}</span>
              <select
                className="dash-input"
                required
                value={form[f.name] || ''}
                onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
              >
                <option value="">Select faculty</option>
                {(balance.data?.faculty || []).map((fac: any) => (
                  <option key={fac.facultyId} value={fac.facultyId}>{fac.name}</option>
                ))}
              </select>
            </label>
          ) : f.options ? (
            <label key={f.name} className="field-label">
              <span>{f.placeholder}</span>
              <select
                className="dash-input"
                value={form[f.name] || f.options[0]}
                onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
              >
                {f.options.map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
          ) : (
            <label key={f.name} className="field-label">
              <span>{f.placeholder}</span>
              <input
                className="dash-input"
                placeholder={f.placeholder}
                value={form[f.name] || ''}
                onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
              />
            </label>
          ),
        )}
        <div className="form-actions">
          <button className="btn btn-primary" type="submit">Save</button>
        </div>
      </form>
    </Panel>
  )

  const listPanel = (
    <Panel
      title={embedded ? title : 'Records'}
      action={<span className="meta-chip">{list.length}</span>}
    >
      {list.length === 0 ? (
        <p className="empty-state">No {title.toLowerCase()} records yet.</p>
      ) : (
        <ul className="role-roster">
          {list.map((r) => (
            <li key={r.id} className="role-roster-item">
              {renderRow(r)}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )

  const body = (
    <>
      {message && <div className="alert-banner">{message}</div>}
      {formPanel}
      {listPanel}
    </>
  )

  return (
    <>
      {!embedded && <PageHeader title={title} />}
      {embedded ? <div className="crud-column">{body}</div> : body}
    </>
  )
}

export function HodResearchPage() {
  return (
    <SimpleCrudPage
      title="Research"
      listPath="/hod/research"
      createPath="/hod/research"
      fields={[
        { name: 'facultyId', placeholder: 'Faculty' },
        { name: 'projectTitle', placeholder: 'Title' },
        { name: 'role', placeholder: 'Role', options: ['Principal Investigator', 'Co-Investigator', 'Researcher'] },
        { name: 'commitmentPct', placeholder: 'Commitment %' },
      ]}
      renderRow={(r) => (
        <div className="role-roster-row">
          <div className="role-roster-main">
            <strong>{r.faculty?.name || 'Faculty'}</strong>
            <span className="role-roster-sub">{r.projectTitle}</span>
          </div>
          <span className="role-badge">{r.role}</span>
          <span className="meta-chip">{r.commitmentPct}%</span>
        </div>
      )}
    />
  )
}

export function HodAdminCommitteesPage() {
  return (
    <>
      <PageHeader
        title="Administration & Committees"
        subtitle="Department administrative roles and committee memberships in one place."
      />
      <div className="admin-committees-grid">
        <SimpleCrudPage
          embedded
          title="Administration"
          listPath="/hod/admin-roles"
          createPath="/hod/admin-roles"
          fields={[
            { name: 'facultyId', placeholder: 'Faculty' },
            { name: 'roleName', placeholder: 'Role', options: ['Department Coordinator', 'Class Coordinator', 'Lab Coordinator', 'Exam Coordinator', 'Placement Coordinator', 'Admission Coordinator'] },
          ]}
          renderRow={(r) => (
            <div className="role-roster-row">
              <div className="role-roster-main">
                <strong>{r.faculty?.name || 'Faculty'}</strong>
                {(r.scopeLabel || r.duration) && (
                  <span className="role-roster-sub">
                    {[r.scopeLabel, r.duration].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
              <span className="role-badge">{r.roleName}</span>
            </div>
          )}
        />
        <SimpleCrudPage
          embedded
          title="Committees"
          listPath="/hod/committees"
          createPath="/hod/committees"
          fields={[
            { name: 'facultyId', placeholder: 'Faculty' },
            { name: 'name', placeholder: 'Committee' },
            { name: 'role', placeholder: 'Role', options: ['Chairperson', 'Coordinator', 'Member'] },
          ]}
          renderRow={(r) => (
            <div className="role-roster-row">
              <div className="role-roster-main">
                <strong>{r.faculty?.name || 'Faculty'}</strong>
                <span className="role-roster-sub">{r.committee?.name || r.name || 'Committee'}</span>
              </div>
              <span className="role-badge">{r.role}</span>
            </div>
          )}
        />
      </div>
    </>
  )
}

export function HodAdminPage() {
  return <HodAdminCommitteesPage />
}

export function HodCommitteesPage() {
  return <HodAdminCommitteesPage />
}

export function HodCorrectionsPage() {
  const corrections = useApiData(() => api<any[]>('/hod/corrections'))

  return (
    <>
      <PageHeader
        title="Correction Requests"
        subtitle="Department correction requests (monitor only — HR reviews)."
      />
      <ErrorRetry error={corrections.error} onRetry={() => void corrections.reload()} />
      <Panel title="Queue">
        {(corrections.data || []).length === 0 && (
          <p className="empty-state">No correction requests.</p>
        )}
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {(corrections.data || []).map((c) => (
            <div key={c.id} className="list-card">
              <div className="person-cell">
                <PersonAvatar
                  name={c.submittedBy?.name || 'User'}
                  email={c.submittedBy?.email}
                />
                <div className="person-meta">
                  <strong>
                    {c.issueCategory} · <StatusPill status={c.status} />
                  </strong>
                  <span>{c.description}</span>
                  {(c.currentValue || c.expectedValue) && (
                    <span>
                      Current: {c.currentValue || '—'} → Expected: {c.expectedValue || '—'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
