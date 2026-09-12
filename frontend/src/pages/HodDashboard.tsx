import { useState } from 'react'
import {
  DashboardShell,
  Panel,
  Stat,
  sectionId,
  useApiData,
} from '../components/DashboardShell'
import { PersonAvatar, StatusPill } from '../components/PersonAvatar'
import { api, apiBlob } from '../lib/api'
import { authService } from '../lib/auth'

export function HodDashboard() {
  const session = authService.getSession()
  const deptId = session?.user.departmentId
  const dash = useApiData(() => api<any>('/hod/dashboard'), [deptId])
  const courses = useApiData(() => api<any[]>('/hod/courses'), [deptId])
  const allocations = useApiData(() => api<any[]>('/hod/allocations'), [deptId])
  const timetable = useApiData(() => api<any[]>('/hod/timetable'), [deptId])
  const projects = useApiData(() => api<any[]>('/hod/projects'), [deptId])
  const balance = useApiData(
    () =>
      deptId
        ? api<any>(`/workload/department/${deptId}/balance`)
        : Promise.resolve(null),
    [deptId],
  )
  const [simResult, setSimResult] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [courseForm, setCourseForm] = useState({
    code: '',
    name: '',
    hoursPerWeek: '3',
    semester: '1',
  })
  const [allocForm, setAllocForm] = useState({
    courseId: '',
    facultyId: '',
    hours: '3',
  })
  const [projectForm, setProjectForm] = useState({
    title: '',
    guideId: '',
    studentCount: '1',
    level: 'UG',
  })

  const faculty = balance.data?.faculty || []

  async function recalculate() {
    if (!deptId) return
    setBusy(true)
    try {
      await api(`/workload/department/${deptId}/recalculate`, { method: 'POST' })
      await Promise.all([dash.reload(), balance.reload()])
      setMessage('Department workloads recalculated.')
    } catch (e: any) {
      setMessage(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function whatIfFirstFaculty() {
    const first = faculty[0]
    if (!first) return
    setBusy(true)
    try {
      const result = await api(`/workload/faculty/${first.facultyId}/simulate`, {
        method: 'POST',
        body: JSON.stringify({
          allocations: [{ hours: 14, courseType: 'THEORY' }],
        }),
      })
      setSimResult(result)
      setMessage('What-if completed (no DB writes).')
    } catch (e: any) {
      setMessage(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function applyFirstSuggestion() {
    const s = balance.data?.suggestions?.[0]
    if (!s) {
      setMessage('No balance suggestions available.')
      return
    }
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
      setMessage('Balance move applied and snapshots refreshed.')
    } catch (e: any) {
      setMessage(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function submitApproval() {
    setBusy(true)
    try {
      await api('/hod/submit-approval', { method: 'POST', body: '{}' })
      setMessage('Package submitted to Dean.')
      await dash.reload()
    } catch (e: any) {
      setMessage(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function exportExcel() {
    if (!deptId) return
    try {
      const blob = await apiBlob(`/reports/department/${deptId}/excel`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'department-workload.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setMessage(e.message || 'Export failed')
    }
  }

  async function addCourse(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await api('/hod/courses', {
        method: 'POST',
        body: JSON.stringify({
          code: courseForm.code,
          name: courseForm.name,
          hoursPerWeek: Number(courseForm.hoursPerWeek),
          semester: Number(courseForm.semester),
          type: 'THEORY',
        }),
      })
      setCourseForm({ code: '', name: '', hoursPerWeek: '3', semester: '1' })
      setMessage('Course added.')
      await courses.reload()
    } catch (err: any) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function addAllocation(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await api('/hod/allocations', {
        method: 'POST',
        body: JSON.stringify({
          courseId: allocForm.courseId,
          facultyId: allocForm.facultyId,
          hours: Number(allocForm.hours),
        }),
      })
      setMessage('Allocation saved.')
      await Promise.all([allocations.reload(), balance.reload()])
    } catch (err: any) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function addProject(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await api('/hod/projects', {
        method: 'POST',
        body: JSON.stringify({
          title: projectForm.title,
          guideId: projectForm.guideId,
          studentCount: Number(projectForm.studentCount),
          level: projectForm.level,
        }),
      })
      setProjectForm({ title: '', guideId: '', studentCount: '1', level: 'UG' })
      setMessage('Project added.')
      await Promise.all([projects.reload(), balance.reload()])
    } catch (err: any) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <DashboardShell role="HOD">
      {message && <div className="alert-banner">{message}</div>}

      <div className="stat-grid">
        <Stat label="Courses" value={dash.data?.courses ?? '—'} />
        <Stat
          label="Overloaded"
          value={faculty.filter((f: any) => f.status === 'OVERLOAD').length}
        />
        <Stat
          label="Underloaded"
          value={faculty.filter((f: any) => f.status === 'UNDERLOAD').length}
        />
        <Stat label="Faculty" value={faculty.length || '—'} />
      </div>

      <Panel
        title="CSE faculty workload"
        id={sectionId('Faculty')}
        action={
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void recalculate()}
            >
              Recalculate
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void exportExcel()}
            >
              Excel
            </button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Faculty</th>
                <th>Total</th>
                <th>Teaching</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {faculty.map((f: any) => (
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
                          {f.facultyCode} · {f.name}
                        </strong>
                        <span>
                          {f.email || '—'} · Norm {f.normMin}–{f.normMax}
                          {f.provisionalTeaching ? ' · provisional teaching' : ''}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <strong>{f.total?.toFixed?.(2) ?? f.total}</strong>
                  </td>
                  <td>{f.teachingWeighted?.toFixed?.(2)}</td>
                  <td>
                    <StatusPill status={f.status} />
                  </td>
                </tr>
              ))}
              {faculty.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-state">
                    No faculty workload yet — run recalculate after allocations.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid-2" id={sectionId('Workload')}>
        <Panel title="What-if" id={sectionId('What-if')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => void whatIfFirstFaculty()}
            >
              Simulate +14h (first faculty)
            </button>
          </div>
          {simResult && (
            <pre
              style={{
                marginTop: '0.85rem',
                background: '#f4f7fb',
                borderRadius: '0.75rem',
                padding: '0.75rem',
                fontSize: '0.75rem',
                overflow: 'auto',
              }}
            >
              {JSON.stringify(
                {
                  total: simResult.total,
                  status: simResult.status,
                  teachingWeighted: simResult.teachingWeighted,
                },
                null,
                2,
              )}
            </pre>
          )}
        </Panel>

        <Panel title="Balancing" id={sectionId('Balancing')}>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => void applyFirstSuggestion()}
          >
            Apply top suggestion
          </button>
          <ul
            style={{
              marginTop: '0.85rem',
              paddingLeft: '1.1rem',
              fontSize: '0.85rem',
              color: '#5b6b7c',
            }}
          >
            {(balance.data?.suggestions || []).slice(0, 5).map((s: any, i: number) => (
              <li key={i}>{s.reason}</li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel
        title="Courses"
        id={sectionId('Courses')}
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
      >
        <form
          onSubmit={(e) => void addCourse(e)}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          <input
            className="dash-input"
            placeholder="Code"
            required
            value={courseForm.code}
            onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })}
          />
          <input
            className="dash-input"
            placeholder="Name"
            required
            value={courseForm.name}
            onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
          />
          <input
            className="dash-input"
            placeholder="Hours/week"
            value={courseForm.hoursPerWeek}
            onChange={(e) =>
              setCourseForm({ ...courseForm, hoursPerWeek: e.target.value })
            }
          />
          <button type="submit" className="btn btn-secondary" disabled={busy}>
            Add course
          </button>
        </form>
        <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.875rem' }}>
          {(courses.data || []).map((c) => (
            <li key={c.id} style={{ marginBottom: '0.35rem' }}>
              <strong>{c.code}</strong> {c.name} · {c.hoursPerWeek}h/w
            </li>
          ))}
          {(courses.data || []).length === 0 && (
            <li className="empty-state">No courses yet.</li>
          )}
        </ul>
        {dash.data?.pendingApproval && (
          <p style={{ marginTop: '0.85rem', fontSize: '0.85rem', color: '#b45309' }}>
            Pending approval: {dash.data.pendingApproval.status}
          </p>
        )}
      </Panel>

      <Panel title="Course allocation" id={sectionId('Course Allocation')}>
        <form
          onSubmit={(e) => void addAllocation(e)}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          <select
            className="dash-input"
            required
            value={allocForm.courseId}
            onChange={(e) => setAllocForm({ ...allocForm, courseId: e.target.value })}
          >
            <option value="">Select course</option>
            {(courses.data || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>
          <select
            className="dash-input"
            required
            value={allocForm.facultyId}
            onChange={(e) => setAllocForm({ ...allocForm, facultyId: e.target.value })}
          >
            <option value="">Select faculty</option>
            {faculty.map((f: any) => (
              <option key={f.facultyId} value={f.facultyId}>
                {f.facultyCode} · {f.name}
              </option>
            ))}
          </select>
          <input
            className="dash-input"
            type="number"
            min="0.5"
            step="0.5"
            value={allocForm.hours}
            onChange={(e) => setAllocForm({ ...allocForm, hours: e.target.value })}
          />
          <button type="submit" className="btn btn-secondary" disabled={busy}>
            Assign
          </button>
        </form>
        <table className="data-table">
          <thead>
            <tr>
              <th>Course</th>
              <th>Faculty</th>
              <th>Hours</th>
            </tr>
          </thead>
          <tbody>
            {(allocations.data || []).map((a) => (
              <tr key={a.id}>
                <td>{a.course?.code}</td>
                <td>{a.faculty?.name}</td>
                <td>{a.hours}</td>
              </tr>
            ))}
            {(allocations.data || []).length === 0 && (
              <tr>
                <td colSpan={3} className="empty-state">
                  No allocations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>

      <Panel title="Timetable" id={sectionId('Timetable')}>
        {(timetable.data || []).length === 0 && (
          <p className="empty-state">No timetable slots yet.</p>
        )}
        <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.875rem' }}>
          {(timetable.data || []).map((t: any) => (
            <li key={t.id}>
              Day {t.dayOfWeek}: {t.startTime}–{t.endTime} · {t.course?.code} ·{' '}
              {t.room || '—'}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Projects" id={sectionId('Projects')}>
        <form
          onSubmit={(e) => void addProject(e)}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          <input
            className="dash-input"
            placeholder="Title"
            required
            value={projectForm.title}
            onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
          />
          <select
            className="dash-input"
            required
            value={projectForm.guideId}
            onChange={(e) =>
              setProjectForm({ ...projectForm, guideId: e.target.value })
            }
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
        <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.875rem' }}>
          {(projects.data || []).map((p: any) => (
            <li key={p.id}>
              <strong>{p.title}</strong> · guide {p.guide?.name} · {p.studentCount}{' '}
              students
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="Reports"
        id={sectionId('Reports')}
        action={
          <button type="button" className="btn btn-primary" onClick={() => void exportExcel()}>
            Download Excel
          </button>
        }
      >
        <p className="empty-state">
          Export department workload spreadsheet for the active period.
        </p>
      </Panel>
    </DashboardShell>
  )
}
