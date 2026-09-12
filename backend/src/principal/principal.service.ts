import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkloadService } from '../workload/workload.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PrincipalService {
  constructor(
    private prisma: PrismaService,
    private workload: WorkloadService,
    private notifications: NotificationsService,
  ) {}

  async dashboard() {
    const [summary, schools, pendingApprovals] = await Promise.all([
      this.workload.institutionSummary(),
      this.prisma.school.count(),
      this.prisma.approvalRequest.count({
        where: {
          level: 'PRINCIPAL',
          status: { in: ['PRINCIPAL_REVIEW', 'DEAN_APPROVED'] },
        },
      }),
    ]);
    return {
      ...summary,
      schools,
      pendingApprovals,
      real: summary.real,
      demo: summary.demo,
      dataNote: summary.dataNote,
    };
  }

  searchFaculty(query: Record<string, string | undefined>) {
    return this.workload.searchFaculty(query);
  }

  async hierarchy() {
    const [schools, summary] = await Promise.all([
      this.prisma.school.findMany({
        include: {
          departments: {
            include: { _count: { select: { faculty: true } } },
          },
        },
      }),
      this.workload.institutionSummary(),
    ]);
    return schools.map((school) => ({
      ...school,
      departments: school.departments.map((d) => {
      const row = (summary.allRows || summary.rows).find(
        (r) => r.departmentId === d.id && r.dataSource !== 'DEMO',
      ) || (summary.allRows || summary.rows).find((r) => r.departmentId === d.id);
        return {
          ...d,
          dataSource: d.dataSource,
          compliance: {
            overload: row?.OVERLOAD || 0,
            underload: row?.UNDERLOAD || 0,
            normal: row?.NORMAL || 0,
            indeterminate: 0,
          },
        };
      }),
    }));
  }

  async compliance() {
    const summary = await this.workload.institutionSummary();
    return summary.rows.map((r) => ({
      school: r.school,
      department: r.departmentName,
      departmentCode: r.departmentCode,
      code: r.departmentCode,
      totalFaculty: r.facultyCount,
      overload: r.OVERLOAD,
      underload: r.UNDERLOAD,
      normal: r.NORMAL,
    }));
  }

  listEscalated() {
    return this.prisma.approvalRequest.findMany({
      where: { level: 'PRINCIPAL' },
      include: { submittedBy: true, period: true, auditLogs: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(id: string, actorId: string, comment?: string) {
    const existing = await this.prisma.approvalRequest.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException();

    const updated = await this.prisma.approvalRequest.update({
      where: { id },
      data: { status: 'PRINCIPAL_APPROVED', comment },
    });
    await this.prisma.approvalAuditLog.create({
      data: {
        approvalRequestId: id,
        actorId,
        action: 'PRINCIPAL_APPROVED',
        comment,
      },
    });
    await this.notifications.create(
      existing.submittedById,
      'Principal approved workload package',
      comment || 'Package approved at Principal level.',
    );
    return updated;
  }

  async finalize(id: string, actorId: string, comment?: string) {
    const existing = await this.prisma.approvalRequest.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException();

    const updated = await this.prisma.approvalRequest.update({
      where: { id },
      data: { status: 'FINALIZED', comment },
    });
    await this.prisma.approvalAuditLog.create({
      data: {
        approvalRequestId: id,
        actorId,
        action: 'FINALIZED',
        comment,
      },
    });
    return updated;
  }

  async sendBack(id: string, actorId: string, comment: string) {
    const existing = await this.prisma.approvalRequest.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException();
    const updated = await this.prisma.approvalRequest.update({
      where: { id },
      data: { status: 'PRINCIPAL_SENT_BACK', comment },
    });
    await this.prisma.approvalAuditLog.create({
      data: {
        approvalRequestId: id,
        actorId,
        action: 'PRINCIPAL_SEND_BACK',
        comment,
      },
    });
    await this.notifications.create(
      existing.submittedById,
      'Principal sent back workload package',
      comment,
    );
    return updated;
  }
}
