import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { cached, invalidateCache } from '../common/fast-cache';
import { PrismaService } from '../prisma/prisma.service';
import {
  getNormForDesignation,
  mapClassType,
  summarizeWorkloadHours,
} from './designation-workload-rules';
import {
  applyReallocation,
  calculateWorkload,
  findAlternatives,
  getBalanceSuggestions,
  simulate,
  type AllocationInput,
  type FacultyWorkloadInput,
  type PolicyWeight,
  type ReallocationMove,
  type WorkloadBreakdown,
} from './workload.engine';

function mapCourseType(
  type: string,
): 'THEORY' | 'TUTORIAL' | 'LABORATORY' | 'PROJECT' {
  const t = (type || '').toUpperCase();
  if (t === 'TUTORIAL') return 'TUTORIAL';
  if (t === 'LABORATORY' || t === 'LAB') return 'LABORATORY';
  if (t === 'PROJECT') return 'PROJECT';
  return 'THEORY';
}

function allocationCourseType(a: {
  classType?: string | null;
  course?: { type?: string | null } | null;
}): AllocationInput['courseType'] {
  return mapClassType(a.classType) || mapCourseType(a.course?.type || 'THEORY');
}

/** DEMO / non-bearing activity never enters the engine. */
function isWorkloadBearingRecord(row: Record<string, unknown>) {
  if (row.workloadBearing === false) return false;
  if (String(row.dataSource || 'REAL').toUpperCase() === 'DEMO') return false;
  return true;
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const out: R[] = new Array(items.length);
  let next = 0;
  const workerCount = Math.min(Math.max(1, limit), items.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

@Injectable()
export class WorkloadService {
  constructor(private prisma: PrismaService) {}

  teachingFacultyWhere(departmentId?: string, dataSource?: string) {
    return {
      ...(departmentId ? { departmentId } : {}),
      ...(dataSource ? { dataSource } : {}),
      status: { notIn: ['Inactive', 'INACTIVE', 'Suspended'] },
      OR: [{ user: { is: null } }, { user: { role: { in: ['FACULTY'] } } }],
    };
  }

  async getActivePolicies(): Promise<PolicyWeight[]> {
    const rows = await this.prisma.workloadPolicy.findMany({
      where: { isActive: true },
      orderBy: { effectiveFrom: 'desc' },
    });
    const seen = new Set<string>();
    const out: PolicyWeight[] = [];
    for (const r of rows) {
      if (seen.has(r.activityType)) continue;
      seen.add(r.activityType);
      out.push({
        activityType: r.activityType as PolicyWeight['activityType'],
        weight: r.weight,
      });
    }
    return out;
  }

  async getNormForDepartment(departmentId: string) {
    const period = await this.prisma.academicPeriod.findFirst({
      where: { isActive: true },
    });
    const year = period?.code || undefined;
    const scoped = year
      ? await this.prisma.workloadNorm.findFirst({
          where: { departmentId, isActive: true, academicYear: year },
          orderBy: { effectiveFrom: 'desc' },
        })
      : null;
    if (scoped) return { min: scoped.min, expected: scoped.expected, max: scoped.max };
    const dept = await this.prisma.workloadNorm.findFirst({
      where: { departmentId, isActive: true },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (dept) return { min: dept.min, expected: dept.expected, max: dept.max };
    const globalYear = year
      ? await this.prisma.workloadNorm.findFirst({
          where: { departmentId: null, isActive: true, academicYear: year },
          orderBy: { effectiveFrom: 'desc' },
        })
      : null;
    if (globalYear) {
      return { min: globalYear.min, expected: globalYear.expected, max: globalYear.max };
    }
    const global = await this.prisma.workloadNorm.findFirst({
      where: { departmentId: null, isActive: true },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!global) return null;
    return { min: global.min, expected: global.expected, max: global.max };
  }

  /**
   * Resolve min/expected/max for a faculty member.
   * Excel designation rules win; department/global DB norms are fallback only.
   */
  async getNorm(opts: {
    departmentId: string;
    designation?: string | null;
  }) {
    const fromDesignation = getNormForDesignation(opts.designation);
    if (fromDesignation) {
      return {
        min: fromDesignation.min,
        expected: fromDesignation.expected,
        max: fromDesignation.max,
        requiredHours: fromDesignation.requiredHours,
        cadre: fromDesignation.cadre,
        prescribed: fromDesignation.prescribed,
        source: 'designation-excel' as const,
      };
    }
    const dept = await this.getNormForDepartment(opts.departmentId);
    if (!dept) return null;
    return {
      ...dept,
      requiredHours: dept.expected,
      cadre: null as string | null,
      prescribed: null as string | null,
      source: 'department-db' as const,
    };
  }

  async buildInput(facultyId: string): Promise<FacultyWorkloadInput> {
    const faculty = await this.prisma.faculty.findUnique({
      where: { id: facultyId },
      include: {
        allocations: { include: { course: true } },
        timetableSlots: true,
        projectsGuide: true,
        projectsCoGuide: true,
        phdSupervisions: true,
        committeeMemberships: true,
        research: true,
        adminRoles: true,
      },
    });
    if (!faculty) throw new NotFoundException('Faculty not found');

    const policies = await this.getActivePolicies();
    const resolved = await this.getNorm({
      departmentId: faculty.departmentId,
      designation: faculty.designation,
    });
    const norm = resolved
      ? { min: resolved.min, expected: resolved.expected, max: resolved.max }
      : null;

    const demoFaculty = faculty.dataSource === 'DEMO';
    const slots = faculty.timetableSlots.filter((s) =>
      demoFaculty ? s.dataSource === 'DEMO' : s.dataSource !== 'DEMO',
    );
    const allocs = faculty.allocations.filter((a) =>
      demoFaculty ? a.dataSource === 'DEMO' : a.dataSource !== 'DEMO',
    );

    return {
      facultyId: faculty.id,
      timetableSlots: slots.map((s) => ({
        contactType: s.contactType as 'THEORY' | 'TUTORIAL' | 'LAB',
        durationHrs: s.durationHrs,
      })),
      allocations: allocs.map((a) => ({
        hours: a.hours,
        courseType: allocationCourseType(a),
      })),
      projects: [
        ...faculty.projectsGuide
          .filter((p) => isWorkloadBearingRecord(p as unknown as Record<string, unknown>))
          .map((p) => ({
          level: (p.level === 'PG' ? 'PG' : 'UG') as 'UG' | 'PG',
          studentCount: p.studentCount,
          share: p.guideShare,
        })),
        ...faculty.projectsCoGuide
          .filter((p) => isWorkloadBearingRecord(p as unknown as Record<string, unknown>))
          .map((p) => ({
          level: (p.level === 'PG' ? 'PG' : 'UG') as 'UG' | 'PG',
          studentCount: p.studentCount,
          share: Math.max(0, 1 - (p.guideShare || 0.7)),
        })),
      ],
      phd: faculty.phdSupervisions.map((p) => ({
        scholarCount: p.scholarCount,
        share: p.share,
      })),
      committees: faculty.committeeMemberships.map((c) => ({ role: c.role })),
      research: faculty.research
        .filter((r) => isWorkloadBearingRecord(r as unknown as Record<string, unknown>))
        .map((r) => ({
        commitmentPct: r.commitmentPct,
      })),
      admin: faculty.adminRoles.map((a) => ({
        roleName: a.roleName,
        weightOverride: a.weightOverride,
      })),
      policies,
      norm,
    };
  }

  async calculateWorkload(facultyId: string): Promise<WorkloadBreakdown> {
    const input = await this.buildInput(facultyId);
    return calculateWorkload(input);
  }

  async getCachedWorkload(facultyId: string): Promise<WorkloadBreakdown> {
    const period = await this.prisma.academicPeriod.findFirst({
      where: { isActive: true },
    });
    const byId = await this.ensureBreakdowns([facultyId], period?.id);
    return byId.get(facultyId) ?? this.calculateWorkload(facultyId);
  }

  async recalculateAndPersist(facultyId: string, periodId?: string) {
    const period =
      (periodId
        ? await this.prisma.academicPeriod.findUnique({ where: { id: periodId } })
        : null) ||
      (await this.prisma.academicPeriod.findFirst({ where: { isActive: true } }));
    if (!period) throw new NotFoundException('No academic period');

    const result = await this.calculateWorkload(facultyId);
    const snap = await this.persistBreakdown(facultyId, result, period.id);
    const faculty = await this.prisma.faculty.findUnique({
      where: { id: facultyId },
      select: { departmentId: true },
    });
    this.invalidateWorkloadCaches(faculty?.departmentId);
    return snap;
  }

  private async persistBreakdown(
    facultyId: string,
    result: WorkloadBreakdown,
    periodId: string,
  ) {
    const faculty = await this.prisma.faculty.findUnique({
      where: { id: facultyId },
      select: { dataSource: true },
    });
    return this.prisma.workloadSnapshot.create({
      data: {
        facultyId,
        periodId,
        teachingRaw: result.teachingRaw,
        projectsRaw: result.projectsRaw,
        researchRaw: result.researchRaw,
        adminRaw: result.adminRaw,
        committeeRaw: result.committeeRaw,
        phdRaw: result.phdRaw,
        teachingWeighted: result.teachingWeighted,
        projectsWeighted: result.projectsWeighted,
        researchWeighted: result.researchWeighted,
        adminWeighted: result.adminWeighted,
        committeeWeighted: result.committeeWeighted,
        phdWeighted: result.phdWeighted,
        total: result.total,
        status: result.status,
        provisionalTeaching: result.provisionalTeaching,
        normMin: result.normMin,
        normExpected: result.normExpected,
        normMax: result.normMax,
        dataSource: faculty?.dataSource || 'REAL',
        evidenceJson: JSON.stringify({ ...result.evidence, breakdown: result }),
      },
    });
  }

  async recalculateDepartment(departmentId: string) {
    const faculty = await this.prisma.faculty.findMany({
      where: this.teachingFacultyWhere(departmentId),
      select: { id: true },
    });
    return mapLimit(faculty, 6, (f) => this.recalculateAndPersist(f.id));
  }

  async simulateFaculty(
    facultyId: string,
    overrides: Partial<FacultyWorkloadInput>,
  ) {
    const input = await this.buildInput(facultyId);
    return simulate(input, overrides);
  }

  async simulateProposal(
    facultyId: string,
    body: {
      activityType?: string;
      additionalHours?: number;
      courseType?: AllocationInput['courseType'];
    },
  ) {
    const input = await this.buildInput(facultyId);
    const current = calculateWorkload(input);
    const extra = Number(body.additionalHours || 0);
    const courseType = mapCourseType(body.courseType || body.activityType || 'THEORY');
    const projected = simulate(input, {
      allocations: [...input.allocations, { hours: extra, courseType }],
    });

    const faculty = await this.prisma.faculty.findUnique({
      where: { id: facultyId },
    });
    const peers = faculty
      ? await this.getDepartmentBalance(faculty.departmentId)
      : { faculty: [] as Array<WorkloadBreakdown & { facultyId: string }> };
    const alternatives =
      projected.status === 'OVERLOAD'
        ? findAlternatives(
            projected,
            peers.faculty.filter((f) => f.facultyId !== facultyId),
            extra,
          )
        : [];

    return {
      current,
      additional: extra,
      projected,
      maximum: current.normMax,
      status: projected.status,
      alternatives: alternatives.map((a) => {
        const meta = peers.faculty.find((f) => f.facultyId === a.targetFacultyId);
        return {
          ...a,
          name: (meta as { name?: string } | undefined)?.name,
          facultyCode: (meta as { facultyCode?: string } | undefined)?.facultyCode,
        };
      }),
    };
  }

  private breakdownFromSnapshot(
    snap: { evidenceJson: string | null; facultyId: string; total: number; status: string; teachingWeighted: number; projectsWeighted: number; researchWeighted: number; adminWeighted: number; committeeWeighted: number; phdWeighted: number; teachingRaw: number; projectsRaw: number; researchRaw: number; adminRaw: number; committeeRaw: number; phdRaw: number; provisionalTeaching: boolean; normMin: number; normExpected: number; normMax: number },
  ): WorkloadBreakdown | null {
    if (!snap.evidenceJson) return null;
    try {
      const parsed = JSON.parse(snap.evidenceJson);
      const b = parsed?.breakdown;
      if (b && typeof b.total === 'number' && b.facultyId) {
        return b as WorkloadBreakdown;
      }
    } catch {
      /* ignore */
    }
    return {
      facultyId: snap.facultyId,
      theoryRaw: 0,
      tutorialRaw: 0,
      labRaw: 0,
      teachingRaw: snap.teachingRaw,
      projectsRaw: snap.projectsRaw,
      researchRaw: snap.researchRaw,
      adminRaw: snap.adminRaw,
      committeeRaw: snap.committeeRaw,
      phdRaw: snap.phdRaw,
      theoryWeighted: 0,
      tutorialWeighted: 0,
      labWeighted: 0,
      teachingWeighted: snap.teachingWeighted,
      projectsWeighted: snap.projectsWeighted,
      ugProjectsWeighted: 0,
      pgProjectsWeighted: 0,
      researchWeighted: snap.researchWeighted,
      adminWeighted: snap.adminWeighted,
      committeeWeighted: snap.committeeWeighted,
      phdWeighted: snap.phdWeighted,
      total: snap.total,
      status: snap.status as WorkloadBreakdown['status'],
      provisionalTeaching: snap.provisionalTeaching,
      normMin: snap.normMin,
      normExpected: snap.normExpected,
      normMax: snap.normMax,
      percentOfNorm: snap.normExpected ? Math.round((snap.total / snap.normExpected) * 1000) / 10 : 0,
      evidence: {},
    };
  }

  private async ensureBreakdowns(
    facultyIds: string[],
    periodId?: string,
    opts?: { computeMissing?: boolean },
  ): Promise<Map<string, WorkloadBreakdown>> {
    const byId = new Map<string, WorkloadBreakdown>();
    if (facultyIds.length === 0) return byId;
    const computeMissing = opts?.computeMissing !== false;
    const snaps = periodId
      ? await this.prisma.$queryRaw<
          Array<{
            facultyId: string;
            evidenceJson: string | null;
            total: number;
            status: string;
            teachingWeighted: number;
            projectsWeighted: number;
            researchWeighted: number;
            adminWeighted: number;
            committeeWeighted: number;
            phdWeighted: number;
            teachingRaw: number;
            projectsRaw: number;
            researchRaw: number;
            adminRaw: number;
            committeeRaw: number;
            phdRaw: number;
            provisionalTeaching: boolean;
            normMin: number;
            normExpected: number;
            normMax: number;
          }>
        >`
          SELECT DISTINCT ON ("facultyId")
            "facultyId",
            "evidenceJson",
            total,
            status,
            "teachingWeighted",
            "projectsWeighted",
            "researchWeighted",
            "adminWeighted",
            "committeeWeighted",
            "phdWeighted",
            "teachingRaw",
            "projectsRaw",
            "researchRaw",
            "adminRaw",
            "committeeRaw",
            "phdRaw",
            "provisionalTeaching",
            "normMin",
            "normExpected",
            "normMax"
          FROM "WorkloadSnapshot"
          WHERE "periodId" = ${periodId}
            AND "facultyId" IN (${Prisma.join(facultyIds)})
          ORDER BY "facultyId", "calculatedAt" DESC
        `
      : [];
    const latest = new Map<string, (typeof snaps)[number]>();
    for (const s of snaps) {
      latest.set(s.facultyId, s);
    }
    const missing: string[] = [];
    for (const id of facultyIds) {
      const snap = latest.get(id);
      const cached = snap ? this.breakdownFromSnapshot(snap) : null;
      if (cached) {
        byId.set(id, cached);
      } else if (computeMissing) {
        missing.push(id);
      }
    }
    if (!computeMissing || missing.length === 0) return byId;
    const computed = await mapLimit(missing, 6, async (id) => {
      const result = await this.calculateWorkload(id);
      if (periodId) await this.persistBreakdown(id, result, periodId);
      return result;
    });
    for (const result of computed) byId.set(result.facultyId, result);
    return byId;
  }

  async getDepartmentBalance(departmentId: string) {
    return cached(`balance:${departmentId}`, 45_000, () =>
      this.loadDepartmentBalance(departmentId),
    );
  }

  private async loadDepartmentBalance(departmentId: string) {
    const faculty = await this.prisma.faculty.findMany({
      where: this.teachingFacultyWhere(departmentId),
      select: {
        id: true,
        name: true,
        facultyCode: true,
        email: true,
        photoUrl: true,
        photoThumbUrl: true,
        designation: true,
        dataSource: true,
      },
    });
    const period = await this.prisma.academicPeriod.findFirst({
      where: { isActive: true },
    });
    // Snapshot-only reads — never recalculate every faculty on page load.
    const byId = await this.ensureBreakdowns(
      faculty.map((f) => f.id),
      period?.id,
      { computeMissing: false },
    );
    const enriched = faculty.map((meta) => {
      const designationNorm = getNormForDesignation(meta.designation);
      const b = byId.get(meta.id);
      if (b) {
        const hours = summarizeWorkloadHours({
          assigned: b.total,
          min: designationNorm?.min ?? b.normMin,
          max: designationNorm?.max ?? b.normMax,
        });
        return {
          ...b,
          evidence: {},
          name: meta.name,
          facultyCode: meta.facultyCode,
          email: meta.email,
          photoUrl: meta.photoThumbUrl || meta.photoUrl,
          designation: meta.designation,
          dataSource: meta.dataSource,
          availableCapacity: Math.max(0, (designationNorm?.max ?? b.normMax) - b.total),
          normMin: designationNorm?.min ?? b.normMin,
          normExpected: designationNorm?.expected ?? b.normExpected,
          normMax: designationNorm?.max ?? b.normMax,
          cadre: designationNorm?.cadre || null,
          prescribed: designationNorm?.prescribed || null,
          ...hours,
          status: hours.status as WorkloadBreakdown['status'],
        };
      }
      const fallbackMin = designationNorm?.min ?? 16;
      const fallbackMax = designationNorm?.max ?? 20;
      const fallbackExpected = designationNorm?.expected ?? 18;
      const hours = summarizeWorkloadHours({
        assigned: 0,
        min: fallbackMin,
        max: fallbackMax,
        status: 'UNDERLOAD',
      });
      return {
        facultyId: meta.id,
        theoryRaw: 0,
        tutorialRaw: 0,
        labRaw: 0,
        teachingRaw: 0,
        projectsRaw: 0,
        researchRaw: 0,
        adminRaw: 0,
        committeeRaw: 0,
        phdRaw: 0,
        theoryWeighted: 0,
        tutorialWeighted: 0,
        labWeighted: 0,
        teachingWeighted: 0,
        projectsWeighted: 0,
        ugProjectsWeighted: 0,
        pgProjectsWeighted: 0,
        researchWeighted: 0,
        adminWeighted: 0,
        committeeWeighted: 0,
        phdWeighted: 0,
        total: 0,
        provisionalTeaching: false,
        normMin: fallbackMin,
        normExpected: fallbackExpected,
        normMax: fallbackMax,
        percentOfNorm: 0,
        evidence: {},
        name: meta.name,
        facultyCode: meta.facultyCode,
        email: meta.email,
        photoUrl: meta.photoThumbUrl || meta.photoUrl,
        designation: meta.designation,
        dataSource: meta.dataSource,
        availableCapacity: fallbackMax,
        cadre: designationNorm?.cadre || null,
        prescribed: designationNorm?.prescribed || null,
        ...hours,
        status: hours.status as WorkloadBreakdown['status'],
      };
    });
    const suggestions = [
      ...getBalanceSuggestions(enriched.filter((f) => f.dataSource !== 'DEMO')),
      ...getBalanceSuggestions(enriched.filter((f) => f.dataSource === 'DEMO')),
    ];
    return {
      faculty: enriched,
      suggestions: suggestions.map((s) => {
        const from = enriched.find((f) => f.facultyId === s.fromFacultyId);
        const to = enriched.find((f) => f.facultyId === s.toFacultyId);
        return {
          ...s,
          fromName: from?.name,
          toName: to?.name,
          beforeFrom: from?.total,
          beforeTo: to?.total,
          afterFrom: from ? from.total - s.suggestedHours : null,
          afterTo: to ? to.total + s.suggestedHours : null,
        };
      }),
    };
  }

  /** Drop cached balance/summary after mutations. */
  invalidateWorkloadCaches(departmentId?: string) {
    if (departmentId) {
      invalidateCache(`balance:${departmentId}`);
      invalidateCache(`hod:dash:${departmentId}`);
      invalidateCache(`hod:coverage:${departmentId}`);
    } else {
      invalidateCache('balance:');
      invalidateCache('hod:dash:');
      invalidateCache('hod:coverage:');
    }
    invalidateCache('faculty:search:');
    invalidateCache('inst:summary');
  }

  async institutionSummary(schoolId?: string | null) {
    const key = `inst:summary:${schoolId || 'all'}`;
    return cached(key, 45_000, () => this.loadInstitutionSummary(schoolId));
  }

  private async loadInstitutionSummary(schoolId?: string | null) {
    const departments = await this.prisma.department.findMany({
      where: schoolId ? { schoolId } : undefined,
      include: { school: true },
    });
    const period = await this.prisma.academicPeriod.findFirst({
      where: { isActive: true },
    });
    const deptIds = departments.map((d) => d.id);
    const faculty = await this.prisma.faculty.findMany({
      where: {
        ...this.teachingFacultyWhere(),
        ...(deptIds.length ? { departmentId: { in: deptIds } } : {}),
      },
      select: { id: true, departmentId: true, dataSource: true },
    });

    // Latest snapshot only (no evidenceJson) — avoids pulling full history over Neon.
    const latestByFaculty = new Map<
      string,
      { status: string; total: number }
    >();
    if (period && faculty.length > 0) {
      const facultyIds = faculty.map((f) => f.id);
      const snaps = await this.prisma.$queryRaw<
        Array<{ facultyId: string; status: string; total: number }>
      >`
        SELECT DISTINCT ON ("facultyId")
          "facultyId",
          status,
          total
        FROM "WorkloadSnapshot"
        WHERE "periodId" = ${period.id}
          AND "facultyId" IN (${Prisma.join(facultyIds)})
        ORDER BY "facultyId", "calculatedAt" DESC
      `;
      for (const s of snaps) {
        latestByFaculty.set(s.facultyId, {
          status: s.status,
          total: Number(s.total) || 0,
        });
      }
    }

    const rows: Array<{
      departmentId: string;
      departmentCode: string;
      departmentName: string;
      school: string;
      schoolId: string;
      dataSource: 'REAL' | 'DEMO';
      facultyCount: number;
      averageWorkload: number;
      NORMAL: number;
      OVERLOAD: number;
      UNDERLOAD: number;
      compliancePct: number;
      rowId: string;
    }> = [];
    const tally = {
      REAL: { totalFaculty: 0, normal: 0, overload: 0, underload: 0, totalLoad: 0 },
      DEMO: { totalFaculty: 0, normal: 0, overload: 0, underload: 0, totalLoad: 0 },
    };
    for (const d of departments) {
      const members = faculty.filter((f) => f.departmentId === d.id);
      for (const source of ['REAL', 'DEMO'] as const) {
        const group = members.filter((f) =>
          source === 'DEMO' ? f.dataSource === 'DEMO' : f.dataSource !== 'DEMO',
        );
        if (group.length === 0) continue;
        const loads = group
          .map((f) => {
            const snap = latestByFaculty.get(f.id);
            if (!snap) return null;
            return { status: snap.status, total: snap.total };
          })
          .filter((b): b is { status: string; total: number } => Boolean(b));
        const n = loads.filter((f) => f.status === 'NORMAL').length;
        const o = loads.filter((f) => f.status === 'OVERLOAD').length;
        const u = loads.filter((f) => f.status === 'UNDERLOAD').length;
        const sum = loads.reduce((s, f) => s + f.total, 0);
        // Count all teaching faculty in the group, even without a snapshot yet.
        const count = group.length;
        tally[source].totalFaculty += count;
        tally[source].normal += n;
        tally[source].overload += o;
        tally[source].underload += u;
        tally[source].totalLoad += sum;
        rows.push({
          departmentId: d.id,
          departmentCode: d.code,
          departmentName: d.name,
          school: d.school.name,
          schoolId: d.schoolId,
          dataSource: source,
          facultyCount: count,
          averageWorkload:
            loads.length === 0 ? 0 : Math.round((sum / loads.length) * 10) / 10,
          NORMAL: n,
          OVERLOAD: o,
          UNDERLOAD: u,
          compliancePct:
            count === 0 ? 100 : Math.round((n / count) * 1000) / 10,
          rowId: `${d.id}:${source}`,
        });
      }
    }
    const pack = (s: 'REAL' | 'DEMO') => ({
      dataSource: s,
      totalFaculty: tally[s].totalFaculty,
      averageWorkload:
        tally[s].totalFaculty === 0
          ? 0
          : Math.round((tally[s].totalLoad / Math.max(1, tally[s].normal + tally[s].overload + tally[s].underload)) * 10) / 10,
      normal: tally[s].normal,
      overload: tally[s].overload,
      underload: tally[s].underload,
      compliancePct:
        tally[s].totalFaculty === 0
          ? 100
          : Math.round((tally[s].normal / tally[s].totalFaculty) * 1000) / 10,
      rows: rows.filter((r) => r.dataSource === s),
    });
    const real = pack('REAL');
    const demo = pack('DEMO');
    const totalFaculty = real.totalFaculty + demo.totalFaculty;
    const normal = real.normal + demo.normal;
    const overload = real.overload + demo.overload;
    const underload = real.underload + demo.underload;
    return {
      dataSource: 'ALL',
      totalFaculty,
      averageWorkload:
        normal + overload + underload === 0
          ? 0
          : Math.round(
              ((real.averageWorkload * (real.normal + real.overload + real.underload) +
                demo.averageWorkload * (demo.normal + demo.overload + demo.underload)) /
                Math.max(1, normal + overload + underload)) *
                10,
            ) / 10,
      normal,
      overload,
      underload,
      compliancePct:
        totalFaculty === 0
          ? 100
          : Math.round((normal / totalFaculty) * 1000) / 10,
      rows,
      departments: departments.length,
      real,
      demo,
      dataNote: 'Institutional workload health across schools and departments.',
      allRows: rows,
    };
  }

  async dashboardSummary(opts?: { departmentId?: string; schoolId?: string | null }) {
    if (opts?.departmentId) {
      const balance = await this.getDepartmentBalance(opts.departmentId);
      const totals = balance.faculty.map((f) => f.total);
      const normal = balance.faculty.filter((f) => f.status === 'NORMAL').length;
      const overload = balance.faculty.filter((f) => f.status === 'OVERLOAD').length;
      const underload = balance.faculty.filter((f) => f.status === 'UNDERLOAD').length;
      const pendingApprovals = await this.prisma.approvalRequest.count({
        where: {
          departmentId: opts.departmentId,
          status: {
            in: ['PENDING', 'HOD_SUBMITTED', 'DEAN_REVIEW', 'PRINCIPAL_REVIEW'],
          },
        },
      });
      return {
        totalFaculty: balance.faculty.length,
        averageWorkload:
          totals.length === 0
            ? 0
            : Math.round((totals.reduce((s, n) => s + n, 0) / totals.length) * 10) / 10,
        normal,
        overload,
        underload,
        compliance:
          balance.faculty.length === 0
            ? 100
            : Math.round((normal / balance.faculty.length) * 1000) / 10,
        pendingApprovals,
      };
    }
    const summary = await this.institutionSummary(opts?.schoolId);
    const pendingApprovals = await this.prisma.approvalRequest.count({
      where: {
        status: {
          in: ['PENDING', 'HOD_SUBMITTED', 'DEAN_REVIEW', 'PRINCIPAL_REVIEW'],
        },
      },
    });
    return {
      totalFaculty: summary.totalFaculty,
      averageWorkload: summary.averageWorkload,
      normal: summary.normal,
      overload: summary.overload,
      underload: summary.underload,
      compliance: summary.compliancePct,
      pendingApprovals,
    };
  }

  async history(facultyId?: string) {
    return this.prisma.workloadSnapshot.findMany({
      where: facultyId ? { facultyId } : undefined,
      include: {
        faculty: { select: { name: true, facultyCode: true, departmentId: true } },
        period: true,
      },
      orderBy: { calculatedAt: 'desc' },
      take: 200,
    });
  }

  async applyBalanceMoves(moves: ReallocationMove[]) {
    for (const move of moves) {
      const fromAllocs = await this.prisma.courseAllocation.findMany({
        where: { facultyId: move.fromFacultyId },
        include: { course: true },
      });
      let remaining = move.hours;
      for (const alloc of fromAllocs) {
        if (remaining <= 0) break;
        const take = Math.min(alloc.hours, remaining);
        if (take <= 0) continue;
        await this.prisma.courseAllocation.update({
          where: { id: alloc.id },
          data: { hours: alloc.hours - take },
        });
        await this.prisma.courseAllocation.create({
          data: {
            courseId: alloc.courseId,
            facultyId: move.toFacultyId,
            hours: take,
            classType: alloc.classType,
            section: alloc.section,
            dataSource: alloc.dataSource,
          },
        });
        remaining -= take;
      }
    }

    const facultyIds = new Set(
      moves.flatMap((m) => [m.fromFacultyId, m.toFacultyId]),
    );
    const snaps = [];
    for (const id of facultyIds) {
      snaps.push(await this.recalculateAndPersist(id));
    }
    return snaps;
  }

  applyReallocationInMemory(
    inputs: FacultyWorkloadInput[],
    moves: ReallocationMove[],
  ) {
    return applyReallocation(inputs, moves);
  }

  async recalculateAllTeaching() {
    const faculty = await this.prisma.faculty.findMany({
      where: this.teachingFacultyWhere(),
      select: { id: true },
    });
    const snaps = await mapLimit(faculty, 6, (f) => this.recalculateAndPersist(f.id));
    return { count: snaps.length };
  }

  async searchFaculty(query: {
    q?: string;
    departmentId?: string;
    dataSource?: string;
    designation?: string;
    status?: string;
    schoolId?: string | null;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 12));
    const cacheKey = `faculty:search:${JSON.stringify({
      q: query.q || '',
      departmentId: query.departmentId || '',
      dataSource: query.dataSource || '',
      designation: query.designation || '',
      status: query.status || '',
      schoolId: query.schoolId || '',
      page,
      pageSize,
    })}`;
    return cached(cacheKey, 30_000, () =>
      this.loadFacultySearch({ ...query, page, pageSize }),
    );
  }

  private async loadFacultySearch(query: {
    q?: string;
    departmentId?: string;
    dataSource?: string;
    designation?: string;
    status?: string;
    schoolId?: string | null;
    page: number;
    pageSize: number;
  }) {
    const { page, pageSize } = query;
    const where: Record<string, unknown> = {};
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.dataSource) where.dataSource = query.dataSource;
    if (query.designation) {
      where.designation = { contains: query.designation, mode: 'insensitive' };
    }
    if (query.status && query.status !== 'ALL') where.status = query.status;
    if (query.schoolId) where.department = { schoolId: query.schoolId };
    const q = query.q?.trim();
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { facultyCode: { contains: q, mode: 'insensitive' } },
        { designation: { contains: q, mode: 'insensitive' } },
        { department: { is: { name: { contains: q, mode: 'insensitive' } } } },
        { department: { is: { code: { contains: q, mode: 'insensitive' } } } },
      ];
    }
    const [total, items] = await Promise.all([
      this.prisma.faculty.count({ where }),
      this.prisma.faculty.findMany({
        where,
        select: {
          id: true,
          facultyCode: true,
          name: true,
          email: true,
          designation: true,
          status: true,
          photoUrl: true,
          photoThumbUrl: true,
          dataSource: true,
          department: { select: { id: true, code: true, name: true } },
          snapshots: {
            orderBy: { calculatedAt: 'desc' },
            take: 1,
            select: { total: true, status: true, dataSource: true },
          },
          _count: { select: { allocations: true } },
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items, total, page, pageSize };
  }

  async audit(
    user: { id?: string; role?: string },
    action: string,
    entity: string,
    entityId?: string,
    extra?: { oldValue?: unknown; newValue?: unknown },
  ) {
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        role: user.role,
        action,
        entity,
        entityId,
        oldValue: extra?.oldValue ? JSON.stringify(extra.oldValue) : null,
        newValue: extra?.newValue ? JSON.stringify(extra.newValue) : null,
      },
    });
  }
}
