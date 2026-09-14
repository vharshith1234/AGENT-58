/**
 * Centralized designation → workload norm rules.
 * Source of truth: CSE Odd-2026 Faculty WL Excel ("Prescribed workload (h/week)").
 * Import this module anywhere norms/required hours are needed — do not hardcode bands elsewhere.
 *
 * Snapshot also kept at prisma/data/designation-workload-rules.json for inspection.
 */

export type DesignationWorkloadNorm = {
  min: number;
  expected: number;
  max: number;
};

export type DesignationWorkloadRule = DesignationWorkloadNorm & {
  cadre: string;
  prescribed: string;
  match: string[];
};

export const DESIGNATION_RULES_META = {
  sourceFile: 'prisma/data/cse-odd-2026/Workload-AY-2026-27-I-Sem.xlsx',
  sourceSheet: 'Faculty WL',
  sourceColumn: 'Prescribed workload (h/week)',
} as const;

/**
 * Cadre norms derived from Excel Faculty WL.
 * CAP uses the modal prescribed value (12) when Excel rows disagree.
 */
export const DESIGNATION_WORKLOAD_RULES: DesignationWorkloadRule[] = [
  {
    cadre: 'Professor',
    prescribed: '6-8',
    min: 6,
    expected: 7,
    max: 8,
    match: ['\\bprofessor\\b', '\\bprof\\.?\\b'],
  },
  {
    cadre: 'Associate Professor',
    prescribed: '12-14',
    min: 12,
    expected: 13,
    max: 14,
    match: ['assoc(?:iate)?\\.?\\s*prof'],
  },
  {
    cadre: 'Senior Assistant Professor',
    prescribed: '16-18',
    min: 16,
    expected: 17,
    max: 18,
    match: ['sr\\.?\\s*asst', 'senior\\s*(?:level\\s*)?(?:asst|assistant)'],
  },
  {
    cadre: 'Assistant Professor',
    prescribed: '16-18',
    min: 16,
    expected: 17,
    max: 18,
    match: ['asst\\.?\\s*prof', 'assistant\\s*professor'],
  },
  {
    cadre: 'CAP',
    prescribed: '12',
    min: 12,
    expected: 12,
    max: 12,
    match: ['\\bcap\\b', 'contractual\\s*assistant'],
  },
  {
    cadre: 'Teaching Associate',
    prescribed: '16-18',
    min: 16,
    expected: 17,
    max: 18,
    match: ['teaching\\s*associate'],
  },
  {
    cadre: 'Teaching Assistant',
    prescribed: '16-18',
    min: 16,
    expected: 17,
    max: 18,
    match: ['teaching\\s*assistant'],
  },
];

export const DEFAULT_DESIGNATION_NORM: DesignationWorkloadNorm & {
  cadre: string;
  prescribed: string;
} = {
  cadre: 'Default',
  prescribed: '16-18',
  min: 16,
  expected: 17,
  max: 18,
};

/** Parse Excel prescribed bands like "16-18", "6–8", or a single hour "12". */
export function parsePrescribedBand(
  prescribed: string | number | null | undefined,
): DesignationWorkloadNorm | null {
  if (prescribed == null || prescribed === '') return null;
  const raw = String(prescribed).trim();
  const range = raw.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) return null;
    // Guard against Excel date serials mistaken for hours.
    if (max > 80) return null;
    const expected = Math.round(((min + max) / 2) * 10) / 10;
    return { min, expected, max };
  }
  const single = raw.match(/^(\d+(?:\.\d+)?)$/);
  if (single) {
    const n = Number(single[1]);
    if (!Number.isFinite(n) || n <= 0 || n > 80) return null;
    return { min: n, expected: n, max: n };
  }
  return null;
}

const MATCHERS = DESIGNATION_WORKLOAD_RULES.map((rule) => ({
  rule,
  patterns: rule.match.map((p) => new RegExp(p, 'i')),
}));

