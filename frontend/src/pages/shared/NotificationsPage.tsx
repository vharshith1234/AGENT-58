import { PageHeader, Panel, useApiData } from '../../components/DashboardShell'
import { api } from '../../lib/api'

export function NotificationsPage() {
  const notes = useApiData(() => api<any[]>('/notifications'))

  async function markRead(id: string) {
    await api(`/notifications/${id}/read`, { method: 'PATCH' })
    await notes.reload()
    window.dispatchEvent(new Event('agent58-notifications-updated'))
  }

  return (
    <>
      <PageHeader title="Notifications" subtitle="Alerts for allocations, approvals, and corrections." />
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
