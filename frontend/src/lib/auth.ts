import { ROLE_CONFIGS, type AppRole } from './roles'
import { API_BASE, ApiError } from './api'

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'INACTIVE_ACCOUNT'
  | 'SERVER_ERROR'
  | 'VALIDATION'

export class AuthError extends Error {
  code: AuthErrorCode

  constructor(code: AuthErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'AuthError'
  }
}

export interface AuthUser {
  id: string
  email: string
  name: string
  role: AppRole
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  departmentId?: string | null
  schoolId?: string | null
  facultyId?: string | null
  photoUrl?: string | null
}

export interface AuthSession {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

const SESSION_KEY = 'agent58.session'
const REMEMBER_KEY = 'agent58.rememberEmail'

function saveSession(session: AuthSession) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export const authService = {
  async login(email: string, password: string): Promise<AuthSession> {
    let res: Response
    try {
      res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password: password.trim(),
        }),
      })
    } catch {
      throw new AuthError(
        'SERVER_ERROR',
        'Cannot reach Agent 58 API. Is the backend running on port 3000?',
      )
    }

    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg = Array.isArray(body.message)
        ? body.message.join(', ')
        : body.message || 'Login failed'
      if (res.status === 403) {
        const code =
          typeof msg === 'string' && msg.toLowerCase().includes('inactive')
            ? 'INACTIVE_ACCOUNT'
            : 'VALIDATION'
        throw new AuthError(code, msg)
      }
      if (res.status === 401) {
        throw new AuthError('INVALID_CREDENTIALS', msg)
      }
      throw new AuthError('SERVER_ERROR', msg)
    }

    const session: AuthSession = {
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
      user: body.user,
    }
    saveSession(session)
    return session
  },

  async logout() {
    const session = this.getSession()
    if (session?.refreshToken) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: session.refreshToken }),
        })
      } catch {
        /* ignore */
      }
    }
    sessionStorage.removeItem(SESSION_KEY)
  },

  getSession(): AuthSession | null {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as AuthSession
    } catch {
      return null
    }
  },

  patchSessionUser(partial: Partial<AuthUser>) {
    const session = this.getSession()
    if (!session) return null
    const next = { ...session, user: { ...session.user, ...partial } }
    saveSession(next)
    return next
  },

  setRememberEmail(email: string | null) {
    if (email) localStorage.setItem(REMEMBER_KEY, email)
    else localStorage.removeItem(REMEMBER_KEY)
  },

  getRememberEmail(): string {
    return localStorage.getItem(REMEMBER_KEY) ?? ''
  },

  dashboardFor(role: AppRole): string {
    return ROLE_CONFIGS[role].dashboardPath
  },
}

export function mapApiError(err: unknown): AuthError {
  if (err instanceof AuthError) return err
  if (err instanceof ApiError) {
    return new AuthError('SERVER_ERROR', err.message)
  }
  return new AuthError('SERVER_ERROR', 'Unexpected error')
}
