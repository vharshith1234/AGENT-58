import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent, ClipboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { InstitutionalHeader } from '../InstitutionalChrome'
import { api } from '../../lib/api'
import '../../styles/drims-login.css'
import '../../styles/premium-login.css'

type Step = 'email' | 'otp' | 'password' | 'done'

function PremiumForgotFooter() {
  return (
    <footer className="premium-login-footer">
      <div className="premium-login-footer-inner">
        <p>© 2026 AGENT 58 · VIGNAN&apos;S · Faculty Workload System</p>
      </div>
    </footer>
  )
}

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const [resetToken, setResetToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [maskedEmail, setMaskedEmail] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const otpRefs = useRef<Array<HTMLInputElement | null>>([])

  const otp = otpDigits.join('')

  useEffect(() => {
    if (step === 'otp') {
      otpRefs.current[0]?.focus()
    }
  }, [step])

  function setOtpAt(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1)
    setOtpDigits((prev) => {
      const next = [...prev]
      next[index] = digit
      return next
    })
    if (digit && index < 5) otpRefs.current[index + 1]?.focus()
  }

  function onOtpKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  function onOtpPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const next = ['', '', '', '', '', '']
    pasted.split('').forEach((ch, i) => {
      next[i] = ch
    })
    setOtpDigits(next)
    otpRefs.current[Math.min(pasted.length, 5)]?.focus()
  }

  async function sendOtp(e?: FormEvent) {
    e?.preventDefault()
    setError('')
    setInfo('')
    if (!email.trim()) {
      setError('Official email / User ID is required.')
      return
    }
    setLoading(true)
    try {
      const res = await api<{
        ok: boolean
        sent?: boolean
        message?: string
        maskedEmail?: string
        devOtp?: string
        brevoError?: string
      }>('/auth/forgot', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      })
      setMaskedEmail(res.maskedEmail || '')
      if (res.sent === false) {
        setError(res.message || 'No account found for that email.')
        return
      }
      if (res.devOtp) {
        setOtpDigits(res.devOtp.split('').slice(0, 6))
        setInfo(
          `${res.message || 'Dev OTP ready.'} Code: ${res.devOtp}` +
            (res.brevoError ? ` (${res.brevoError.slice(0, 80)}…)` : ''),
        )
      } else {
        setInfo(res.message || 'Check your registered email for the OTP.')
      }
      setStep('otp')
    } catch (err: any) {
      setError(err?.message || 'Could not send OTP. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function verifyOtp(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (otp.length !== 6) {
      setError('Enter the 6-digit OTP from your official email.')
      return
    }
    setLoading(true)
    try {
      const res = await api<{ ok: boolean; resetToken: string }>('/auth/forgot/verify', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), otp }),
      })
      setResetToken(res.resetToken)
      setStep('password')
    } catch (err: any) {
      setError(err?.message || 'Invalid OTP.')
    } finally {
      setLoading(false)
    }
  }

  async function resetPassword(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await api('/auth/forgot/reset', {
        method: 'POST',
        body: JSON.stringify({ resetToken, newPassword: password }),
      })
      setStep('done')
    } catch (err: any) {
      setError(err?.message || 'Could not reset password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page login-page--premium login-page--enter login-page--forgot">
      <InstitutionalHeader />

      <main className="premium-hero premium-hero--forgot">
        <div className="premium-hero-bg" aria-hidden>
          <img src="/brand/vignan-campus.png" alt="" />
          <div className="premium-hero-bg-veil" />
        </div>

        <div className="premium-forgot-wrap">
          <div className="premium-login-card premium-forgot-card">
            <div className="premium-forgot-head">
              <span className="premium-forgot-badge">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                  <rect x="3" y="5" width="18" height="14" rx="3" stroke="#1769E8" strokeWidth="1.8" />
                  <path d="M4 7.5L12 13l8-5.5" stroke="#1769E8" strokeWidth="1.8" strokeLinecap="round" />
                  <circle cx="18.5" cy="7.5" r="3.2" fill="#EAF4FF" stroke="#5B5CE2" strokeWidth="1.4" />
                  <path d="M18.5 6.2v1.5l.9.9" stroke="#123B73" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                Official mail OTP
              </span>
              <h2>Forgot Password?</h2>
              <p>
                Reset using a one-time code sent to your <strong>registered email</strong>{' '}
                (official institutional or linked mailbox).
              </p>
            </div>

            {error ? <div className="premium-forgot-alert is-error">{error}</div> : null}
            {info && step === 'otp' ? (
              <div className="premium-forgot-alert is-ok">
                {info}
                {maskedEmail ? (
                  <>
                    {' '}
                    Sent to <strong>{maskedEmail}</strong>.
                  </>
                ) : null}
              </div>
            ) : null}

            {step === 'email' && (
              <form className="premium-forgot-form" onSubmit={(e) => void sendOtp(e)} noValidate>
                <label className="premium-field">
                  <span>Official Email / User ID</span>
                  <div className="premium-input">
                    <i className="fa-solid fa-envelope" aria-hidden />
                    <input
                      type="text"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@vignan.ac.in"
                      required
                      autoComplete="username"
                    />
                  </div>
                </label>
                <button className="premium-submit" type="submit" disabled={loading}>
                  <span className="premium-submit-arrow" aria-hidden>
                    →
                  </span>
                  {loading ? 'Sending OTP…' : 'Send OTP to Official Mail'}
                </button>
              </form>
            )}

            {step === 'otp' && (
              <form className="premium-forgot-form" onSubmit={(e) => void verifyOtp(e)} noValidate>
                <div className="premium-otp-block">
                  <span className="premium-field-label">Enter 6-digit OTP</span>
                  <div className="premium-otp-boxes" onPaste={onOtpPaste}>
                    {otpDigits.map((d, i) => (
                      <input
                        key={i}
                        ref={(el) => {
                          otpRefs.current[i] = el
                        }}
                        className="premium-otp-box"
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={d}
                        aria-label={`OTP digit ${i + 1}`}
                        onChange={(e) => setOtpAt(i, e.target.value)}
                        onKeyDown={(e) => onOtpKeyDown(i, e)}
                        autoComplete={i === 0 ? 'one-time-code' : 'off'}
                      />
                    ))}
                  </div>
                </div>
                <button className="premium-submit" type="submit" disabled={loading}>
                  <span className="premium-submit-arrow" aria-hidden>
                    →
                  </span>
                  {loading ? 'Verifying…' : 'Verify OTP'}
                </button>
                <button
                  type="button"
                  className="premium-forgot-resend"
                  disabled={loading}
                  onClick={() => void sendOtp()}
                >
                  Resend OTP to official mail
                </button>
              </form>
            )}

            {step === 'password' && (
              <form
                className="premium-forgot-form"
                onSubmit={(e) => void resetPassword(e)}
                noValidate
              >
                <label className="premium-field">
                  <span>New password</span>
                  <div className="premium-input">
                    <i className="fa-solid fa-lock" aria-hidden />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      required
                      autoComplete="new-password"
                    />
                  </div>
                </label>
                <label className="premium-field">
                  <span>Confirm password</span>
                  <div className="premium-input">
                    <i className="fa-solid fa-lock" aria-hidden />
                    <input
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Re-enter password"
                      required
                      autoComplete="new-password"
                    />
                  </div>
                </label>
                <button className="premium-submit" type="submit" disabled={loading}>
                  <span className="premium-submit-arrow" aria-hidden>
                    →
                  </span>
                  {loading ? 'Saving…' : 'Reset password'}
                </button>
              </form>
            )}

            {step === 'done' && (
              <div className="premium-forgot-done">
                <div className="premium-forgot-alert is-ok">
                  Password updated. You can sign in with your new password.
                </div>
                <button
                  className="premium-submit"
                  type="button"
                  onClick={() => navigate('/login')}
                >
                  <span className="premium-submit-arrow" aria-hidden>
                    →
                  </span>
                  Back to Login
                </button>
              </div>
            )}

            {step !== 'done' ? (
              <p className="premium-forgot-back">
                <Link to="/login">← Back to Login</Link>
              </p>
            ) : null}
          </div>
        </div>
      </main>

      <PremiumForgotFooter />
    </div>
  )
}
