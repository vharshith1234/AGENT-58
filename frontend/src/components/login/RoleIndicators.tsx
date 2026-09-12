import { ROLE_INDICATORS, ROLE_CONFIGS, type AppRole } from '../../lib/roles'
import { IconBuilding, IconUser, IconUsers } from './icons'

const BADGE: Record<AppRole, string> = {
  HR: 'badge-hr',
  HOD: 'badge-hod',
  DEAN: 'badge-dean',
  PRINCIPAL: 'badge-principal',
  FACULTY: 'badge-faculty',
}

function RoleGlyph({ role }: { role: AppRole }) {
  if (role === 'PRINCIPAL') return <IconBuilding />
  if (role === 'HR' || role === 'FACULTY') return <IconUsers />
  return <IconUser />
}

/** Visual-only indicators — not interactive */
export function RoleIndicators() {
  return (
    <div className="role-indicators" aria-label="Supported roles">
      {ROLE_INDICATORS.map((role) => (
        <div key={role} className="role-indicator">
          <span className={`badge ${BADGE[role]}`} aria-hidden>
            <RoleGlyph role={role} />
          </span>
          <span className="caption">{ROLE_CONFIGS[role].label}</span>
        </div>
      ))}
    </div>
  )
}
