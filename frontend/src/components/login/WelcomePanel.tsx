import { ROLE_CONFIGS, type AppRole } from '../../lib/roles'
import { quickLoginPortal } from '../../lib/demoLogins'
import { LoginRobot } from './LoginRobot'

function IconFacultyLogin() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z"
        fill="#1769E8"
        opacity="0.15"
      />
      <path
        d="M4 10.5L12 4l8 6.5"
        stroke="#1769E8"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 19.5V11.2L12 6.8l5.5 4.4V19.5"
        stroke="#123B73"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16.8" cy="15.2" r="3.3" fill="#EAF4FF" stroke="#1769E8" strokeWidth="1.4" />
      <path
        d="M16.8 13.7v1.7l1.1.9"
        stroke="#123B73"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconWorkload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="3" fill="#1769E8" opacity="0.12" />
      <rect x="3" y="4" width="18" height="16" rx="3" stroke="#1769E8" strokeWidth="1.6" />
      <path d="M3 9h18" stroke="#93C5FD" strokeWidth="1.4" />
      <rect x="6" y="11.5" width="3.2" height="5.5" rx="1" fill="#1769E8" />
      <rect x="10.4" y="13" width="3.2" height="4" rx="1" fill="#5B5CE2" />
      <rect x="14.8" y="10.5" width="3.2" height="6.5" rx="1" fill="#38BDF8" />
    </svg>
  )
}

function IconSmarter() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.2a6.2 6.2 0 0 0-3.5 11.3v2a1.5 1.5 0 0 0 1.5 1.5h4a1.5 1.5 0 0 0 1.5-1.5v-2A6.2 6.2 0 0 0 12 3.2z"
        fill="#7C3AED"
        opacity="0.14"
      />
      <path
        d="M12 3.2a6.2 6.2 0 0 0-3.5 11.3v2a1.5 1.5 0 0 0 1.5 1.5h4a1.5 1.5 0 0 0 1.5-1.5v-2A6.2 6.2 0 0 0 12 3.2z"
        stroke="#7C3AED"
        strokeWidth="1.55"
      />
      <path d="M9.6 20h4.8M10.4 21.6h3.2" stroke="#A78BFA" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M12 7.2l.85 1.8 2 .22-1.5 1.4.45 1.95L12 11.5l-1.8 1.07.45-1.95-1.5-1.4 2-.22L12 7.2z"
        fill="#7C3AED"
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
    title: 'Workload System',
    text: 'Manage work efficiently',
  },
  {
    Icon: IconSmarter,
    tone: 'tone-smart',
    title: 'Smarter Planning',
    text: 'For academic excellence',
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
        <div className="premium-welcome-top">
          <div className="premium-hero-copy">
            <p className="premium-welcome-kicker">AGENT 58</p>
            <h2>
              Welcome to <span>Faculty Workload</span> System
            </h2>
            <p className="premium-hero-sub">
              Smarter workload management for academic excellence
            </p>
          </div>

          <div className="premium-welcome-aside" aria-hidden>
            <LoginRobot className="login-robot--welcome" />
            <div className="premium-learn-board">
              <span>Learn</span>
              <span>Plan</span>
              <span>Achieve</span>
            </div>
          </div>
        </div>

        <ul className="premium-feature-list">
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
            className="premium-hero-cta"
            disabled={busy}
            onClick={() => onQuickEnter(key)}
          >
            {busy ? 'Opening…' : `Enter ${ROLE_CONFIGS[key].welcomeTitle} →`}
          </button>
        ) : null}
      </div>
    </div>
  )
}
