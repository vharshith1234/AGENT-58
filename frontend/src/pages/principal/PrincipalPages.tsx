import { useEffect, useState } from 'react'
import {
  ErrorRetry,
  PageHeader,
  Pager,
  Panel,
  Stat,
  TableSkeleton,
  paginate,
  useApiData,
} from '../../components/DashboardShell'
import { BarChart, DonutBreakdown } from '../../components/OverviewCharts'
import { PersonAvatar, StatusPill } from '../../components/PersonAvatar'
import { api, apiBlob, triggerDownload } from '../../lib/api'

export function PrincipalOverview() {
  const dash = useApiData(() => api<any>('/principal/dashboard'))
  const rawRows = dash.data?.allRows || dash.data?.rows || []
  const byDept = new Map<string, any>()
  for (const r of rawRows) {
    const key = r.departmentCode || r.code || r.departmentId
    const cur = byDept.get(key) || {
      departmentCode: r.departmentCode || r.code,
      NORMAL: 0,
      OVERLOAD: 0,
      UNDERLOAD: 0,
    }
    cur.NORMAL += Number(r.normal || r.NORMAL || 0)
    cur.OVERLOAD += Number(r.overload || r.OVERLOAD || 0)
    cur.UNDERLOAD += Number(r.underload || r.UNDERLOAD || 0)
    byDept.set(key, cur)
  }
  const rows = Array.from(byDept.values())
  const totalFaculty =
    Number(dash.data?.real?.totalFaculty || 0) + Number(dash.data?.demo?.totalFaculty || 0) ||
    Number(dash.data?.totalFaculty || 0)
  const totalOver =
    Number(dash.data?.real?.overload || 0) + Number(dash.data?.demo?.overload || 0) ||
    Number(dash.data?.overload || 0)
  const totalUnder =
    Number(dash.data?.real?.underload || 0) + Number(dash.data?.demo?.underload || 0) ||
    Number(dash.data?.underload || 0)
  const totalNormal =
    Number(dash.data?.real?.normal || 0) + Number(dash.data?.demo?.normal || 0) ||
    Number(dash.data?.normal || 0)
  const average =
    totalFaculty > 0
      ? Math.round(
          ((Number(dash.data?.real?.averageWorkload || 0) * Number(dash.data?.real?.totalFaculty || 0) +
            Number(dash.data?.demo?.averageWorkload || 0) * Number(dash.data?.demo?.totalFaculty || 0)) /
            totalFaculty) *
            10,
        ) / 10
      : dash.data?.averageWorkload ?? '—'

  return (
    <>
      <PageHeader
        title="Principal Overview"
        subtitle="Institution-wide workload health."
      />
      <ErrorRetry error={dash.error} onRetry={() => void dash.reload()} />
      {dash.loading && <TableSkeleton />}
      <div className="stat-grid">
        <Stat label="Schools" value={dash.data?.schools ?? '—'} />
        <Stat label="Departments" value={dash.data?.departments ?? '—'} />
        <Stat label="Total Faculty" value={totalFaculty || '—'} />
        <Stat label="Average Workload" value={average} />
        <Stat label="Normal" value={totalNormal} />
        <Stat label="Overloaded" value={totalOver} />
        <Stat label="Underloaded" value={totalUnder} />
        <Stat label="Escalated" value={dash.data?.pendingApprovals ?? '—'} />
      </div>
      <div className="grid-2">
        <DonutBreakdown
          title="Current workload status"
          segments={[
            { label: 'Normal', value: totalNormal, color: '#059669' },
            { label: 'Overload', value: totalOver, color: '#dc2626' },
            { label: 'Underload', value: totalUnder, color: '#2563eb' },
          ]}
        />
        <Panel title="At a glance">
          <ul className="compact-list">
            <li>
              <strong>{rows.length} departments</strong>
              <span>In current institution snapshot</span>
            </li>
            <li>
              <strong>{dash.data?.pendingApprovals ?? 0} escalated</strong>
              <span>Packages awaiting executive attention</span>
            </li>
            <li>
              <strong>Detailed trends</strong>
              <span>Open Analytics for department and role comparisons</span>
            </li>
          </ul>
        </Panel>
      </div>
    </>
  )
}

export function PrincipalInstitutionPage() {
  const hierarchy = useApiData(() => api<any[]>('/principal/hierarchy'))
  return (
    <>
      <PageHeader title="Institution Overview" subtitle="Schools and departments." />
      {(hierarchy.data || []).map((school) => (
        <Panel key={school.id} title={school.name}>
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
        </Panel>
      ))}
    </>
  )
}

export function PrincipalCompliancePage() {
  const compliance = useApiData(() => api<any[]>('/principal/compliance'))
  return (
    <>
      <PageHeader title="Compliance" subtitle="Department compliance snapshot." />
      <Panel title="By department">
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
    </>
  )
}

