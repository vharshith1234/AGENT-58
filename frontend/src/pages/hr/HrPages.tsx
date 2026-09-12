import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ErrorRetry,
  PageHeader,
  Pager,
  Panel,
  Stat,
  TableSkeleton,
  filterByQuery,
  useApiData,
} from '../../components/DashboardShell'
import { BarChart, DonutBreakdown } from '../../components/OverviewCharts'
import { PersonAvatar, StatusPill, resolvePhotoUrl } from '../../components/PersonAvatar'
import { api, apiBlob, triggerDownload } from '../../lib/api'
import { authService } from '../../lib/auth'

export function HrOverview() {
  const dash = useApiData(() => api<any>('/hr/dashboard'))
  const rawRows = dash.data?.allRows || dash.data?.rows || []
  const byDept = new Map<string, any>()
  for (const r of rawRows) {
    const key = r.departmentCode || r.departmentId
    const cur = byDept.get(key) || {
      departmentCode: r.departmentCode,
      departmentId: r.departmentId,
      NORMAL: 0,
      OVERLOAD: 0,
      UNDERLOAD: 0,
    }
    cur.NORMAL += Number(r.NORMAL || 0)
    cur.OVERLOAD += Number(r.OVERLOAD || 0)
    cur.UNDERLOAD += Number(r.UNDERLOAD || 0)
    byDept.set(key, cur)
  }
  const rows = Array.from(byDept.values())
  const totalFaculty =
    Number(dash.data?.real?.totalFaculty || 0) + Number(dash.data?.demo?.totalFaculty || 0) ||
    Number(dash.data?.facultyCount || 0) + Number(dash.data?.demoFacultyCount || 0)
  const normal =
    Number(dash.data?.real?.normal || 0) + Number(dash.data?.demo?.normal || 0) ||
    Number(dash.data?.normal || 0)
  const overload =
    Number(dash.data?.real?.overload || 0) + Number(dash.data?.demo?.overload || 0) ||
    Number(dash.data?.overload || 0)
  const underload =
    Number(dash.data?.real?.underload || 0) + Number(dash.data?.demo?.underload || 0) ||
    Number(dash.data?.underload || 0)
  const pending = Number(dash.data?.pendingCorrections || 0)
  const approved = Number(dash.data?.approvedCorrections || 0)
  const rejected = Number(dash.data?.rejectedCorrections || 0)

  return (
    <>
      <PageHeader
        title="HR Overview"
        subtitle="Institutional workload health at a glance."
      />
      <ErrorRetry error={dash.error} onRetry={() => void dash.reload()} />
      {dash.loading && <TableSkeleton />}
      <div className="stat-grid">
        <Stat label="Total Faculty" value={totalFaculty || '—'} />
        <Stat label="Departments" value={dash.data?.deptCount ?? '—'} />
        <Stat label="Normal" value={normal} />
        <Stat label="Overloaded" value={overload} />
        <Stat label="Underloaded" value={underload} />
        <Stat label="Pending Corrections" value={pending} />
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
        <DonutBreakdown
          title="Correction requests"
          segments={[
            { label: 'Pending', value: pending, color: '#f59e0b' },
            { label: 'Approved', value: approved, color: '#059669' },
            { label: 'Rejected', value: rejected, color: '#dc2626' },
          ]}
        />
      </div>
      <div className="grid-2">
        <BarChart
          title="Faculty count by department"
          items={rows.map((r: any) => ({
            label: r.departmentCode,
            value: Number(r.NORMAL || 0) + Number(r.OVERLOAD || 0) + Number(r.UNDERLOAD || 0),
            color: '#1e3a8a',
          }))}
        />
        <BarChart
          title="Normal / overload / underload"
          items={[
            { label: 'Normal', value: normal, color: '#059669' },
            { label: 'Overload', value: overload, color: '#dc2626' },
            { label: 'Underload', value: underload, color: '#2563eb' },
          ]}
        />
      </div>
      <Panel title="Load distribution">
        <div className="bar-chart">
          {rows.map((r: any) => (
            <div key={r.departmentId || r.departmentCode} className="bar-chart-row">
              <div className="bar-chart-label">{r.departmentCode}</div>
              <div className="bar-chart-track stacked">
                <div
                  className="bar-chart-fill"
                  style={{
                    width: `${pct(r.NORMAL, r)}%`,
                    background: '#059669',
                  }}
                  title={`Normal ${r.NORMAL}`}
                />
                <div
                  className="bar-chart-fill"
                  style={{
                    width: `${pct(r.OVERLOAD, r)}%`,
                    background: '#dc2626',
                  }}
                  title={`Over ${r.OVERLOAD}`}
                />
                <div
                  className="bar-chart-fill"
                  style={{
                    width: `${pct(r.UNDERLOAD, r)}%`,
                    background: '#2563eb',
                  }}
                  title={`Under ${r.UNDERLOAD}`}
                />
              </div>
              <div className="bar-chart-value">
                {r.NORMAL}/{r.OVERLOAD}/{r.UNDERLOAD}
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="empty-state">No compliance snapshots yet.</p>
          )}
        </div>
      </Panel>
    </>
  )
}

function pct(part: number, row: any) {
  const total =
    Number(row.NORMAL || 0) + Number(row.OVERLOAD || 0) + Number(row.UNDERLOAD || 0) || 1
  return Math.round((Number(part || 0) / total) * 100)
}

export function HrFacultyPage() {
  const depts = useApiData(() => api<any[]>('/hr/departments'))
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('Active')
  const [deptFilter, setDeptFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    facultyCode: '',
    name: '',
    email: '',
    departmentId: '',
    designation: 'Assistant Professor',
    qualification: 'Ph.D',
    employmentType: 'Regular',
    specialization: '',
    employeeId: '',
  })

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(query)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const faculty = useApiData(() => {
    const params = new URLSearchParams()
    if (debounced) params.set('q', debounced)
    if (statusFilter !== 'ALL') params.set('status', statusFilter)
    if (deptFilter) params.set('departmentId', deptFilter)
    params.set('page', String(page))
    params.set('pageSize', '12')
    return api<any>(`/hr/faculty?${params.toString()}`)
  }, [debounced, statusFilter, deptFilter, page])

  const authMissing =
    faculty.error &&
    /authentication required|unauthorized|401/i.test(faculty.error)

  const rows = faculty.data?.items || []
  const pages = Math.max(1, Math.ceil((faculty.data?.total || 0) / 12))

  async function addFaculty(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      await api('/hr/faculty', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          employeeId: form.employeeId || form.facultyCode,
        }),
      })
      setForm({
        facultyCode: '',
        name: '',
        email: '',
        departmentId: form.departmentId,
        designation: 'Assistant Professor',
        qualification: 'Ph.D',
        employmentType: 'Regular',
        specialization: '',
        employeeId: '',
      })
      setShowForm(false)
      setMessage('Faculty added. A login account was created; credentials are sent through official channels.')
      await faculty.reload()
    } catch (err: any) {
      setMessage(err.message || 'Could not add faculty.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Faculty"
        subtitle="Add, search, and manage faculty records for the Faculty Workload System."
        action={
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void faculty.reload()}
            >
              Refresh
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowForm((v) => !v)}
            >
              {showForm ? 'Close form' : 'Add faculty'}
            </button>
          </div>
        }
      />
      {message && <div className="alert-banner">{message}</div>}
      {showForm && (
        <Panel title="New faculty">
          <form className="form-grid" onSubmit={(e) => void addFaculty(e)}>
            <input
              className="dash-input"
              placeholder="Faculty ID"
              required
              value={form.facultyCode}
              onChange={(e) => setForm({ ...form, facultyCode: e.target.value })}
            />
            <input
              className="dash-input"
              placeholder="Full name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="dash-input"
              type="email"
              placeholder="Email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <select
              className="dash-input"
              required
              value={form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
            >
              <option value="">Department</option>
              {(depts.data || []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} · {d.name}
                </option>
              ))}
            </select>
            <input
              className="dash-input"
              placeholder="Designation"
              value={form.designation}
              onChange={(e) => setForm({ ...form, designation: e.target.value })}
            />
            <input
              className="dash-input"
              placeholder="Qualification"
              value={form.qualification}
              onChange={(e) => setForm({ ...form, qualification: e.target.value })}
            />
            <input
              className="dash-input"
              placeholder="Employment type"
              value={form.employmentType}
              onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
            />
            <input
              className="dash-input"
              placeholder="Specialization"
              value={form.specialization}
              onChange={(e) => setForm({ ...form, specialization: e.target.value })}
            />
            <button className="btn btn-primary" type="submit" disabled={busy}>
              Save faculty
            </button>
          </form>
        </Panel>
      )}
      {faculty.loading && <p className="empty-state">Loading faculty…</p>}
      {authMissing ? (
        <div className="alert-banner" style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
          Session expired. Please{' '}
          <button
            type="button"
            className="open-profile-link"
            onClick={() => {
              void authService.logout().then(() => navigate('/login'))
            }}
          >
            sign in again
          </button>{' '}
          as Human Resources to load faculty.
        </div>
      ) : faculty.error ? (
        <p className="empty-state" style={{ color: '#b91c1c' }}>
          {faculty.error}
        </p>
      ) : null}
      <section className="panel faculty-directory-panel">
        <div className="form-grid" style={{ marginBottom: '0.85rem' }}>
          <input
            className="dash-input"
            placeholder="Search name, ID, email, department"
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
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <select
            className="dash-input"
            value={deptFilter}
            onChange={(e) => {
              setDeptFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All departments</option>
            {(depts.data || []).map((d: any) => (
              <option key={d.id} value={d.id}>
                {d.code} · {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table faculty-drims-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Faculty Member</th>
                <th>Department</th>
                <th>Count (2026)</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f: any) => {
                const snap = f.snapshots?.[0]
                const count = snap
                  ? Math.round(Number(snap.total || 0))
                  : f._count?.allocations || 0
                const status = snap?.status || f.status || 'ACTIVE'
                return (
                  <tr key={f.id}>
                    <td>
                      <strong className="faculty-id">{f.facultyCode}</strong>
                    </td>
                    <td>
                      <div className="person-cell">
                        <PersonAvatar
                          name={f.name}
                          email={f.email}
                          photoUrl={f.photoUrl}
                        />
                        <div className="person-meta">
                          <strong>{f.name}</strong>
                          <span>{f.designation}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <em className="dept-italic">
                        {f.department?.name || f.department?.code || '—'}
                      </em>
                    </td>
                    <td>
                      <span className="count-badge">{count}</span>
                    </td>
                    <td>
                      <StatusPill status={status} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="open-profile-link"
                        onClick={() => navigate(`/hr/faculty/${f.id}`)}
                      >
                        OPEN PROFILE →
                      </button>
                    </td>
                  </tr>
                )
              })}
              {!faculty.loading &&
                !faculty.error &&
                rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty-state">
                      No faculty records found.
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
        <Pager page={page} pages={pages} onPage={setPage} />
      </section>
    </>
  )
}

function facultyInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function HrFacultyDetailPage() {
  const { facultyId } = useParams()
  const faculty = useApiData(
    () => api<any>(`/hr/faculty/${facultyId}`),
    [facultyId],
  )
  const depts = useApiData(() => api<any[]>('/hr/departments'))
  const row = faculty.data
  const photoSrc = resolvePhotoUrl(row?.photoUrl)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    name: '',
    designation: '',
    qualification: '',
    employmentType: '',
    specialization: '',
    departmentId: '',
    employeeId: '',
  })

  useEffect(() => {
    if (!row) return
    setForm({
      name: row.name || '',
      designation: row.designation || '',
      qualification: row.qualification || '',
      employmentType: row.employmentType || 'Regular',
      specialization: row.specialization || '',
      departmentId: row.departmentId || '',
      employeeId: row.employeeId || row.facultyCode || '',
    })
  }, [row?.id])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!facultyId) return
    setBusy(true)
    try {
      await api(`/hr/faculty/${facultyId}`, {
        method: 'PATCH',
        body: JSON.stringify(form),
      })
      setMessage('Profile updated.')
      await faculty.reload()
    } catch (err: any) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function setStatus(status: 'Active' | 'Inactive') {
    if (!facultyId) return
    setBusy(true)
    try {
      await api(`/hr/faculty/${facultyId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      setMessage(status === 'Active' ? 'Faculty activated.' : 'Faculty deactivated.')
      await faculty.reload()
    } catch (err: any) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (faculty.loading) {
    return (
      <>
        <PageHeader title="Faculty Profile" />
        <p className="empty-state">Loading…</p>
      </>
    )
  }

  if (!row) {
    return (
      <>
        <PageHeader title="Faculty Profile" />
        <p className="empty-state">Faculty not found.</p>
        <Link to="/hr/faculty" className="open-profile-link">
          ← Back to Faculty
        </Link>
      </>
    )
  }

  const isActive = String(row.status || 'Active') === 'Active'

  return (
    <>
      <PageHeader
        title="Faculty Profile"
        action={
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              type="button"
              className={isActive ? 'btn btn-danger' : 'btn btn-success'}
              disabled={busy}
              onClick={() => void setStatus(isActive ? 'Inactive' : 'Active')}
            >
              {isActive ? 'Deactivate' : 'Activate'}
            </button>
            <Link to="/hr/faculty" className="btn btn-secondary">
              ← Back
            </Link>
          </div>
        }
      />
      {message && <div className="alert-banner">{message}</div>}
      <section className="profile-hero-card">
        <div className="profile-avatar-edit">
          {photoSrc ? (
            <img className="profile-avatar-circle" src={photoSrc} alt={row.name} />
          ) : (
            <div className="profile-avatar-circle profile-avatar-fallback">
              {facultyInitials(row.name)}
            </div>
          )}
        </div>
        <div className="profile-hero-meta">
          <h2 className="profile-hero-name">{row.name}</h2>
          <p>{row.designation}</p>
          <p>{row.department?.name || '—'}</p>
          <p>Employee ID: {row.facultyCode}</p>
          <p>{row.email}</p>
          {(row.adminRoles || []).length > 0 && (
            <p>
              {(row.adminRoles as any[])
                .map((r) => `${r.roleName}${r.scopeLabel ? ` — ${r.scopeLabel}` : ''}`)
                .join(' · ')}
            </p>
          )}
          <p>
            Status: <StatusPill status={row.status || 'Active'} />
          </p>
        </div>
      </section>
      <Panel title="Edit record">
        <form className="form-grid" onSubmit={(e) => void save(e)}>
          <input
            className="dash-input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Name"
          />
          <input
            className="dash-input"
            value={form.designation}
            onChange={(e) => setForm({ ...form, designation: e.target.value })}
            placeholder="Designation"
          />
          <input
            className="dash-input"
            value={form.qualification}
            onChange={(e) => setForm({ ...form, qualification: e.target.value })}
            placeholder="Qualification"
          />
          <input
            className="dash-input"
            value={form.employmentType}
            onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
            placeholder="Employment type"
          />
          <input
            className="dash-input"
            value={form.specialization}
            onChange={(e) => setForm({ ...form, specialization: e.target.value })}
            placeholder="Specialization"
          />
          <select
            className="dash-input"
            value={form.departmentId}
            onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
          >
            {(depts.data || []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} · {d.name}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            Save changes
          </button>
        </form>
      </Panel>
    </>
  )
}

export function HrDepartmentsPage() {
  const depts = useApiData(() => api<any[]>('/hr/departments'))
  const [query, setQuery] = useState('')
  const rows = filterByQuery(
    depts.data || [],
    query,
    (d) => `${d.code} ${d.name} ${d.school?.name || ''} ${d.dataSource || ''}`,
  )
  return (
    <>
      <PageHeader title="Departments" subtitle="Schools and departments in the Faculty Workload System." />
      <Panel title="Department list">
        <input
          className="dash-input"
          style={{ marginBottom: '0.75rem' }}
          placeholder="Search department"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>School</th>
              <th>Faculty count</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>
                  <strong>{d.code}</strong>
                </td>
                <td>{d.name}</td>
                <td>{d.school?.name || '—'}</td>
                <td>{d._count?.faculty ?? '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-state">
                  No departments found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>
    </>
  )
}

export function HrPoliciesPage() {
  const norms = useApiData(() => api<any[]>('/hr/norms'))
  const [normForm, setNormForm] = useState({
    min: '16',
    expected: '18',
    max: '20',
    academicYear: '2026-27',
    semester: '1',
  })
  const [message, setMessage] = useState<string | null>(null)

  async function saveNorm(e: React.FormEvent) {
    e.preventDefault()
    await api('/hr/norms', {
      method: 'POST',
      body: JSON.stringify({
        min: Number(normForm.min),
        expected: Number(normForm.expected),
        max: Number(normForm.max),
        academicYear: normForm.academicYear,
        semester: Number(normForm.semester),
      }),
    })
    setMessage('Policy saved.')
    await norms.reload()
  }

  return (
    <>
      <PageHeader title="Workload Policies" subtitle="Configurable min / expected / max. Demo defaults 16 / 18 / 20." />
      {message && <div className="alert-banner">{message}</div>}
      <Panel title="Active norms">
        <form className="form-grid" onSubmit={(e) => void saveNorm(e)}>
          <input className="dash-input" value={normForm.academicYear} onChange={(e) => setNormForm({ ...normForm, academicYear: e.target.value })} placeholder="Academic year" />
          <input className="dash-input" value={normForm.semester} onChange={(e) => setNormForm({ ...normForm, semester: e.target.value })} placeholder="Semester" />
          <input className="dash-input" value={normForm.min} onChange={(e) => setNormForm({ ...normForm, min: e.target.value })} placeholder="Min" />
          <input className="dash-input" value={normForm.expected} onChange={(e) => setNormForm({ ...normForm, expected: e.target.value })} placeholder="Expected" />
          <input className="dash-input" value={normForm.max} onChange={(e) => setNormForm({ ...normForm, max: e.target.value })} placeholder="Max" />
          <button className="btn btn-secondary" type="submit">Update policy</button>
        </form>
        <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.1rem', fontSize: '0.875rem' }}>
          {(norms.data || []).map((n) => (
            <li key={n.id}>
              <strong>{n.department?.code || 'GLOBAL'}</strong>
              {n.academicYear ? ` · ${n.academicYear}` : ''}
              {n.semester ? ` S${n.semester}` : ''}: {n.min}–{n.max} (expected {n.expected})
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}

export function HrCorrectionsPage() {
  const corrections = useApiData(() => api<any[]>('/hr/corrections'))
  const [message, setMessage] = useState<string | null>(null)

  async function review(id: string, status: 'APPROVED' | 'REJECTED') {
    await api(`/hr/corrections/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ status, note: `Marked ${status} by HR` }),
    })
    setMessage(`Request ${status.toLowerCase()}.`)
    await corrections.reload()
  }

  return (
    <>
      <PageHeader title="Correction Requests" subtitle="Review faculty-submitted workload corrections." />
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
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={() => void review(c.id, 'APPROVED')}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => void review(c.id, 'REJECTED')}
                  >
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

