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
import { PersonAvatar, StatusPill } from '../../components/PersonAvatar'
import { api, apiBlob, triggerDownload } from '../../lib/api'

export function DeanOverview() {
  const dash = useApiData(() => api<any>('/dean/dashboard'))
  const comparisons = dash.data?.comparisons || []
  const overload = Number(
    dash.data?.overload ?? comparisons.reduce((s: number, c: any) => s + Number(c.overload || 0), 0),
  )
  const underload = Number(
    dash.data?.underload ?? comparisons.reduce((s: number, c: any) => s + Number(c.underload || 0), 0),
  )
  const normal = Number(
    dash.data?.normal ?? comparisons.reduce((s: number, c: any) => s + Number(c.normal || 0), 0),
  )
  const totalFaculty = Number(
    dash.data?.totalFaculty ??
      comparisons.reduce(
        (s: number, c: any) =>
          s + Number(c.facultyCount || (c.normal || 0) + (c.overload || 0) + (c.underload || 0)),
        0,
      ),
  )
  const average =
    dash.data?.averageWorkload != null && dash.data.averageWorkload !== ''
      ? Number(dash.data.averageWorkload)
      : '—'
  const deptCount = Number(dash.data?.departmentCount ?? comparisons.length) || '—'
  const compliance =
    dash.data?.compliancePct != null ? Number(dash.data.compliancePct) : '—'

  return (
    <>
      <PageHeader
        title="Dean Overview"
        subtitle="Institution-wide workload comparison across all departments."
      />
      <ErrorRetry error={dash.error} onRetry={() => void dash.reload()} />
      {dash.loading && <TableSkeleton />}
      <div className="stat-grid">
        <Stat label="Departments" value={deptCount} />
        <Stat label="Total Faculty" value={totalFaculty || '—'} />
        <Stat label="Average Workload" value={average} />
        <Stat label="Normal" value={normal} />
        <Stat label="Pending Approvals" value={dash.data?.pending?.length ?? '—'} />
        <Stat label="Overload Flags" value={overload} />
        <Stat label="Underload Flags" value={underload} />
        <Stat label="Compliance" value={compliance} />
      </div>
      <div className="grid-2">
        <BarChart
          title="Department faculty counts"
          items={comparisons.map((c: any) => ({
            label: c.department.code,
            value:
              Number(c.facultyCount || 0) ||
              Number(c.normal || 0) + Number(c.overload || 0) + Number(c.underload || 0),
            color: '#1e3a8a',
          }))}
        />
        <DonutBreakdown
          title="Institution load mix"
          segments={[
            { label: 'Normal', value: normal, color: '#059669' },
            { label: 'Overload', value: overload, color: '#dc2626' },
            { label: 'Underload', value: underload, color: '#2563eb' },
          ]}
        />
      </div>
    </>
  )
}

