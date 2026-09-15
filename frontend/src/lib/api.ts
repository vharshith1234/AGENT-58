function resolveApiBase() {
  // Dev always uses same-origin /api (Vite proxy) so phone/LAN works.
  if (import.meta.env.DEV) return '/api'
  return import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
}

const API_BASE = resolveApiBase()
const DEFAULT_TIMEOUT_MS = 45_000
const CACHE_TTL_MS = 60_000

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

type StoredSession = {
  accessToken?: string
  refreshToken?: string
  user?: unknown
}

function readSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem('agent58.session')
    if (!raw) return null
    return JSON.parse(raw) as StoredSession
  } catch {
    return null
  }
}

function writeSession(session: StoredSession) {
  sessionStorage.setItem('agent58.session', JSON.stringify(session))
}

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    const session = readSession()
    if (!session?.refreshToken) return null
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      })
      if (!res.ok) {
        sessionStorage.removeItem('agent58.session')
        return null
      }
      const body = await res.json()
      writeSession({
        accessToken: body.accessToken,
        refreshToken: body.refreshToken,
        user: { ...(session.user as object), ...(body.user || {}) },
      })
      return body.accessToken as string
    } catch {
      return null
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

function errorMessage(body: any, fallback: string) {
  const msg = body?.message
  if (typeof msg === 'string') return msg
  if (Array.isArray(msg)) return msg.map((m) => (typeof m === 'string' ? m : m?.message || String(m))).join(', ')
  if (msg && typeof msg === 'object') {
    if (typeof msg.message === 'string') return msg.message
    if (msg.code === 'OVERLOAD_WARNING') {
      return 'This assignment would overload the faculty. Confirm overload to proceed.'
    }
  }
  if (typeof body?.error === 'string' && body.error !== 'Conflict') return body.error
  return fallback
}

const inflight = new Map<string, Promise<unknown>>()
const responseCache = new Map<string, { at: number; data: unknown }>()

async function request<T>(
  path: string,
  options: RequestInit = {},
  retried = false,
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase()
  const cacheKey = !retried && method === 'GET' ? path : ''
  if (cacheKey) {
    const hit = responseCache.get(cacheKey)
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return hit.data as T
    }
    if (inflight.has(cacheKey)) {
      return inflight.get(cacheKey) as Promise<T>
    }
  }

  const run = (async () => {
    const session = readSession()
    const headers = new Headers(options.headers || {})
    if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json')
    }
    if (session?.accessToken) {
      headers.set('Authorization', `Bearer ${session.accessToken}`)
    }

    let res: Response
    try {
      res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        signal: options.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      })
    } catch (err: any) {
      // Neon cold-start: retry GET once after a short pause.
      if (
        (err?.name === 'TimeoutError' || err?.name === 'AbortError') &&
        method === 'GET' &&
        !retried
      ) {
        await new Promise((r) => setTimeout(r, 1500))
        return request<T>(path, options, true)
      }
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        throw new ApiError(
          0,
          'Request timed out. The database may be waking up — please retry.',
        )
      }
      throw new ApiError(
        0,
        'Cannot reach Agent 58 API. Is the backend running on port 3000?',
      )
    }

    if (res.status === 401 && !retried) {
      const next = await refreshAccessToken()
      if (next) return request<T>(path, options, true)
    }

    if (!res.ok) {
      let body: any = null
      try {
        body = await res.json()
      } catch {
        /* ignore */
      }
      throw new ApiError(
        res.status,
        errorMessage(body, res.statusText || 'Request failed'),
        body,
      )
    }

    // Mutations must not leave stale GET responses in the client cache
    if (method !== 'GET') {
      responseCache.clear()
    }

    if (res.status === 204) return undefined as T
    const ct = res.headers.get('content-type') || ''
    const data = ct.includes('application/json')
      ? ((await res.json()) as T)
      : ((await res.blob()) as T)
    if (cacheKey && !(data instanceof Blob)) {
      responseCache.set(cacheKey, { at: Date.now(), data })
    }
    return data
  })()

  if (cacheKey) {
    inflight.set(cacheKey, run)
    run.finally(() => inflight.delete(cacheKey))
  }
  return run
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  return request<T>(path, options)
}

export async function apiUpload<T = unknown>(
  path: string,
  formData: FormData,
): Promise<T> {
  return request<T>(path, { method: 'POST', body: formData })
}

export async function apiDelete<T = unknown>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' })
}

export async function apiBlob(path: string): Promise<Blob> {
  return request<Blob>(path, {})
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function invalidateApiCache(prefix = '') {
  for (const key of responseCache.keys()) {
    if (!prefix || key.startsWith(prefix)) responseCache.delete(key)
  }
}

export { API_BASE }
