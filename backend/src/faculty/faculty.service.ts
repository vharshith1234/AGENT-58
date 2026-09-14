import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkloadService } from '../workload/workload.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  analyticsFromItems,
  demoProjectCards,
  demoResearchCards,
  mapRealProjects,
  mapRealResearch,
  type ActivityPortfolio,
} from './demo-activity';

@Injectable()
export class FacultyPortalService {
  constructor(
    private prisma: PrismaService,
    private workload: WorkloadService,
    private notifications: NotificationsService,
  ) {}

  async meWorkload(facultyId: string | null | undefined) {
    if (!facultyId) throw new ForbiddenException('No faculty profile linked');
    const faculty = await this.prisma.faculty.findUnique({
      where: { id: facultyId },
      include: { department: true },
    });
    if (!faculty) throw new NotFoundException();
    const breakdown = await this.workload.getCachedWorkload(facultyId);
    const latest = await this.prisma.workloadSnapshot.findFirst({
      where: { facultyId },
      orderBy: { calculatedAt: 'desc' },
    });
    const [allocations, projects, timetable, research, admin, phd, committees] =
      await Promise.all([
      this.prisma.courseAllocation.findMany({
        where: { facultyId },
        include: { course: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.project.findMany({
        where: {
          OR: [{ guideId: facultyId }, { coGuideId: facultyId }],
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.timetableSlot.findMany({
        where: { facultyId },
        include: { course: true },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      }),
      this.prisma.researchCommitment.findMany({ where: { facultyId } }),
      this.prisma.adminResponsibility.findMany({ where: { facultyId } }),
      this.prisma.phDSupervision.findMany({ where: { facultyId } }),
      this.prisma.committeeMembership.findMany({
        where: { facultyId },
        include: { committee: true },
      }),
    ]);
    return {
      faculty,
      breakdown,
      latestSnapshot: latest,
      allocations,
      projects,
      timetable,
      research,
      admin,
      phd,
      committees,
    };
  }

  async activityPortfolio(
    facultyId: string | null | undefined,
    kind: 'projects' | 'research',
  ): Promise<ActivityPortfolio> {
    if (!facultyId) throw new ForbiddenException('No faculty profile linked');
    const faculty = await this.prisma.faculty.findUnique({
      where: { id: facultyId },
      include: { department: true },
    });
    if (!faculty) throw new NotFoundException();
    const breakdown = await this.workload.getCachedWorkload(facultyId);
    const context = {
      id: faculty.id,
      name: faculty.name,
      departmentName: faculty.department.name,
    };

    if (kind === 'projects') {
      const rows = await this.prisma.project.findMany({
        where: { OR: [{ guideId: facultyId }, { coGuideId: facultyId }] },
        include: { guide: { select: { name: true } }, coGuide: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      });
      const real = mapRealProjects(facultyId, faculty.department.name, rows);
      const items = real.length ? real : demoProjectCards(context);
      return analyticsFromItems(
        'projects',
        items,
        breakdown.projectsWeighted,
        real.length ? 'REAL' : 'DEMO',
      );
    }

    const rows = await this.prisma.researchCommitment.findMany({
      where: { facultyId },
      orderBy: { createdAt: 'desc' },
    });
    const real = mapRealResearch(faculty.department.name, faculty.name, rows);
    const items = real.length ? real : demoResearchCards(context);
    return analyticsFromItems(
      'research',
      items,
      breakdown.researchWeighted,
      real.length ? 'REAL' : 'DEMO',
    );
  }

  async verify(facultyId: string | null | undefined, note?: string) {
    if (!facultyId) throw new ForbiddenException('No faculty profile linked');
    const snap = await this.workload.recalculateAndPersist(facultyId);
    await this.notifications.notifyRole(
      'HOD',
      'Faculty verified workload',
      `Faculty ${facultyId} verified statement.${note ? ' Note: ' + note : ''}`,
    );
    return { verified: true, snapshot: snap };
  }

  async submitCorrection(
    userId: string,
    facultyId: string | null | undefined,
    body: {
      issueCategory: string;
      description: string;
      targetRole?: string;
      currentValue?: string;
      expectedValue?: string;
    },
  ) {
    const correction = await this.prisma.correctionRequest.create({
      data: {
        submittedById: userId,
        facultyId: facultyId || undefined,
        issueCategory: body.issueCategory,
        targetRole: (body.targetRole as any) || 'HOD',
        description: body.description,
        currentValue: body.currentValue,
        expectedValue: body.expectedValue,
        status: 'PENDING',
      },
    });
    await this.notifications.notifyRole(
      'HR',
      'New correction request',
      `${body.issueCategory}: ${body.description}`,
    );
    await this.notifications.notifyRole(
      'HOD',
      'New correction request',
      `${body.issueCategory}: ${body.description}`,
    );
    await this.notifications.notifyRole(
      'DEAN',
      'New correction request',
      `${body.issueCategory}: ${body.description}`,
    );
    await this.notifications.notifyRole(
      'PRINCIPAL',
      'New correction request',
      `${body.issueCategory}: ${body.description}`,
    );
    return correction;
  }

  listMyCorrections(userId: string) {
    return this.prisma.correctionRequest.findMany({
      where: { submittedById: userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updatePhoto(
    facultyId: string | null | undefined,
    relativePath: string,
  ) {
    if (!facultyId) throw new ForbiddenException('No faculty profile linked');
    const updated = await this.prisma.faculty.update({
      where: { id: facultyId },
      data: { photoUrl: relativePath },
      select: {
        id: true,
        name: true,
        email: true,
        facultyCode: true,
        photoUrl: true,
        designation: true,
      },
    });
    await this.prisma.user.updateMany({
      where: { facultyId },
      data: { photoUrl: relativePath },
    });
    return updated;
  }

  async removePhoto(facultyId: string | null | undefined) {
    if (!facultyId) throw new ForbiddenException('No faculty profile linked');
    return this.prisma.faculty.update({
      where: { id: facultyId },
      data: { photoUrl: null },
      select: { id: true, photoUrl: true },
    });
  }

  async buildStatementPdf(facultyId: string | null | undefined) {
    if (!facultyId) throw new ForbiddenException('No faculty profile linked');
    const data = await this.meWorkload(facultyId);
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    let y = 800;
    const line = (text: string, size = 11, useBold = false) => {
      page.drawText(text, {
        x: 50,
        y,
        size,
        font: useBold ? bold : font,
        color: rgb(0.1, 0.1, 0.15),
      });
      y -= size + 8;
    };

    line('AGENT 58 — Faculty Workload Statement', 16, true);
    line(`Faculty: ${data.faculty.name} (${data.faculty.facultyCode})`);
    line(`Department: ${data.faculty.department.name}`);
    line(`Total weighted: ${data.breakdown.total.toFixed(2)}`);
    line(`Status: ${data.breakdown.status}`);
    line(`Norm: ${data.breakdown.normMin}–${data.breakdown.normMax} (expected ${data.breakdown.normExpected})`);
    line('');
    line('Breakdown', 13, true);
    line(`Theory: ${data.breakdown.theoryWeighted.toFixed(2)}`);
    line(`Tutorial: ${data.breakdown.tutorialWeighted.toFixed(2)}`);
    line(`Laboratory: ${data.breakdown.labWeighted.toFixed(2)}`);
    line(`UG Projects: ${data.breakdown.ugProjectsWeighted.toFixed(2)}`);
    line(`PG Projects: ${data.breakdown.pgProjectsWeighted.toFixed(2)}`);
    line(`PhD: ${data.breakdown.phdWeighted.toFixed(2)}`);
    line(`Committees: ${data.breakdown.committeeWeighted.toFixed(2)}`);
    line(`Research: ${data.breakdown.researchWeighted.toFixed(2)}`);
    line(`Admin: ${data.breakdown.adminWeighted.toFixed(2)}`);
    line('');
    line('Generated by Agent 58 · Vignan University', 9);

    return Buffer.from(await doc.save());
  }

  async buildStatementExcel(facultyId: string | null | undefined) {
    if (!facultyId) throw new ForbiddenException('No faculty profile linked');
    const data = await this.meWorkload(facultyId);
    const XLSX = await import('xlsx');
    const rows = [
      {
        Activity: 'Theory',
        Hours: data.breakdown.theoryRaw,
        Weighted: data.breakdown.theoryWeighted,
      },
      {
        Activity: 'Tutorial',
        Hours: data.breakdown.tutorialRaw,
        Weighted: data.breakdown.tutorialWeighted,
      },
      {
        Activity: 'Laboratory',
        Hours: data.breakdown.labRaw,
        Weighted: data.breakdown.labWeighted,
      },
      {
        Activity: 'UG Projects',
        Weighted: data.breakdown.ugProjectsWeighted,
      },
      {
        Activity: 'PG Projects',
        Weighted: data.breakdown.pgProjectsWeighted,
      },
      { Activity: 'PhD', Weighted: data.breakdown.phdWeighted },
      { Activity: 'Research', Weighted: data.breakdown.researchWeighted },
      { Activity: 'Administration', Weighted: data.breakdown.adminWeighted },
      { Activity: 'Committee', Weighted: data.breakdown.committeeWeighted },
      {
        Activity: 'TOTAL',
        Weighted: data.breakdown.total,
        Status: data.breakdown.status,
        Min: data.breakdown.normMin,
        Expected: data.breakdown.normExpected,
        Max: data.breakdown.normMax,
      },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Statement');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  async buildStatementCsv(facultyId: string | null | undefined) {
    if (!facultyId) throw new ForbiddenException('No faculty profile linked');
    const data = await this.meWorkload(facultyId);
    const XLSX = await import('xlsx');
    const rows = [
      { Activity: 'Theory', Hours: data.breakdown.theoryRaw, Weighted: data.breakdown.theoryWeighted },
      { Activity: 'Tutorial', Hours: data.breakdown.tutorialRaw, Weighted: data.breakdown.tutorialWeighted },
      { Activity: 'Laboratory', Hours: data.breakdown.labRaw, Weighted: data.breakdown.labWeighted },
      { Activity: 'UG Projects', Weighted: data.breakdown.ugProjectsWeighted },
      { Activity: 'PG Projects', Weighted: data.breakdown.pgProjectsWeighted },
      { Activity: 'PhD', Weighted: data.breakdown.phdWeighted },
      { Activity: 'Research', Weighted: data.breakdown.researchWeighted },
      { Activity: 'Administration', Weighted: data.breakdown.adminWeighted },
      { Activity: 'Committee', Weighted: data.breakdown.committeeWeighted },
      {
        Activity: 'TOTAL',
        Weighted: data.breakdown.total,
        Status: data.breakdown.status,
        Min: data.breakdown.normMin,
        Expected: data.breakdown.normExpected,
        Max: data.breakdown.normMax,
      },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Statement');
    return XLSX.write(wb, { type: 'buffer', bookType: 'csv' }) as Buffer;
  }
}