export function PrincipalApprovalsPage() {
  const approvals = useApiData(() => api<any[]>('/principal/approvals'))

  return (
    <>
      <PageHeader
        title="Package activity"
        subtitle="Executive monitor only — HR / Uttej controls assignments and request decisions."
      />
      <Panel title="Escalated history">
        {(approvals.data || []).length === 0 && (
          <p className="empty-state">No escalated packages.</p>
        )}
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {(approvals.data || []).map((a) => (
            <div key={a.id} className="list-card">
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
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}

export function PrincipalAnalyticsPage() {
  const dash = useApiData(() => api<any>('/principal/dashboard'))
  const history = useApiData(() => api<any[]>('/workload/history'))
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [histPage, setHistPage] = useState(1)

  const rawRows = dash.data?.allRows || dash.data?.rows || []
  const byDept = new Map<string, any>()
  for (const r of rawRows) {
    const key = r.departmentCode || r.code || r.departmentId
    const cur = byDept.get(key) || {
      departmentCode: r.departmentCode || r.code,
      NORMAL: 0,
      OVERLOAD: 0,
      UNDERLOAD: 0,
    }
    cur.NORMAL += Number(r.normal || r.NORMAL || 0)
    cur.OVERLOAD += Number(r.overload || r.OVERLOAD || 0)
    cur.UNDERLOAD += Number(r.underload || r.UNDERLOAD || 0)
    byDept.set(key, cur)
  }
  const deptRows = Array.from(byDept.values()).filter((r) =>
    !query.trim()
      ? true
      : String(r.departmentCode || '')
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
  )
  const pagedDepts = paginate(deptRows, page, 10)
  const histRows = (history.data || []).filter((h: any) =>
    !query.trim()
      ? true
      : `${h.faculty?.name || ''} ${h.period?.code || ''} ${h.status || ''}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
  )
  const pagedHist = paginate(histRows, histPage, 10)

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Department comparison, distribution, and historical workload trends."
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
          items={deptRows.map((r: any) => ({
            label: r.departmentCode || 'Dept',
            value: Number(r.NORMAL || 0) + Number(r.OVERLOAD || 0) + Number(r.UNDERLOAD || 0),
            color: '#1e3a8a',
          }))}
        />
        <BarChart
          title="Overload by department"
          items={deptRows.map((r: any) => ({
            label: r.departmentCode || 'Dept',
            value: Number(r.OVERLOAD || 0),
            color: '#dc2626',
          }))}
        />
      </div>
      <Panel title="Department comparison" action={<span className="meta-chip">{deptRows.length}</span>}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Department</th>
              <th>Normal</th>
              <th>Overload</th>
              <th>Underload</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {pagedDepts.rows.map((r: any) => {
              const total =
                Number(r.NORMAL || 0) + Number(r.OVERLOAD || 0) + Number(r.UNDERLOAD || 0)
              return (
                <tr key={r.departmentCode}>
                  <td>
                    <strong>{r.departmentCode}</strong>
                  </td>
                  <td>{r.NORMAL}</td>
                  <td>{r.OVERLOAD}</td>
                  <td>{r.UNDERLOAD}</td>
                  <td>{total}</td>
                </tr>
              )
            })}
            {pagedDepts.rows.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state">
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

export function PrincipalReportsPage() {
  async function download(path: string, filename: string) {
    const blob = await apiBlob(path)
    triggerDownload(blob, filename)
  }
  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Institution-wide compliance documents."
      />
      <Panel title="Exports">
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void download('/reports/compliance.pdf', 'compliance.pdf')}
          >
            Compliance PDF
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void download('/reports/institution/excel', 'institution-workload.xlsx')}
          >
            Institution Excel
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void download('/reports/institution/csv', 'institution-workload.csv')}
          >
            Institution CSV
          </button>
        </div>
      </Panel>
    </>
  )
}

export function PrincipalDepartmentsPage() {
  return <PrincipalCompliancePage />
}

export function PrincipalFacultyPage() {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(1)
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
    params.set('page', String(page))
    params.set('pageSize', '10')
    return api<any>(`/principal/faculty?${params.toString()}`)
  }, [debounced, page])

  const rows = faculty.data?.items || []
  const pages = Math.max(1, Math.ceil((faculty.data?.total || 0) / 10))

  return (
    <>
      <PageHeader title="Faculty" subtitle="Institution faculty directory." />
      <Panel title="Directory">
        <div className="form-grid" style={{ marginBottom: '0.75rem' }}>
          <input
            className="dash-input"
            placeholder="Search name, department, HOD, Dean, Principal"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
            }}
          />
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Faculty</th>
              <th>Department</th>
              <th>Roles</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f: any) => (
              <tr key={f.id}>
                <td>
                  <div className="person-cell">
                    <PersonAvatar name={f.name} email={f.email} photoUrl={f.photoUrl} />
                    <div className="person-meta">
                      <strong>{f.name}</strong>
                      <span>{f.designation}</span>
                    </div>
                  </div>
                </td>
                <td>{f.department?.name}</td>
                <td>
                  {(f.adminRoles || []).map((r: any) => r.roleName).join(', ') || '—'}
                </td>
                <td><StatusPill status={f.snapshots?.[0]?.status || f.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pager page={page} pages={pages} onPage={setPage} />
      </Panel>
    </>
  )
}

function mergeDeptCounts(
  rows: any[],
  field: 'OVERLOAD' | 'UNDERLOAD',
): { code: string; name: string; count: number }[] {
  const merged = new Map<string, { code: string; name: string; count: number }>()
  for (const r of rows) {
    const n = Number(r[field] || r[field.toLowerCase()] || 0)
    if (n <= 0) continue
    const key = String(r.departmentCode || r.departmentId || '')
    if (!key) continue
    const cur = merged.get(key) || {
      code: r.departmentCode || key,
      name: r.departmentName || r.department || '',
      count: 0,
    }
    cur.count += n
    if (r.departmentName) cur.name = r.departmentName
    merged.set(key, cur)
  }
  return Array.from(merged.values()).sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
}

export function PrincipalOverloadPage() {
  const summary = useApiData(() => api<any>('/principal/dashboard'))
  const rows = mergeDeptCounts(summary.data?.allRows || summary.data?.rows || [], 'OVERLOAD')
  const total = rows.reduce((s, r) => s + r.count, 0)
  return (
    <>
      <PageHeader title="Overload" subtitle="Department overload counts." />
      <ErrorRetry error={summary.error} onRetry={() => void summary.reload()} />
      {summary.loading && <TableSkeleton />}
      {!summary.loading && (
        <>
          <div className="stat-grid principal-metric-stats">
            <Stat label="Departments flagged" value={rows.length} />
            <Stat label="Overloaded faculty" value={total} />
          </div>
          {rows.length === 0 ? (
            <Panel title="Overloaded departments">
              <p className="empty-state">No overloaded departments.</p>
            </Panel>
          ) : (
            <div className="metric-card-grid">
              {rows.map((r, i) => (
                <article
                  key={r.code}
                  className="metric-card metric-card-over"
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                >
                  <div className="metric-card-top">
                    <span className="metric-card-code">{r.code}</span>
                    <span className="metric-card-badge">Overload</span>
                  </div>
                  <p className="metric-card-name">{r.name || r.code}</p>
                  <div className="metric-card-count">
                    <strong>{r.count}</strong>
                    <span>faculty overloaded</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}

export function PrincipalUnderloadPage() {
  const summary = useApiData(() => api<any>('/principal/dashboard'))
  const rows = mergeDeptCounts(summary.data?.allRows || summary.data?.rows || [], 'UNDERLOAD')
  const total = rows.reduce((s, r) => s + r.count, 0)
  return (
    <>
      <PageHeader title="Underload" subtitle="Department underload counts." />
      <ErrorRetry error={summary.error} onRetry={() => void summary.reload()} />
      {summary.loading && <TableSkeleton />}
      {!summary.loading && (
        <>
          <div className="stat-grid principal-metric-stats">
            <Stat label="Departments flagged" value={rows.length} />
            <Stat label="Underloaded faculty" value={total} />
          </div>
          {rows.length === 0 ? (
            <Panel title="Underloaded departments">
              <p className="empty-state">No underloaded departments.</p>
            </Panel>
          ) : (
            <div className="metric-card-grid">
              {rows.map((r, i) => (
                <article
                  key={r.code}
                  className="metric-card metric-card-under"
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                >
                  <div className="metric-card-top">
                    <span className="metric-card-code">{r.code}</span>
                    <span className="metric-card-badge">Underload</span>
                  </div>
                  <p className="metric-card-name">{r.name || r.code}</p>
                  <div className="metric-card-count">
                    <strong>{r.count}</strong>
                    <span>faculty underloaded</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}

export function PrincipalTrendsPage() {
  const history = useApiData(() => api<any[]>('/workload/history'))
  const rows = (history.data || []).slice(0, 40)
  return (
    <>
      <PageHeader title="Trends" subtitle="Workload history across periods." />
      <ErrorRetry error={history.error} onRetry={() => void history.reload()} />
      {history.loading && <TableSkeleton />}
      <Panel title="Snapshots">
        {!history.loading && rows.length === 0 && (
          <p className="empty-state">No workload snapshots yet.</p>
        )}
        {rows.length > 0 && (
          <div className="table-scroll">
            <table className="data-table principal-trends-table">
              <thead>
                <tr>
                  <th>Faculty</th>
                  <th>Period</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <strong>{h.faculty?.name || '—'}</strong>
                    </td>
                    <td>
                      <span className="period-chip">{h.period?.code || '—'}</span>
                    </td>
                    <td className="num-cell">{h.total ?? '—'}</td>
                    <td>
                      <StatusPill status={h.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}
