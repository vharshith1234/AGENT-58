const API_ORIGIN = (
  import.meta.env.DEV
    ? ''
    : import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
).replace(/\/api\/?$/, '')

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function hashSeed(input: string) {
  let h = 0
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0
  return h
}

const PALETTE = ['#1e3a8a', '#2563eb', '#0f766e', '#b45309', '#334155', '#be123c']

export function resolvePhotoUrl(photoUrl?: string | null) {
  if (!photoUrl) return null
  if (
    photoUrl.startsWith('http://') ||
    photoUrl.startsWith('https://') ||
    photoUrl.startsWith('data:')
  ) {
    return photoUrl
  }
  return `${API_ORIGIN}${photoUrl.startsWith('/') ? '' : '/'}${photoUrl}`
}

export function optimizePhotoUrl(photoUrl?: string | null, size = 96) {
  const src = resolvePhotoUrl(photoUrl)
  if (!src) return null
  if (src.includes('res.cloudinary.com') && src.includes('/upload/')) {
    return src.replace(
      '/upload/',
      `/upload/c_fill,g_face,w_${size},h_${size},f_auto,q_auto/`,
    )
  }
  return src
}

export function DataSourceBadge({
  source,
  title,
}: {
  source?: string | null
  title?: string
}) {
  const s = (source || 'REAL').toUpperCase()
  if (s !== 'DEMO') return null
  return (
    <span
      className="source-pill source-demo"
      title={title || 'DEMO DATA — synthetic academic coverage, not an official university timetable'}
    >
      DEMO DATA
    </span>
  )
}

/** Normal profile photo, or initials fallback (no cartoon icons) */
export function PersonAvatar({
  name,
  email,
  size = 'md',
  photoUrl,
}: {
  name: string
  email?: string | null
  size?: 'md' | 'lg'
  photoUrl?: string | null
}) {
  const src = optimizePhotoUrl(photoUrl, size === 'lg' ? 160 : 64)
  const cls = size === 'lg' ? 'avatar avatar-lg' : 'avatar'
  const seed = hashSeed(email || name)
  const bg = PALETTE[seed % PALETTE.length]
  const label = initials(name)

  return (
    <span className="avatar-wrap">
      {src ? (
        <img
          className={cls}
          src={src}
          alt={name}
          loading="lazy"
          decoding="async"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
            const fb = e.currentTarget.parentElement?.querySelector(
              '.avatar-fallback',
            ) as HTMLElement | null
            if (fb) fb.style.display = 'flex'
          }}
        />
      ) : null}
      <span
        className={`${cls} avatar-fallback`}
        style={{
          background: bg,
          display: src ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 700,
          fontSize: size === 'lg' ? '1.2rem' : '0.8rem',
          letterSpacing: '0.02em',
        }}
        aria-label={name}
      >
        {label}
      </span>
    </span>
  )
}

export function StatusPill({ status }: { status?: string | null }) {
  const s = (status || 'PENDING').toUpperCase()
  const cls =
    s === 'NORMAL' || s === 'APPROVED' || s === 'COMPLETED' || s === 'ACCEPTED'
      ? 'status-normal'
      : s === 'ACTIVE' || s === 'ONGOING'
        ? 'status-info'
        : s === 'OVERLOAD' || s === 'REJECTED' || s === 'ON_HOLD'
          ? 'status-overload'
          : s === 'UNDERLOAD' || s === 'REVIEW' || s === 'UNDER_REVIEW' || s === 'SUBMITTED'
            ? 'status-underload'
            : s === 'PENDING' || s === 'PENDING_UTESH'
              ? 'status-pending'
              : 'status-indeterminate'

  return <span className={`status-pill ${cls}`}>{s.replaceAll('_', ' ')}</span>
}
