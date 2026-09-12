/**
 * Pure deterministic workload calculation — no I/O, no LLM.
 * Weights and norms are always supplied by the caller (from DB).
 */

export type ActivityType =
  | 'THEORY'
  | 'TUTORIAL'
  | 'LAB'
  | 'UG_PROJECT'
  | 'PG_PROJECT'
  | 'PHD'
  | 'COMMITTEE'
  | 'ADMIN_ROLE'
  | 'RESEARCH';

export type WorkloadStatus =
  | 'UNDERLOAD'
  | 'NORMAL'
  | 'OVERLOAD'
  | 'INDETERMINATE';

export interface PolicyWeight {
  activityType: ActivityType;
  weight: number;
}

export interface WorkloadNormInput {
  min: number;
  expected: number;
  max: number;
}

export interface TimetableSlotInput {
  contactType: 'THEORY' | 'TUTORIAL' | 'LAB';
  durationHrs: number;
}

export interface AllocationInput {
  hours: number;
  courseType: 'THEORY' | 'TUTORIAL' | 'LABORATORY' | 'PROJECT';
}

export interface ProjectInput {
  level: 'UG' | 'PG';
  studentCount: number;
  share: number; // 0–1
}

export interface PhdInput {
  scholarCount: number;
  share: number;
}

export interface CommitteeInput {
  role: string; // CHAIR | MEMBER | ...
}

export interface ResearchInput {
  commitmentPct: number;
}

export interface AdminInput {
  roleName: string;
  weightOverride?: number | null;
}

export interface FacultyWorkloadInput {
  facultyId: string;
  timetableSlots: TimetableSlotInput[];
  allocations: AllocationInput[];
  projects: ProjectInput[];
  phd: PhdInput[];
  committees: CommitteeInput[];
  research: ResearchInput[];
  admin: AdminInput[];
  policies: PolicyWeight[];
  norm: WorkloadNormInput | null;
}

export interface WorkloadBreakdown {
  facultyId: string;
  theoryRaw: number;
  tutorialRaw: number;
  labRaw: number;
  teachingRaw: number;
  projectsRaw: number;
  researchRaw: number;
  adminRaw: number;
  committeeRaw: number;
  phdRaw: number;
  theoryWeighted: number;
  tutorialWeighted: number;
  labWeighted: number;
  teachingWeighted: number;
  projectsWeighted: number;
  ugProjectsWeighted: number;
  pgProjectsWeighted: number;
  researchWeighted: number;
  adminWeighted: number;
  committeeWeighted: number;
  phdWeighted: number;
  total: number;
  status: WorkloadStatus;
  provisionalTeaching: boolean;
  normMin: number;
  normExpected: number;
  normMax: number;
  percentOfNorm: number;
  evidence: Record<string, unknown>;
}

function weightMap(policies: PolicyWeight[]): Map<ActivityType, number> {
  const m = new Map<ActivityType, number>();
  for (const p of policies) m.set(p.activityType, p.weight);
  return m;
}

function w(map: Map<ActivityType, number>, type: ActivityType): number {
  const v = map.get(type);
  if (v === undefined) {
    throw new Error(`Missing policy weight for activity type: ${type}`);
  }
  return v;
}

function statusFromNorm(
  total: number,
  norm: WorkloadNormInput | null,
): { status: WorkloadStatus; min: number; expected: number; max: number } {
  if (!norm) {
    return { status: 'INDETERMINATE', min: 0, expected: 0, max: 0 };
  }
  if (total < norm.min) return { status: 'UNDERLOAD', ...norm };
  if (total > norm.max) return { status: 'OVERLOAD', ...norm };
  return { status: 'NORMAL', ...norm };
}

function activityFromCourse(
  type: AllocationInput['courseType'],
): ActivityType | null {
  if (type === 'LABORATORY') return 'LAB';
  if (type === 'TUTORIAL') return 'TUTORIAL';
  if (type === 'THEORY') return 'THEORY';
  return null;
}

/**
 * Official teaching load comes from Course Allocation only.
 * Timetable hours are schedule/validation evidence and are never added on top.
 */
