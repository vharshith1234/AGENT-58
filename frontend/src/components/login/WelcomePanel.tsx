import { ROLE_CONFIGS, type AppRole } from '../../lib/roles'
import { quickLoginPortal } from '../../lib/demoLogins'
import { LoginRobot } from './LoginRobot'

function IconFacultyLogin() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id="ic-login" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1769E8" />
          <stop offset="1" stopColor="#5B5CE2" />
        </linearGradient>
      </defs>
      <path
        d="M4 10.2L12 4.5l8 5.7v1.4L12 6.6 4 11.6v-1.4z"
        fill="url(#ic-login)"
      />
      <path
        d="M7 12.2v4.6c0 1.7 2.3 3 5 3s5-1.3 5-3v-4.6"
        stroke="url(#ic-login)"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="17.2" cy="15.4" r="3.1" fill="#EAF4FF" stroke="#1769E8" strokeWidth="1.4" />
      <path
        d="M17.2 14v1.5l1 .9"
        stroke="#123B73"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconWorkload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id="ic-wl" x1="2" y1="4" x2="22" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0EA5E9" />
          <stop offset="1" stopColor="#1769E8" />
        </linearGradient>
      </defs>
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" fill="#EAF4FF" stroke="url(#ic-wl)" strokeWidth="1.6" />
      <path d="M3.5 9h17" stroke="#93C5FD" strokeWidth="1.3" />
      <circle cx="6.8" cy="6.8" r="0.9" fill="#F87171" />
      <circle cx="9.4" cy="6.8" r="0.9" fill="#FBBF24" />
      <circle cx="12" cy="6.8" r="0.9" fill="#34D399" />
      <rect x="6.2" y="11.2" width="3" height="5.4" rx="1" fill="url(#ic-wl)" />
      <rect x="10.5" y="12.6" width="3" height="4" rx="1" fill="#5B5CE2" />
      <rect x="14.8" y="10.4" width="3" height="6.2" rx="1" fill="#38BDF8" />
    </svg>
  )
}

function IconSmarter() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id="ic-smart" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C3AED" />
          <stop offset="1" stopColor="#1769E8" />
        </linearGradient>
      </defs>
      <path
        d="M12 3.2c-3.7 0-6.7 2.8-6.7 6.2 0 2.2 1.2 4.1 3.1 5.2v2.1c0 .8.6 1.4 1.4 1.4h4.4c.8 0 1.4-.6 1.4-1.4v-2.1c1.9-1.1 3.1-3 3.1-5.2 0-3.4-3-6.2-6.7-6.2z"
        fill="#F5F3FF"
        stroke="url(#ic-smart)"
        strokeWidth="1.55"
      />
      <path d="M9.4 19.6h5.2" stroke="#A78BFA" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M10.2 21.2h3.6" stroke="#C4B5FD" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M12 7.4l.75 1.65 1.8.2-1.35 1.25.4 1.75L12 11.3l-1.6.95.4-1.75-1.35-1.25 1.8-.2L12 7.4z"
        fill="url(#ic-smart)"
      />
    </svg>
  )
}

const FEATURES = [
  {
    Icon: IconFacultyLogin,
    tone: 'tone-login',
    title: 'Faculty Login',
    text: 'Access your dashboard',
  },
  {
    Icon: IconWorkload,
    tone: 'tone-workload',
    title: 'Faculty Workload System',
    text: 'Manage your workload efficiently',
  },
  {
    Icon: IconSmarter,
    tone: 'tone-smart',
    title: 'Smarter workload management',
    text: 'for academic excellence',
  },
] as const

export function WelcomePanel({
  portal,
  onQuickEnter,
  busy,
}: {
  portal: AppRole
  onQuickEnter?: (role: AppRole) => void
  busy?: boolean
}) {
  const key = quickLoginPortal(portal)

  return (
    <div className={`welcome-section faculty welcome-${key.toLowerCase()} premium-hero-panel`}>
      <div className="premium-welcome-card">
        <div className="premium-hero-copy">
          <h2 className="slide-element">
            Welcome to
            <br />
            <span>Faculty Workload</span>
            <br />
            System
          </h2>
          <p className="premium-hero-sub slide-element">
            Smarter workload management for academic excellence
          </p>

          <ul className="premium-feature-list slide-element">
            {FEATURES.map(({ Icon, tone, title, text }) => (
              <li key={title}>
                <div className={`premium-feature-icon ${tone}`} aria-hidden>
                  <Icon />
                </div>
                <div>
                  <strong>{title}</strong>
                  <span>{text}</span>
                </div>
              </li>
            ))}
          </ul>

          {onQuickEnter ? (
            <button
              type="button"
              className="slide-element premium-hero-cta"
              disabled={busy}
              onClick={() => onQuickEnter(key)}
            >
              {busy ? 'Opening…' : `Enter ${ROLE_CONFIGS[key].welcomeTitle} →`}
            </button>
          ) : null}
        </div>

        <div className="premium-hero-art slide-element" aria-hidden>
          <div className="premium-robot-stage">
            <LoginRobot className="login-robot--welcome" />
            <div className="premium-learn-board">
              <span>Learn</span>
              <span>Plan</span>
              <span>Achieve</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
