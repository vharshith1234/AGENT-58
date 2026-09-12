import { useState } from 'react'
import { DashboardShell, Panel, Stat, sectionId, useApiData } from '../components/DashboardShell'
import { PersonAvatar, StatusPill } from '../components/PersonAvatar'
import { api } from '../lib/api'

export function DeanDashboard() {
  const dash = useApiData(() => api<any>('/dean/dashboard'))
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
    await Promise.all([dash.reload(), approvals.reload()])
  }

  return (
    <DashboardShell role="DEAN">
      {message && <div className="alert-banner">{message}</div>}

      <div className="stat-grid" id={sectionId('Overload')}>
        <Stat label="Departments" value={dash.data?.comparisons?.length ?? '—'} />
        <Stat label="Pending Approvals" value={dash.data?.pending?.length ?? '—'} />
        <Stat
          label="Overload Flags"
          value={
            (dash.data?.comparisons || []).reduce(
              (s: number, c: any) => s + c.overload,
              0,
            ) || 0
          }
        />
        <Stat
          label="Underload Flags"
          value={
            (dash.data?.comparisons || []).reduce(
              (s: number, c: any) => s + c.underload,
              0,
            ) || 0
          }
        />
      </div>

      <Panel title="Department comparison" id={sectionId('Comparison')}>
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

      <Panel title="Departments" id={sectionId('Departments')}>
        <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.875rem' }}>
          {(dash.data?.comparisons || []).map((c: any) => (
            <li key={c.department.id} style={{ marginBottom: '0.35rem' }}>
              <strong>{c.department.code}</strong> — {c.department.name}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Approval queue" id={sectionId('Approvals')}>
        {(approvals.data || []).length === 0 && (
          <p className="empty-state">No approval packages yet.</p>
        )}
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {(approvals.data || []).map((a) => (
            <div
              key={a.id}
              style={{
                border: '1px solid #d5dee8',
                borderRadius: '0.9rem',
                padding: '0.9rem 1rem',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                gap: '0.75rem',
              }}
            >
              <div className="person-cell">
                <PersonAvatar
                  name={a.submittedBy?.name || 'HOD'}
                  email={a.submittedBy?.email}
                />
                <div className="person-meta">
                  <strong>
                    {a.period?.code} · <StatusPill status={a.status} /> · {a.level}
                  </strong>
                  <span>
                    Submitted by {a.submittedBy?.name} · dept {a.departmentId}
                  </span>
                </div>
              </div>
              {a.status === 'PENDING' && a.level === 'DEAN' && (
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

      <Panel title="Reports" id={sectionId('Reports')}>
        <p className="empty-state">
          Use department comparison and approvals above for school-level reporting.
        </p>
      </Panel>
    </DashboardShell>
  )
}
