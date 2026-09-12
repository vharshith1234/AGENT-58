import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  InstitutionalFooter,
  InstitutionalHeader,
} from './InstitutionalChrome'
import { PersonAvatar } from './PersonAvatar'
import { authService } from '../lib/auth'
import { ROLE_CONFIGS, type AppRole } from '../lib/roles'
import { ROLE_NAV, roleBasePath } from '../lib/nav'

export function DashboardShell({ role, children }: { role: AppRole; children?: ReactNode }) {
  const navigate = useNavigate()
  const config = ROLE_CONFIGS[role]
  const session = authService.getSession()
  const links = ROLE_NAV[role]
  const [sessionTick, setSessionTick] = useState(0)

  useEffect(() => {
    if (!session) navigate('/login', { replace: true })
    else if (session.user.role !== role) {
      navigate(authService.dashboardFor(session.user.role), { replace: true })
    }
  }, [session, role, navigate, sessionTick])

  useEffect(() => {
    const onUpdate = () => setSessionTick((n) => n + 1)
    window.addEventListener('agent58-session-updated', onUpdate)
    return () => window.removeEventListener('agent58-session-updated', onUpdate)
  }, [])

  const liveSession = authService.getSession() || session
  if (!liveSession) return null
  const profilePath = `${roleBasePath(role)}/profile`

  return (
    <div className="app-shell">
      <InstitutionalHeader showSessionActions key={sessionTick} />
      <div className="app-shell-body">
        <aside className="app-sidebar" aria-label={`${config.label} navigation`}>
          <div className="sidebar-sticky-inner">
            <NavLink to={profilePath} className="sidebar-user-card">
              <PersonAvatar
                name={liveSession.user.name}
                email={liveSession.user.email}
                photoUrl={liveSession.user.photoUrl}
              />
              <div className="sidebar-user-meta">
                <strong>{liveSession.user.name}</strong>
                <span>{config.shortLabel}</span>
              </div>
            </NavLink>
            <div className="sidebar-nav-label">{config.label}</div>
            <nav className="sidebar-nav-links">
              {links.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `sidebar-link${isActive ? ' is-active' : ''}`
                  }
                  end={item.path.endsWith('/dashboard')}
                >
                  <i className={item.icon} aria-hidden />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </aside>

        <div className="app-content">
          <div className="mobile-nav" aria-label="Sections">
            {links.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => (isActive ? 'is-active' : undefined)}
                end={item.path.endsWith('/dashboard')}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
          <Outlet />
          {children}
        </div>
      </div>
      <InstitutionalFooter />
    </div>
  )
}

export function refreshShellSession() {
  window.dispatchEvent(new Event('agent58-session-updated'))
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  )
}

export function Panel({
  title,
  children,
  action,
  id,
}: {
  title: string
  children: ReactNode
  action?: ReactNode
  id?: string
}) {
  return (
    <section className="panel" id={id}>
      <div className="panel-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function ErrorRetry({
  error,
  onRetry,
}: {
  error: string | null
  onRetry: () => void
}) {
  if (!error) return null
  return (
    <div className="alert-banner" style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
      Unable to load data. {error}{' '}
      <button type="button" className="open-profile-link" onClick={onRetry}>
        Retry
      </button>
    </div>
  )
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="skeleton-table" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-row">
          {Array.from({ length: cols }).map((__, j) => (
            <div key={j} className="skeleton-cell" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function paginate<T>(items: T[], page: number, pageSize = 12) {
  const total = items.length
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const p = Math.min(Math.max(1, page), pages)
  return {
    rows: items.slice((p - 1) * pageSize, p * pageSize),
    page: p,
    pages,
    total,
  }
}

export function Pager({
  page,
  pages,
  onPage,
}: {
  page: number
  pages: number
  onPage: (n: number) => void
}) {
  if (pages <= 1) return null
  return (
    <div className="pager">
      <button type="button" className="btn btn-secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span>
        Page {page} of {pages}
      </span>
      <button type="button" className="btn btn-secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </div>
  )
}

export function useApiData<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      setData(await loader())
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, error, loading, reload }
}

export function filterByQuery<T>(
  items: T[],
  query: string,
  getHaystack: (item: T) => string,
) {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter((item) => getHaystack(item).toLowerCase().includes(q))
}

export function sectionId(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}
