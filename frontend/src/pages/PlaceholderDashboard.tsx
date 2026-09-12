import { useNavigate } from 'react-router-dom'
import {
  InstitutionalFooter,
  InstitutionalHeader,
} from '../components/InstitutionalChrome'
import { authService } from '../lib/auth'
import { ROLE_CONFIGS, type AppRole } from '../lib/roles'

interface PlaceholderDashboardProps {
  role: AppRole
}

export function PlaceholderDashboard({ role }: PlaceholderDashboardProps) {
  const navigate = useNavigate()
  const config = ROLE_CONFIGS[role]
  const session = authService.getSession()

  function logout() {
    authService.logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="login-page">
      <InstitutionalHeader />
      <main className="login-main">
        <div className="w-full max-w-3xl rounded-2xl border border-border bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-[0.16em] text-primary uppercase">
                Authenticated shell
              </p>
              <h2 className="mt-2 font-display text-2xl font-extrabold text-ink">
                {config.welcomeTitle}
              </h2>
              <p className="mt-2 text-muted">
                Signed in as <strong>{session?.user.email ?? 'guest'}</strong>
                {session?.user.name ? <> · {session.user.name}</> : null}
                {' · '}
                Role: <strong>{role}</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-dark"
            >
              Logout
            </button>
          </div>
          <p className="mt-4 text-sm text-slate-400">
            Full modules for this role will be built in later phases.
          </p>
        </div>
      </main>
      <InstitutionalFooter />
    </div>
  )
}
