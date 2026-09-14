import { Link } from 'react-router-dom'
import { PageHeader, Panel, useApiData } from '../../components/DashboardShell'
import { api } from '../../lib/api'
import { authService } from '../../lib/auth'
import { roleBasePath } from '../../lib/nav'

function requestsPathForRole(role?: string) {
  if (!role) return '/login'
  const base = roleBasePath(role as any)
  if (role === 'FACULTY') return `${base}/requests`
  if (role === 'HR' || role === 'HOD' || role === 'DEAN' || role === 'PRINCIPAL') {
    return `${base}/requests`
  }
  return `${base}/notifications`
}

function isRequestNotification(n: { title?: string; body?: string; kind?: string }) {
  const text = `${n.title || ''} ${n.body || ''} ${n.kind || ''}`.toLowerCase()
  return (
    text.includes('request') ||
    text.includes('reassign') ||
    text.includes('correction') ||
    text.includes('leave') ||
    text.includes('transfer')
  )
}

export function NotificationsPage() {
  const notes = useApiData(() => api<any[]>('/notifications'))
  const session = authService.getSession()
  const requestsPath = requestsPathForRole(session?.user?.role)

  async function markRead(id: string) {
    await api(`/notifications/${id}/read`, { method: 'PATCH' })
    await notes.reload()
    window.dispatchEvent(new Event('agent58-notifications-updated'))
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Alerts for leave, reassignment, corrections, and approvals."
        action={
          <Link className="btn btn-primary btn-sm" to={requestsPath}>
            Open Requests
          </Link>
        }
      />
      <Panel title="Inbox">
        {(notes.data || []).length === 0 && (
          <p className="empty-state">No notifications yet.</p>
        )}
        <div style={{ display: 'grid', gap: '0.65rem' }}>
          {(notes.data || []).map((n) => (
            <div key={n.id} className="list-card">
              <div>
                <strong>{n.title}</strong>
                <p className="empty-state" style={{ marginTop: '0.25rem' }}>
                  {n.body}
                </p>
                {isRequestNotification(n) && (
                  <Link
                    className="open-profile-link"
                    to={requestsPath}
                    onClick={() => {
                      if (!n.read) void markRead(n.id)
                    }}
                    style={{ display: 'inline-block', marginTop: '0.35rem' }}
                  >
                    View request
                  </Link>
                )}
              </div>
              {!n.read && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => void markRead(n.id)}
                >
                  Mark read
                </button>
              )}
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
