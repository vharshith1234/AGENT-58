import { useState } from 'react'
import {
  PageHeader,
  Panel,
  useApiData,
} from '../../components/DashboardShell'
import { StatusPill } from '../../components/PersonAvatar'
import { api, apiBlob } from '../../lib/api'
import { ActivityPortfolio } from '../../components/ActivityPortfolio'
import {
  PersonalMyCoursesPage,
  PersonalMyWorkloadPage,
  PersonalTeachingDashboard,
  PersonalTimetablePage,
} from '../shared/PersonalTeachingPages'

export function FacultyOverview() {
  return (
    <PersonalTeachingDashboard
      title="Dashboard"
      subtitle="Your teaching workload, courses, classes, and timetable."
    />
  )
}

export function FacultyCoursesPage() {
  return <PersonalMyCoursesPage />
}

export function FacultyTimetablePage() {
  return <PersonalTimetablePage />
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
  return <PersonalMyWorkloadPage />
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
        title="History"
        subtitle={
          faculty
            ? `${faculty.name} · ${faculty.facultyCode}`
            : 'Verify and download your workload statement history.'
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
          {(me.data?.admin || []).map((a: any) => (
            <li key={a.id}>{a.roleName}</li>
          ))}
        </ul>
      </Panel>
      <Panel title="Committees (Agent 56)">
        <ul className="plain-list">
          {(me.data?.committees || []).map((c: any) => (
            <li key={c.id}>
              {c.committee?.name} · {c.role}
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="PhD supervision (Agent 25)">
        <ul className="plain-list">
          {(me.data?.phd || []).map((p: any) => (
            <li key={p.id}>
              {p.scholarCount} scholar(s) · {p.role}
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}