export function calculateTeaching(
  slots: TimetableSlotInput[],
  allocations: AllocationInput[],
  weights: Map<ActivityType, number>,
): {
  theoryRaw: number;
  tutorialRaw: number;
  labRaw: number;
  raw: number;
  theoryWeighted: number;
  tutorialWeighted: number;
  labWeighted: number;
  weighted: number;
  provisional: boolean;
  evidence: unknown;
} {
  let theoryRaw = 0;
  let tutorialRaw = 0;
  let labRaw = 0;
  let theoryWeighted = 0;
  let tutorialWeighted = 0;
  let labWeighted = 0;

  const detail = allocations
    .map((a) => {
      const type = activityFromCourse(a.courseType);
      if (!type) return null;
      const wt = w(weights, type);
      const weighted = a.hours * wt;
      if (type === 'THEORY') {
        theoryRaw += a.hours;
        theoryWeighted += weighted;
      } else if (type === 'TUTORIAL') {
        tutorialRaw += a.hours;
        tutorialWeighted += weighted;
      } else {
        labRaw += a.hours;
        labWeighted += weighted;
      }
      return { courseType: a.courseType, hours: a.hours, weight: wt, weighted };
    })
    .filter(Boolean);

  const scheduledHours = slots.reduce((s, slot) => s + slot.durationHrs, 0);

  return {
    theoryRaw,
    tutorialRaw,
    labRaw,
    raw: theoryRaw + tutorialRaw + labRaw,
    theoryWeighted,
    tutorialWeighted,
    labWeighted,
    weighted: theoryWeighted + tutorialWeighted + labWeighted,
    provisional: false,
    evidence: {
      source: 'allocation',
      detail,
      timetableValidation: {
        slotCount: slots.length,
        scheduledHours,
        note: 'Timetable is schedule only and is not added to teaching workload.',
      },
    },
  };
}

export function calculateWorkload(input: FacultyWorkloadInput): WorkloadBreakdown {
  const weights = weightMap(input.policies);

  const teaching = calculateTeaching(
    input.timetableSlots,
    input.allocations,
    weights,
  );

  let projectsRaw = 0;
  let projectsWeighted = 0;
  let ugProjectsWeighted = 0;
  let pgProjectsWeighted = 0;
  const projectDetail = input.projects.map((p) => {
    const type: ActivityType = p.level === 'PG' ? 'PG_PROJECT' : 'UG_PROJECT';
    const wt = w(weights, type);
    const raw = p.studentCount * p.share;
    const weighted = raw * wt;
    projectsRaw += raw;
    projectsWeighted += weighted;
    if (p.level === 'PG') pgProjectsWeighted += weighted;
    else ugProjectsWeighted += weighted;
    return { level: p.level, studentCount: p.studentCount, share: p.share, weight: wt, raw, weighted };
  });

  let phdRaw = 0;
  let phdWeighted = 0;
  const phdDetail = input.phd.map((p) => {
    const wt = w(weights, 'PHD');
    const raw = p.scholarCount * p.share;
    phdRaw += raw;
    phdWeighted += raw * wt;
    return { scholarCount: p.scholarCount, share: p.share, weight: wt, raw };
  });

  let committeeRaw = 0;
  let committeeWeighted = 0;
  const committeeDetail = input.committees.map((c) => {
    const wt = w(weights, 'COMMITTEE');
    const roleFactor = c.role.toUpperCase().includes('CHAIR') ? 1.5 : 1;
    const raw = roleFactor;
    committeeRaw += raw;
    committeeWeighted += raw * wt;
    return { role: c.role, roleFactor, weight: wt, raw };
  });

  let researchRaw = 0;
  let researchWeighted = 0;
  const researchDetail = input.research.map((r) => {
    const wt = w(weights, 'RESEARCH');
    const raw = r.commitmentPct / 100;
    researchRaw += raw;
    researchWeighted += raw * wt;
    return { commitmentPct: r.commitmentPct, weight: wt, raw };
  });

  let adminRaw = 0;
  let adminWeighted = 0;
  const adminDetail = input.admin.map((a) => {
    const base = w(weights, 'ADMIN_ROLE');
    const wt = a.weightOverride != null ? a.weightOverride : base;
    const raw = 1;
    adminRaw += raw;
    adminWeighted += raw * wt;
    return { roleName: a.roleName, weight: wt, raw };
  });

  const total =
    teaching.weighted +
    projectsWeighted +
    phdWeighted +
    committeeWeighted +
    researchWeighted +
    adminWeighted;

  const normed = statusFromNorm(total, input.norm);

  return {
    facultyId: input.facultyId,
    theoryRaw: teaching.theoryRaw,
    tutorialRaw: teaching.tutorialRaw,
    labRaw: teaching.labRaw,
    teachingRaw: teaching.raw,
    projectsRaw,
    researchRaw,
    adminRaw,
    committeeRaw,
    phdRaw,
    theoryWeighted: teaching.theoryWeighted,
    tutorialWeighted: teaching.tutorialWeighted,
    labWeighted: teaching.labWeighted,
    teachingWeighted: teaching.weighted,
    projectsWeighted,
    ugProjectsWeighted,
    pgProjectsWeighted,
    researchWeighted,
    adminWeighted,
    committeeWeighted,
    phdWeighted,
    total,
    status: normed.status,
    provisionalTeaching: teaching.provisional,
    normMin: normed.min,
    normExpected: normed.expected,
    normMax: normed.max,
    percentOfNorm: normed.expected > 0 ? Math.round((total / normed.expected) * 1000) / 10 : 0,
    evidence: {
      teaching: teaching.evidence,
      projects: projectDetail,
      phd: phdDetail,
      committees: committeeDetail,
      research: researchDetail,
      admin: adminDetail,
    },
  };
}

