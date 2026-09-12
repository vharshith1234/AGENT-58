import { useState } from 'react'
import {
  ErrorRetry,
  PageHeader,
  Panel,
  Stat,
  TableSkeleton,
  useApiData,
} from '../../components/DashboardShell'
import { BarChart, DonutBreakdown } from '../../components/OverviewCharts'
import { StatusPill } from '../../components/PersonAvatar'
import { api, apiBlob } from '../../lib/api'
import { ActivityPortfolio } from '../../components/ActivityPortfolio'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function FacultyOverview() {
  const me = useApiData(() => api<any>('/faculty/me/workload'))
  const b = me.data?.breakdown
  return (
    <>
      <PageHeader
        title="Faculty Overview"
        subtitle="Your workload composition and status."
      />
      <ErrorRetry error={me.error} onRetry={() => void me.reload()} />
      {me.loading && <TableSkeleton />}
      <div className="stat-grid">
        <Stat label="Total Workload" value={b ? b.total.toFixed(2) : '—'} />
        <Stat label="Status" value={b?.status ?? '—'} />
        <Stat label="Norm Band" value={b ? `${b.normMin}–${b.normMax}` : '—'} />
        <Stat label="Expected" value={b?.normExpected ?? '—'} />
      </div>
      {b && (
        <div className="grid-2">
          <BarChart
            title="Workload components"
            items={[
              { label: 'Teaching', value: b.teachingWeighted, color: '#1e3a8a' },
              { label: 'Projects', value: b.projectsWeighted, color: '#2563eb' },
              { label: 'PhD', value: b.phdWeighted, color: '#0f766e' },
              { label: 'Committees', value: b.committeeWeighted, color: '#b45309' },
              { label: 'Research', value: b.researchWeighted, color: '#7c3aed' },
              { label: 'Admin', value: b.adminWeighted, color: '#be123c' },
            ]}
          />
          <DonutBreakdown
            title="Share of total"
            segments={[
              { label: 'Teaching', value: b.teachingWeighted, color: '#1e3a8a' },
              { label: 'Projects', value: b.projectsWeighted, color: '#2563eb' },
              { label: 'Other', value: Math.max(0, b.total - b.teachingWeighted - b.projectsWeighted), color: '#94a3b8' },
            ]}
          />
        </div>
      )}
    </>
  )
}

