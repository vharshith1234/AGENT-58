import { ROLE_CONFIGS, type AppRole } from '../../lib/roles'
import { quickLoginPortal } from '../../lib/demoLogins'

const WELCOME: Record<'HR' | 'HOD' | 'DEAN' | 'FACULTY', { title: string; lines: string[] }> = {
  HR: {
    title: 'HR Login',
    lines: [
      'Workload control & administration',
      'Manage faculty, courses, assignments and requests',
    ],
  },
  HOD: {
    title: 'HOD Login',
    lines: [
      'Department monitoring',
      'View CSE workload, courses and requests',
    ],
  },
  DEAN: {
    title: 'Dean Login',
    lines: [
      'Institution monitoring',
      'Review departments, approvals and requests',
    ],
  },
  FACULTY: {
    title: 'Faculty Login',
    lines: [
      'Faculty Workload System',
      'Smarter workload management for academic excellence',
    ],
  },
}

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
  const copy = WELCOME[key]
  return (
    <div className={`welcome-section faculty welcome-${key.toLowerCase()}`}>
      <h2 className="slide-element">WELCOME BACK!</h2>
      <p className="slide-element">{copy.title}</p>
      {copy.lines.map((line) => (
        <p key={line} className="slide-element">
          {line}
        </p>
      ))}
      {onQuickEnter ? (
        <button
          type="button"
          className="slide-element welcome-role-hint welcome-quick-link"
          disabled={busy}
          onClick={() => onQuickEnter(key)}
        >
          {busy ? 'Opening…' : `Enter ${ROLE_CONFIGS[key].welcomeTitle} →`}
        </button>
      ) : (
        <p className="slide-element welcome-role-hint">{ROLE_CONFIGS[key].welcomeTitle}</p>
      )}
    </div>
  )
}