export function HrCompliancePage() {
  const compliance = useApiData(() => api<any[]>('/hr/compliance'))
  return (
    <>
      <PageHeader title="Compliance" subtitle="Department normal / overload / underload counts." />
      <Panel title="By department">
        <table className="data-table">
          <thead>
            <tr>
              <th>Dept</th>
              <th>Normal</th>
              <th>Over</th>
              <th>Under</th>
            </tr>
          </thead>
          <tbody>
            {(compliance.data || []).map((r) => (
              <tr key={r.departmentId}>
                <td>
                  <strong>{r.departmentCode}</strong>
                </td>
                <td>{r.NORMAL}</td>
                <td>{r.OVERLOAD}</td>
                <td>{r.UNDERLOAD}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  )
}

export function HrReportsPage() {
  const depts = useApiData(() => api<any[]>('/hr/departments'))
  const [deptId, setDeptId] = useState('')

  async function download(path: string, filename: string) {
    const blob = await apiBlob(path)
    triggerDownload(blob, filename)
  }

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Download institutional and department workload files."
      />
      <Panel title="Institution exports">
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" onClick={() => void download('/reports/compliance.pdf', 'compliance.pdf')}>
            Compliance PDF
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void download('/reports/institution/excel', 'institution-workload.xlsx')}>
            Institution Excel
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void download('/reports/institution/csv', 'institution-workload.csv')}>
            Institution CSV
          </button>
        </div>
      </Panel>
      <Panel title="Department export">
        <div className="form-grid">
          <select className="dash-input" value={deptId} onChange={(e) => setDeptId(e.target.value)}>
            <option value="">Select department</option>
            {(depts.data || []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} · {d.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!deptId}
            onClick={() => void download(`/reports/department/${deptId}/excel`, 'department-workload.xlsx')}
          >
            Excel
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!deptId}
            onClick={() => void download(`/reports/department/${deptId}/csv`, 'department-workload.csv')}
          >
            CSV
          </button>
        </div>
      </Panel>
    </>
  )
}

