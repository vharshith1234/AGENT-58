import { DashboardShell, Panel, Stat, sectionId, useApiData } from '../components/DashboardShell'
import { PersonAvatar, StatusPill } from '../components/PersonAvatar'
import { api, apiBlob } from '../lib/api'

export function HrDashboard() {
  const dash = useApiData(() => api<any>('/hr/dashboard'))
  const faculty = useApiData(() => api<any>('/hr/faculty?page=1&pageSize=50'))
  const norms = useApiData(() => api<any[]>('/hr/norms'))
  const policies = useApiData(() => api<any[]>('/hr/policies'))
  const corrections = useApiData(() => api<any[]>('/hr/corrections'))
  const compliance = useApiData(() => api<any[]>('/hr/compliance'))
  const facultyItems = Array.isArray(faculty.data)
    ? faculty.data
    : faculty.data?.items || []

  async function downloadCompliance() {
    const blob = await apiBlob('/reports/compliance.pdf')
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'compliance.pdf'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function review(id: string, status: 'APPROVED' | 'REJECTED') {
    await api(`/hr/corrections/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ status, note: `Marked ${status} by HR` }),
    })
    await corrections.reload()
  }

  return (
    <DashboardShell role="HR">
      <div className="stat-grid">
        <Stat label="Total Faculty" value={dash.data?.facultyCount ?? '—'} />
        <Stat label="Departments" value={dash.data?.deptCount ?? '—'} />
        <Stat label="Pending Requests" value={dash.data?.pendingCorrections ?? '—'} />
        <Stat label="Active Period" value={dash.data?.activePeriod?.code ?? '—'} />
      </div>

      <Panel
        title="Faculty directory"
        id={sectionId('Faculty Management')}
        action={
          <button type="button" className="btn btn-secondary" onClick={() => void faculty.reload()}>
            Refresh
          </button>
        }
      >
        {faculty.loading && <p className="empty-state">Loading faculty…</p>}
        {faculty.error && <p className="empty-state" style={{ color: '#b91c1c' }}>{faculty.error}</p>}
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Faculty</th>
                <th>ID</th>
                <th>Designation</th>
                <th>Department</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {facultyItems.map((f: any) => (
                <tr key={f.id}>
                  <td>
                    <div className="person-cell">
                      <PersonAvatar name={f.name} email={f.email} photoUrl={f.photoUrl} />
                      <div className="person-meta">
                        <strong>{f.name}</strong>
                        <span>{f.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>{f.facultyCode}</td>
                  <td>{f.designation}</td>
                  <td>{f.department?.code || '—'}</td>
                  <td>
                    <StatusPill status={f.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid-2">
        <Panel
          title="Compliance by department"
          id={sectionId('Compliance')}
          action={
            <button type="button" className="btn btn-primary" onClick={() => void downloadCompliance()}>
              Download PDF
            </button>
          }
        >
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
              {(compliance.data || []).length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-state">
                    No compliance data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Panel>

        <Panel title="Policies & norms" id={sectionId('Workload Policies')}>
          <p className="empty-state" style={{ marginBottom: '0.75rem' }}>
            Active workload norms
          </p>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.875rem' }}>
            {(norms.data || []).map((n) => (
              <li key={n.id} style={{ marginBottom: '0.35rem' }}>
                <strong>{n.department?.code || 'GLOBAL'}</strong>: {n.min}–{n.max} (expected{' '}
                {n.expected})
              </li>
            ))}
          </ul>
          <p className="empty-state" style={{ margin: '1rem 0 0.5rem' }}>
            Weightings
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {(policies.data || []).map((p) => (
              <span
                key={p.id}
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  background: '#eef2f6',
                  border: '1px solid #d5dee8',
                  borderRadius: '999px',
                  padding: '0.25rem 0.55rem',
                }}
              >
                {p.activityType} · {p.weight}
              </span>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Correction requests" id={sectionId('Correction Requests')}>
        {(corrections.data || []).length === 0 && (
          <p className="empty-state">No correction requests.</p>
        )}
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {(corrections.data || []).map((c) => (
            <div
              key={c.id}
              style={{
                border: '1px solid #d5dee8',
                borderRadius: '0.85rem',
                padding: '0.85rem 1rem',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                gap: '0.75rem',
              }}
            >
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

      <Panel
        title="Reports"
        id={sectionId('Reports')}
        action={
          <button type="button" className="btn btn-primary" onClick={() => void downloadCompliance()}>
            Compliance PDF
          </button>
        }
      >
        <p className="empty-state">Download institutional compliance reports.</p>
      </Panel>

      <Panel title="Departments" id={sectionId('Departments')}>
        <p className="empty-state">
          Department structure is managed with faculty records above. Use Faculty Management to review
          CSE staff by department code.
        </p>
      </Panel>
    </DashboardShell>
  )
}
