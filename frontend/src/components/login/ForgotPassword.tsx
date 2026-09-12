import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  InstitutionalFooter,
  InstitutionalHeader,
} from '../InstitutionalChrome'
import { api } from '../../lib/api'
import '../../styles/drims-login.css'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.trim()) {
      setError('Email / User ID is required.')
      return
    }
    setLoading(true)
    try {
      await api('/auth/forgot', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      setSent(true)
    } catch {
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <InstitutionalHeader />
      <div className="auth-wrapper" style={{ height: 'auto', minHeight: 420 }}>
        <div className="background-shape" aria-hidden />
        <div className="credentials-panel faculty" style={{ width: '100%', position: 'relative' }}>
          <h2 className="slide-element">Forgot Password?</h2>
          {sent ? (
            <div className="field-wrapper slide-element error-message">
              <div
                className="error-text"
                style={{
                  background: '#ecfdf5',
                  borderColor: '#10b981',
                  color: '#065f46',
                }}
              >
                If an account exists for <strong>{email}</strong>, Human Resources has
                been notified. Credentials are never shown here.
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate>
              {error ? (
                <div className="field-wrapper slide-element error-message">
                  <div className="error-text">{error}</div>
                </div>
              ) : null}
              <div className="field-wrapper slide-element">
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder=" "
                  data-filled={email ? 'true' : undefined}
                  required
                />
                <label>Email / User ID</label>
                <i className="fa-solid fa-envelope" aria-hidden />
              </div>
              <div className="field-wrapper slide-element">
                <button className="submit-button" type="submit" disabled={loading}>
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          )}
          <p className="switch-link slide-element">
            <Link to="/login" className="forgot-link">
              Back to Login
            </Link>
          </p>
        </div>
      </div>
      <InstitutionalFooter />
    </div>
  )
}