export function HrWeightingsPage() {
  const policies = useApiData(() => api<any[]>('/hr/policies'))
  const [weightForm, setWeightForm] = useState({ activityType: 'THEORY', weight: '1' })
  const [message, setMessage] = useState<string | null>(null)

  async function saveWeight(e: React.FormEvent) {
    e.preventDefault()
    await api('/hr/policies', {
      method: 'POST',
      body: JSON.stringify({
        activityType: weightForm.activityType,
        weight: Number(weightForm.weight),
      }),
    })
    setMessage('Weighting saved.')
    await policies.reload()
  }

  return (
    <>
      <PageHeader title="Weightings" subtitle="Activity weights used by the workload engine." />
      {message && <div className="alert-banner">{message}</div>}
      <Panel title="Update weighting">
        <form className="form-grid" onSubmit={(e) => void saveWeight(e)}>
          <select className="dash-input" value={weightForm.activityType} onChange={(e) => setWeightForm({ ...weightForm, activityType: e.target.value })}>
            {['THEORY','TUTORIAL','LAB','UG_PROJECT','PG_PROJECT','PHD','RESEARCH','ADMIN_ROLE','COMMITTEE'].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input className="dash-input" value={weightForm.weight} onChange={(e) => setWeightForm({ ...weightForm, weight: e.target.value })} />
          <button className="btn btn-secondary" type="submit">Update weighting</button>
        </form>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.75rem' }}>
          {(policies.data || []).map((p) => (
            <span key={p.id} className="meta-chip">
              {p.activityType} · {p.weight}
            </span>
          ))}
        </div>
      </Panel>
    </>
  )
}

export function HrAnalyticsPage() {
  const dash = useApiData(() => api<any>('/hr/dashboard'))
  const compliance = useApiData(() => api<any[]>('/hr/compliance'))
  const faculty = useApiData(() => api<any>('/hr/faculty?page=1&pageSize=50'))
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('ALL')
  const facultyItems = Array.isArray(faculty.data)
    ? faculty.data
    : faculty.data?.items || []
  const rows = filterByQuery(
    facultyItems.filter((f: any) => {
      const snapStatus = f.snapshots?.[0]?.status
      if (status === 'ALL') return true
      return snapStatus === status
    }),
    query,
    (f) => `${f.facultyCode} ${f.name} ${f.department?.code || ''}`,
  )
  const totalFaculty =
    Number(dash.data?.real?.totalFaculty || 0) + Number(dash.data?.demo?.totalFaculty || 0) ||
    Number(dash.data?.facultyCount || 0)
  const normal =
    Number(dash.data?.real?.normal || 0) + Number(dash.data?.demo?.normal || 0) ||
    Number(dash.data?.normal || 0)
  const overload =
    Number(dash.data?.real?.overload || 0) + Number(dash.data?.demo?.overload || 0) ||
    Number(dash.data?.overload || 0)
  const underload =
    Number(dash.data?.real?.underload || 0) + Number(dash.data?.demo?.underload || 0) ||
    Number(dash.data?.underload || 0)

  return (
    <>
      <PageHeader title="Workload Analytics" subtitle="Institution load mix and faculty search." />
      <div className="stat-grid">
        <Stat label="Faculty" value={totalFaculty || '—'} />
        <Stat label="Normal" value={normal} />
        <Stat label="Overloaded" value={overload} />
        <Stat label="Underloaded" value={underload} />
      </div>
      <div className="grid-2">
        <BarChart
          title="Compliance by department"
          items={(compliance.data || []).map((r) => ({
            label: r.departmentCode || 'Dept',
            value: Number(r.NORMAL || 0) + Number(r.OVERLOAD || 0) + Number(r.UNDERLOAD || 0),
            color: '#1e3a8a',
          }))}
        />
        <DonutBreakdown
          title="Institution status"
          segments={[
            { label: 'Normal', value: normal, color: '#059669' },
            { label: 'Overload', value: overload, color: '#dc2626' },
            { label: 'Underload', value: underload, color: '#2563eb' },
          ]}
        />
      </div>
      <Panel title="Faculty filter">
        <div className="form-grid" style={{ marginBottom: '0.75rem' }}>
          <input className="dash-input" placeholder="Search faculty" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className="dash-input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ALL">All load statuses</option>
            <option value="NORMAL">Normal</option>
            <option value="OVERLOAD">Overload</option>
            <option value="UNDERLOAD">Underload</option>
          </select>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Faculty</th>
              <th>Department</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id}>
                <td>{f.facultyCode} · {f.name}</td>
                <td>{f.department?.code || '—'}</td>
                <td>{f.snapshots?.[0]?.total ?? '—'}</td>
                <td><StatusPill status={f.snapshots?.[0]?.status || f.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  )
}

export function HrHistoryPage() {
  const history = useApiData(() => api<any[]>('/workload/history'))
  const [query, setQuery] = useState('')
  const rows = filterByQuery(
    history.data || [],
    query,
    (h) => `${h.faculty?.facultyCode || ''} ${h.faculty?.name || ''} ${h.period?.code || ''} ${h.status || ''}`,
  )
  return (
    <>
      <PageHeader title="Workload History" subtitle="Snapshots by academic period — previous records are kept." />
      <Panel title="Snapshots">
        <input
          className="dash-input"
          style={{ marginBottom: '0.75rem' }}
          placeholder="Search faculty, period, or status"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
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
            {rows.map((h) => (
              <tr key={h.id}>
                <td>{h.faculty?.facultyCode} {h.faculty?.name}</td>
                <td>{h.period?.code}</td>
                <td>{h.total}</td>
                <td><StatusPill status={h.status} /></td>
                <td>{new Date(h.calculatedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  )
}

export function HrSettingsPage() {
  const dash = useApiData(() => api<any>('/hr/dashboard'))
  return (
    <>
      <PageHeader title="Settings" subtitle="Active academic period and policy scope." />
      <Panel title="Institution">
        <p>Active period: {dash.data?.activePeriod?.name || '—'}</p>
        <p>Compliance: {dash.data?.compliancePct ?? '—'}%</p>
      </Panel>
    </>
  )
}
