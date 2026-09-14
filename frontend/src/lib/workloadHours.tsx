/**
 * Centralized workload hours display helpers.
 * Required hours come from Excel designation norms (API: assignedHours / requiredHours / etc.).
 */

export type WorkloadHoursView = {
  assignedHours: number
  requiredHours: number
  remainingHours: number
  excessHours: number
  differenceLabel: string
  status: string
}

function num(v: unknown, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

/** Normalize any faculty/workload payload into Assigned / Required / Remaining display fields. */
export function workloadHoursFrom(row: any): WorkloadHoursView {
  const assigned = num(row?.assignedHours ?? row?.total ?? row?.teachingWeighted, 0)
  const required = num(
    row?.requiredHours ?? row?.normMin ?? row?.required ?? row?.prescribedMin,
    16,
  )
  const max = num(row?.prescribedMax ?? row?.normMax, required)
  const remaining = Math.max(0, Math.round((required - assigned) * 10) / 10)
  const excess = Math.max(0, Math.round((assigned - max) * 10) / 10)
  let status = String(row?.status || '').toUpperCase()
  if (!status || status === 'INDETERMINATE') {
    if (assigned < required) status = 'UNDERLOAD'
    else if (assigned > max) status = 'OVERLOAD'
    else status = 'NORMAL'
  }
  const differenceLabel =
    row?.differenceLabel ||
    (status === 'UNDERLOAD'
      ? `${remaining} hrs remaining`
      : status === 'OVERLOAD'
        ? `${excess} hrs excess`
        : '0 hrs remaining')
  return {
    assignedHours: Math.round(assigned * 10) / 10,
    requiredHours: required,
    remainingHours: remaining,
    excessHours: excess,
    differenceLabel,
    status,
  }
}

export function hoursLabel(n: number) {
  return `${n} hrs`
}

export function classTypeLabel(classType?: string | null, courseType?: string | null) {
  const raw = String(classType || '').toUpperCase()
  if (raw === 'L' || raw === 'LECTURE' || raw === 'THEORY') return 'L'
  if (raw === 'T' || raw === 'TUTORIAL') return 'T'
  if (raw === 'P' || raw === 'PRACTICAL' || raw === 'LAB' || raw === 'LABORATORY') return 'P'
  const ct = String(courseType || '').toUpperCase()
  if (ct === 'TUTORIAL') return 'T'
  if (ct === 'LABORATORY' || ct === 'LAB') return 'P'
  if (ct === 'THEORY' || ct === 'LECTURE') return 'L'
  return '—'
}

export function ClassTypeBadge({ type }: { type: string }) {
  const t = classTypeLabel(type)
  const cls =
    t === 'L' ? 'class-type-badge is-l' : t === 'T' ? 'class-type-badge is-t' : t === 'P' ? 'class-type-badge is-p' : 'class-type-badge'
  return <span className={cls}>{t}</span>
}
