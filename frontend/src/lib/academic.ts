import { sectionMatchesFilter } from './sections'

/** Academic structure for Years 2–4 (no 1st Year). */

export const ACADEMIC_YEARS = [2, 3, 4] as const
export type AcademicYear = (typeof ACADEMIC_YEARS)[number]

/** Odd/even semesters used in this workload system. */
export const ACADEMIC_SEMESTERS = [3, 4, 5, 6, 7, 8] as const

/** Sections available per year. */
export const SECTIONS_BY_YEAR: Record<AcademicYear, number> = {
  2: 22,
  3: 20,
  4: 19,
}

/** Max section count across years (for “All years” filters). */
export const MAX_SECTION = 22

export function yearLabel(y: string | number) {
  const n = Number(y)
  if (n === 2) return '2nd Year'
  if (n === 3) return '3rd Year'
  if (n === 4) return '4th Year'
  if (n === 1) return '1st Year'
  return `Year ${y}`
}

export function sectionsForYear(year: string | number | 'ALL' | null | undefined): string[] {
  if (year === 'ALL' || year == null || year === '') {
    return Array.from({ length: MAX_SECTION }, (_, i) => String(i + 1))
  }
  const y = Number(year) as AcademicYear
  const max = SECTIONS_BY_YEAR[y] || MAX_SECTION
  return Array.from({ length: max }, (_, i) => String(i + 1))
}

export function isSupportedAcademicYear(y: number) {
  return y === 2 || y === 3 || y === 4
}

/** Resolve programme year from course academicYear / semester. */
export function courseYear(c: {
  academicYear?: string | null
  semester?: number | null
  section?: string | null
}): number {
  const ay = String(c?.academicYear || '')
  if (ay === '1' || ay === '2' || ay === '3' || ay === '4') return Number(ay)
  const sem = Number(c?.semester || 0)
  if (sem === 1 || sem === 2) return 1
  if (sem === 3 || sem === 4) return 2
  if (sem === 5 || sem === 6) return 3
  if (sem === 7 || sem === 8) return 4
  return 0
}

/** Filter helper: Years 2–4, Semesters 3–8, section match. */
export function matchesAcademicFilters(
  row: { academicYear?: string | null; semester?: number | null; section?: string | null },
  filters: { year?: string; semester?: string; section?: string },
  sectionRaw?: string | null,
) {
  const y = courseYear(row)
  if (filters.year && filters.year !== 'ALL') {
    if (String(y) !== filters.year) return false
  } else if (y === 1) {
    return false
  }
  if (filters.semester && filters.semester !== 'ALL') {
    if (String(row.semester ?? '') !== filters.semester) return false
  } else {
    const sem = Number(row.semester || 0)
    if (sem > 0 && (sem < 3 || sem > 8)) return false
  }
  if (filters.section && filters.section !== 'ALL') {
    if (!sectionMatchesFilter(sectionRaw ?? row.section, filters.section)) return false
  }
  return true
}
