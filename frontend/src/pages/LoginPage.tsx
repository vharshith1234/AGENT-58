import { useCallback, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LoginForm } from '../components/login/LoginForm'
import {
  LoginSplash,
  markLoginSplashSeen,
  shouldShowLoginSplash,
} from '../components/login/LoginSplash'
import { WelcomePanel } from '../components/login/WelcomePanel'
import { InstitutionalHeader } from '../components/InstitutionalChrome'
import { AuthError, authService } from '../lib/auth'
import { QUICK_LOGIN_ACCOUNTS, quickLoginPortal } from '../lib/demoLogins'
import { parseLoginPortal, type AppRole } from '../lib/roles'
import '../styles/drims-login.css'
import '../styles/premium-login.css'

function PremiumLoginFooter() {
  return (
    <footer className="premium-login-footer">
      <div className="premium-login-footer-inner">
        <p>© 2026 AGENT 58 · VIGNAN&apos;S · Faculty Workload System</p>
      </div>
    </footer>
  )
}

export function LoginPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const portal = parseLoginPortal(params.get('role'))
  const [quickBusy, setQuickBusy] = useState(false)
  const [quickError, setQuickError] = useState<string | null>(null)
  const [showSplash, setShowSplash] = useState(() => shouldShowLoginSplash())
  const [enterLogin, setEnterLogin] = useState(() => !showSplash)

  const setPortal = useCallback(
    (role: AppRole) => {
      navigate(`/login?role=${quickLoginPortal(role)}`, { replace: true })
    },
    [navigate],
  )

  const quickEnter = useCallback(
    async (role: AppRole) => {
      const portalRole = quickLoginPortal(role)
      setPortal(portalRole)
      const account = QUICK_LOGIN_ACCOUNTS[portalRole]
      setQuickError(null)
      setQuickBusy(true)
      try {
        const session = await authService.login(
          account.email,
          account.password,
          portalRole,
        )
        navigate(authService.dashboardFor(session.user.role), { replace: true })
      } catch (err) {
        setQuickError(
          err instanceof AuthError
            ? err.message
            : 'Unable to open this role right now. Please try again.',
        )
      } finally {
        setQuickBusy(false)
      }
    },
    [navigate, setPortal],
  )

  const onSplashComplete = useCallback(() => {
    markLoginSplashSeen()
    setShowSplash(false)
    setEnterLogin(true)
  }, [])

  return (
    <div
      className={`login-page login-page--premium${enterLogin ? ' login-page--enter' : ''}`}
    >
      {showSplash ? <LoginSplash onComplete={onSplashComplete} /> : null}

      <InstitutionalHeader />

      <main className="premium-hero">
        <div className="premium-hero-bg" aria-hidden>
          <img src="/brand/vignan-campus.png" alt="" />
          <div className="premium-hero-bg-veil" />
        </div>

        <div className="premium-hero-inner">
          <LoginForm
            portal={portal}
            onPortalChange={setPortal}
            onQuickEnter={quickEnter}
            quickBusy={quickBusy}
            externalError={quickError}
          />
          <WelcomePanel
            portal={portal}
            onQuickEnter={quickEnter}
            busy={quickBusy}
          />
        </div>
      </main>

      <PremiumLoginFooter />
    </div>
  )
}

export { ForgotPasswordPage } from '../components/login/ForgotPassword'
