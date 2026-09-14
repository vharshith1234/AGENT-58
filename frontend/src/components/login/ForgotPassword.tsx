import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent, ClipboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  InstitutionalFooter,
  InstitutionalHeader,
} from '../InstitutionalChrome'
import { api } from '../../lib/api'
import '../../styles/drims-login.css'

type Step = 'email' | 'otp' | 'password' | 'done'

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
    <div className="login-page">
      <InstitutionalHeader />
      <div className="auth-wrapper forgot-auth-wrap">
        <div className="background-shape" aria-hidden />
        <div className="credentials-panel faculty forgot-official">
          <div className="forgot-official-head slide-element">
            <span className="forgot-official-badge">
              <i className="fa-solid fa-envelope-circle-check" aria-hidden />
              Official mail OTP
            </span>
            <h2>Forgot Password?</h2>
            <p className="forgot-official-sub">
              Reset using a one-time code sent to your <strong>registered email</strong> (official
              institutional or linked mailbox).
            </p>
          </div>

          {error ? (
            <div className="forgot-alert forgot-alert-error slide-element">{error}</div>
          ) : null}
          {info && step === 'otp' ? (
            <div className="forgot-alert forgot-alert-ok slide-element">
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
            <form className="forgot-form" onSubmit={(e) => void sendOtp(e)} noValidate>
              <label className="forgot-box-field slide-element">
                <span className="forgot-box-label">Official Email / User ID</span>
                <div className="forgot-box-input">
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
              <button className="submit-button forgot-submit" type="submit" disabled={loading}>
                {loading ? 'Sending OTP…' : 'Send OTP to Official Mail'}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form className="forgot-form" onSubmit={(e) => void verifyOtp(e)} noValidate>
              <div className="forgot-otp-block slide-element">
                <span className="forgot-box-label">Enter 6-digit OTP</span>
                <div className="forgot-otp-boxes" onPaste={onOtpPaste}>
                  {otpDigits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        otpRefs.current[i] = el
                      }}
                      className="forgot-otp-box"
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
              <button className="submit-button forgot-submit" type="submit" disabled={loading}>
                {loading ? 'Verifying…' : 'Verify OTP'}
              </button>
              <button
                type="button"
                className="forgot-resend"
                disabled={loading}
                onClick={() => void sendOtp()}
              >
                Resend OTP to official mail
              </button>
            </form>
          )}

          {step === 'password' && (
            <form className="forgot-form" onSubmit={(e) => void resetPassword(e)} noValidate>
              <label className="forgot-box-field slide-element">
                <span className="forgot-box-label">New password</span>
                <div className="forgot-box-input">
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
              <label className="forgot-box-field slide-element">
                <span className="forgot-box-label">Confirm password</span>
                <div className="forgot-box-input">
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
              <button className="submit-button forgot-submit" type="submit" disabled={loading}>
                {loading ? 'Saving…' : 'Reset password'}
              </button>
            </form>
          )}

          {step === 'done' && (
            <div className="forgot-done slide-element">
              <div className="forgot-alert forgot-alert-ok">
                Password updated. You can sign in with your new password.
              </div>
              <button className="submit-button forgot-submit" type="button" onClick={() => navigate('/login')}>
                Back to Login
              </button>
            </div>
          )}

          {step !== 'done' && (
            <p className="switch-link slide-element">
              <Link to="/login" className="forgot-link">
                Back to Login
              </Link>
            </p>
          )}
        </div>
      </div>
      <InstitutionalFooter />
    </div>
  )
}
