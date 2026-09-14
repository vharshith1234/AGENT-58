import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ErrorRetry,
  PageHeader,
  Panel,
  Stat,
  TableSkeleton,
  filterByQuery,
  paginate,
  Pager,
  useApiData,
} from '../../components/DashboardShell'
import { BarChart, DonutBreakdown } from '../../components/OverviewCharts'
import { PersonAvatar, StatusPill } from '../../components/PersonAvatar'
import { api } from '../../lib/api'
import { authService } from '../../lib/auth'
import {
  ACADEMIC_SEMESTERS,
  ACADEMIC_YEARS,
  courseYear,
  matchesAcademicFilters,
  sectionsForYear,
  yearLabel,
} from '../../lib/academic'
import { formatSectionDisplay } from '../../lib/sections'
import {
  ClassTypeBadge,
  classTypeLabel,
  hoursLabel,
  workloadHoursFrom,
} from '../../lib/workloadHours'

function useHodDept() {
  return authService.getSession()?.user.departmentId
}

function requestPriority(row: any) {
  if (row.priority) return String(row.priority)
  if (row.fromStatusAfter === 'OVERLOAD' || row.toStatusAfter === 'OVERLOAD') return 'High'
  if (String(row.status || '').includes('PENDING')) return 'Medium'
  return null
}

