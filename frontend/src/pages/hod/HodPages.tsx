import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
import { api, apiBlob, apiUpload, ApiError, triggerDownload } from '../../lib/api'
import { authService } from '../../lib/auth'

function useHodDept() {
  return authService.getSession()?.user.departmentId
}

function shortFacultyName(name?: string, code?: string) {
  const raw = String(name || '').replace(/^(Dr|Prof|Mr|Mrs|Ms)\.?\s+/i, '').trim()
  if (!raw) return code || 'Faculty'
  const parts = raw.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 14)
  return `${parts[0][0]}. ${parts[parts.length - 1]}`.slice(0, 16)
}

function courseYear(c: { academicYear?: string | null; semester?: number | null; section?: string | null }) {
  const ay = String(c.academicYear || '')
  if (ay === '1' || ay === '2' || ay === '3' || ay === '4') return Number(ay)
  if (String(c.section || '') === '7') return 4
  const sem = Number(c.semester || 0)
  if (sem === 1 || sem === 2) return 1
  if (sem === 3 || sem === 4) return 2
  if (sem === 5 || sem === 6) return 3
  if (sem === 7 || sem === 8) return 4
  return 0
}

function yearLabel(y: string | number) {
  const n = Number(y)
  if (n === 2) return '2nd Year'
  if (n === 3) return '3rd Year'
  if (n === 4) return '4th Year'
  return `Year ${y}`
}

