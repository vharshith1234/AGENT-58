import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkloadService } from '../workload/workload.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DeanService {
  constructor(
    private prisma: PrismaService,
    private workload: WorkloadService,
    private notifications: NotificationsService,
  ) {}

  async dashboard(schoolId?: string | null) {
    const departments = await this.prisma.department.findMany({
      where: schoolId ? { schoolId } : undefined,
      include: { school: { select: { id: true, code: true, name: true } } },
      orderBy: { code: 'asc' },
    });
    const [comparisons, pending] = await Promise.all([
      Promise.all(
        departments.map(async (d) => {
          const balance = await this.workload.getDepartmentBalance(d.id);
          return {
            department: d,
            overload: balance.faculty.filter((f) => f.status === 'OVERLOAD').length,
            underload: balance.faculty.filter((f) => f.status === 'UNDERLOAD').length,
            normal: balance.faculty.filter((f) => f.status === 'NORMAL').length,
            facultyCount: balance.faculty.length,
            faculty: balance.faculty.map((f) => ({
              facultyId: f.facultyId,
              name: f.name,
              facultyCode: f.facultyCode,
              total: f.total,
              status: f.status,
              normMin: f.normMin,
              normMax: f.normMax,
              availableCapacity: f.availableCapacity,
              dataSource: f.dataSource,
            })),
          };
        }),
      ),
      this.prisma.approvalRequest.findMany({
        where: {
          status: { in: ['PENDING', 'HOD_SUBMITTED', 'DEAN_REVIEW'] },
          level: 'DEAN',
          ...(schoolId && departments.length
            ? { departmentId: { in: departments.map((d) => d.id) } }
            : {}),
        },
        include: { submittedBy: true, period: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const realComparisons = comparisons.filter((c) => c.department.dataSource !== 'DEMO');
    const demoComparisons = comparisons.filter((c) => c.department.dataSource === 'DEMO');
    const pack = (list: typeof comparisons) => {
      const faculty = list.reduce((s, c) => s + c.facultyCount, 0);
      const normalN = list.reduce((s, c) => s + c.normal, 0);
      const overloadN = list.reduce((s, c) => s + c.overload, 0);
      const underloadN = list.reduce((s, c) => s + c.underload, 0);
      const totals = list.flatMap((c) => c.faculty.map((f) => f.total));
      return {
        totalFaculty: faculty,
        normal: normalN,
        overload: overloadN,
        underload: underloadN,
        averageWorkload:
          totals.length === 0
            ? 0
            : Math.round((totals.reduce((s, n) => s + n, 0) / totals.length) * 10) / 10,
        compliancePct: faculty === 0 ? 100 : Math.round((normalN / faculty) * 1000) / 10,
      };
    };
    const real = pack(realComparisons);
    const demo = pack(demoComparisons);
    const all = pack(comparisons);
    return {
      comparisons,
      pending,
      departmentCount: comparisons.length,
      totalFaculty: all.totalFaculty,
      normal: all.normal,
      overload: all.overload,
      underload: all.underload,
      averageWorkload: all.averageWorkload,
      compliancePct: all.compliancePct,
      real,
      demo,
      dataNote: 'Institution-wide workload comparison across all departments.',
    };
  }

  /** Institution-wide department cards (not limited to Dean school). */
  async allDepartments() {
    const [departments, summary] = await Promise.all([
      this.prisma.department.findMany({
        include: { school: { select: { id: true, code: true, name: true } } },
        orderBy: { code: 'asc' },
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
      const accounted = counts.NORMAL + counts.OVERLOAD + counts.UNDERLOAD;
      const underload =
        counts.UNDERLOAD + Math.max(0, counts.facultyCount - accounted);
      return {
        department: {
          id: d.id,
          code: d.code,
          name: d.name,
          dataSource: d.dataSource,
          schoolId: d.schoolId,
          school: d.school,
        },
        normal: counts.NORMAL,
        overload: counts.OVERLOAD,
        underload,
        facultyCount: counts.facultyCount,
      };
    });
  }

  async listApprovals(schoolId?: string | null) {
    const deptIds = schoolId
      ? (
          await this.prisma.department.findMany({
            where: { schoolId },
            select: { id: true },
          })
        ).map((d) => d.id)
      : [];
    return this.prisma.approvalRequest.findMany({
      where: deptIds.length ? { departmentId: { in: deptIds } } : undefined,
      include: { submittedBy: true, period: true, auditLogs: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async assertSchoolApproval(id: string, schoolId?: string | null) {
    const existing = await this.prisma.approvalRequest.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException();
    if (!schoolId) return existing;
    const dept = await this.prisma.department.findUnique({
      where: { id: existing.departmentId },
    });
    if (!dept || dept.schoolId !== schoolId) {
      throw new NotFoundException();
    }
    return existing;
  }

  async approve(id: string, actorId: string, comment?: string, schoolId?: string | null) {
    const existing = await this.assertSchoolApproval(id, schoolId);

    const updated = await this.prisma.approvalRequest.update({
      where: { id },
      data: { status: 'DEAN_APPROVED', comment },
    });
    await this.prisma.approvalAuditLog.create({
      data: {
        approvalRequestId: id,
        actorId,
        action: 'DEAN_APPROVED',
        comment,
      },
    });
    await this.notifications.create(
      existing.submittedById,
      'Dean approved workload package',
      comment || 'Your department package was approved by the Dean.',
    );
    return updated;
  }

  async sendBack(id: string, actorId: string, comment: string, schoolId?: string | null) {
    const existing = await this.assertSchoolApproval(id, schoolId);

    const updated = await this.prisma.approvalRequest.update({
      where: { id },
      data: { status: 'DEAN_SENT_BACK', comment },
    });
    await this.prisma.approvalAuditLog.create({
      data: {
        approvalRequestId: id,
        actorId,
        action: 'DEAN_SEND_BACK',
        comment,
      },
    });
    await this.notifications.create(
      existing.submittedById,
      'Dean sent back workload package',
      comment,
    );
    return updated;
  }

  async escalateToPrincipal(id: string, actorId: string, comment?: string, schoolId?: string | null) {
    const existing = await this.assertSchoolApproval(id, schoolId);

    const updated = await this.prisma.approvalRequest.update({
      where: { id },
      data: { level: 'PRINCIPAL', status: 'PRINCIPAL_REVIEW', comment },
    });
    await this.prisma.approvalAuditLog.create({
      data: {
        approvalRequestId: id,
        actorId,
        action: 'ESCALATED_TO_PRINCIPAL',
        comment,
      },
    });
    await this.notifications.notifyRole(
      'PRINCIPAL',
      'Workload package escalated',
      comment || `Approval ${id} escalated to Principal.`,
    );
    return updated;
  }
}
