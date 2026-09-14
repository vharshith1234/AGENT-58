import { useCallback, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LoginForm } from '../components/login/LoginForm'
import { WelcomePanel } from '../components/login/WelcomePanel'
import {
  InstitutionalFooter,
  InstitutionalHeader,
} from '../components/InstitutionalChrome'
import { AuthError, authService } from '../lib/auth'
import { QUICK_LOGIN_ACCOUNTS, quickLoginPortal } from '../lib/demoLogins'
import { parseLoginPortal, type AppRole } from '../lib/roles'
import '../styles/drims-login.css'

export function LoginPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const portal = parseLoginPortal(params.get('role'))
  const [quickBusy, setQuickBusy] = useState(false)
  const [quickError, setQuickError] = useState<string | null>(null)

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
        authService.setRememberEmail(account.email)
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

  return (
    <div className="login-page">
      <InstitutionalHeader />

      <div className="auth-wrapper">
        <div className="background-shape" aria-hidden />
        <div className="secondary-shape" aria-hidden />
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

      <InstitutionalFooter />
    </div>
  )
}

export { ForgotPasswordPage } from '../components/login/ForgotPassword'
