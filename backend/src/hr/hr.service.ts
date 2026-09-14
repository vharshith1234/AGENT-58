import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { WorkloadService } from '../workload/workload.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class HrService {
  private dashboardCache:
    | { at: number; value: Awaited<ReturnType<HrService['buildDashboard']>> }
    | null = null;
  private static readonly DASHBOARD_TTL_MS = 30_000;

  constructor(
    private prisma: PrismaService,
    private workload: WorkloadService,
    private notifications: NotificationsService,
  ) {}

  async dashboard() {
    const hit = this.dashboardCache;
    if (hit && Date.now() - hit.at < HrService.DASHBOARD_TTL_MS) {
      return hit.value;
    }
    const value = await this.buildDashboard();
    this.dashboardCache = { at: Date.now(), value };
    return value;
  }

  private async buildDashboard() {
    // One round-trip to Neon (each query was taking multiple seconds over the wire).
    const [summaryRows, meta] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{
          departmentId: string;
          departmentCode: string;
          departmentName: string;
          school: string;
          schoolId: string;
          dataSource: string;
          facultyCount: number;
          averageWorkload: number;
          NORMAL: number;
          OVERLOAD: number;
          UNDERLOAD: number;
        }>
      >`
        WITH teaching AS (
          SELECT f.id, f."departmentId", f."dataSource"
          FROM "Faculty" f
          LEFT JOIN "User" u ON u."facultyId" = f.id
          WHERE f.status NOT IN ('Inactive', 'INACTIVE', 'Suspended')
            AND (u.id IS NULL OR u.role = 'FACULTY')
        ),
        active_period AS (
          SELECT id FROM "AcademicPeriod" WHERE "isActive" = true LIMIT 1
        ),
        latest AS (
          SELECT DISTINCT ON (ws."facultyId")
            ws."facultyId",
            ws.status,
            ws.total
          FROM "WorkloadSnapshot" ws
          JOIN active_period ap ON ap.id = ws."periodId"
          WHERE ws."facultyId" IN (SELECT id FROM teaching)
          ORDER BY ws."facultyId", ws."calculatedAt" DESC
        )
        SELECT
          d.id AS "departmentId",
          d.code AS "departmentCode",
          d.name AS "departmentName",
          s.name AS school,
          s.id AS "schoolId",
          t."dataSource" AS "dataSource",
          COUNT(t.id)::int AS "facultyCount",
          COALESCE(ROUND(AVG(l.total)::numeric, 1), 0)::float AS "averageWorkload",
          COUNT(*) FILTER (WHERE l.status = 'NORMAL')::int AS "NORMAL",
          COUNT(*) FILTER (WHERE l.status = 'OVERLOAD')::int AS "OVERLOAD",
          COUNT(*) FILTER (WHERE l.status = 'UNDERLOAD')::int AS "UNDERLOAD"
        FROM "Department" d
        JOIN "School" s ON s.id = d."schoolId"
        LEFT JOIN teaching t ON t."departmentId" = d.id
        LEFT JOIN latest l ON l."facultyId" = t.id
        GROUP BY d.id, d.code, d.name, s.id, s.name, t."dataSource"
        HAVING COUNT(t.id) > 0
        ORDER BY d.code, t."dataSource"
      `,
      this.prisma.$queryRaw<
        Array<{
          deptCount: number;
          pendingCorrections: number;
          approvedCorrections: number;
          rejectedCorrections: number;
          periodId: string | null;
          periodCode: string | null;
          periodName: string | null;
        }>
      >`
        SELECT
          (SELECT COUNT(*)::int FROM "Department") AS "deptCount",
          (SELECT COUNT(*)::int FROM "CorrectionRequest"
            WHERE status IN ('PENDING', 'UNDER_REVIEW')) AS "pendingCorrections",
          (SELECT COUNT(*)::int FROM "CorrectionRequest"
            WHERE status = 'APPROVED') AS "approvedCorrections",
          (SELECT COUNT(*)::int FROM "CorrectionRequest"
            WHERE status = 'REJECTED') AS "rejectedCorrections",
          (SELECT id FROM "AcademicPeriod" WHERE "isActive" = true LIMIT 1) AS "periodId",
          (SELECT code FROM "AcademicPeriod" WHERE "isActive" = true LIMIT 1) AS "periodCode",
          (SELECT name FROM "AcademicPeriod" WHERE "isActive" = true LIMIT 1) AS "periodName"
      `,
    ]);

    const rows = summaryRows.map((r) => ({
      departmentId: r.departmentId,
      departmentCode: r.departmentCode,
      departmentName: r.departmentName,
      school: r.school,
      schoolId: r.schoolId,
      dataSource: (r.dataSource === 'DEMO' ? 'DEMO' : 'REAL') as 'REAL' | 'DEMO',
      facultyCount: Number(r.facultyCount) || 0,
      averageWorkload: Number(r.averageWorkload) || 0,
      NORMAL: Number(r.NORMAL) || 0,
      OVERLOAD: Number(r.OVERLOAD) || 0,
      UNDERLOAD: Number(r.UNDERLOAD) || 0,
      compliancePct:
        Number(r.facultyCount) === 0
          ? 100
          : Math.round((Number(r.NORMAL) / Number(r.facultyCount)) * 1000) / 10,
      rowId: `${r.departmentId}:${r.dataSource === 'DEMO' ? 'DEMO' : 'REAL'}`,
    }));

    const pack = (source: 'REAL' | 'DEMO') => {
      const subset = rows.filter((r) => r.dataSource === source);
      const totalFaculty = subset.reduce((s, r) => s + r.facultyCount, 0);
      const normal = subset.reduce((s, r) => s + r.NORMAL, 0);
      const overload = subset.reduce((s, r) => s + r.OVERLOAD, 0);
      const underload = subset.reduce((s, r) => s + r.UNDERLOAD, 0);
      const loadSum = subset.reduce(
        (s, r) => s + r.averageWorkload * Math.max(r.NORMAL + r.OVERLOAD + r.UNDERLOAD, 0),
        0,
      );
      const withSnap = subset.reduce(
        (s, r) => s + r.NORMAL + r.OVERLOAD + r.UNDERLOAD,
        0,
      );
      return {
        dataSource: source,
        totalFaculty,
        averageWorkload:
          withSnap === 0 ? 0 : Math.round((loadSum / withSnap) * 10) / 10,
        normal,
        overload,
        underload,
        compliancePct:
          totalFaculty === 0
            ? 100
            : Math.round((normal / totalFaculty) * 1000) / 10,
        rows: subset,
      };
    };

    const real = pack('REAL');
    const demo = pack('DEMO');
    const m = meta[0] || {
      deptCount: 0,
      pendingCorrections: 0,
      approvedCorrections: 0,
      rejectedCorrections: 0,
      periodId: null,
      periodCode: null,
      periodName: null,
    };

    return {
      facultyCount: real.totalFaculty + demo.totalFaculty,
      demoFacultyCount: demo.totalFaculty,
      activeFaculty: real.totalFaculty + demo.totalFaculty,
      deptCount: Number(m.deptCount) || 0,
      pendingCorrections: Number(m.pendingCorrections) || 0,
      approvedCorrections: Number(m.approvedCorrections) || 0,
      rejectedCorrections: Number(m.rejectedCorrections) || 0,
      activePeriod: m.periodId
        ? {
            id: m.periodId,
            code: m.periodCode,
            name: m.periodName,
            isActive: true,
          }
        : null,
      normal: real.normal + demo.normal,
      overload: real.overload + demo.overload,
      underload: real.underload + demo.underload,
      compliancePct:
        real.totalFaculty + demo.totalFaculty === 0
          ? 100
          : Math.round(
              ((real.normal + demo.normal) /
                (real.totalFaculty + demo.totalFaculty)) *
                1000,
            ) / 10,
      rows: rows,
      allRows: rows,
      real,
      demo,
      dataNote: 'Institutional workload health across schools and departments.',
    };
  }

  /** Drop cached overview after mutations that change institutional stats. */
  invalidateDashboardCache() {
    this.dashboardCache = null;
  }

  listFaculty(query: Record<string, string | undefined> = {}) {
    return this.workload.searchFaculty(query);
  }

  getFaculty(id: string) {
    return this.prisma.faculty.findUnique({
      where: { id },
      include: {
        department: { include: { school: true } },
        adminRoles: true,
        affiliations: { include: { department: true } },
        headedDepartments: { select: { id: true, code: true, name: true } },
        user: { select: { role: true, status: true, email: true } },
        snapshots: {
          orderBy: { calculatedAt: 'desc' },
          take: 1,
          select: { total: true, status: true, dataSource: true },
        },
      },
    });
  }

  async createFaculty(body: Record<string, unknown>) {
    const departmentId = String(body.departmentId);
    const dept = await this.prisma.department.findUnique({
      where: { id: departmentId },
    });
    if (!dept) throw new NotFoundException('Department not found');
    const faculty = await this.prisma.faculty.create({
      data: {
        facultyCode: String(body.facultyCode),
        name: String(body.name),
        email: String(body.email).toLowerCase(),
        departmentId,
        designation: String(body.designation || 'Assistant Professor'),
        qualification: String(body.qualification || 'Ph.D'),
        joiningDate: body.joiningDate
          ? new Date(String(body.joiningDate))
          : null,
        employmentType: String(body.employmentType || 'Regular'),
        status: String(body.status || 'Active'),
        specialization: body.specialization ? String(body.specialization) : null,
        employeeId: body.employeeId ? String(body.employeeId) : String(body.facultyCode),
        phone: body.phone ? String(body.phone) : null,
        dataSource: dept.dataSource === 'DEMO' ? 'DEMO' : 'REAL',
      },
    });
    const email = faculty.email;
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (!existingUser) {
      await this.prisma.user.create({
        data: {
          email,
          name: faculty.name,
          role: 'FACULTY',
          status: faculty.status === 'Active' ? 'ACTIVE' : 'INACTIVE',
          passwordHash: await bcrypt.hash(`Vignan@${faculty.facultyCode}`, 10),
          facultyId: faculty.id,
          departmentId: faculty.departmentId,
        },
      });
    }
    await this.notifications.notifyRole(
      'HOD',
      'New faculty added',
      `${faculty.name} is now available for course allocation.`,
      faculty.departmentId,
    );
    this.invalidateDashboardCache();
    await this.workload.audit(
      { role: 'HR' },
      'CREATE_FACULTY',
      'Faculty',
      faculty.id,
      { newValue: { email: faculty.email, facultyCode: faculty.facultyCode } },
    );
    return faculty;
  }

  async updateFaculty(id: string, body: Record<string, unknown>) {
    const existing = await this.prisma.faculty.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    const updated = await this.prisma.faculty.update({
      where: { id },
      data: {
        name: body.name != null ? String(body.name) : undefined,
        designation: body.designation != null ? String(body.designation) : undefined,
        qualification: body.qualification != null ? String(body.qualification) : undefined,
        employmentType: body.employmentType != null ? String(body.employmentType) : undefined,
        status: body.status != null ? String(body.status) : undefined,
        specialization:
          body.specialization != null ? String(body.specialization) : undefined,
        departmentId:
          body.departmentId != null ? String(body.departmentId) : undefined,
        employeeId: body.employeeId != null ? String(body.employeeId) : undefined,
        phone: body.phone != null ? String(body.phone) : undefined,
      },
    });
    if (body.status != null || body.name != null) {
      await this.prisma.user.updateMany({
        where: { facultyId: id },
        data: {
          ...(body.name != null ? { name: String(body.name) } : {}),
          ...(body.status != null
            ? { status: String(body.status) === 'Active' ? 'ACTIVE' : 'INACTIVE' }
            : {}),
        },
      });
    }
    this.invalidateDashboardCache();
    return updated;
  }

  listSchools() {
    return this.prisma.school.findMany({ orderBy: { name: 'asc' } });
  }

  listDepartments() {
    return this.prisma.department.findMany({
      include: { school: true, _count: { select: { faculty: true } } },
      orderBy: { code: 'asc' },
    });
  }

  createDepartment(body: Record<string, unknown>) {
    return this.prisma.department.create({
      data: {
        name: String(body.name),
        code: String(body.code),
        schoolId: String(body.schoolId),
      },
    });
  }

  async updateDepartment(id: string, body: Record<string, unknown>) {
    return this.prisma.department.update({
      where: { id },
      data: {
        name: body.name != null ? String(body.name) : undefined,
        status: body.status != null ? String(body.status) : undefined,
        hodFacultyId: body.hodFacultyId != null ? String(body.hodFacultyId) : undefined,
      },
    });
  }

  listPolicies() {
    return this.prisma.workloadPolicy.findMany({
      where: { isActive: true },
      orderBy: { activityType: 'asc' },
    });
  }

  async upsertPolicy(body: Record<string, unknown>, userId: string) {
    await this.prisma.workloadPolicy.updateMany({
      where: {
        activityType: String(body.activityType) as any,
        isActive: true,
      },
      data: { isActive: false },
    });
    const created = await this.prisma.workloadPolicy.create({
      data: {
        activityType: String(body.activityType) as any,
        weight: Number(body.weight),
        effectiveFrom: new Date(),
        updatedBy: userId,
        isActive: true,
      },
    });
    await this.workload.audit({ id: userId, role: 'HR' }, 'WEIGHTING_UPDATED', 'WorkloadPolicy', created.id, {
      newValue: { activityType: created.activityType, weight: created.weight },
    });
    await this.workload.recalculateAllTeaching();
    return created;
  }

  listNorms() {
    return this.prisma.workloadNorm.findMany({
      where: { isActive: true },
      include: { department: true },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async createNorm(body: Record<string, unknown>, userId?: string) {
    if (body.departmentId) {
      await this.prisma.workloadNorm.updateMany({
        where: { departmentId: String(body.departmentId), isActive: true },
        data: { isActive: false },
      });
    } else {
      await this.prisma.workloadNorm.updateMany({
        where: { departmentId: null, isActive: true },
        data: { isActive: false },
      });
    }
    const created = await this.prisma.workloadNorm.create({
      data: {
        departmentId: body.departmentId ? String(body.departmentId) : null,
        academicYear: body.academicYear ? String(body.academicYear) : null,
        semester: body.semester != null ? Number(body.semester) : null,
        min: Number(body.min),
        expected: Number(body.expected),
        max: Number(body.max),
        effectiveFrom: new Date(),
        isActive: true,
      },
    });
    await this.workload.audit({ id: userId, role: 'HR' }, 'POLICY_UPDATED', 'WorkloadNorm', created.id, {
      newValue: { min: created.min, expected: created.expected, max: created.max },
    });
    await this.workload.recalculateAllTeaching();
    return created;
  }

  listCorrections() {
    return this.prisma.correctionRequest.findMany({
      include: {
        submittedBy: {
          include: {
            department: true,
            faculty: { include: { department: true } },
          },
        },
        reviewedBy: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewCorrection(
    id: string,
    body: { status: 'APPROVED' | 'REJECTED'; note?: string },
    reviewerId: string,
  ) {
    const updated = await this.prisma.correctionRequest.update({
      where: { id },
      data: {
        status: body.status,
        resolutionNote: body.note,
        reviewedById: reviewerId,
      },
      include: {
        submittedBy: { include: { department: true, faculty: true } },
      },
    });
    await this.notifications.create(
      updated.submittedById,
      `Correction ${body.status.toLowerCase()}`,
      body.note || `Your correction request was ${body.status.toLowerCase()}.`,
    );
    const who =
      updated.submittedBy?.faculty?.name ||
      updated.submittedBy?.name ||
      'Faculty';
    const msg = `${who}: ${updated.issueCategory} → ${body.status}`;
    await this.notifications.notifyRole('HOD', `Correction ${body.status.toLowerCase()}`, msg);
    await this.notifications.notifyRole('DEAN', `Correction ${body.status.toLowerCase()}`, msg);
    await this.notifications.notifyRole('PRINCIPAL', `Correction ${body.status.toLowerCase()}`, msg);
    this.invalidateDashboardCache();
    return updated;
  }

  async complianceReport() {
    const [departments, summary] = await Promise.all([
      this.prisma.department.findMany({
        orderBy: { code: 'asc' },
        select: { id: true, code: true, name: true },
      }),
      this.workload.institutionSummary(),
    ]);
    const byDept = new Map<
      string,
      { NORMAL: number; OVERLOAD: number; UNDERLOAD: number; facultyCount: number }
    >();
    for (const r of summary.allRows || summary.rows || []) {
      const cur = byDept.get(r.departmentId) || {
        NORMAL: 0,
        OVERLOAD: 0,
        UNDERLOAD: 0,
        facultyCount: 0,
      };
      cur.NORMAL += Number(r.NORMAL || 0);
      cur.OVERLOAD += Number(r.OVERLOAD || 0);
      cur.UNDERLOAD += Number(r.UNDERLOAD || 0);
      cur.facultyCount += Number(r.facultyCount || 0);
      byDept.set(r.departmentId, cur);
    }
    return departments.map((d) => {
      const counts = byDept.get(d.id) || {
        NORMAL: 0,
        OVERLOAD: 0,
        UNDERLOAD: 0,
        facultyCount: 0,
      };
      // Faculty without a workload snapshot still count as underloaded for visibility.
      const accounted = counts.NORMAL + counts.OVERLOAD + counts.UNDERLOAD;
      const underload =
        counts.UNDERLOAD + Math.max(0, counts.facultyCount - accounted);
      return {
        departmentId: d.id,
        departmentCode: d.code,
        departmentName: d.name,
        NORMAL: counts.NORMAL,
        OVERLOAD: counts.OVERLOAD,
        UNDERLOAD: underload,
        facultyCount: counts.facultyCount,
      };
    });
  }
}
