import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { authService } from '../lib/auth'
import { roleBasePath } from '../lib/nav'
import { PersonAvatar } from './PersonAvatar'

/** DRIMS-style sticky header — Agent 58 branding */
export function InstitutionalHeader({
  showSessionActions = false,
}: {
  showSessionActions?: boolean
}) {
  const navigate = useNavigate()
  const session = showSessionActions ? authService.getSession() : null
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!session) return
    let cancelled = false

    async function load() {
      try {
        const data = await api<{ count: number }>('/notifications/unread-count')
        if (!cancelled) setUnread(data.count || 0)
      } catch {
        if (!cancelled) setUnread(0)
      }
    }

    void load()
    const timer = window.setInterval(() => void load(), 30000)
    const onUpdate = () => void load()
    window.addEventListener('agent58-notifications-updated', onUpdate)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener('agent58-notifications-updated', onUpdate)
    }
  }, [session?.user.id])

  async function logout() {
    await authService.logout()
    navigate('/login', { replace: true })
  }

  const notifyPath = session ? `${roleBasePath(session.user.role)}/notifications` : '/login'

  return (
    <header className="login-header">
      <div className="header-top-bar" />
      <div className="header-container">
        <div className="header-left">
          <Link to="/login" className="header-logo-link" aria-label="Vignan's home">
            <img
              src="/brand/vignan-logo.png?v=3"
              alt="Vignan's Foundation for Science, Technology & Research"
              className="header-logo"
            />
          </Link>
        </div>

        <div className="header-center">
          <div className="drims-branding" aria-label="AGENT 58">
            <div className="drims-logo">AGENT 58</div>
            <div className="drims-separator" />
            <div className="drims-full-name">
              <div className="drims-line">FACULTY</div>
              <div className="drims-line">WORKLOAD</div>
              <div className="drims-line">SYSTEM</div>
            </div>
          </div>
        </div>

        <div className="header-right">
          {session ? (
            <div className="header-session">
              <Link to={`${roleBasePath(session.user.role)}/profile`} className="header-avatar-link" aria-label="Profile">
                <PersonAvatar
                  name={session.user.name}
                  email={session.user.email}
                  photoUrl={session.user.photoUrl}
                />
              </Link>
              <Link to={notifyPath} className="header-notify-link" aria-label="Notifications">
                <i className="fa-regular fa-bell" aria-hidden />
                {unread > 0 && (
                  <span className="header-notify-badge">{unread > 99 ? '99+' : unread}</span>
                )}
              </Link>
              <span className="header-user-email">{session.user.email}</span>
              <button type="button" className="header-logout-btn" onClick={logout}>
                Logout
              </button>
            </div>
          ) : (
            <div className="cse-label">CSE</div>
          )}
        </div>
      </div>
      <div className="header-bottom-bar" />
    </header>
  )
}

export function InstitutionalFooter() {
  return (
    <footer className="login-footer">
      <div className="footer-container">
        <div className="footer-bottom">
          <div className="footer-copyright-section">
            <p className="footer-copyright">
              © 2026 <strong>AGENT 58</strong> — Faculty Workload System. All rights
              reserved.
            </p>
            <p className="footer-institution">
              VIGNAN&apos;S Foundation for Science, Technology &amp; Research (Deemed
              to be University) · Since 2026
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