/** Resolve Excel cadre label from a free-text faculty designation. */
export function resolveCadre(designation?: string | null): string | null {
  const text = String(designation || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;

  // Prefer more specific cadres first.
  const order = [
    'Teaching Associate',
    'Teaching Assistant',
    'Senior Assistant Professor',
    'Associate Professor',
    'Assistant Professor',
    'CAP',
    'Professor',
  ];
  const byCadre = new Map(MATCHERS.map((m) => [m.rule.cadre, m]));
  for (const cadre of order) {
    const entry = byCadre.get(cadre);
    if (!entry) continue;
    if (entry.patterns.some((re) => re.test(text))) return cadre;
  }
  return null;
}

export function listDesignationWorkloadRules(): DesignationWorkloadRule[] {
  return DESIGNATION_WORKLOAD_RULES.map((r) => ({ ...r, match: [...r.match] }));
}

export function getDefaultDesignationNorm(): DesignationWorkloadNorm {
  return {
    min: DEFAULT_DESIGNATION_NORM.min,
    expected: DEFAULT_DESIGNATION_NORM.expected,
    max: DEFAULT_DESIGNATION_NORM.max,
  };
}

/**
 * Required / prescribed norm for a faculty designation.
 * Returns null only when designation is empty — callers may fall back to DB department norms.
 */
export function getNormForDesignation(
  designation?: string | null,
):
  | (DesignationWorkloadNorm & {
      cadre: string;
      prescribed: string;
      requiredHours: number;
    })
  | null {
  const text = String(designation || '').trim();
  if (!text) return null;

  const cadre = resolveCadre(text);
  const rule =
    (cadre && DESIGNATION_WORKLOAD_RULES.find((r) => r.cadre === cadre)) ||
    DEFAULT_DESIGNATION_NORM;

  return {
    cadre: rule.cadre,
    prescribed: rule.prescribed,
    min: rule.min,
    expected: rule.expected,
    max: rule.max,
    /** Single "required hours" figure used in UI (Excel band floor / prescribed target). */
    requiredHours: rule.min,
  };
}

/** Map allocation class type letters to engine course types. */
export function mapClassType(
  classType?: string | null,
): 'THEORY' | 'TUTORIAL' | 'LABORATORY' | null {
  const t = String(classType || '')
    .trim()
    .toUpperCase();
  if (t === 'L' || t === 'LECTURE' || t === 'THEORY') return 'THEORY';
  if (t === 'T' || t === 'TUTORIAL') return 'TUTORIAL';
  if (t === 'P' || t === 'PRACTICAL' || t === 'LAB' || t === 'LABORATORY') {
    return 'LABORATORY';
  }
  return null;
}

export function normalizeClassType(
  classType?: string | null,
): 'L' | 'T' | 'P' | null {
  const mapped = mapClassType(classType);
  if (mapped === 'THEORY') return 'L';
  if (mapped === 'TUTORIAL') return 'T';
  if (mapped === 'LABORATORY') return 'P';
  return null;
}

/** UI-facing hours summary — Required = Excel band floor (min). */
export function summarizeWorkloadHours(opts: {
  assigned: number;
  min: number;
  max: number;
  status?: string | null;
}) {
  const assigned = Number(opts.assigned) || 0;
  const min = Number(opts.min) || 0;
  const max = Number(opts.max) || min;
  const required = min;
  const remaining = Math.max(0, Math.round((required - assigned) * 10) / 10);
  const excess = Math.max(0, Math.round((assigned - max) * 10) / 10);
  let status = String(opts.status || '').toUpperCase();
  if (!status || status === 'INDETERMINATE') {
    if (assigned < min) status = 'UNDERLOAD';
    else if (assigned > max) status = 'OVERLOAD';
    else status = 'NORMAL';
  }
  const differenceLabel =
    status === 'UNDERLOAD'
      ? `${remaining} hrs remaining`
      : status === 'OVERLOAD'
        ? `${excess} hrs excess`
        : '0 hrs remaining';
  return {
    assignedHours: Math.round(assigned * 10) / 10,
    requiredHours: required,
    remainingHours: remaining,
    excessHours: excess,
    differenceLabel,
    prescribedMax: max,
    status,
  };
}