export function DeanDepartmentsPage() {
  const depts = useApiData(() => api<any[]>('/dean/departments'))
  const rows = depts.data || []

  return (
    <>
      <PageHeader
        title="Departments"
        subtitle="All departments across the institution."
      />
      <ErrorRetry error={depts.error} onRetry={() => void depts.reload()} />
      {depts.loading && <TableSkeleton />}
      {!depts.loading && rows.length === 0 && (
        <Panel title="Departments">
          <p className="empty-state">No departments found.</p>
        </Panel>
      )}
      <div className="dept-card-grid">
        {rows.map((c: any) => {
          const faculty =
            Number(c.facultyCount || 0) ||
            Number(c.normal || 0) + Number(c.overload || 0) + Number(c.underload || 0)
          return (
            <article key={c.department.id} className="dept-card">
              <div className="dept-card-top">
                <span className="dept-card-code">{c.department.code}</span>
                <span className="dept-card-faculty">{faculty} faculty</span>
              </div>
              <h3 className="dept-card-name">{c.department.name}</h3>
              {c.department.school?.name ? (
                <p className="dept-card-school">{c.department.school.name}</p>
              ) : null}
              <div className="dept-card-stats">
                <div className="dept-pill dept-pill-normal">
                  <span className="dept-pill-value">{c.normal}</span>
                  <span className="dept-pill-label">Normal</span>
                </div>
                <div className="dept-pill dept-pill-over">
                  <span className="dept-pill-value">{c.overload}</span>
                  <span className="dept-pill-label">Over</span>
                </div>
                <div className="dept-pill dept-pill-under">
                  <span className="dept-pill-value">{c.underload}</span>
                  <span className="dept-pill-label">Under</span>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}

export function DeanComparisonPage() {
  const dash = useApiData(() => api<any>('/dean/dashboard'))
  return (
    <>
      <PageHeader title="Comparison" subtitle="Normal / overload / underload by department." />
      <Panel title="Department comparison">
        <table className="data-table">
          <thead>
            <tr>
              <th>Department</th>
              <th>Normal</th>
              <th>Over</th>
              <th>Under</th>
            </tr>
          </thead>
          <tbody>
            {(dash.data?.comparisons || []).map((c: any) => (
              <tr key={c.department.id}>
                <td>
                  <strong>
                    {c.department.code} — {c.department.name}
                  </strong>
                </td>
                <td>{c.normal}</td>
                <td>{c.overload}</td>
                <td>{c.underload}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  )
}

export function DeanApprovalsPage() {
  const approvals = useApiData(() => api<any[]>('/dean/approvals'))
  const [message, setMessage] = useState<string | null>(null)

  async function act(id: string, action: 'approve' | 'send-back' | 'escalate') {
    const path =
      action === 'approve'
        ? `/dean/approvals/${id}/approve`
        : action === 'send-back'
          ? `/dean/approvals/${id}/send-back`
          : `/dean/approvals/${id}/escalate`
    await api(path, {
      method: 'POST',
      body: JSON.stringify({
        comment:
          action === 'send-back'
            ? 'Please revise allocations and resubmit.'
            : `Dean ${action}`,
      }),
    })
    setMessage(`Action ${action} completed.`)
    await approvals.reload()
  }

  return (
    <>
      <PageHeader title="Approvals" subtitle="Review HOD workload packages." />
      {message && <div className="alert-banner">{message}</div>}
      <Panel title="Approval queue">
        {(approvals.data || []).length === 0 && (
          <p className="empty-state">No approval packages yet.</p>
        )}
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {(approvals.data || []).map((a) => (
            <div key={a.id} className="list-card">
              <div className="person-cell">
                <PersonAvatar
                  name={a.submittedBy?.name || 'HOD'}
                  email={a.submittedBy?.email}
                />
                <div className="person-meta">
                  <strong>
                    {a.period?.code} · <StatusPill status={a.status} /> · {a.level}
                  </strong>
                  <span>Submitted by {a.submittedBy?.name}</span>
                </div>
              </div>
              {(a.status === 'PENDING' || a.status === 'HOD_SUBMITTED' || a.status === 'DEAN_REVIEW') && a.level === 'DEAN' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={() => void act(a.id, 'approve')}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn btn-warn"
                    onClick={() => void act(a.id, 'send-back')}
                  >
                    Send back
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void act(a.id, 'escalate')}
                  >
                    Escalate
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

export function DeanOverloadPage() {
  const dash = useApiData(() => api<any>('/dean/dashboard'))
  const rows = (dash.data?.comparisons || []).flatMap((c: any) =>
    (c.faculty || [])
      .filter((f: any) => f.status === 'OVERLOAD')
      .map((f: any) => ({ ...f, department: c.department })),
  )
  return (
    <>
      <PageHeader title="Overload" subtitle="Faculty above the maximum norm." />
      <Panel title="Overloaded faculty">
        <table className="data-table">
          <thead>
            <tr>
              <th>Faculty</th>
              <th>Department</th>
              <th>Total</th>
              <th>Maximum</th>
              <th>Excess</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f: any) => (
              <tr key={f.facultyId}>
                <td>{f.name}</td>
                <td>{f.department?.code}</td>
                <td>{f.total?.toFixed?.(2)}</td>
                <td>{f.normMax}</td>
                <td>{(f.total - f.normMax).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  )
}

export function DeanReportsPage() {
  async function download(path: string, filename: string) {
    const blob = await apiBlob(path)
    triggerDownload(blob, filename)
  }
  return (
    <>
      <PageHeader title="Reports" subtitle="School-level workload, comparison, overload, underload, and approvals." />
      <Panel title="Exports">
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={() => void download('/reports/institution/csv', 'institution-workload.csv')}>
            Institution CSV
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void download('/reports/institution/excel', 'institution-workload.xlsx')}>
            Institution Excel
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void download('/reports/compliance.pdf', 'compliance.pdf')}>
            Compliance PDF
          </button>
        </div>
      </Panel>
    </>
  )
}

function flattenFaculty(dash: any, status: string) {
  return (dash?.comparisons || []).flatMap((c: any) =>
    (c.faculty || [])
      .filter((f: any) => f.status === status)
      .map((f: any) => ({ ...f, department: c.department })),
  )
}

export function DeanAnalysisPage() {
  return <DeanComparisonPage />
}

export function DeanUnderloadPage() {
  const dash = useApiData(() => api<any>('/dean/dashboard'))
  const rows = flattenFaculty(dash.data, 'UNDERLOAD')
  return (
    <>
      <PageHeader title="Underload" subtitle="Faculty below the minimum norm." />
      <Panel title="Underloaded faculty">
        <table className="data-table">
          <thead>
            <tr>
              <th>Faculty</th>
              <th>Department</th>
              <th>Total</th>
              <th>Minimum</th>
              <th>Capacity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f: any) => (
              <tr key={f.facultyId}>
                <td>{f.name}</td>
                <td>{f.department?.code}</td>
                <td>{f.total?.toFixed?.(2)}</td>
                <td>{f.normMin}</td>
                <td>{(f.normMax - f.total).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  )
}

export function DeanTrendsPage() {
  const history = useApiData(() => api<any[]>('/workload/history'))
  return (
    <>
      <PageHeader title="Trends" subtitle="Historical snapshots." />
      <Panel title="Recent calculations">
        <ul className="plain-list">
          {(history.data || []).slice(0, 30).map((h) => (
            <li key={h.id}>
              {h.faculty?.name} · {h.period?.code} · {h.total} · {h.status}
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}
