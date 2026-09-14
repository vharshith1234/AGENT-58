import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ErrorRetry,
  PageHeader,
  Pager,
  Panel,
  Stat,
  TableSkeleton,
  filterByQuery,
  paginate,
  useApiData,
} from '../../components/DashboardShell'
import { BarChart, DonutBreakdown } from '../../components/OverviewCharts'
import { PersonAvatar, StatusPill, resolvePhotoUrl } from '../../components/PersonAvatar'
import { api, apiBlob, triggerDownload } from '../../lib/api'
import { authService } from '../../lib/auth'
import {
  PreviousDataUnlockPanel,
  usePreviousDataUnlock,
} from '../../lib/previousDataUnlock'
import { ClassTypeBadge, classTypeLabel, workloadHoursFrom } from '../../lib/workloadHours'
import { useWorkspaceBase, useIsMonitorWorkspace } from '../../lib/workspaceBase'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function requestPriority(row: any) {
  if (row.priority) return String(row.priority)
  if (row.fromStatusAfter === 'OVERLOAD' || row.toStatusAfter === 'OVERLOAD') return 'High'
  if (String(row.status || '').includes('PENDING')) return 'Medium'
  return null
}

export function HrOverview() {
  const base = useWorkspaceBase()
  const dash = useApiData(() => api<any>('/hr/dashboard'))
  const overview = useApiData(() => api<any>('/hr/workload/overview'))
  const pendingReq = useApiData(() => api<any[]>('/hr/reassignments?status=PENDING_UTESH'))
  const corrections = useApiData(() => api<any[]>('/hr/corrections'))
  const totalFaculty =
    Number(dash.data?.real?.totalFaculty || 0) + Number(dash.data?.demo?.totalFaculty || 0) ||
    Number(dash.data?.facultyCount || 0) + Number(dash.data?.demoFacultyCount || 0)
  const normal =
    Number(overview.data?.stats?.normal ?? NaN) >= 0
      ? Number(overview.data?.stats?.normal)
      : Number(dash.data?.real?.normal || 0) + Number(dash.data?.demo?.normal || 0) ||
        Number(dash.data?.normal || 0)
  const overload =
    Number(overview.data?.stats?.overload ?? NaN) >= 0
      ? Number(overview.data?.stats?.overload)
      : Number(dash.data?.real?.overload || 0) + Number(dash.data?.demo?.overload || 0) ||
        Number(dash.data?.overload || 0)
  const underload =
    Number(overview.data?.stats?.underload ?? NaN) >= 0
      ? Number(overview.data?.stats?.underload)
      : Number(dash.data?.real?.underload || 0) + Number(dash.data?.demo?.underload || 0) ||
        Number(dash.data?.underload || 0)
  const pending =
    (pendingReq.data || []).length +
    (corrections.data || []).filter((c: any) => String(c.status || '').toUpperCase() === 'PENDING')
      .length
  const courseCount = (overview.data?.courses || []).length

  const recent = useMemo(() => {
    const leave = (pendingReq.data || []).map((r: any) => ({
      id: `leave-${r.id}`,
      type: 'Leave / Reassignment',
      by: r.createdBy?.name || r.fromFaculty?.name || r.fromFacultyName || 'Faculty',
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
        subtitle="Current CSE workload snapshot for Uttej / HR."
      />
      <ErrorRetry error={dash.error} onRetry={() => void dash.reload()} />
      {dash.loading && <TableSkeleton />}
      <div className="stat-grid">
        <Stat label="Total Faculty" value={totalFaculty || overview.data?.stats?.total || '—'} />
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
            <Link className="btn btn-primary btn-sm" to={`${base}/requests`}>
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

export function HrFacultyPage() {
  const base = useWorkspaceBase()
  const isHodWorkspace = useIsMonitorWorkspace()
  const depts = useApiData(() => api<any[]>('/hr/departments'))
  const navigate = useNavigate()
  const {
    unlocked,
    unlockInput,
    setUnlockInput,
    unlockMessage,
    tryUnlock,
    lockAgain,
  } = usePreviousDataUnlock()
  const cse = (depts.data || []).find((d: any) => d.code === 'CSE')
  const cseId = cse?.id || ''
  const visibleDepts = unlocked ? depts.data || [] : cse ? [cse] : []
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

  useEffect(() => {
    if (!cseId) return
    if (!unlocked) {
      setDeptFilter(cseId)
      setForm((f) => ({ ...f, departmentId: f.departmentId || cseId }))
    }
  }, [cseId, unlocked])

  const effectiveDeptId = unlocked ? deptFilter : cseId || deptFilter

  const faculty = useApiData(() => {
    const params = new URLSearchParams()
    if (debounced) params.set('q', debounced)
    if (statusFilter !== 'ALL') params.set('status', statusFilter)
    if (effectiveDeptId) params.set('departmentId', effectiveDeptId)
    params.set('page', String(page))
    params.set('pageSize', '10')
    return api<any>(`/hr/faculty?${params.toString()}`)
  }, [debounced, statusFilter, effectiveDeptId, page])

  const authMissing =
    faculty.error &&
    /authentication required|unauthorized|401/i.test(faculty.error)

  const rows = faculty.data?.items || []
  const pages = Math.max(1, Math.ceil((faculty.data?.total || 0) / 10))

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
        subtitle={
          isHodWorkspace
            ? unlocked
              ? 'All departments unlocked.'
              : 'CSE faculty directory. Unlock to see other departments.'
            : unlocked
              ? 'All departments unlocked.'
              : 'Uttej CSE-only mode. Unlock to see other departments.'
        }
        action={
          isHodWorkspace ? undefined : (
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
          )
        }
      />
      {(message || unlockMessage) && (
        <div className="alert-banner">{message || unlockMessage}</div>
      )}
      {!isHodWorkspace && showForm && (
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
              value={form.departmentId || (unlocked ? '' : cseId)}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
              disabled={!unlocked && !!cseId}
            >
              <option value="">Department</option>
              {visibleDepts.map((d: any) => (
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
        <div className="panel-head" style={{ marginBottom: '0.65rem' }}>
          <h2>Faculty directory</h2>
          <PreviousDataUnlockPanel
            unlocked={unlocked}
            unlockInput={unlockInput}
            setUnlockInput={setUnlockInput}
            onUnlock={tryUnlock}
            onLock={() => {
              lockAgain()
              if (cseId) setDeptFilter(cseId)
            }}
          />
        </div>
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
            value={effectiveDeptId}
            disabled={!unlocked}
            onChange={(e) => {
              setDeptFilter(e.target.value)
              setPage(1)
            }}
          >
            {unlocked && <option value="">All departments</option>}
            {visibleDepts.map((d: any) => (
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
                        onClick={() => navigate(`${base}/faculty/${f.id}`)}
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
        <Pager page={page} pages={pages} total={faculty.data?.total || 0} onPage={setPage} />
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
  const base = useWorkspaceBase()
  const { facultyId } = useParams()
  const faculty = useApiData(() => api<any>(`/hr/faculty/${facultyId}`), [facultyId])
  const workload = useApiData(
    () => (facultyId ? api<any>(`/workload/faculty/${facultyId}`) : Promise.resolve(null)),
    [facultyId],
  )
  const depts = useApiData(() => api<any[]>('/hr/departments'))
  const { unlocked } = usePreviousDataUnlock()
  const row = faculty.data
  const deptId = row?.departmentId || ''
  const allocations = useApiData(
    () =>
      deptId
        ? api<any[]>(`/hr/allocations?departmentId=${encodeURIComponent(deptId)}`)
        : Promise.resolve([]),
    [deptId],
  )
  const timetable = useApiData(
    () =>
      deptId
        ? api<any[]>(`/hr/timetable?departmentId=${encodeURIComponent(deptId)}`)
        : Promise.resolve([]),
    [deptId],
  )
  const photoSrc = resolvePhotoUrl(row?.photoUrl)
  const cse = (depts.data || []).find((d: any) => d.code === 'CSE')
  const visibleDepts = unlocked
    ? depts.data || []
    : [row?.department, cse].filter(Boolean).filter(
        (d: any, i: number, arr: any[]) => arr.findIndex((x) => x.id === d.id) === i,
      )
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
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

  const myAllocations = useMemo(
    () => (allocations.data || []).filter((a: any) => a.facultyId === facultyId),
    [allocations.data, facultyId],
  )
  const mySlots = useMemo(
    () =>
      (timetable.data || []).filter(
        (t: any) => String(t.facultyId || t.faculty?.id || '') === String(facultyId),
      ),
    [timetable.data, facultyId],
  )

  const wlSource = workload.data || row?.snapshots?.[0] || {}
  const hours = workloadHoursFrom({
    ...wlSource,
    assignedHours: wlSource.assignedHours ?? wlSource.total ?? row?.snapshots?.[0]?.total,
    requiredHours: wlSource.requiredHours ?? wlSource.normMin,
    status: wlSource.status ?? row?.snapshots?.[0]?.status,
  })

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
        <TableSkeleton />
      </>
    )
  }

  if (!row) {
    return (
      <>
        <PageHeader title="Faculty Profile" />
        <p className="empty-state">Faculty not found.</p>
        <Link to={`${base}/faculty`} className="open-profile-link">
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
        subtitle="Current workload and teaching focus."
        action={
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowEdit((v) => !v)}
            >
              {showEdit ? 'Hide edit' : 'Edit record'}
            </button>
            <button
              type="button"
              className={isActive ? 'btn btn-danger btn-sm' : 'btn btn-success btn-sm'}
              disabled={busy}
              onClick={() => void setStatus(isActive ? 'Inactive' : 'Active')}
            >
              {isActive ? 'Deactivate' : 'Activate'}
            </button>
            <Link to={`${base}/faculty`} className="btn btn-secondary btn-sm">
              ← Back
            </Link>
          </div>
        }
      />
      {message && <div className="alert-banner">{message}</div>}

      <section className="profile-hero-card profile-hero-compact">
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
          <p className="profile-hero-title">
            {row.designation || '—'}
            {row.department?.code ? ` · ${row.department.code}` : ''}
          </p>
          <StatusPill status={hours.status || row.status || 'Active'} />
        </div>
      </section>

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

      <div className="grid-2">
        <Panel
          title="Current courses / subjects"
          action={<span className="meta-chip">{myAllocations.length}</span>}
        >
          {(allocations.loading || workload.loading) && <TableSkeleton />}
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
                    <div className="muted-line">{a.course?.name || ''}</div>
                  </td>
                  <td>{a.section || a.course?.section || '—'}</td>
                  <td>
                    <ClassTypeBadge type={a.classType || a.course?.type || ''} />
                  </td>
                  <td>{a.hours ?? '—'}</td>
                </tr>
              ))}
              {!allocations.loading && myAllocations.length === 0 && (
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
          {timetable.loading && <TableSkeleton />}
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
              {!timetable.loading && mySlots.length === 0 && (
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

      {showEdit ? (
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
              disabled={!unlocked}
            >
              {visibleDepts.map((d: any) => (
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
      ) : null}
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
  const cse = (depts.data || []).find((d) => d.code === 'CSE')
  const cseId = cse?.id || ''
  const overview = useApiData(() => api<any>('/hr/workload/overview'))
  const facultyOptions = overview.data?.faculty || []
  const {
    unlocked,
    unlockInput,
    setUnlockInput,
    unlockMessage,
    tryUnlock,
    lockAgain,
  } = usePreviousDataUnlock()

  const [periodDate, setPeriodDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [periodRange, setPeriodRange] = useState<'day' | 'week' | 'month'>('day')
  const [facultyId, setFacultyId] = useState('')
  const [deptId, setDeptId] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (cseId && !deptId) setDeptId(cseId)
  }, [cseId, deptId])

  async function download(path: string, filename: string) {
    try {
      const blob = await apiBlob(path)
      triggerDownload(blob, filename)
      setMessage(null)
    } catch (e: any) {
      setMessage(e.message || 'Download failed')
    }
  }

  function periodDownload(format: 'xlsx' | 'csv') {
    const q = new URLSearchParams({
      range: periodRange,
      date: periodDate,
      format,
    })
    if (facultyId) q.set('facultyId', facultyId)
    const facTag = facultyId ? `-faculty` : '-all-faculty'
    const name = `cse-${periodRange}${facTag}-${periodDate}.${format === 'csv' ? 'csv' : 'xlsx'}`
    return download(`/reports/cse/period?${q.toString()}`, name)
  }

  const scopeQ = unlocked ? 'all' : 'cse'
  const banner = message || unlockMessage

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={
          unlocked
            ? 'Unlocked: full institution / all departments available.'
            : 'Uttej CSE-only mode. Faculty included in every period report.'
        }
        action={
          <PreviousDataUnlockPanel
            unlocked={unlocked}
            unlockInput={unlockInput}
            setUnlockInput={setUnlockInput}
            onUnlock={tryUnlock}
            onLock={() => {
              lockAgain()
              setDeptId(cseId)
            }}
          />
        }
      />
      {banner && <div className="alert-banner">{banner}</div>}

      <Panel title="CSE period reports (day / week / month) — with faculty">
        <div className="form-grid" style={{ alignItems: 'end' }}>
          <label className="field-label">
            <span>Report type</span>
            <select
              className="dash-input"
              value={periodRange}
              onChange={(e) => setPeriodRange(e.target.value as 'day' | 'week' | 'month')}
            >
              <option value="day">Day wise</option>
              <option value="week">Week wise</option>
              <option value="month">Month wise</option>
            </select>
          </label>
          <label className="field-label">
            <span>
              {periodRange === 'month'
                ? 'Any date in month'
                : periodRange === 'week'
                  ? 'Any date in week'
                  : 'Date'}
            </span>
            <input
              className="dash-input"
              type="date"
              value={periodDate}
              onChange={(e) => setPeriodDate(e.target.value)}
            />
          </label>
          <label className="field-label">
            <span>Faculty</span>
            <select
              className="dash-input"
              value={facultyId}
              onChange={(e) => setFacultyId(e.target.value)}
            >
              <option value="">All CSE faculty</option>
              {facultyOptions.map((f: any) => (
                <option key={f.facultyId} value={f.facultyId}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-primary" onClick={() => void periodDownload('xlsx')}>
            Excel
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void periodDownload('csv')}>
            CSV
          </button>
        </div>
        <p className="empty-state" style={{ marginTop: '0.75rem' }}>
          File includes Faculty directory sheet + workload, timetable, leave, and reassignments
          {facultyId ? ' for the selected faculty' : ' for all CSE faculty'}.
        </p>
      </Panel>

      <Panel title={unlocked ? 'Exports (CSE + institution)' : 'CSE snapshot exports'}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'nowrap',
            gap: '0.5rem',
            alignItems: 'center',
            overflowX: 'auto',
          }}
        >
          <button
            type="button"
            className="btn btn-primary"
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            onClick={() =>
              void download(
                `/reports/compliance.pdf?scope=${scopeQ}`,
                scopeQ === 'all' ? 'institution-compliance.pdf' : 'cse-compliance.pdf',
              )
            }
          >
            {unlocked ? 'Institution Compliance PDF' : 'CSE Compliance PDF'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            onClick={() =>
              void download(
                `/reports/institution/excel?scope=${scopeQ}`,
                scopeQ === 'all' ? 'institution-workload.xlsx' : 'cse-workload.xlsx',
              )
            }
          >
            {unlocked ? 'Institution Excel' : 'CSE Excel'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            onClick={() =>
              void download(
                `/reports/institution/csv?scope=${scopeQ}`,
                scopeQ === 'all' ? 'institution-workload.csv' : 'cse-workload.csv',
              )
            }
          >
            {unlocked ? 'Institution CSV' : 'CSE CSV'}
          </button>
          {!unlocked && (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                disabled={!cseId}
                onClick={() => void download(`/reports/department/${cseId}/excel`, 'cse-department-workload.xlsx')}
              >
                CSE Department Excel
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                disabled={!cseId}
                onClick={() => void download(`/reports/department/${cseId}/csv`, 'cse-department-workload.csv')}
              >
                CSE Department CSV
              </button>
            </>
          )}
        </div>

        {unlocked && (
          <div className="form-grid" style={{ marginTop: '1rem', alignItems: 'end' }}>
            <label className="field-label">
              <span>Department</span>
              <select className="dash-input" value={deptId} onChange={(e) => setDeptId(e.target.value)}>
                <option value="">Select department</option>
                {(depts.data || []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} · {d.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!deptId}
              onClick={() => void download(`/reports/department/${deptId}/excel`, 'department-workload.xlsx')}
            >
              Department Excel
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!deptId}
              onClick={() => void download(`/reports/department/${deptId}/csv`, 'department-workload.csv')}
            >
              Department CSV
            </button>
          </div>
        )}
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
  const overview = useApiData(() => api<any>('/hr/workload/overview'))
  const compliance = useApiData(() => api<any[]>('/hr/compliance'))
  const allocations = useApiData(() => api<any[]>('/hr/allocations'))
  const [status, setStatus] = useState('ALL')
  const [deptCode, setDeptCode] = useState('ALL')

  const faculty = overview.data?.faculty || []
  const courses = overview.data?.courses || []
  const allocRows = allocations.data || []

  const filteredFaculty = faculty.filter((f: any) => {
    if (status !== 'ALL' && f.status !== status) return false
    return true
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

  const deptRows = (compliance.data || dash.data?.allRows || dash.data?.rows || [])
    .map((r: any) => ({
      label: r.departmentCode || 'Dept',
      normal: Number(r.NORMAL || 0),
      under: Number(r.UNDERLOAD || 0),
      over: Number(r.OVERLOAD || 0),
      total: Number(r.NORMAL || 0) + Number(r.UNDERLOAD || 0) + Number(r.OVERLOAD || 0),
    }))
    .filter((r) => (deptCode === 'ALL' ? true : r.label === deptCode))

  const deptCodes = Array.from(
    new Set(
      (compliance.data || dash.data?.allRows || dash.data?.rows || []).map(
        (r: any) => r.departmentCode || 'Dept',
      ),
    ),
  ).sort()

  const ltp = { L: 0, T: 0, P: 0 }
  for (const a of allocRows) {
    const t = classTypeLabel(a.classType, a.course?.type)
    if (t === 'L' || t === 'T' || t === 'P') ltp[t] += 1
  }

  const courseAllocBars = [
    { label: 'Courses', value: courses.length, color: '#1e3a8a' },
    { label: 'Allocations', value: allocRows.length, color: '#0f766e' },
    {
      label: 'Unallocated',
      value: Math.max(0, courses.length - new Set(allocRows.map((a: any) => a.courseId)).size),
      color: '#94a3b8',
    },
  ]

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Workload, department, and course allocation at a glance."
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
          <label className="field-label">
            <span>Department</span>
            <select
              className="dash-input"
              value={deptCode}
              onChange={(e) => setDeptCode(e.target.value)}
            >
              <option value="ALL">All departments</option>
              {deptCodes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Panel>

      <div className="grid-2">
        <DonutBreakdown title="Normal / Underload / Overload" segments={statusSegs} />
        <BarChart title="Faculty workload (top 10)" items={facultyWorkloadBars} />
      </div>

      <div className="grid-2">
        <BarChart
          title="Department-wise workload"
          items={deptRows.map((r) => ({
            label: r.label,
            value: r.total,
            color: '#1e3a8a',
          }))}
        />
        <BarChart title="Course allocation" items={courseAllocBars} />
      </div>

      <DonutBreakdown
        title="L / T / P distribution"
        segments={[
          { label: 'Lecture (L)', value: ltp.L, color: '#1d4ed8' },
          { label: 'Tutorial (T)', value: ltp.T, color: '#0f766e' },
          { label: 'Practical (P)', value: ltp.P, color: '#b45309' },
        ]}
      />
    </>
  )
}

export function HrHistoryPage() {
  const history = useApiData(() => api<any[]>('/workload/history'))
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const rows = filterByQuery(
    history.data || [],
    query,
    (h) => `${h.faculty?.facultyCode || ''} ${h.faculty?.name || ''} ${h.period?.code || ''} ${h.status || ''}`,
  )
  const paged = paginate(rows, page, 10)
  return (
    <>
      <PageHeader title="Workload History" subtitle="Snapshots by academic period — previous records are kept." />
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
            {paged.rows.map((h) => (
              <tr key={h.id}>
                <td>{h.faculty?.facultyCode} {h.faculty?.name}</td>
                <td>{h.period?.code}</td>
                <td>{h.total}</td>
                <td><StatusPill status={h.status} /></td>
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