export interface ReallocationMove {
  fromFacultyId: string;
  toFacultyId: string;
  hours: number;
  label?: string;
}

/** Side-effect-free what-if: apply hypothetical moves to teaching raw then recompute with same weights. */
export function simulate(
  base: FacultyWorkloadInput,
  overrides: Partial<
    Pick<
      FacultyWorkloadInput,
      | 'timetableSlots'
      | 'allocations'
      | 'projects'
      | 'phd'
      | 'committees'
      | 'research'
      | 'admin'
    >
  >,
): WorkloadBreakdown {
  return calculateWorkload({ ...base, ...overrides });
}

export function findAlternatives(
  overloaded: WorkloadBreakdown,
  candidates: WorkloadBreakdown[],
  extraHours?: number,
  maxSuggestions = 8,
): Array<{
  targetFacultyId: string;
  current: number;
  capacity: number;
  projected: number;
  suggestedHours: number;
  suitable: boolean;
  reason: string;
}> {
  const extra =
    extraHours ??
    Math.max(0, overloaded.total - overloaded.normMax);
  if (extra <= 0 && overloaded.status !== 'OVERLOAD') return [];

  return candidates
    .filter((u) => u.facultyId !== overloaded.facultyId)
    .map((u) => {
      const capacity = Math.max(0, Math.round((u.normMax - u.total) * 10) / 10);
      const suggestedHours = Math.min(extra || 0, capacity);
      const projected = Math.round((u.total + (extra || 0)) * 10) / 10;
      const suitable = capacity >= (extra || 0) && projected <= u.normMax;
      return {
        targetFacultyId: u.facultyId,
        current: u.total,
        capacity,
        projected,
        suggestedHours: Math.round(suggestedHours * 10) / 10,
        suitable,
        reason: suitable
          ? `Current ${u.total.toFixed(1)}, capacity ${capacity.toFixed(1)}, projected ${projected.toFixed(1)} — suitable`
          : `Current ${u.total.toFixed(1)}, capacity ${capacity.toFixed(1)} — not suitable for +${(extra || 0).toFixed(1)}`,
      };
    })
    .sort((a, b) => Number(b.suitable) - Number(a.suitable) || b.capacity - a.capacity)
    .slice(0, maxSuggestions);
}

export function getBalanceSuggestions(
  snapshots: WorkloadBreakdown[],
): Array<{
  fromFacultyId: string;
  toFacultyId: string;
  suggestedHours: number;
  reason: string;
}> {
  const over = snapshots.filter((s) => s.status === 'OVERLOAD');
  const receivers = snapshots.filter(
    (s) => s.status !== 'OVERLOAD' && s.normMax - s.total > 0,
  );
  const out: Array<{
    fromFacultyId: string;
    toFacultyId: string;
    suggestedHours: number;
    reason: string;
  }> = [];

  for (const o of over) {
    const excess = o.total - o.normMax;
    for (const u of receivers) {
      const capacity = Math.max(0, u.normMax - u.total);
      const suggestedHours = Math.round(Math.min(excess, capacity) * 10) / 10;
      if (suggestedHours <= 0) continue;
      out.push({
        fromFacultyId: o.facultyId,
        toFacultyId: u.facultyId,
        suggestedHours,
        reason: `Move ${suggestedHours}h from overloaded faculty toward available capacity ${capacity.toFixed(1)}`,
      });
    }
  }
  return out;
}

/** Apply allocation-hour moves in memory (caller persists). */
export function applyReallocation(
  inputs: FacultyWorkloadInput[],
  moves: ReallocationMove[],
): FacultyWorkloadInput[] {
  const clone = inputs.map((i) => ({
    ...i,
    allocations: i.allocations.map((a) => ({ ...a })),
  }));
  const byId = new Map(clone.map((c) => [c.facultyId, c]));

  for (const move of moves) {
    const from = byId.get(move.fromFacultyId);
    const to = byId.get(move.toFacultyId);
    if (!from || !to) continue;

    let remaining = move.hours;
    for (const alloc of from.allocations) {
      if (remaining <= 0) break;
      const take = Math.min(alloc.hours, remaining);
      alloc.hours -= take;
      remaining -= take;
      to.allocations.push({ hours: take, courseType: alloc.courseType });
    }
  }

  return clone;
}