export function FacultyCoursesPage() {
  const me = useApiData(() => api<any>('/faculty/me/workload'))
  return (
    <>
      <PageHeader title="My Courses" subtitle="Courses allocated to you." />
      <Panel title="Allocations">
        {(me.data?.allocations || []).length === 0 && (
          <p className="empty-state">No course allocations yet.</p>
        )}
        {(me.data?.allocations || []).length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                <th>Credits</th>
                <th>Section</th>
                <th>Semester</th>
                <th>Hours</th>
              </tr>
            </thead>
            <tbody>
              {(me.data?.allocations || []).map((a: any) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.course?.code}</strong>
                  </td>
                  <td>{a.course?.name}</td>
                  <td>{a.course?.type || '—'}</td>
                  <td>{a.course?.credits ?? '—'}</td>
                  <td>{a.section || a.course?.section || '—'}</td>
                  <td>{a.course?.semester ?? '—'}</td>
                  <td>{a.hours}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  )
}

export function FacultyTimetablePage() {
  const me = useApiData(() => api<any>('/faculty/me/workload'))
  return (
    <>
      <PageHeader title="My Timetable" subtitle="Your scheduled contact hours." />
      <Panel title="Weekly slots">
        {(me.data?.timetable || []).length === 0 && (
          <p className="empty-state">No timetable slots yet.</p>
        )}
        {(me.data?.timetable || []).length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Time</th>
                <th>Course</th>
                <th>Room</th>
              </tr>
            </thead>
            <tbody>
              {(me.data?.timetable || []).map((t: any) => (
                <tr key={t.id}>
                  <td>{DAYS[t.dayOfWeek] ?? t.dayOfWeek}</td>
                  <td>
                    {t.startTime}–{t.endTime}
                  </td>
                  <td>
                    {t.course?.code} {t.course?.name}
                  </td>
                  <td>{t.room || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  )
}

export function FacultyProjectsPage() {
  return (
    <ActivityPortfolio
      kind="projects"
      title="My Projects"
      subtitle="Guidance, mentoring, and student project portfolio."
    />
  )
}

export function FacultyWorkloadPage() {
  return <FacultyOverview />
}

export function FacultyStatementPage() {
  const me = useApiData(() => api<any>('/faculty/me/workload'))
  const [message, setMessage] = useState<string | null>(null)
  const b = me.data?.breakdown
  const faculty = me.data?.faculty

  async function verify() {
    try {
      await api('/faculty/me/verify', {
        method: 'POST',
        body: JSON.stringify({ note: 'Verified by faculty' }),
      })
      setMessage('Workload verified.')
      await me.reload()
    } catch (e: any) {
      setMessage(e.message || 'Verify failed')
    }
  }

  async function downloadCsv() {
    try {
      const blob = await apiBlob('/faculty/me/statement.csv')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'workload-statement.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setMessage(e.message || 'CSV download failed')
    }
  }

  async function downloadExcel() {
    try {
      const blob = await apiBlob('/faculty/me/statement.xlsx')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'workload-statement.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setMessage(e.message || 'Excel download failed')
    }
  }

  async function downloadPdf() {
    try {
      const blob = await apiBlob('/faculty/me/statement.pdf')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'workload-statement.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setMessage(e.message || 'PDF download failed')
    }
  }

  return (
    <>
      <PageHeader
        title="Workload Statement"
        subtitle={
          faculty
            ? `${faculty.name} · ${faculty.facultyCode}`
            : 'Verify and download your statement.'
        }
        action={
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" onClick={() => void verify()}>
              Verify
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void downloadPdf()}
            >
              PDF statement
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void downloadCsv()}
            >
              CSV
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void downloadExcel()}
            >
              Excel
            </button>
          </div>
        }
      />
      {message && <div className="alert-banner">{message}</div>}
      <Panel title="Breakdown">
        {me.loading && <p className="empty-state">Loading…</p>}
        {b && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Component</th>
                <th>Weighted hours</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Teaching{b.provisionalTeaching ? ' (provisional)' : ''}</td>
                <td>{b.teachingWeighted.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Projects</td>
                <td>{b.projectsWeighted.toFixed(2)}</td>
              </tr>
              <tr>
                <td>PhD</td>
                <td>{b.phdWeighted.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Committees</td>
                <td>{b.committeeWeighted.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Research</td>
                <td>{b.researchWeighted.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Admin</td>
                <td>{b.adminWeighted.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </Panel>
    </>
  )
}

export function FacultyCorrectionsPage() {
  const corrections = useApiData(() => api<any[]>('/faculty/me/corrections'))
  const [category, setCategory] = useState('Teaching hours')
  const [description, setDescription] = useState('')
  const [currentValue, setCurrentValue] = useState('')
  const [expectedValue, setExpectedValue] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  async function submitCorrection(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api('/faculty/me/corrections', {
        method: 'POST',
        body: JSON.stringify({
          issueCategory: category,
          description,
          currentValue,
          expectedValue,
          targetRole: 'HOD',
        }),
      })
      setDescription('')
      setMessage('Correction submitted.')
      await corrections.reload()
    } catch (err: any) {
      setMessage(err.message || 'Submit failed')
    }
  }

  return (
    <>
      <PageHeader title="Corrections" subtitle="Request changes to your recorded workload." />
      {message && <div className="alert-banner">{message}</div>}
      <div className="grid-2">
        <Panel title="Request correction">
          <form className="profile-form" onSubmit={(e) => void submitCorrection(e)}>
            <label>
              Category
              <select
                className="dash-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option>Teaching hours</option>
                <option>Project credit</option>
                <option>Admin role</option>
                <option>Other</option>
              </select>
            </label>
            <label>
              Description
              <textarea
                className="dash-input"
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label>
              Current value
              <input className="dash-input" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} />
            </label>
            <label>
              Expected value
              <input className="dash-input" value={expectedValue} onChange={(e) => setExpectedValue(e.target.value)} />
            </label>
            <button type="submit" className="btn btn-primary">
              Submit
            </button>
          </form>
        </Panel>
        <Panel title="My corrections">
          {(corrections.data || []).length === 0 && (
            <p className="empty-state">No requests yet.</p>
          )}
          <div style={{ display: 'grid', gap: '0.65rem' }}>
            {(corrections.data || []).map((c) => (
              <div key={c.id} className="list-card">
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <StatusPill status={c.status} />
                  <strong style={{ fontSize: '0.85rem' }}>{c.issueCategory}</strong>
                </div>
                <p className="empty-state" style={{ marginTop: '0.35rem' }}>
                  {c.description}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  )
}

export function FacultyResearchPage() {
  return (
    <ActivityPortfolio
      kind="research"
      title="My Research"
      subtitle="Research commitments, proposals, and publication activity."
    />
  )
}

export function FacultyResponsibilitiesPage() {
  const me = useApiData(() => api<any>('/faculty/me/workload'))
  return (
    <>
      <PageHeader title="My Responsibilities" subtitle="Administration, committees, and PhD supervision." />
      <Panel title="Administrative roles">
        <ul className="plain-list">
          {(me.data?.admin || []).map((a: any) => <li key={a.id}>{a.roleName}</li>)}
        </ul>
      </Panel>
      <Panel title="Committees (Agent 56)">
        <ul className="plain-list">
          {(me.data?.committees || []).map((c: any) => (
            <li key={c.id}>{c.committee?.name} · {c.role}</li>
          ))}
        </ul>
      </Panel>
      <Panel title="PhD supervision (Agent 25)">
        <ul className="plain-list">
          {(me.data?.phd || []).map((p: any) => (
            <li key={p.id}>{p.scholarCount} scholar(s) · {p.role}</li>
          ))}
        </ul>
      </Panel>
    </>
  )
}
