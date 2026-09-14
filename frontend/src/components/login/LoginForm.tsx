import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthError, authService } from '../../lib/auth'
import { quickLoginPortal } from '../../lib/demoLogins'
import { LOGIN_PORTALS, ROLE_CONFIGS, type AppRole } from '../../lib/roles'

export function LoginForm({
  portal,
  onPortalChange,
  onQuickEnter,
  quickBusy,
  externalError,
}: {
  portal: AppRole
  onPortalChange: (role: AppRole) => void
  onQuickEnter: (role: AppRole) => void | Promise<void>
  quickBusy?: boolean
  externalError?: string | null
}) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const activePortal = quickLoginPortal(portal)
  const busy = loading || !!quickBusy
  const displayError = formError || externalError || ''

  useEffect(() => {
    const remembered = authService.getRememberEmail()
    if (remembered) setEmail(remembered)
  }, [])

  useEffect(() => {
    setFormError('')
  }, [activePortal])

  useEffect(() => {
    if (!loading) {
      if (progressTimer.current) {
        clearInterval(progressTimer.current)
        progressTimer.current = null
      }
      return
    }
    setProgress(1)
    progressTimer.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 92) return p
        const step = p < 40 ? 9 : p < 70 ? 6 : 3
        return Math.min(92, p + step)
      })
    }, 45)
    return () => {
      if (progressTimer.current) {
        clearInterval(progressTimer.current)
        progressTimer.current = null
      }
    }
  }, [loading])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const emailValue = String(fd.get('email') ?? email).trim()
    const passwordValue = String(fd.get('password') ?? password)

    setEmail(emailValue)
    setPassword(passwordValue)
    setFormError('')

    if (!emailValue || !passwordValue) {
      setFormError('Email and password are required.')
      return
    }
    if (passwordValue.length < 6) {
      setFormError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    try {
      const session = await authService.login(emailValue, passwordValue, activePortal)
      const actualRole = session.user.role
      if (
        actualRole !== activePortal &&
        actualRole !== 'DEAN' &&
        actualRole !== 'PRINCIPAL'
      ) {
        await authService.logout()
        setProgress(0)
        setFormError(
          `This account is ${ROLE_CONFIGS[actualRole]?.shortLabel || actualRole}. Open the ${ROLE_CONFIGS[actualRole]?.shortLabel || actualRole} login.`,
        )
        return
      }
      if (remember) authService.setRememberEmail(emailValue)
      else authService.setRememberEmail(null)
      setProgress(100)
      await new Promise((r) => setTimeout(r, 180))
      navigate(authService.dashboardFor(actualRole), { replace: true })
    } catch (err) {
      setProgress(0)
      if (err instanceof AuthError) setFormError(err.message)
      else setFormError('Unable to sign in right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`credentials-panel faculty portal-${activePortal.toLowerCase()}`}>
      <nav className="login-role-links" aria-label="Quick role access">
        {LOGIN_PORTALS.map((role, index) => (
          <span key={role} className="login-role-link-wrap">
            {index > 0 ? <span className="login-role-sep" aria-hidden>|</span> : null}
            <button
              type="button"
              className="login-role-link"
              data-active={activePortal === role ? 'true' : undefined}
              aria-current={activePortal === role ? 'page' : undefined}
              disabled={busy}
              title={`Enter as ${ROLE_CONFIGS[role].shortLabel} (no password)`}
              onClick={() => void onQuickEnter(role)}
            >
              {quickBusy && activePortal === role
                ? 'Opening…'
                : ROLE_CONFIGS[role].shortLabel}
            </button>
          </span>
        ))}
      </nav>

      <p className="login-portal-label slide-element">
        Click HR / HOD / Dean / Faculty to enter directly · or sign in below
      </p>

      <form onSubmit={onSubmit} noValidate>
        {displayError ? (
          <div className="field-wrapper slide-element error-message">
            <div className="error-text">{displayError}</div>
          </div>
        ) : null}

        <div className="field-wrapper slide-element">
          <input
            type="text"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            placeholder=" "
            data-filled={email ? 'true' : undefined}
            required
            disabled={busy}
          />
          <label>Email / User ID</label>
          <i className="fa-solid fa-envelope" aria-hidden />
        </div>

        <div className="field-wrapper slide-element">
          <input
            type={showPassword ? 'text' : 'password'}
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder=" "
            data-filled={password ? 'true' : undefined}
            required
            disabled={busy}
          />
          <label>Password</label>
          <button
            type="button"
            className="field-eye"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
          >
            <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
          </button>
        </div>

        <div className="remember-forgot-container slide-element">
          <div className="remember-section">
            <label className="remember-label">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                disabled={busy}
              />
              <span>Remember me</span>
            </label>
          </div>
          <div className="forgot-section">
            <Link to="/forgot-password" className="forgot-link">
              Forgot password?
            </Link>
          </div>
        </div>

        <div className="field-wrapper slide-element login-submit-wrap">
          <button className="submit-button" type="submit" disabled={busy}>
            {quickBusy
              ? `Opening ${ROLE_CONFIGS[activePortal].shortLabel}…`
              : loading
                ? `Signing in… ${progress}%`
                : `Sign in as ${ROLE_CONFIGS[activePortal].shortLabel}`}
          </button>
          {loading || quickBusy ? (
            <div
              className="login-progress"
              aria-live="polite"
              aria-valuenow={progress || (quickBusy ? 60 : 0)}
              aria-valuemin={0}
              aria-valuemax={100}
              role="progressbar"
            >
              <div
                className="login-progress-bar"
                style={{ width: `${loading ? progress : quickBusy ? 60 : 0}%` }}
              />
            </div>
          ) : null}
        </div>
      </form>
    </div>
  )
}
