/** Fixed section choices: All + 1–19. */
export const SECTION_CHOICES = Array.from({ length: 19 }, (_, i) => String(i + 1))

/** Split stored section values like "1,10" or "1/3/8" into individual tokens. */
export function sectionTokens(raw: string | null | undefined): string[] {
  return String(raw || '')
    .split(/[,;/|]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** True when filter is ALL, or the row section equals / contains that section number. */
export function sectionMatchesFilter(raw: string | null | undefined, filter: string) {
  if (!filter || filter === 'ALL') return true
  const tokens = sectionTokens(raw)
  if (tokens.includes(filter)) return true
  return String(raw || '').trim() === filter
}

export function formatSectionDisplay(raw: string | null | undefined) {
  const s = String(raw || '').trim()
  if (!s) return '—'
  const tokens = sectionTokens(s)
  if (tokens.length === 1 && /^\d+$/.test(tokens[0])) return `Section ${tokens[0]}`
  if (tokens.length > 1) return tokens.join(', ')
  return s
}
