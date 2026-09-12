import { useState } from 'react'
import {
  ErrorRetry,
  PageHeader,
  Stat,
  TableSkeleton,
  useApiData,
} from './DashboardShell'
import { DonutBreakdown, TrendChart } from './OverviewCharts'
import { StatusPill } from './PersonAvatar'
import { api } from '../lib/api'

export type ActivityCard = {
  id: string
  title: string
  role: string
  status: string
  duration: string
  department: string
  collaborators: string[]
  progress: number
  level?: string
  funding?: string | null
  commitmentPct?: number
  studentCount?: number
  dataSource: 'REAL' | 'DEMO'
  workloadBearing: boolean
}

export type ActivityPortfolioData = {
  kind: 'projects' | 'research'
  source: 'REAL' | 'DEMO'
  workloadBearingCount: number
  countedWorkloadHours: number
  items: ActivityCard[]
  kpis: { total: number; active: number; completed: number; avgProgress: number }
  statusDistribution: { label: string; value: number; color: string }[]
  trend: { label: string; value: number }[]
  notice: string | null
}

const FILTERS = ['ALL', 'ACTIVE', 'COMPLETED'] as const

function matchesFilter(item: ActivityCard, filter: (typeof FILTERS)[number]) {
  const status = item.status.toUpperCase()
  if (filter === 'ALL') return true
  if (filter === 'COMPLETED') return status === 'COMPLETED'
  return !['COMPLETED', 'ON_HOLD'].includes(status)
}

function CardSkeleton() {
  return (
    <div className="activity-card is-loading" aria-hidden>
      <div className="skeleton-cell" style={{ width: '40%', height: 12 }} />
      <div className="skeleton-cell" style={{ width: '80%', height: 18, marginTop: 12 }} />
      <div className="skeleton-cell" style={{ width: '60%', height: 12, marginTop: 10 }} />
      <div className="skeleton-cell" style={{ width: '100%', height: 8, marginTop: 18 }} />
    </div>
  )
}

export function ActivityPortfolio({
  kind,
  title,
  subtitle,
}: {
  kind: 'projects' | 'research'
  title: string
  subtitle: string
}) {
  const path = kind === 'projects' ? '/faculty/me/projects' : '/faculty/me/research'
  const data = useApiData(() => api<ActivityPortfolioData>(path))
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL')
  const portfolio = data.data
  const items = (portfolio?.items || []).filter((item) => matchesFilter(item, filter))
  const isProjects = kind === 'projects'

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
      />
      <ErrorRetry error={data.error} onRetry={() => void data.reload()} />

      {data.loading && !portfolio ? (
        <>
          <TableSkeleton rows={2} cols={4} />
          <div className="activity-card-grid">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </>
      ) : null}

      {portfolio ? (
        <>
          <div className="stat-grid">
            <Stat label={isProjects ? 'Projects' : 'Commitments'} value={portfolio.kpis.total} />
            <Stat label="Active" value={portfolio.kpis.active} />
            <Stat label="Completed" value={portfolio.kpis.completed} />
            <Stat
              label="Counted in workload"
              value={portfolio.countedWorkloadHours.toFixed(2)}
            />
          </div>

          <div className="grid-2 activity-analytics">
            <DonutBreakdown
              title={isProjects ? 'Project status' : 'Research status'}
              segments={
                portfolio.statusDistribution.length
                  ? portfolio.statusDistribution
                  : [{ label: 'None', value: 1, color: '#e2e8f0' }]
              }
            />
            <TrendChart
              title={isProjects ? 'Project activity trend' : 'Research activity trend'}
              points={portfolio.trend}
            />
          </div>

          <section className="panel">
            <div className="panel-head">
              <h2>{isProjects ? 'Project portfolio' : 'Research portfolio'}</h2>
              <div className="chip-row" role="tablist" aria-label="Status filter">
                {FILTERS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={`filter-chip${filter === id ? ' is-active' : ''}`}
                    onClick={() => setFilter(id)}
                  >
                    {id === 'ALL' ? 'All' : id === 'ACTIVE' ? 'In progress' : 'Completed'}
                  </button>
                ))}
              </div>
            </div>

            {items.length === 0 ? (
              <div className="empty-illustration">
                <i className="fa-regular fa-folder-open" aria-hidden />
                <p className="empty-state">No records in this view.</p>
              </div>
            ) : (
              <div className="activity-card-grid">
                {items.map((item) => (
                  <article key={item.id} className="activity-card">
                    <div className="activity-card-top">
                      <div className="activity-card-tags">
                        {item.level ? <span className="soft-pill">{item.level}</span> : null}
                        {typeof item.commitmentPct === 'number' ? (
                          <span className="soft-pill">{item.commitmentPct}% time</span>
                        ) : null}
                      </div>
                      <StatusPill status={item.status} />
                    </div>
                    <h3>{item.title}</h3>
                    <p className="activity-meta">
                      <span>
                        <i className="fa-solid fa-user-tie" aria-hidden /> {item.role}
                      </span>
                      <span>
                        <i className="fa-regular fa-calendar" aria-hidden /> {item.duration}
                      </span>
                      <span>
                        <i className="fa-solid fa-building-columns" aria-hidden /> {item.department}
                      </span>
                    </p>
                    <div className="activity-collab">
                      <span className="activity-collab-label">Collaborators</span>
                      <p>{item.collaborators.join(' · ') || '—'}</p>
                    </div>
                    <div className="activity-progress">
                      <div className="activity-progress-head">
                        <span>Progress</span>
                        <strong>{item.progress}%</strong>
                      </div>
                      <div className="bar-chart-track" aria-hidden>
                        <div
                          className="bar-chart-fill"
                          style={{
                            width: `${item.progress}%`,
                            background: item.progress >= 100 ? '#166534' : '#2563eb',
                          }}
                        />
                      </div>
                    </div>
                    <p className="activity-foot">
                      {item.workloadBearing
                        ? 'Included in workload calculation.'
                        : 'Portfolio record — not included in workload calculation.'}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </>
  )
}
