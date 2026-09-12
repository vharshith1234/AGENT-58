import { useState } from 'react'
import { DashboardShell, Panel, Stat, sectionId, useApiData } from '../components/DashboardShell'
import { PersonAvatar, StatusPill } from '../components/PersonAvatar'
import { api, apiBlob } from '../lib/api'

export function PrincipalDashboard() {
  const hierarchy = useApiData(() => api<any[]>('/principal/hierarchy'))
  const compliance = useApiData(() => api<any[]>('/principal/compliance'))
  const approvals = useApiData(() => api<any[]>('/principal/approvals'))
  const [message, setMessage] = useState<string | null>(null)

  async function approve(id: string) {
    await api(`/principal/approvals/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ comment: 'Principal approved' }),
    })
    setMessage('Approved.')
    await approvals.reload()
  }

  async function finalize(id: string) {
    await api(`/principal/approvals/${id}/finalize`, {
      method: 'POST',
      body: JSON.stringify({ comment: 'Finalized' }),
    })
    setMessage('Finalized.')
    await approvals.reload()
  }

  async function downloadCompliance() {
    const blob = await apiBlob('/reports/compliance.pdf')
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'compliance.pdf'
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalOver = (compliance.data || []).reduce(
    (s, r) => s + (r.overload || 0),
    0,
  )

  return (
    <DashboardShell role="PRINCIPAL">
      {message && <div className="alert-banner">{message}</div>}

      <div className="stat-grid" id={sectionId('Analytics')}>
        <Stat label="Schools" value={hierarchy.data?.length ?? '—'} />
        <Stat label="Departments" value={compliance.data?.length ?? '—'} />
        <Stat label="Overload Flags" value={totalOver} />
        <Stat label="Escalated" value={approvals.data?.length ?? '—'} />
      </div>

      <Panel
        title="Institution hierarchy & compliance"
        id={sectionId('Institution Overview')}
        action={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void downloadCompliance()}
          >
            Compliance PDF
          </button>
        }
      >
        {(hierarchy.data || []).map((school) => (
          <div key={school.id} style={{ marginBottom: '1.25rem' }}>
            <h3
              className="font-display"
              style={{ margin: '0 0 0.65rem', fontSize: '1rem', color: '#0b1c2c' }}
            >
              {school.name}
            </h3>
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
                {(school.departments || []).map((d: any) => (
                  <tr key={d.id}>
                    <td>
                      <strong>
                        {d.code} — {d.name}
                      </strong>
                    </td>
                    <td>{d.compliance?.normal}</td>
                    <td>{d.compliance?.overload}</td>
                    <td>{d.compliance?.underload}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </Panel>

      <Panel title="Compliance" id={sectionId('Compliance')}>
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
            {(compliance.data || []).map((r: any) => (
              <tr key={r.departmentId || r.departmentCode}>
                <td>
                  <strong>{r.departmentCode || r.code}</strong>
                </td>
                <td>{r.normal ?? r.NORMAL}</td>
                <td>{r.overload ?? r.OVERLOAD}</td>
                <td>{r.underload ?? r.UNDERLOAD}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Escalated approvals" id={sectionId('Approvals')}>
        {(approvals.data || []).length === 0 && (
          <p className="empty-state">No escalated packages.</p>
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
                  name={a.submittedBy?.name || 'Submitter'}
                  email={a.submittedBy?.email}
                />
                <div className="person-meta">
                  <strong>
                    {a.period?.code} · <StatusPill status={a.status} />
                  </strong>
                  <span>Dept {a.departmentId}</span>
                </div>
              </div>
              {a.status === 'PENDING' && (
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={() => void approve(a.id)}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void finalize(a.id)}
                  >
                    Finalize
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Reports"
        id={sectionId('Reports')}
        action={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void downloadCompliance()}
          >
            Download PDF
          </button>
        }
      >
        <p className="empty-state">Institution-wide compliance report.</p>
      </Panel>
    </DashboardShell>
  )
}