/** HOD Dashboard — same layout as HR, department-scoped, view only. */
export function HodDeptDashboard() {
  const deptId = useHodDept()
  const dash = useApiData(() => api<any>('/hod/dashboard'), [deptId])
  const allocations = useApiData(() => api<any[]>('/hod/allocations'), [deptId])
  const courses = useApiData(() => api<any[]>('/hod/courses'), [deptId])
  const pendingReq = useApiData(() => api<any[]>('/hod/reassignments'), [deptId])
  const corrections = useApiData(() => api<any[]>('/hod/corrections'), [deptId])

  const faculty = dash.data?.balance?.faculty || []
  const totalFaculty = faculty.length
  const normal = faculty.filter((f: any) => f.status === 'NORMAL').length
  const overload = faculty.filter((f: any) => f.status === 'OVERLOAD').length
  const underload = faculty.filter((f: any) => f.status === 'UNDERLOAD').length
  const courseCount = (courses.data || []).filter((c: any) => {
    const y = courseYear(c)
    return y === 2 || y === 3 || y === 4
  }).length
  const pending =
    (pendingReq.data || []).filter((r: any) => String(r.status || '').includes('PENDING')).length +
    (corrections.data || []).filter((c: any) => String(c.status || '').toUpperCase() === 'PENDING')
      .length

  const recent = useMemo(() => {
    const leave = (pendingReq.data || [])
      .filter((r: any) => String(r.status || '').includes('PENDING'))
      .map((r: any) => ({
        id: `leave-${r.id}`,
        type: 'Leave / Reassignment',
        by: r.createdBy?.name || r.fromFaculty?.name || 'Faculty',
        date: r.createdAt || r.date,
        status: r.status || 'PENDING',
        priority: requestPriority(r),
      }))
    const corr = (corrections.data || [])
      .filter((c: any) => String(c.status || '').toUpperCase() === 'PENDING')
      .map((c: any) => ({
        id: `corr-${c.id}`,
        type: c.issueCategory || 'Correction',
        by: c.submittedBy?.name || c.faculty?.name || 'Faculty',
        date: c.createdAt,
        status: c.status || 'PENDING',
        priority: 'Medium',
      }))
    return [...leave, ...corr]
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
      .slice(0, 6)
  }, [pendingReq.data, corrections.data])

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Department workload snapshot (monitor only — same view as HR)."
      />
      <ErrorRetry
        error={dash.error || allocations.error}
        onRetry={() => {
          void dash.reload()
          void allocations.reload()
        }}
      />
      {dash.loading && <TableSkeleton />}
      <div className="stat-grid">
        <Stat label="Total Faculty" value={totalFaculty || '—'} />
        <Stat label="Total Courses" value={courseCount || '—'} />
        <Stat label="Normal" value={normal} />
        <Stat label="Underload" value={underload} />
        <Stat label="Overload" value={overload} />
        <Stat label="Pending Requests" value={pending} />
      </div>
      <div className="grid-2">
        <DonutBreakdown
          title="Current workload status"
          segments={[
            { label: 'Normal', value: normal, color: '#059669' },
            { label: 'Overload', value: overload, color: '#dc2626' },
            { label: 'Underload', value: underload, color: '#2563eb' },
          ]}
        />
        <Panel
          title="Recent Requests"
          action={
            <Link className="btn btn-primary btn-sm" to="/hod/requests">
              Open Requests
            </Link>
          }
        >
          {recent.length === 0 ? (
            <p className="empty-state">No open requests right now.</p>
          ) : (
            <div className="request-card-list">
              {recent.map((r) => (
                <article key={r.id} className="request-card">
                  <div className="request-card-top">
                    <strong>{r.type}</strong>
                    <StatusPill status={r.status} />
                  </div>
                  <div className="request-card-meta">
                    <span>
                      <i className="fa-solid fa-user" aria-hidden /> {r.by}
                    </span>
                    <span>
                      <i className="fa-regular fa-calendar" aria-hidden />{' '}
                      {r.date ? new Date(r.date).toLocaleDateString() : '—'}
                    </span>
                    {r.priority ? (
                      <span className={`priority-chip priority-${String(r.priority).toLowerCase()}`}>
                        {r.priority}
                      </span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  )
}

/** HOD Faculty — same directory style as HR, no Add. */
export function HodDeptFacultyPage() {
  const navigate = useNavigate()
  const deptId = useHodDept()
  const balance = useApiData(
    () => (deptId ? api<any>(`/workload/department/${deptId}/balance`) : Promise.resolve(null)),
    [deptId],
  )
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(1)

  const faculty = filterByQuery(
    (balance.data?.faculty || []).filter((f: any) => {
      if (statusFilter === 'ALL') return true
      if (statusFilter === 'Active') return f.status === 'NORMAL' || f.status === 'UNDERLOAD' || f.status === 'OVERLOAD'
      if (statusFilter === 'Inactive') return false
      return f.status === statusFilter
    }),
    query,
    (f: any) => `${f.facultyCode || ''} ${f.name || ''} ${f.email || ''} ${f.designation || ''}`,
  )
  const paged = paginate(faculty, page, 10)
  const deptName = balance.data?.department?.name || balance.data?.departmentName || 'Department'

  return (
    <>
      <PageHeader
        title="Faculty"
        subtitle="Department faculty directory (view only — same layout as HR)."
        action={
          <button type="button" className="btn btn-secondary" onClick={() => void balance.reload()}>
            Refresh
          </button>
        }
      />
      <ErrorRetry error={balance.error} onRetry={() => void balance.reload()} />
      {balance.loading && <TableSkeleton />}
      <section className="panel faculty-directory-panel">
        <div className="panel-head" style={{ marginBottom: '0.65rem' }}>
          <h2>Faculty directory</h2>
          <span className="meta-chip">{faculty.length}</span>
        </div>
        <div className="form-grid" style={{ marginBottom: '0.85rem' }}>
          <input
            className="dash-input"
            placeholder="Search name, ID, email"
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
            <option value="UNDERLOAD">Underload</option>
            <option value="OVERLOAD">Overload</option>
          </select>
          <input className="dash-input" value={deptName} disabled />
        </div>
        <div className="overflow-x-auto">
          <table className="data-table faculty-drims-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Faculty Member</th>
                <th>Assigned</th>
                <th>Required</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paged.rows.map((f: any) => {
                const hours = workloadHoursFrom(f)
                return (
                  <tr key={f.facultyId}>
                    <td>
                      <strong className="faculty-id">{f.facultyCode || '—'}</strong>
                    </td>
                    <td>
                      <div className="person-cell">
                        <PersonAvatar name={f.name} email={f.email} photoUrl={f.photoUrl} />
                        <div className="person-meta">
                          <strong>{f.name}</strong>
                          <span>{f.designation || '—'}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="count-badge">{hours.assignedHours}</span>
                    </td>
                    <td>{hours.requiredHours}</td>
                    <td>
                      <StatusPill status={hours.status || f.status} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="open-profile-link"
                        onClick={() => navigate(`/hod/faculty/${f.facultyId}`)}
                      >
                        OPEN PROFILE →
                      </button>
                    </td>
                  </tr>
                )
              })}
              {!balance.loading && paged.rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state">
                    No faculty records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager page={paged.page} pages={paged.pages} total={paged.total} onPage={setPage} />
      </section>
    </>
  )
}

/** HOD Courses — same list/filters as HR, no Add course. */
export function HodDeptCoursesPage() {
  const courses = useApiData(() => api<any[]>('/hod/courses'))
  const [page, setPage] = useState(1)
  const [year, setYear] = useState('ALL')
  const [semester, setSemester] = useState('ALL')
  const [section, setSection] = useState('ALL')
  const [search, setSearch] = useState('')
  const sectionOptions = sectionsForYear(year)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (courses.data || []).filter((c: any) => {
      if (!matchesAcademicFilters(c, { year, semester, section }, c.section)) return false
      if (!q) return true
      return `${c.code || ''} ${c.name || ''}`.toLowerCase().includes(q)
    })
  }, [courses.data, year, semester, section, search])

  const paged = paginate(filtered, page, 10)

  return (
    <>
      <PageHeader
        title="Courses"
        subtitle="Department course catalogue (view only — same filters as HR)."
      />
      <ErrorRetry error={courses.error} onRetry={() => void courses.reload()} />
      <Panel title="Course list" action={<span className="meta-chip">{filtered.length}</span>}>
        <div className="form-grid report-filter-grid" style={{ marginBottom: '0.85rem' }}>
          <label className="field-label">
            <span>Year</span>
            <select
              className="dash-input"
              value={year}
              onChange={(e) => {
                setYear(e.target.value)
                setSection('ALL')
                setPage(1)
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
          <label className="field-label">
            <span>Semester</span>
            <select
              className="dash-input"
              value={semester}
              onChange={(e) => {
                setSemester(e.target.value)
                setPage(1)
              }}
            >
              <option value="ALL">All semesters</option>
              {ACADEMIC_SEMESTERS.map((s) => (
                <option key={s} value={String(s)}>
                  Semester {s}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            <span>Section</span>
            <select
              className="dash-input"
              value={section}
              onChange={(e) => {
                setSection(e.target.value)
                setPage(1)
              }}
            >
              <option value="ALL">All sections</option>
              {sectionOptions.map((s) => (
                <option key={s} value={s}>
                  Section {s}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            <span>Search</span>
            <input
              className="dash-input"
              placeholder="Code or name"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </label>
        </div>
        {courses.loading && <TableSkeleton />}
        <table className="data-table compact-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Year</th>
              <th>Semester</th>
              <th>Section</th>
              <th>Type</th>
              <th>Hours</th>
            </tr>
          </thead>
          <tbody>
            {paged.rows.map((c: any) => {
              const y = courseYear(c)
              return (
                <tr key={c.id}>
                  <td>
                    <strong>{c.code}</strong>
                  </td>
                  <td>{c.name}</td>
                  <td>{y ? yearLabel(y) : '—'}</td>
                  <td>{c.semester ?? '—'}</td>
                  <td>{formatSectionDisplay(c.section)}</td>
                  <td>{c.type || '—'}</td>
                  <td>{c.hoursPerWeek != null ? `${c.hoursPerWeek}h/w` : '—'}</td>
                </tr>
              )
            })}
            {!courses.loading && paged.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-state">
                  No courses match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pager page={paged.page} pages={paged.pages} total={paged.total} onPage={setPage} />
      </Panel>
    </>
  )
}

/** HOD Assignments — same Current Allocations view as HR, no allocate/edit/remove. */
export function HodDeptAssignmentsPage() {
  const allocations = useApiData(() => api<any[]>('/hod/allocations'))
  const [allocCourseQ, setAllocCourseQ] = useState('')
  const [allocFacultyQ, setAllocFacultyQ] = useState('')
  const [allocSection, setAllocSection] = useState('ALL')
  const [allocClassType, setAllocClassType] = useState('ALL')
  const [year, setYear] = useState('ALL')
  const [semester, setSemester] = useState('ALL')
  const [allocPage, setAllocPage] = useState(1)
  const sectionOptions = sectionsForYear(year)

  const filteredAllocs = useMemo(() => {
    let rows = allocations.data || []
    const cq = allocCourseQ.trim().toLowerCase()
    const fq = allocFacultyQ.trim().toLowerCase()
    rows = rows.filter((a: any) =>
      matchesAcademicFilters(
        a.course || {},
        { year, semester, section: allocSection },
        a.section || a.course?.section,
      ),
    )
    if (cq) {
      rows = rows.filter((a: any) =>
        `${a.course?.code || ''} ${a.course?.name || ''}`.toLowerCase().includes(cq),
      )
    }
    if (fq) {
      rows = rows.filter((a: any) => String(a.faculty?.name || '').toLowerCase().includes(fq))
    }
    if (allocClassType !== 'ALL') {
      rows = rows.filter(
        (a: any) => classTypeLabel(a.classType, a.course?.type) === allocClassType,
      )
    }
    return rows
  }, [allocations.data, allocCourseQ, allocFacultyQ, allocSection, allocClassType, year, semester])

  const allocPaged = paginate(filteredAllocs, allocPage, 10)

  return (
    <>
      <PageHeader
        title="Assignments"
        subtitle="Current course allocations (view only — HR allocates)."
      />
      <ErrorRetry error={allocations.error} onRetry={() => void allocations.reload()} />
      <Panel title="Current allocations" action={<span className="meta-chip">{filteredAllocs.length}</span>}>
        <div className="form-grid report-filter-grid" style={{ marginBottom: '0.65rem' }}>
          <label className="field-label">
            <span>Year</span>
            <select
              className="dash-input"
              value={year}
              onChange={(e) => {
                setYear(e.target.value)
                setAllocSection('ALL')
                setAllocPage(1)
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
          <label className="field-label">
            <span>Semester</span>
            <select
              className="dash-input"
              value={semester}
              onChange={(e) => {
                setSemester(e.target.value)
                setAllocPage(1)
              }}
            >
              <option value="ALL">All semesters</option>
              {ACADEMIC_SEMESTERS.map((s) => (
                <option key={s} value={String(s)}>
                  Semester {s}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            <span>Search Course</span>
            <input
              className="dash-input"
              value={allocCourseQ}
              onChange={(e) => {
                setAllocCourseQ(e.target.value)
                setAllocPage(1)
              }}
              placeholder="Code or name"
            />
          </label>
          <label className="field-label">
            <span>Search Faculty</span>
            <input
              className="dash-input"
              value={allocFacultyQ}
              onChange={(e) => {
                setAllocFacultyQ(e.target.value)
                setAllocPage(1)
              }}
              placeholder="Faculty name"
            />
          </label>
          <label className="field-label">
            <span>Section</span>
            <select
              className="dash-input"
              value={allocSection}
              onChange={(e) => {
                setAllocSection(e.target.value)
                setAllocPage(1)
              }}
            >
              <option value="ALL">All</option>
              {sectionOptions.map((s) => (
                <option key={s} value={s}>
                  Section {s}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            <span>Class Type</span>
            <select
              className="dash-input"
              value={allocClassType}
              onChange={(e) => {
                setAllocClassType(e.target.value)
                setAllocPage(1)
              }}
            >
              <option value="ALL">All</option>
              <option value="L">L</option>
              <option value="T">T</option>
              <option value="P">P</option>
            </select>
          </label>
        </div>
        {allocations.loading && <TableSkeleton />}
        <table className="data-table">
          <thead>
            <tr>
              <th>Course</th>
              <th>Faculty</th>
              <th>Year</th>
              <th>Semester</th>
              <th>Section</th>
              <th>Class Type</th>
              <th>Hours</th>
            </tr>
          </thead>
          <tbody>
            {allocPaged.rows.map((a: any) => {
              const y = courseYear(a.course || {})
              return (
                <tr key={a.id}>
                  <td>
                    <strong>{a.course?.code}</strong>
                    {a.course?.name ? (
                      <>
                        <br />
                        <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{a.course.name}</span>
                      </>
                    ) : null}
                  </td>
                  <td>{a.faculty?.name || '—'}</td>
                  <td>{y ? yearLabel(y) : '—'}</td>
                  <td>{a.course?.semester ?? '—'}</td>
                  <td>{formatSectionDisplay(a.section || a.course?.section)}</td>
                  <td>
                    <ClassTypeBadge type={classTypeLabel(a.classType, a.course?.type)} />
                  </td>
                  <td>{hoursLabel(Number(a.hours) || 0)}</td>
                </tr>
              )
            })}
            {!allocations.loading && allocPaged.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-state">
                  No allocations for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pager page={allocPaged.page} pages={allocPaged.pages} total={allocPaged.total} onPage={setAllocPage} />
      </Panel>
    </>
  )
}

/** HOD Analytics — same charts as HR, department scoped. */
export function HodDeptAnalyticsPage() {
  const deptId = useHodDept()
  const balance = useApiData(
    () => (deptId ? api<any>(`/workload/department/${deptId}/balance`) : Promise.resolve(null)),
    [deptId],
  )
  const courses = useApiData(() => api<any[]>('/hod/courses'), [deptId])
  const allocations = useApiData(() => api<any[]>('/hod/allocations'), [deptId])
  const [status, setStatus] = useState('ALL')

  const faculty = balance.data?.faculty || []
  const filteredFaculty = faculty.filter((f: any) => (status === 'ALL' ? true : f.status === status))
  const allocRows = allocations.data || []
  const courseRows = (courses.data || []).filter((c: any) => {
    const y = courseYear(c)
    return y === 2 || y === 3 || y === 4
  })

  const statusSegs = [
    {
      label: 'Normal',
      value: filteredFaculty.filter((f: any) => f.status === 'NORMAL').length,
      color: '#059669',
    },
    {
      label: 'Underload',
      value: filteredFaculty.filter((f: any) => f.status === 'UNDERLOAD').length,
      color: '#2563eb',
    },
    {
      label: 'Overload',
      value: filteredFaculty.filter((f: any) => f.status === 'OVERLOAD').length,
      color: '#dc2626',
    },
  ]

  const facultyWorkloadBars = [...filteredFaculty]
    .sort(
      (a: any, b: any) =>
        Number(b.assignedHours ?? b.total ?? 0) - Number(a.assignedHours ?? a.total ?? 0),
    )
    .slice(0, 10)
    .map((f: any) => ({
      label: String(f.name || 'Faculty').split(' ').slice(-2).join(' ') || f.name,
      value: Math.round(Number(f.assignedHours ?? f.total ?? 0) * 10) / 10,
      color:
        f.status === 'OVERLOAD' ? '#dc2626' : f.status === 'UNDERLOAD' ? '#2563eb' : '#059669',
    }))

  const ltp = { L: 0, T: 0, P: 0 }
  for (const a of allocRows) {
    const t = classTypeLabel(a.classType, a.course?.type)
    if (t === 'L' || t === 'T' || t === 'P') ltp[t] += 1
  }

  const courseAllocBars = [
    { label: 'Courses', value: courseRows.length, color: '#1e3a8a' },
    { label: 'Allocations', value: allocRows.length, color: '#0f766e' },
    {
      label: 'Unallocated',
      value: Math.max(0, courseRows.length - new Set(allocRows.map((a: any) => a.courseId)).size),
      color: '#94a3b8',
    },
  ]

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Workload and course allocation at a glance (view only)."
      />
      <Panel title="Filters">
        <div className="form-grid report-filter-grid">
          <label className="field-label">
            <span>Workload status</span>
            <select className="dash-input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ALL">All</option>
              <option value="NORMAL">Normal</option>
              <option value="UNDERLOAD">Underload</option>
              <option value="OVERLOAD">Overload</option>
            </select>
          </label>
        </div>
      </Panel>
      <div className="grid-2">
        <DonutBreakdown title="Normal / Underload / Overload" segments={statusSegs} />
        <BarChart title="Faculty workload (top 10)" items={facultyWorkloadBars} />
      </div>
      <div className="grid-2">
        <BarChart title="Course allocation" items={courseAllocBars} />
        <DonutBreakdown
          title="L / T / P distribution"
          segments={[
            { label: 'Lecture (L)', value: ltp.L, color: '#1d4ed8' },
            { label: 'Tutorial (T)', value: ltp.T, color: '#0f766e' },
            { label: 'Practical (P)', value: ltp.P, color: '#b45309' },
          ]}
        />
      </div>
    </>
  )
}

/** HOD History — same workload snapshots view as HR, scoped to department faculty. */
export function HodDeptHistoryPage() {
  const deptId = useHodDept()
  const balance = useApiData(
    () => (deptId ? api<any>(`/workload/department/${deptId}/balance`) : Promise.resolve(null)),
    [deptId],
  )
  const history = useApiData(() => api<any[]>('/workload/history'))
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const facultyIds = useMemo(
    () => new Set((balance.data?.faculty || []).map((f: any) => f.facultyId)),
    [balance.data],
  )

  const rows = filterByQuery(
    (history.data || []).filter((h: any) => {
      const fid = h.facultyId || h.faculty?.id
      if (facultyIds.size === 0) return true
      return facultyIds.has(fid)
    }),
    query,
    (h) =>
      `${h.faculty?.facultyCode || ''} ${h.faculty?.name || ''} ${h.period?.code || ''} ${h.status || ''}`,
  )
  const paged = paginate(rows, page, 10)

  return (
    <>
      <PageHeader
        title="Workload History"
        subtitle="Snapshots by academic period (view only — same as HR)."
      />
      <ErrorRetry
        error={history.error || balance.error}
        onRetry={() => {
          void history.reload()
          void balance.reload()
        }}
      />
      <Panel title="Snapshots" action={<span className="meta-chip">{rows.length}</span>}>
        <input
          className="dash-input"
          style={{ marginBottom: '0.75rem' }}
          placeholder="Search faculty, period, or status"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setPage(1)
          }}
        />
        <table className="data-table">
          <thead>
            <tr>
              <th>Faculty</th>
              <th>Period</th>
              <th>Total</th>
              <th>Status</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {paged.rows.map((h: any) => (
              <tr key={h.id}>
                <td>
                  {h.faculty?.facultyCode} {h.faculty?.name}
                </td>
                <td>{h.period?.code}</td>
                <td>{h.total}</td>
                <td>
                  <StatusPill status={h.status} />
                </td>
                <td>{new Date(h.calculatedAt).toLocaleString()}</td>
              </tr>
            ))}
            {paged.rows.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state">
                  No history rows for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pager page={paged.page} pages={paged.pages} total={paged.total} onPage={setPage} />
      </Panel>
    </>
  )
}

/** HOD Requests — same leave/corrections tabs as HR, no Accept/Reject. */
export function HodDeptRequestsPage() {
  const [tab, setTab] = useState<'leave' | 'corrections'>('leave')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const stats = useApiData(() => api<any>('/hod/reassignments/stats'))
  const reassignments = useApiData(() => {
    const q = new URLSearchParams()
    if (statusFilter) q.set('status', statusFilter)
    const qs = q.toString()
    return api<any[]>(`/hod/reassignments${qs ? `?${qs}` : ''}`)
  }, [statusFilter])
  const corrections = useApiData(() => api<any[]>('/hod/corrections'))
  const leavePaged = paginate(reassignments.data || [], page, 10)
  const corrPaged = paginate(corrections.data || [], page, 10)

  return (
    <>
      <PageHeader
        title="Requests"
        subtitle="Leave / reassignment and corrections (monitor only — HR accepts or rejects)."
      />
      <div className="stat-grid">
        <Stat label="Total" value={stats.data?.total ?? '—'} />
        <Stat label="Pending Uttej" value={stats.data?.pending ?? '—'} />
        <Stat label="Accepted" value={stats.data?.accepted ?? '—'} />
        <Stat label="Rejected" value={stats.data?.rejected ?? '—'} />
      </div>

      <div className="form-actions" style={{ marginBottom: '0.85rem', gap: '0.5rem' }}>
        <button
          type="button"
          className={tab === 'leave' ? 'btn btn-primary' : 'btn btn-secondary'}
          onClick={() => {
            setTab('leave')
            setPage(1)
          }}
        >
          Leave / Reassignment
        </button>
        <button
          type="button"
          className={tab === 'corrections' ? 'btn btn-primary' : 'btn btn-secondary'}
          onClick={() => {
            setTab('corrections')
            setPage(1)
          }}
        >
          Corrections
        </button>
      </div>

      {tab === 'leave' && (
        <Panel
          title="Leave / reassignment"
          action={
            <select
              className="dash-input"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">All statuses</option>
              <option value="PENDING_UTESH">Pending Uttej</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="REJECTED">Rejected</option>
            </select>
          }
        >
          <ErrorRetry error={reassignments.error} onRetry={() => void reassignments.reload()} />
          {reassignments.loading && <TableSkeleton />}
          <table className="data-table">
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                <th>Hours</th>
                <th>Status</th>
                <th>Decision</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {leavePaged.rows.map((r: any) => (
                <tr key={r.id}>
                  <td>{r.fromFaculty?.name}</td>
                  <td>{r.toFaculty?.name}</td>
                  <td>{r.hours}h</td>
                  <td>
                    <StatusPill status={r.status} />
                  </td>
                  <td>
                    {r.decidedBy?.name || '—'}
                    {r.decidedAt ? ` · ${String(r.decidedAt).slice(0, 16)}` : ''}
                  </td>
                  <td>{r.reason || r.rejectionReason || '—'}</td>
                </tr>
              ))}
              {!reassignments.loading && leavePaged.rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state">
                    No requests for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <Pager page={leavePaged.page} pages={leavePaged.pages} total={leavePaged.total} onPage={setPage} />
        </Panel>
      )}

      {tab === 'corrections' && (
        <Panel title="Corrections" action={<span className="meta-chip">{(corrections.data || []).length}</span>}>
          <ErrorRetry error={corrections.error} onRetry={() => void corrections.reload()} />
          {corrections.loading && <TableSkeleton />}
          <table className="data-table">
            <thead>
              <tr>
                <th>Faculty</th>
                <th>Category</th>
                <th>Description</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {corrPaged.rows.map((c: any) => (
                <tr key={c.id}>
                  <td>{c.faculty?.name || c.submittedBy?.name || '—'}</td>
                  <td>{c.issueCategory || '—'}</td>
                  <td>{c.description || '—'}</td>
                  <td>
                    <StatusPill status={c.status} />
                  </td>
                </tr>
              ))}
              {!corrections.loading && corrPaged.rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-state">
                    No correction requests.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <Pager page={corrPaged.page} pages={corrPaged.pages} total={corrPaged.total} onPage={setPage} />
        </Panel>
      )}
    </>
  )
}