function AcademicFilterBar({
  year,
  section,
  years,
  sections,
  onYear,
  onSection,
}: {
  year: string
  section: string
  years: Array<string | number>
  sections: string[]
  onYear: (v: string) => void
  onSection: (v: string) => void
  source?: string
  onSource?: (v: string) => void
  showSource?: boolean
}) {
  return (
    <div className="filter-bar">
      <select className="dash-input" value={year} onChange={(e) => onYear(e.target.value)}>
        <option value="ALL">All years</option>
        {years.map((y) => (
          <option key={y} value={String(y)}>
            {yearLabel(y)}
          </option>
        ))}
      </select>
      <select className="dash-input" value={section} onChange={(e) => onSection(e.target.value)}>
        <option value="ALL">All sections</option>
        {sections.map((s) => (
          <option key={s} value={s}>
            Section {s}
          </option>
        ))}
      </select>
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
  const years = Array.from(new Set(courses.map((c) => courseYear(c)).filter(Boolean))).sort()
  const sections = Array.from(
    new Set(
      courses.flatMap((c) => [
        c.section,
        ...(c.allocations || []).map((a: any) => a.section),
      ]).filter(Boolean),
    ),
  ) as string[]
  const rows = filterByQuery(
    courses.filter((c) => {
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false
      if (yearFilter !== 'ALL' && String(courseYear(c)) !== yearFilter) return false
      if (sectionFilter !== 'ALL') {
        const secs = [c.section, ...(c.allocations || []).map((a: any) => a.section)].filter(Boolean)
        if (!secs.includes(sectionFilter)) return false
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
        <select className="dash-input" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
          <option value="ALL">All years</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>{yearLabel(y)}</option>
          ))}
        </select>
        <select className="dash-input" value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)}>
          <option value="ALL">All sections</option>
          {sections.map((s) => (
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

export function HodOverview() {
  const deptId = useHodDept()
  const dash = useApiData(() => api<any>('/hod/dashboard'), [deptId])
  const allocations = useApiData(() => api<any[]>('/hod/allocations'), [deptId])
  const faculty = dash.data?.balance?.faculty || []
  const coverage = dash.data?.academicCoverage || { years: [], sections: [], rows: [] }
  const dept = dash.data?.department
  const [year, setYear] = useState('ALL')
  const [section, setSection] = useState('ALL')
  const [status, setStatus] = useState('ALL')

  const years = Array.from(
    new Set(
      [
        ...(coverage.years || []),
        ...(allocations.data || []).map((a: any) => courseYear(a.course || {})),
      ].filter((y) => y === 2 || y === 3 || y === 4),
    ),
  ).sort() as number[]

  const sections = Array.from(
    new Set(
      [
        ...(coverage.sections || []),
        ...(allocations.data || []).map((a: any) => a.section || a.course?.section),
      ].filter(Boolean),
    ),
  ).sort((a, b) => String(a).localeCompare(String(b))) as string[]

  const facultyScope = new Map<string, Array<{ year: number; section: string }>>()
  for (const a of allocations.data || []) {
    const fid = a.facultyId || a.faculty?.id
    if (!fid) continue
    const y = courseYear(a.course || {})
    const s = String(a.section || a.course?.section || '')
    if (!y || !s) continue
    const list = facultyScope.get(fid) || []
    list.push({ year: y, section: s })
    facultyScope.set(fid, list)
  }

  const filteredFaculty = faculty.filter((f: any) => {
    if (status !== 'ALL' && f.status !== status) return false
    if (year === 'ALL' && section === 'ALL') return true
    const scope = facultyScope.get(f.facultyId) || []
    if (scope.length === 0) return false
    return scope.some((row) => {
      if (year !== 'ALL' && String(row.year) !== year) return false
      if (section !== 'ALL' && String(row.section) !== section) return false
      return true
    })
  })

  const normal = filteredFaculty.filter((f: any) => f.status === 'NORMAL').length
  const overloaded = filteredFaculty.filter((f: any) => f.status === 'OVERLOAD').length
  const underloaded = filteredFaculty.filter((f: any) => f.status === 'UNDERLOAD').length

  const coverageRows = (coverage.rows || []).filter((r: any) => {
    if (year !== 'ALL' && String(r.year) !== year) return false
    if (section !== 'ALL' && String(r.section) !== section) return false
    return true
  })

  return (
    <>
      <PageHeader
        title="Workload Dashboard"
        subtitle="Filter by department, year, section, and workload status."
      />
      <ErrorRetry error={dash.error || allocations.error} onRetry={() => { void dash.reload(); void allocations.reload() }} />
      {(dash.loading || allocations.loading) && <TableSkeleton />}

      <Panel title="Filters">
        <div className="workload-filters">
          <label className="filter-field">
            <span>Department</span>
            <select className="dash-input" value={dept?.id || deptId || ''} disabled>
              <option value={dept?.id || deptId || ''}>
                {dept ? `${dept.code} — ${dept.name}` : 'Current department'}
              </option>
            </select>
          </label>
          <label className="filter-field">
            <span>Year</span>
            <select className="dash-input" value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="ALL">All</option>
              {years.map((y) => (
                <option key={y} value={String(y)}>
                  {yearLabel(y)}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>Section</span>
            <select className="dash-input" value={section} onChange={(e) => setSection(e.target.value)}>
              <option value="ALL">All</option>
              {sections.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>Workload Status</span>
            <select className="dash-input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ALL">All</option>
              <option value="NORMAL">Normal</option>
              <option value="UNDERLOAD">Underload</option>
              <option value="OVERLOAD">Overload</option>
            </select>
          </label>
        </div>
      </Panel>

      <div className="stat-grid">
        <Stat label="Total Faculty" value={filteredFaculty.length} />
        <Stat label="Normal" value={normal} />
        <Stat label="Underload" value={underloaded} />
        <Stat label="Overload" value={overloaded} />
      </div>

      <div className="grid-2">
        <DonutBreakdown
          title="Workload status"
          segments={[
            { label: 'Normal', value: normal, color: '#059669' },
            { label: 'Overload', value: overloaded, color: '#dc2626' },
            { label: 'Underload', value: underloaded, color: '#2563eb' },
          ]}
        />
        <BarChart
          title="Faculty workload"
          items={filteredFaculty.slice(0, 10).map((f: any) => ({
            label: shortFacultyName(f.name, f.facultyCode),
            value: Number(f.total || 0),
            color: f.status === 'OVERLOAD' ? '#dc2626' : f.status === 'UNDERLOAD' ? '#2563eb' : '#059669',
          }))}
        />
      </div>

      <Panel
        title="Faculty workload"
        action={
          <Link className="open-profile-link" to="/hod/workload">
            Open Workload tab →
          </Link>
        }
      >
        <p className="empty-state" style={{ margin: 0 }}>
          Faculty load details are listed under the <Link to="/hod/workload">Workload</Link> tab
          ({filteredFaculty.length} matching current filters).
        </p>
      </Panel>

      <Panel title="Coverage in view">
        {coverageRows.length === 0 && (
          <p className="empty-state">No year/section coverage for this filter.</p>
        )}
        {coverageRows.length > 0 && (
          <table className="data-table compact-table">
            <thead>
              <tr>
                <th>Year</th>
                <th>Section</th>
                <th>Subjects</th>
                <th>Faculty</th>
                <th>Allocations</th>
                <th>Slots</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {coverageRows.map((r: any) => (
                <tr key={`${r.year}-${r.section}-${r.dataSource}`}>
                  <td>{yearLabel(r.year || '—')}</td>
                  <td>{r.section}</td>
                  <td>{r.courses}</td>
                  <td>{r.facultyCount}</td>
                  <td>{r.allocations}</td>
                  <td>{r.slots}</td>
                  <td>
                    <DataSourceBadge source={r.dataSource} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  )
}

export function HodFacultyPage() {
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
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const faculty = filterByQuery(
    (balance.data?.faculty || []).filter((f: any) => {
      if (statusFilter !== 'ALL' && f.status !== statusFilter) return false
      return true
    }),
    query,
    (f: any) => `${f.facultyCode || ''} ${f.name || ''} ${f.designation || ''} ${f.status || ''}`,
  )
  const paged = paginate(faculty, page, 12)

  async function recalculate() {
    if (!deptId) return
    setBusy(true)
    try {
      await api(`/workload/department/${deptId}/recalculate`, { method: 'POST' })
      await balance.reload()
      setMessage('Workloads recalculated.')
    } catch (e: any) {
      setMessage(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Faculty"
        subtitle="Department faculty workload status."
        action={
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void recalculate()}
          >
            Recalculate
          </button>
        }
      />
      {message && <div className="alert-banner">{message}</div>}
      <ErrorRetry error={balance.error} onRetry={() => void balance.reload()} />
      {balance.loading && <TableSkeleton />}
      <Panel title="Faculty workload">
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
        <table className="data-table">
          <thead>
            <tr>
              <th>Faculty</th>
              <th>Designation</th>
              <th>Teaching</th>
              <th>Projects</th>
              <th>Research</th>
              <th>Admin</th>
              <th>Committee</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {paged.rows.map((f: any) => (
              <tr key={f.facultyId}>
                <td>
                  <div className="person-cell">
                    <PersonAvatar
                      name={f.name || f.facultyCode}
                      email={f.email}
                      photoUrl={f.photoUrl}
                    />
                    <div className="person-meta">
                      <strong>
                        <Link to={`/hod/faculty/${f.facultyId}`}>
                          {f.facultyCode} · {f.name}
                        </Link>
                      </strong>
                      <span>
                        Norm {f.normMin}–{f.normMax}
                      </span>
                    </div>
                  </div>
                </td>
                <td>{f.designation || '—'}</td>
                <td>{f.teachingWeighted?.toFixed?.(2)}</td>
                <td>{f.projectsWeighted?.toFixed?.(2)}</td>
                <td>{f.researchWeighted?.toFixed?.(2)}</td>
                <td>{f.adminWeighted?.toFixed?.(2)}</td>
                <td>{f.committeeWeighted?.toFixed?.(2)}</td>
                <td>
                  <strong>{f.total?.toFixed?.(2) ?? f.total}</strong>
                </td>
                <td>
                  <StatusPill status={f.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pager page={paged.page} pages={paged.pages} onPage={setPage} />
      </Panel>
    </>
  )
}

export function HodCoursesPage() {
  const courses = useApiData(() => api<any[]>('/hod/courses'))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [form, setForm] = useState({
    code: '',
    name: '',
    hoursPerWeek: '3',
    type: 'THEORY',
    credits: '3',
    semester: '1',
    section: 'A',
  })

  async function addCourse(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await api('/hod/courses', {
        method: 'POST',
        body: JSON.stringify({
          code: form.code,
          name: form.name,
          hoursPerWeek: Number(form.hoursPerWeek),
          type: form.type,
          credits: Number(form.credits),
          semester: Number(form.semester),
          section: form.section,
        }),
      })
      setForm({
        code: '',
        name: '',
        hoursPerWeek: '3',
        type: 'THEORY',
        credits: '3',
        semester: '1',
        section: 'A',
      })
      setMessage('Course added.')
      await courses.reload()
    } catch (err: any) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function submitApproval() {
    setBusy(true)
    try {
      await api('/hod/submit-approval', { method: 'POST', body: '{}' })
      setMessage('Package submitted to Dean.')
    } catch (e: any) {
      setMessage(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Courses"
        subtitle="Manage department course catalogue."
        action={
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void submitApproval()}
          >
            Submit for Dean
          </button>
        }
      />
      {message && <div className="alert-banner">{message}</div>}
      <Panel title="Add course">
        <form
          onSubmit={(e) => void addCourse(e)}
          className="form-grid"
        >
          <input
            className="dash-input"
            placeholder="Code"
            required
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
          <input
            className="dash-input"
            placeholder="Name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="dash-input"
            placeholder="Hours/week"
            value={form.hoursPerWeek}
            onChange={(e) => setForm({ ...form, hoursPerWeek: e.target.value })}
          />
          <select
            className="dash-input"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            <option value="THEORY">Theory</option>
            <option value="TUTORIAL">Tutorial</option>
            <option value="LABORATORY">Laboratory</option>
          </select>
          <input
            className="dash-input"
            placeholder="Credits"
            value={form.credits}
            onChange={(e) => setForm({ ...form, credits: e.target.value })}
          />
          <input
            className="dash-input"
            placeholder="Semester"
            value={form.semester}
            onChange={(e) => setForm({ ...form, semester: e.target.value })}
          />
          <input
            className="dash-input"
            placeholder="Section"
            value={form.section}
            onChange={(e) => setForm({ ...form, section: e.target.value })}
          />
          <button type="submit" className="btn btn-secondary" disabled={busy}>
            Add course
          </button>
        </form>
      </Panel>
      <Panel title="Course list">
        <HodCourseTable courses={courses.data || []} onReload={() => void courses.reload()} />
      </Panel>
    </>
  )
}

export function HodAllocationsPage() {
  const deptId = useHodDept()
  const navigate = useNavigate()
  const courses = useApiData(() => api<any[]>('/hod/courses'))
  const allocations = useApiData(() => api<any[]>('/hod/allocations'))
  const balance = useApiData(
    () =>
      deptId
        ? api<any>(`/workload/department/${deptId}/balance`)
        : Promise.resolve(null),
    [deptId],
  )
  const faculty = balance.data?.faculty || []
  const [form, setForm] = useState({ courseId: '', facultyId: '', hours: '4' })
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [warning, setWarning] = useState<any>(null)
  const [justification, setJustification] = useState('')
  const [year, setYear] = useState('ALL')
  const [section, setSection] = useState('ALL')
  const allocRows = (allocations.data || []).filter((a: any) => {
    if (year !== 'ALL' && String(courseYear(a.course || {})) !== year) return false
    if (section !== 'ALL' && String(a.section || a.course?.section || '') !== section) return false
    return true
  })
  const allocYears = Array.from(
    new Set((allocations.data || []).map((a: any) => courseYear(a.course || {})).filter(Boolean)),
  ).sort()
  const allocSections = Array.from(
    new Set((allocations.data || []).map((a: any) => a.section || a.course?.section).filter(Boolean)),
  ) as string[]

  async function submit(payload: Record<string, unknown>) {
    return api<any>('/hod/allocations', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async function addAllocation(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      const result = await submit({
        courseId: form.courseId,
        facultyId: form.facultyId,
        hours: Number(form.hours),
      })
      setWarning(null)
      setMessage(
        `Allocation saved. ${result.preCheck?.after?.status || ''} · projected ${result.preCheck?.after?.total?.toFixed?.(1)}`,
      )
      await Promise.all([allocations.reload(), balance.reload()])
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 409) {
        setWarning((err.body as any) || err)
        setMessage(err.message)
      } else {
        setMessage(err.message)
      }
    } finally {
      setBusy(false)
    }
  }

  async function proceedWithJustification() {
    setBusy(true)
    try {
      await submit({
        courseId: form.courseId,
        facultyId: form.facultyId,
        hours: Number(form.hours),
        confirmOverload: true,
        justification,
      })
      setWarning(null)
      setJustification('')
      setMessage('Allocation saved with overload justification.')
      await Promise.all([allocations.reload(), balance.reload()])
    } catch (err: any) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  const preCheck = warning?.preCheck || warning?.after ? warning : warning

  return (
    <>
      <PageHeader title="Course Allocation" subtitle="Official teaching assignments drive workload. Timetable is schedule only." />
      {message && <div className="alert-banner">{message}</div>}
      <Panel title="Assign">
        <form onSubmit={(e) => void addAllocation(e)} className="form-grid">
          <select
            className="dash-input"
            required
            value={form.courseId}
            onChange={(e) => setForm({ ...form, courseId: e.target.value })}
          >
            <option value="">Select course</option>
            {(courses.data || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.name} ({c.type})
              </option>
            ))}
          </select>
          <select
            className="dash-input"
            required
            value={form.facultyId}
            onChange={(e) => setForm({ ...form, facultyId: e.target.value })}
          >
            <option value="">Select faculty</option>
            {faculty.map((f: any) => (
              <option key={f.facultyId} value={f.facultyId}>
                {f.facultyCode} · {f.name} ({f.total?.toFixed?.(1)})
              </option>
            ))}
          </select>
          <input
            className="dash-input"
            type="number"
            min="0.5"
            step="0.5"
            value={form.hours}
            onChange={(e) => setForm({ ...form, hours: e.target.value })}
          />
          <button type="submit" className="btn btn-secondary" disabled={busy}>
            Check & assign
          </button>
        </form>
      </Panel>
      {warning && (
        <Panel title="Overload warning">
          <p>
            Current {preCheck?.preCheck?.before?.total?.toFixed?.(1) ?? '—'} → projected{' '}
            {preCheck?.preCheck?.after?.total?.toFixed?.(1) ?? '—'} (max{' '}
            {preCheck?.preCheck?.after?.normMax ?? '—'}).
          </p>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', margin: '0.75rem 0' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setWarning(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/hod/what-if')}>
              Use What-if Simulation
            </button>
          </div>
          <p>Choose another faculty:</p>
          <ul className="plain-list">
            {(preCheck?.preCheck?.alternatives || []).map((a: any) => (
              <li key={a.facultyId}>
                {a.name}: current {a.current?.toFixed?.(1)}, capacity {a.capacity?.toFixed?.(1)}{' '}
                {a.suitable ? '· Suitable' : '· Not suitable'}
                {a.suitable && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ marginLeft: '0.4rem' }}
                    onClick={() => setForm({ ...form, facultyId: a.facultyId })}
                  >
                    Select
                  </button>
                )}
              </li>
            ))}
          </ul>
          <label>
            Justification
            <textarea
              className="dash-input"
              rows={2}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn-warn"
            disabled={busy || !justification.trim()}
            onClick={() => void proceedWithJustification()}
          >
            Proceed with justification
          </button>
        </Panel>
      )}
      <Panel title="Current allocations">
        <AcademicFilterBar
          year={year}
          section={section}
          years={allocYears}
          sections={allocSections}
          onYear={setYear}
          onSection={setSection}
        />
        <table className="data-table">
          <thead>
            <tr>
              <th>Course</th>
              <th>Year</th>
              <th>Section</th>
              <th>Faculty</th>
              <th>Hours</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {allocRows.map((a: any) => (
              <tr key={a.id}>
                <td>{a.course?.code}</td>
                <td>{courseYear(a.course || {}) ? `Y${courseYear(a.course || {})}` : '—'}</td>
                <td>{a.section || a.course?.section || '—'}</td>
                <td>{a.faculty?.name}</td>
                <td>{a.hours}</td>
                <td>{a.course?.type}</td>
              </tr>
            ))}
            {allocRows.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-state">No allocations for this filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>
    </>
  )
}

export function HodTimetablePage() {
  const timetable = useApiData(() => api<any[]>('/hod/timetable'))
  const courses = useApiData(() => api<any[]>('/hod/courses'))
  const deptId = useHodDept()
  const balance = useApiData(
    () => (deptId ? api<any>(`/workload/department/${deptId}/balance`) : Promise.resolve(null)),
    [deptId],
  )
  const [form, setForm] = useState({
    courseId: '',
    facultyId: '',
    dayOfWeek: '1',
    startTime: '09:00',
    endTime: '10:00',
    room: '',
    contactType: 'THEORY',
  })
  const [csv, setCsv] = useState('')
  const [preview, setPreview] = useState<any | null>(null)
  const [pendingRows, setPendingRows] = useState<any[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [year, setYear] = useState('ALL')
  const [section, setSection] = useState('ALL')
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const slotRows = (timetable.data || []).filter((t: any) => {
    if (year !== 'ALL' && String(courseYear(t.course || {})) !== year) return false
    if (section !== 'ALL' && String(t.batchLabel || t.course?.section || '') !== section) return false
    return true
  })
  const slotYears = Array.from(
    new Set((timetable.data || []).map((t: any) => courseYear(t.course || {})).filter(Boolean)),
  ).sort()
  const slotSections = Array.from(
    new Set((timetable.data || []).map((t: any) => t.batchLabel || t.course?.section).filter(Boolean)),
  ) as string[]

  async function addSlot(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api('/hod/timetable', { method: 'POST', body: JSON.stringify(form) })
      setMessage('Slot added.')
      await timetable.reload()
    } catch (err: any) {
      setMessage(err.message)
    }
  }

  function parseCsvRows() {
    return csv
      .trim()
      .split('\n')
      .slice(1)
      .filter(Boolean)
      .map((line) => {
        const [Day, startTime, endTime, courseCode, facultyCode, room, section, Type] =
          line.split(',').map((s) => s.trim())
        return { Day, startTime, endTime, courseCode, facultyCode, room, section, Type }
      })
  }

  async function previewRows(rows: any[]) {
    const result = await api<any>('/hod/timetable/preview', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    })
    setPendingRows(rows)
    setPreview(result)
    setMessage(`Preview: ${result.valid} valid, ${result.invalid} invalid. Confirm to import.`)
  }

  async function confirmImport() {
    const result = await api<any[]>('/hod/timetable/import', {
      method: 'POST',
      body: JSON.stringify({ rows: pendingRows, confirm: true }),
    })
    const ok = result.filter((r) => r.ok).length
    const bad = result.filter((r) => !r.ok).length
    setMessage(`Imported ${ok} slot(s). ${bad} error(s).`)
    setPreview(null)
    setPendingRows([])
    await timetable.reload()
  }

  async function onExcel(file: File | null) {
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    const result = await apiUpload<any>('/hod/timetable/excel', fd)
    setPendingRows(result.results?.map((r: any) => r.row).filter(Boolean) || [])
    setPreview(result)
    setMessage(`Excel preview: ${result.valid} valid, ${result.invalid} invalid.`)
  }

  return (
    <>
      <PageHeader title="Timetable" subtitle="Schedule validation only — hours are not added on top of allocations." />
      {message && <div className="alert-banner">{message}</div>}
      <Panel title="Add slot">
        <form className="form-grid" onSubmit={(e) => void addSlot(e)}>
          <select className="dash-input" required value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
            <option value="">Course</option>
            {(courses.data || []).map((c) => (
              <option key={c.id} value={c.id}>{c.code}</option>
            ))}
          </select>
          <select className="dash-input" required value={form.facultyId} onChange={(e) => setForm({ ...form, facultyId: e.target.value })}>
            <option value="">Faculty</option>
            {(balance.data?.faculty || []).map((f: any) => (
              <option key={f.facultyId} value={f.facultyId}>{f.name}</option>
            ))}
          </select>
          <select className="dash-input" value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}>
            {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
          <input className="dash-input" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          <input className="dash-input" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          <input className="dash-input" placeholder="Room" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
          <button className="btn btn-secondary" type="submit">Add</button>
        </form>
      </Panel>
      <Panel title="Excel / CSV import">
        <p className="empty-state">Columns: Day, Start Time, End Time, Course Code, Faculty ID, Room, Section, Type. Preview first — nothing is saved until you confirm.</p>
        <input
          className="dash-input"
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => void onExcel(e.target.files?.[0] || null)}
        />
        <textarea className="dash-input" rows={4} placeholder="Day,Start Time,End Time,Course Code,Faculty ID,Room,Section,Type" value={csv} onChange={(e) => setCsv(e.target.value)} />
        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
          <button type="button" className="btn btn-secondary" onClick={() => void previewRows(parseCsvRows())}>
            Preview
          </button>
          <button type="button" className="btn btn-primary" disabled={!preview} onClick={() => void confirmImport()}>
            Confirm import
          </button>
        </div>
        {preview && (
          <ul className="plain-list" style={{ marginTop: '0.75rem' }}>
            {(preview.results || []).slice(0, 12).map((r: any, i: number) => (
              <li key={i}>
                {r.ok ? 'OK' : 'Error'}: {r.error || r.resolved?.courseCode || JSON.stringify(r.row)}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Slots">
        <AcademicFilterBar
          year={year}
          section={section}
          years={slotYears}
          sections={slotSections}
          onYear={setYear}
          onSection={setSection}
        />
        {slotRows.length === 0 && <p className="empty-state">No timetable slots for this filter.</p>}
        <table className="data-table">
          <thead>
            <tr><th>Day</th><th>Time</th><th>Course</th><th>Year</th><th>Section</th><th>Faculty</th><th>Room</th></tr>
          </thead>
          <tbody>
            {slotRows.map((t: any) => (
              <tr key={t.id}>
                <td>{DAYS[t.dayOfWeek] || t.dayOfWeek}</td>
                <td>{t.startTime}–{t.endTime}</td>
                <td>{t.course?.code}</td>
                <td>{courseYear(t.course || {}) ? `Y${courseYear(t.course || {})}` : '—'}</td>
                <td>{t.batchLabel || t.course?.section || '—'}</td>
                <td>{t.faculty?.name}</td>
                <td>{t.room || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
  const faculty = filterByQuery(
    (balance.data?.faculty || []).filter((f: any) =>
      statusFilter === 'ALL' ? true : f.status === statusFilter,
    ),
    query,
    (f: any) => `${f.facultyCode || ''} ${f.name || ''} ${f.status || ''}`,
  )
  const paged = paginate(faculty, page, 12)
  return (
    <>
      <PageHeader title="Workload" subtitle="Department teaching load by faculty. Teaching is taken from Course Allocation only." />
      <ErrorRetry error={balance.error} onRetry={() => void balance.reload()} />
      {balance.loading && <TableSkeleton cols={10} />}
      <Panel
        title="Faculty workload"
        action={<span className="panel-meta">{faculty.length} matching</span>}
      >
        <div className="form-grid" style={{ marginBottom: '0.75rem' }}>
          <input className="dash-input" placeholder="Search faculty" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }} />
          <select className="dash-input" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}>
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
                <td><strong>{f.total?.toFixed?.(2)}</strong></td>
                <td><StatusPill status={f.status} /></td>
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
      <PageHeader title="Workload Balancing" subtitle="Suggestions are not applied until you confirm." />
      {message && <div className="alert-banner">{message}</div>}
      <div className="grid-2">
        <Panel title="Overloaded">
          <ul className="plain-list">
            {overloaded.map((f: any) => (
              <li key={f.facultyId}>{f.name} = {f.total.toFixed(1)}</li>
            ))}
            {overloaded.length === 0 && <p className="empty-state">None</p>}
          </ul>
        </Panel>
        <Panel title="Available capacity">
          <ul className="plain-list">
            {underloaded.concat(normal).map((f: any) => (
              <li key={f.facultyId}>
                {f.name} = {f.total.toFixed(1)} (capacity {f.availableCapacity?.toFixed?.(1)})
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <Panel title="Proposed reallocations">
        {(balance.data?.suggestions || []).length === 0 && (
          <p className="empty-state">No reallocation suggestions.</p>
        )}
        <table className="data-table">
          <thead>
            <tr>
              <th>Move</th>
              <th>Before</th>
              <th>After</th>
              <th>Change</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(balance.data?.suggestions || []).map((s: any, i: number) => (
              <tr key={i}>
                <td>{s.fromName} → {s.toName}</td>
                <td>{s.beforeFrom?.toFixed?.(1)} / {s.beforeTo?.toFixed?.(1)}</td>
                <td>{s.afterFrom?.toFixed?.(1)} / {s.afterTo?.toFixed?.(1)}</td>
                <td>{s.suggestedHours}h · {s.reason}</td>
                <td>
                  <button className="btn btn-primary" disabled={busy} onClick={() => void confirmMove(s)}>
                    Confirm
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  )
}

export function HodReportsPage() {
  const deptId = useHodDept()
  const [message, setMessage] = useState<string | null>(null)
  async function exportFile(kind: 'excel' | 'csv') {
    if (!deptId) return
    const blob = await apiBlob(`/reports/department/${deptId}/${kind}`)
    triggerDownload(blob, kind === 'csv' ? 'department-workload.csv' : 'department-workload.xlsx')
  }
  async function submitApproval() {
    await api('/hod/submit-approval', { method: 'POST', body: '{}' })
    setMessage('Package submitted to Dean (HOD_SUBMITTED).')
  }
  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Department workload exports and approval submission."
        action={
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => void submitApproval()}>
              Submit to Dean
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => void exportFile('csv')}>
              Download CSV
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void exportFile('excel')}>
              Download Excel
            </button>
          </div>
        }
      />
      {message && <div className="alert-banner">{message}</div>}
      <Panel title="Exports">
        <p className="empty-state">
          Download Excel or CSV for the active period. Teaching hours come from Course Allocation, not timetable.
        </p>
      </Panel>
    </>
  )
}

export function HodFacultyDetailPage() {
  const { facultyId } = useParams()
  const detail = useApiData(
    () => api<any>(`/hod/faculty/${facultyId}`),
    [facultyId],
  )
  const f = detail.data?.faculty
  const b = detail.data?.breakdown
  return (
    <>
      <PageHeader title={f?.name || 'Faculty workload'} subtitle={`${f?.facultyCode || ''} · ${f?.department?.name || ''}`} />
      {b && (
        <>
          <div className="stat-grid">
            <Stat label="Total" value={b.total.toFixed(2)} />
            <Stat label="Status" value={b.status} />
            <Stat label="Min / Expected / Max" value={`${b.normMin} / ${b.normExpected} / ${b.normMax}`} />
            <Stat label="% of expected" value={`${b.percentOfNorm}%`} />
          </div>
          <Panel title="Breakdown">
            <table className="data-table">
              <tbody>
                {[
                  ['Theory', b.theoryWeighted],
                  ['Tutorial', b.tutorialWeighted],
                  ['Laboratory', b.labWeighted],
                  ['UG Project', b.ugProjectsWeighted],
                  ['PG Project', b.pgProjectsWeighted],
                  ['PhD', b.phdWeighted],
                  ['Research', b.researchWeighted],
                  ['Administration', b.adminWeighted],
                  ['Committee', b.committeeWeighted],
                ].map(([label, val]) => (
                  <tr key={String(label)}>
                    <td>{label}</td>
                    <td>{Number(val).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </>
      )}
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
  renderRow: (row: any) => string
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
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    await api(createPath, { method: 'POST', body: JSON.stringify(form) })
    setMessage('Saved.')
    await rows.reload()
  }
  return (
    <>
      {!embedded && <PageHeader title={title} />}
      {message && <div className="alert-banner">{message}</div>}
      <Panel title={embedded ? `Add ${title.toLowerCase()}` : 'Add'}>
        <form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
          {fields.map((f) =>
            f.name === 'facultyId' || f.name === 'guideId' ? (
              <select
                key={f.name}
                className="dash-input"
                required
                value={form[f.name] || ''}
                onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
              >
                <option value="">{f.placeholder}</option>
                {(balance.data?.faculty || []).map((fac: any) => (
                  <option key={fac.facultyId} value={fac.facultyId}>{fac.name}</option>
                ))}
              </select>
            ) : f.options ? (
              <select
                key={f.name}
                className="dash-input"
                value={form[f.name] || f.options[0]}
                onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
              >
                {f.options.map((o) => <option key={o}>{o}</option>)}
              </select>
            ) : (
              <input
                key={f.name}
                className="dash-input"
                placeholder={f.placeholder}
                value={form[f.name] || ''}
                onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
              />
            ),
          )}
          <button className="btn btn-secondary" type="submit">Save</button>
        </form>
      </Panel>
      <Panel title={embedded ? title : 'Records'}>
        <ul className="plain-list">
          {(rows.data || []).map((r) => (
            <li key={r.id}>{renderRow(r)}</li>
          ))}
        </ul>
      </Panel>
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
      renderRow={(r) => `${r.faculty?.name} · ${r.projectTitle} · ${r.role} · ${r.commitmentPct}%`}
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
      <div className="grid-2">
        <SimpleCrudPage
          embedded
          title="Administration"
          listPath="/hod/admin-roles"
          createPath="/hod/admin-roles"
          fields={[
            { name: 'facultyId', placeholder: 'Faculty' },
            { name: 'roleName', placeholder: 'Role', options: ['Department Coordinator', 'Class Coordinator', 'Lab Coordinator', 'Exam Coordinator', 'Placement Coordinator', 'Admission Coordinator'] },
          ]}
          renderRow={(r) => `${r.faculty?.name} · ${r.roleName}`}
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
          renderRow={(r) => `${r.faculty?.name} · ${r.committee?.name} · ${r.role}`}
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

export function HodAnalyticsPage() {
  const deptId = useHodDept()
  const dash = useApiData(() => api<any>('/hod/dashboard'), [deptId])
  const balance = useApiData(
    () =>
      deptId
        ? api<any>(`/workload/department/${deptId}/balance`)
        : Promise.resolve(null),
    [deptId],
  )
  const faculty = balance.data?.faculty || []
  const overload = faculty.filter((f: any) => f.status === 'OVERLOAD').length
  const underload = faculty.filter((f: any) => f.status === 'UNDERLOAD').length
  const normal = faculty.filter((f: any) => f.status === 'NORMAL').length
  const [query, setQuery] = useState('')
  const rows = filterByQuery(
    faculty,
    query,
    (f: any) => `${f.facultyCode || ''} ${f.name || ''} ${f.status || ''}`,
  )
  return (
    <>
      <PageHeader title="Analytics" subtitle="Department load mix and faculty totals." />
      <div className="stat-grid">
        <Stat label="Faculty" value={dash.data?.totalFaculty ?? faculty.length} />
        <Stat label="Average" value={dash.data?.averageWorkload ?? '—'} />
        <Stat label="Normal" value={normal} />
        <Stat label="Overload" value={overload} />
        <Stat label="Underload" value={underload} />
      </div>
      <div className="grid-2">
        <DonutBreakdown
          title="Workload status"
          segments={[
            { label: 'Normal', value: normal, color: '#059669' },
            { label: 'Overload', value: overload, color: '#dc2626' },
            { label: 'Underload', value: underload, color: '#2563eb' },
          ]}
        />
        <BarChart
          title="Faculty totals"
          items={faculty.map((f: any) => ({
            label: shortFacultyName(f.name, f.facultyCode),
            value: Number(f.total || 0),
            color: f.status === 'OVERLOAD' ? '#dc2626' : f.status === 'UNDERLOAD' ? '#2563eb' : '#059669',
          }))}
        />
      </div>
      <Panel title="Faculty search">
        <input
          className="dash-input"
          style={{ marginBottom: '0.75rem' }}
          placeholder="Search faculty"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <table className="data-table">
          <thead>
            <tr>
              <th>Faculty</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f: any) => (
              <tr key={f.facultyId}>
                <td>{f.name}</td>
                <td>{f.total?.toFixed?.(2)}</td>
                <td><StatusPill status={f.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  )
}

export function HodCorrectionsPage() {
  const corrections = useApiData(() => api<any[]>('/hod/corrections'))
  const [message, setMessage] = useState<string | null>(null)

  async function review(id: string, status: 'APPROVED' | 'REJECTED') {
    await api(`/hod/corrections/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ status, note: `Marked ${status} by HOD` }),
    })
    setMessage(`Request ${status.toLowerCase()}.`)
    await corrections.reload()
  }

  return (
    <>
      <PageHeader title="Correction Requests" subtitle="Review department faculty correction requests." />
      {message && <div className="alert-banner">{message}</div>}
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
              {c.status === 'PENDING' && (
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button type="button" className="btn btn-success" onClick={() => void review(c.id, 'APPROVED')}>
                    Approve
                  </button>
                  <button type="button" className="btn btn-danger" onClick={() => void review(c.id, 'REJECTED')}>
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
