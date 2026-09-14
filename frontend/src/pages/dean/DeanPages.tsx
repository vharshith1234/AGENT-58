import { useState } from 'react'
import { Link } from 'react-router-dom'
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
        subtitle="Current institution workload summary."
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
        <DonutBreakdown
          title="Current load mix"
          segments={[
            { label: 'Normal', value: normal, color: '#059669' },
            { label: 'Overload', value: overload, color: '#dc2626' },
            { label: 'Underload', value: underload, color: '#2563eb' },
          ]}
        />
        <Panel
          title="Recent Requests"
          action={
            <Link className="btn btn-primary btn-sm" to="/dean/requests">
              Open Requests
            </Link>
          }
        >
          {(dash.data?.pending || []).length === 0 ? (
            <p className="empty-state">No pending approval requests.</p>
          ) : (
            <div className="request-card-list">
              {(dash.data?.pending || []).slice(0, 6).map((r: any) => (
                <article key={r.id} className="request-card">
                  <div className="request-card-top">
                    <strong>{r.level || 'Approval'} request</strong>
                    <StatusPill status={r.status || 'PENDING'} />
                  </div>
                  <div className="request-card-meta">
                    <span>
                      <i className="fa-solid fa-user" aria-hidden />{' '}
                      {r.submittedBy?.name || 'Department'}
                    </span>
                    <span>
                      <i className="fa-regular fa-calendar" aria-hidden />{' '}
                      {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}
                    </span>
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

  return (
    <>
      <PageHeader
        title="Package activity"
        subtitle="Monitor only — HR / Uttej controls assignments and request decisions."
      />
      <Panel title="Approval history">
        {(approvals.data || []).length === 0 && (
          <p className="empty-state">No packages yet.</p>
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
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}

export function DeanOverloadPage() {
  const dash = useApiData(() => api<any>('/dean/dashboard'))
  const [page, setPage] = useState(1)
  const rows = (dash.data?.comparisons || []).flatMap((c: any) =>
    (c.faculty || [])
      .filter((f: any) => f.status === 'OVERLOAD')
      .map((f: any) => ({ ...f, department: c.department })),
  )
  const paged = paginate(rows, page, 10)
  return (
    <>
      <PageHeader title="Overload" subtitle="Faculty above the maximum norm." />
      <Panel title="Overloaded faculty" action={<span className="meta-chip">{rows.length}</span>}>
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
            {paged.rows.map((f: any) => (
              <tr key={f.facultyId}>
                <td>{f.name}</td>
                <td>{f.department?.code}</td>
                <td>{f.total?.toFixed?.(2)}</td>
                <td>{f.normMax}</td>
                <td>{(f.total - f.normMax).toFixed(1)}</td>
              </tr>
            ))}
            {paged.rows.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state">
                  No overloaded faculty.
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
  const dash = useApiData(() => api<any>('/dean/dashboard'))
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('ALL')
  const [page, setPage] = useState(1)
  const allFaculty = (dash.data?.comparisons || []).flatMap((c: any) =>
    (c.faculty || []).map((f: any) => ({
      ...f,
      department: c.department,
      departmentCode: c.department?.code,
    })),
  )
  const filtered = filterByQuery(
    allFaculty.filter((f: any) => (status === 'ALL' ? true : f.status === status)),
    query,
    (f: any) =>
      `${f.name || ''} ${f.departmentCode || ''} ${f.designation || ''} ${f.status || ''}`,
  )
  const paged = paginate(filtered, page, 10)

  return (
    <>
      <PageHeader
        title="Faculty Workload"
        subtitle="Cross-department faculty load status with filters."
      />
      <Panel title="Filters">
        <div className="form-grid">
          <input
            className="dash-input"
            placeholder="Search faculty or department"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
          />
          <select
            className="dash-input"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
          >
            <option value="ALL">All statuses</option>
            <option value="NORMAL">Normal</option>
            <option value="OVERLOAD">Overload</option>
            <option value="UNDERLOAD">Underload</option>
          </select>
        </div>
      </Panel>
      <Panel title="Faculty detail" action={<span className="meta-chip">{filtered.length}</span>}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Faculty</th>
              <th>Department</th>
              <th>Total</th>
              <th>Norm</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {paged.rows.map((f: any) => (
              <tr key={`${f.facultyId}-${f.departmentCode}`}>
                <td>{f.name}</td>
                <td>{f.departmentCode || '—'}</td>
                <td>{Number(f.total || 0).toFixed(1)}</td>
                <td>
                  {f.normMin ?? '—'}–{f.normMax ?? '—'}
                </td>
                <td>
                  <StatusPill status={f.status} />
                </td>
              </tr>
            ))}
            {paged.rows.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state">
                  No faculty match these filters.
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

export function DeanUnderloadPage() {
  const dash = useApiData(() => api<any>('/dean/dashboard'))
  const [page, setPage] = useState(1)
  const rows = flattenFaculty(dash.data, 'UNDERLOAD')
  const paged = paginate(rows, page, 10)
  return (
    <>
      <PageHeader title="Underload" subtitle="Faculty below the minimum norm." />
      <Panel title="Underloaded faculty" action={<span className="meta-chip">{rows.length}</span>}>
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
            {paged.rows.map((f: any) => (
              <tr key={f.facultyId}>
                <td>{f.name}</td>
                <td>{f.department?.code}</td>
                <td>{f.total?.toFixed?.(2)}</td>
                <td>{f.normMin}</td>
                <td>{(f.normMax - f.total).toFixed(1)}</td>
              </tr>
            ))}
            {paged.rows.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state">
                  No underloaded faculty.
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

export function DeanTrendsPage() {
  const dash = useApiData(() => api<any>('/dean/dashboard'))
  const history = useApiData(() => api<any[]>('/workload/history'))
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [histPage, setHistPage] = useState(1)
  const comparisons = dash.data?.comparisons || []
  const filteredDepts = filterByQuery(
    comparisons,
    query,
    (c: any) => `${c.department?.code || ''} ${c.department?.name || ''}`,
  )
  const pagedDepts = paginate(filteredDepts, page, 10)
  const histRows = filterByQuery(
    history.data || [],
    query,
    (h: any) => `${h.faculty?.name || ''} ${h.period?.code || ''} ${h.status || ''}`,
  )
  const pagedHist = paginate(histRows, histPage, 10)

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Department comparison, distribution trends, and historical snapshots."
      />
      <Panel title="Filters">
        <input
          className="dash-input"
          placeholder="Filter department / faculty / period"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setPage(1)
            setHistPage(1)
          }}
        />
      </Panel>
      <div className="grid-2">
        <BarChart
          title="Faculty by department"
          items={filteredDepts.map((c: any) => ({
            label: c.department?.code || 'Dept',
            value:
              Number(c.facultyCount || 0) ||
              Number(c.normal || 0) + Number(c.overload || 0) + Number(c.underload || 0),
            color: '#1e3a8a',
          }))}
        />
        <BarChart
          title="Overload by department"
          items={filteredDepts.map((c: any) => ({
            label: c.department?.code || 'Dept',
            value: Number(c.overload || 0),
            color: '#dc2626',
          }))}
        />
      </div>
      <Panel title="Department comparison" action={<span className="meta-chip">{filteredDepts.length}</span>}>
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
            {pagedDepts.rows.map((c: any) => (
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
            {pagedDepts.rows.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-state">
                  No departments match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pager
          page={pagedDepts.page}
          pages={pagedDepts.pages}
          total={pagedDepts.total}
          onPage={setPage}
        />
      </Panel>
      <Panel title="Historical snapshots" action={<span className="meta-chip">{histRows.length}</span>}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Faculty</th>
              <th>Period</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {pagedHist.rows.map((h: any) => (
              <tr key={h.id}>
                <td>{h.faculty?.name || '—'}</td>
                <td>{h.period?.code || '—'}</td>
                <td>{h.total ?? '—'}</td>
                <td>
                  <StatusPill status={h.status} />
                </td>
              </tr>
            ))}
            {pagedHist.rows.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-state">
                  No history rows for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pager
          page={pagedHist.page}
          pages={pagedHist.pages}
          total={pagedHist.total}
          onPage={setHistPage}
        />
      </Panel>
    </>
  )
}
