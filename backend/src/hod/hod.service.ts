import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { cached, invalidateCache } from '../common/fast-cache';
import { PrismaService } from '../prisma/prisma.service';
import { WorkloadService } from '../workload/workload.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  mapClassType,
  normalizeClassType,
} from '../workload/designation-workload-rules';

/** Swappable Agent 25 PhD feed */
export interface PhdProvider {
  listForFaculty(facultyId: string): Promise<Array<{ scholarCount: number; share: number; role: string }>>;
}

/** Swappable Agent 56 committee feed */
export interface CommitteeProvider {
  listForFaculty(facultyId: string): Promise<Array<{ committeeName: string; role: string }>>;
}

@Injectable()
export class StubPhdProvider implements PhdProvider {
  constructor(private prisma: PrismaService) {}
  async listForFaculty(facultyId: string) {
    const rows = await this.prisma.phDSupervision.findMany({ where: { facultyId } });
    return rows.map((r) => ({
      scholarCount: r.scholarCount,
      share: r.share,
      role: r.role,
    }));
  }
}

@Injectable()
export class StubCommitteeProvider implements CommitteeProvider {
  constructor(private prisma: PrismaService) {}
  async listForFaculty(facultyId: string) {
    const rows = await this.prisma.committeeMembership.findMany({
      where: { facultyId },
      include: { committee: true },
    });
    return rows.map((r) => ({
      committeeName: r.committee.name,
      role: r.role,
    }));
  }
}

@Injectable()
export class HodService {
  constructor(
    private prisma: PrismaService,
    private workload: WorkloadService,
    private notifications: NotificationsService,
    private phdProvider: StubPhdProvider,
    private committeeProvider: StubCommitteeProvider,
  ) {}

  async dashboard(departmentId: string) {
    return cached(`hod:dash:${departmentId}`, 45_000, () =>
      this.buildDashboard(departmentId),
    );
  }

  private async buildDashboard(departmentId: string) {
    const [balance, courses, pendingAllocations, pending, academicCoverage, department] =
      await Promise.all([
        this.workload.getDepartmentBalance(departmentId),
        this.prisma.course.count({ where: { departmentId } }),
        this.prisma.course.count({
          where: { departmentId, allocations: { none: {} } },
        }),
        this.prisma.approvalRequest.findFirst({
          where: {
            departmentId,
            status: { in: ['PENDING', 'HOD_SUBMITTED', 'DEAN_SENT_BACK'] },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.academicCoverage(departmentId),
        this.prisma.department.findUnique({
          where: { id: departmentId },
          select: { id: true, code: true, name: true, dataSource: true },
        }),
      ]);
    const pack = (
      list: Array<{ total: number; status: string; dataSource?: string }>,
    ) => {
      const totals = list.map((f) => f.total);
      const avg =
        totals.length === 0
          ? 0
          : Math.round((totals.reduce((s, n) => s + n, 0) / totals.length) * 10) / 10;
      const overload = list.filter((f) => f.status === 'OVERLOAD');
      const underload = list.filter((f) => f.status === 'UNDERLOAD');
      const normal = list.filter((f) => f.status === 'NORMAL');
      return {
        totalFaculty: list.length,
        averageWorkload: avg,
        normal: normal.length,
        overloaded: overload.length,
        underloaded: underload.length,
        workloadBalanceScore:
          list.length === 0 ? 100 : Math.round((normal.length / list.length) * 1000) / 10,
      };
    };
    const realFac = balance.faculty.filter((f) => f.dataSource !== 'DEMO');
    const demoFac = balance.faculty.filter((f) => f.dataSource === 'DEMO');
    const all = pack(balance.faculty);
    return {
      courses,
      balance,
      department,
      pendingApproval: pending,
      pendingAllocations,
      ...all,
      real: pack(realFac),
      demo: pack(demoFac),
      academicCoverage,
      pendingApprovals: pending ? 1 : 0,
      dataNote:
        'Department workload across years, sections, and faculty load status. DEMO DATA labels mark synthetic academic coverage.',
    };
  }

  private yearOf(course: {
    semester: number;
    section?: string | null;
    academicYear?: string | null;
  }) {
    const ay = String(course.academicYear || '');
    if (ay === '1' || ay === '2' || ay === '3' || ay === '4') return Number(ay);
    const sec = String(course.section || '');
    if (sec === '7') return 4;
    const sem = Number(course.semester || 0);
    if (sem === 1 || sem === 2) return 1;
    if (sem === 3 || sem === 4) return 2;
    if (sem === 5 || sem === 6) return 3;
    if (sem === 7 || sem === 8) return 4;
    return 0;
  }

  async academicCoverage(departmentId: string) {
    return cached(`hod:coverage:${departmentId}`, 45_000, () =>
      this.loadAcademicCoverage(departmentId),
    );
  }

  private async loadAcademicCoverage(departmentId: string) {
    const [courses, slots] = await Promise.all([
      this.prisma.course.findMany({
        where: { departmentId },
        include: {
          allocations: {
            include: {
              faculty: {
                select: { id: true, name: true, dataSource: true },
              },
            },
          },
        },
        orderBy: { code: 'asc' },
      }),
      this.prisma.timetableSlot.findMany({
        where: { course: { departmentId } },
        select: { courseId: true, batchLabel: true, facultyId: true },
      }),
    ]);
    const cells = new Map<
      string,
      {
        year: number;
        section: string;
        dataSource: string;
        courses: number;
        allocations: number;
        slots: number;
        faculty: Set<string>;
        subjects: Array<{
          code: string;
          name: string;
          facultyId: string;
          faculty: string;
          hours: number;
          dataSource: string;
        }>;
      }
    >();
    const bump = (year: number, section: string, dataSource: string) => {
      const key = `${year}|${section}|${dataSource}`;
      let cell = cells.get(key);
      if (!cell) {
        cell = {
          year,
          section,
          dataSource,
          courses: 0,
          allocations: 0,
          slots: 0,
          faculty: new Set(),
          subjects: [],
        };
        cells.set(key, cell);
      }
      return cell;
    };
    for (const course of courses) {
      const year = this.yearOf(course);
      const allocSections = new Set(
        course.allocations.map((a) => a.section || course.section || 'A'),
      );
      if (allocSections.size === 0) allocSections.add(course.section || '—');
      for (const section of allocSections) {
        const cell = bump(year || 0, section, course.dataSource || 'REAL');
        cell.courses += 1;
        for (const a of course.allocations.filter(
          (row) => (row.section || course.section || 'A') === section,
        )) {
          cell.allocations += 1;
          if (a.faculty?.name) cell.faculty.add(a.faculty.name);
          cell.subjects.push({
            code: course.code,
            name: course.name,
            facultyId: a.facultyId,
            faculty: a.faculty?.name || 'Unassigned',
            hours: a.hours,
            dataSource: a.dataSource || course.dataSource || 'REAL',
          });
        }
      }
    }
    for (const slot of slots) {
      const course = courses.find((c) => c.id === slot.courseId);
      if (!course) continue;
      const year = this.yearOf(course);
      const section = slot.batchLabel || course.section || 'A';
      bump(year || 0, section, course.dataSource || 'REAL').slots += 1;
    }
    const rows = Array.from(cells.values())
      .map((c) => ({
        year: c.year,
        section: c.section,
        dataSource: c.dataSource,
        courses: c.courses,
        allocations: c.allocations,
        slots: c.slots,
        facultyCount: c.faculty.size,
        faculty: Array.from(c.faculty),
        subjects: c.subjects,
      }))
      .sort(
        (a, b) =>
          a.year - b.year ||
          String(a.section).localeCompare(String(b.section)) ||
          a.dataSource.localeCompare(b.dataSource),
      );
    return {
      years: Array.from(new Set(rows.map((r) => r.year).filter(Boolean))),
      sections: Array.from(new Set(rows.map((r) => r.section).filter(Boolean))),
      rows,
    };
  }

  listFaculty(departmentId: string) {
    return this.workload.getDepartmentBalance(departmentId);
  }

  async facultyDetail(departmentId: string, facultyId: string) {
    const faculty = await this.prisma.faculty.findFirst({
      where: { id: facultyId, departmentId },
      include: {
        department: true,
        affiliations: { include: { department: true } },
        adminRoles: true,
        headedDepartments: { select: { id: true, code: true, name: true } },
      },
    });
    if (!faculty) throw new NotFoundException('Faculty not found');
    const [breakdown, allocations, timetable, projects, research, admin, phd, committees] =
      await Promise.all([
        this.workload.getCachedWorkload(facultyId),
        this.prisma.courseAllocation.findMany({
          where: { facultyId },
          include: { course: true },
        }),
        this.prisma.timetableSlot.findMany({
          where: { facultyId },
          include: { course: true },
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        }),
        this.prisma.project.findMany({
          where: { OR: [{ guideId: facultyId }, { coGuideId: facultyId }] },
        }),
        this.prisma.researchCommitment.findMany({ where: { facultyId } }),
        this.prisma.adminResponsibility.findMany({ where: { facultyId } }),
        this.phdProvider.listForFaculty(facultyId),
        this.committeeProvider.listForFaculty(facultyId),
      ]);
    return {
      faculty,
      breakdown,
      allocations,
      timetable,
      projects,
      research,
      admin,
      phd,
      committees,
    };
  }

  listCourses(departmentId: string) {
    return this.prisma.course.findMany({
      where: { departmentId },
      include: { allocations: { include: { faculty: true } } },
      orderBy: { code: 'asc' },
    });
  }

  async createCourse(departmentId: string, body: Record<string, unknown>) {
    const dept = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: { dataSource: true },
    });
    return this.prisma.course.create({
      data: {
        code: String(body.code),
        name: String(body.name),
        semester: Number(body.semester || 1),
        credits: Number(body.credits || 3),
        type: String(body.type || 'THEORY'),
        hoursPerWeek: Number(body.hoursPerWeek || 3),
        students: Number(body.students || 0),
        section: body.section ? String(body.section) : null,
        academicYear: body.academicYear ? String(body.academicYear) : '2026-27',
        status: String(body.status || 'ACTIVE'),
        dataSource: dept?.dataSource === 'DEMO' ? 'DEMO' : 'REAL',
        departmentId,
      },
    });
  }

  async updateCourse(departmentId: string, id: string, body: Record<string, unknown>) {
    const existing = await this.prisma.course.findFirst({
      where: { id, departmentId },
    });
    if (!existing) throw new NotFoundException('Course not found');
    const updated = await this.prisma.course.update({
      where: { id },
      data: {
        name: body.name != null ? String(body.name) : undefined,
        semester: body.semester != null ? Number(body.semester) : undefined,
        credits: body.credits != null ? Number(body.credits) : undefined,
        type: body.type != null ? String(body.type) : undefined,
        hoursPerWeek: body.hoursPerWeek != null ? Number(body.hoursPerWeek) : undefined,
        students: body.students != null ? Number(body.students) : undefined,
        section: body.section != null ? String(body.section) : undefined,
        academicYear: body.academicYear != null ? String(body.academicYear) : undefined,
        status: body.status != null ? String(body.status) : undefined,
      },
    });
    await this.workload.audit({ role: 'HOD' }, 'COURSE_UPDATED', 'Course', id, {
      oldValue: existing,
      newValue: updated,
    });
    return updated;
  }

  listAllocations(departmentId: string) {
    return this.prisma.courseAllocation.findMany({
      where: { course: { departmentId } },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            section: true,
            hoursPerWeek: true,
            departmentId: true,
          },
        },
        faculty: {
          select: {
            id: true,
            name: true,
            facultyCode: true,
            designation: true,
            email: true,
            photoUrl: true,
            photoThumbUrl: true,
            dataSource: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async allocate(
    departmentId: string,
    body: {
      courseId: string;
      facultyId: string;
      hours: number;
      section?: string;
      classType?: string;
      confirmOverload?: boolean;
      justification?: string;
      preview?: boolean;
    },
  ) {
    const course = await this.prisma.course.findUnique({
      where: { id: body.courseId },
    });
    if (!course) throw new NotFoundException('Course not found');
    if (course.departmentId !== departmentId) {
      throw new ForbiddenException('Unauthorized access.');
    }
    const faculty = await this.prisma.faculty.findUnique({
      where: { id: body.facultyId },
    });
    if (!faculty || faculty.departmentId !== departmentId) {
      throw new ForbiddenException('Unauthorized access.');
    }

    const classType = normalizeClassType(body.classType);
    if (body.classType && !classType) {
      throw new BadRequestException('classType must be L, T, or P.');
    }

    const existing = await this.prisma.courseAllocation.findMany({
      where: { facultyId: body.facultyId },
      include: { course: true },
    });
    const courseTypeFromCourse = (
      type: string,
    ): 'THEORY' | 'TUTORIAL' | 'LABORATORY' | 'PROJECT' => {
      if (['TUTORIAL', 'LABORATORY', 'PROJECT'].includes(type)) {
        return type as 'THEORY' | 'TUTORIAL' | 'LABORATORY' | 'PROJECT';
      }
      if (type === 'LAB') return 'LABORATORY';
      return 'THEORY';
    };
    const current = await this.workload.calculateWorkload(body.facultyId);
    const projected = await this.workload.simulateFaculty(body.facultyId, {
      allocations: [
        ...existing.map((a) => ({
          hours: a.hours,
          courseType:
            mapClassType(a.classType) || courseTypeFromCourse(a.course.type),
        })),
        {
          hours: body.hours,
          courseType:
            mapClassType(classType) || courseTypeFromCourse(course.type),
        },
      ],
    });

    const alternatives =
      projected.status === 'OVERLOAD'
        ? (await this.workload.getDepartmentBalance(departmentId)).faculty
            .filter((f) => f.facultyId !== body.facultyId)
            .map((f) => ({
              facultyId: f.facultyId,
              name: f.name,
              current: f.total,
              capacity: f.availableCapacity,
              projected: f.total + body.hours,
              suitable: (f.availableCapacity || 0) >= body.hours,
            }))
            .sort((a, b) => Number(b.suitable) - Number(a.suitable) || b.capacity - a.capacity)
        : [];

    const preCheck = { before: current, after: projected, alternatives };

    if (body.preview) {
      return { preview: true, preCheck };
    }

    if (projected.status === 'OVERLOAD' && !body.confirmOverload) {
      throw new ConflictException({
        message: 'Course allocation exceeds workload limit.',
        code: 'OVERLOAD_WARNING',
        preCheck,
      });
    }

    if (projected.status === 'OVERLOAD' && !String(body.justification || '').trim()) {
      throw new BadRequestException(
        'Justification is required to proceed with an overload allocation.',
      );
    }

    const alloc = await this.prisma.courseAllocation.create({
      data: {
        courseId: body.courseId,
        facultyId: body.facultyId,
        hours: body.hours,
        section: body.section || course.section,
        classType,
        justification: body.justification || null,
        dataSource: faculty.dataSource === 'DEMO' ? 'DEMO' : 'REAL',
      },
    });
    await this.workload.recalculateAndPersist(body.facultyId);
    await this.workload.audit(
      { role: 'HOD' },
      'ALLOCATE_COURSE',
      'CourseAllocation',
      alloc.id,
      {
        newValue: {
          courseId: body.courseId,
          facultyId: body.facultyId,
          hours: body.hours,
          classType,
          section: body.section || course.section,
        },
      },
    );

    if (projected.status === 'OVERLOAD') {
      await this.notifications.notifyRole(
        'HOD',
        'Allocation may cause overload',
        `${faculty.name} projected ${projected.total.toFixed(1)} after allocation (max ${projected.normMax}).`,
        course.departmentId,
      );
    } else {
      const linked = await this.prisma.user.findFirst({
        where: { facultyId: faculty.id },
      });
      if (linked) {
        await this.notifications.create(
          linked.id,
          'New course allocation',
          `${course.code} was allocated to you.`,
        );
      }
    }

    return { allocation: alloc, preCheck };
  }

  async updateAllocation(
    departmentId: string,
    allocationId: string,
    body: {
      hours?: number;
      section?: string;
      classType?: string;
      facultyId?: string;
      courseId?: string;
      confirmOverload?: boolean;
      justification?: string;
    },
  ) {
    const existing = await this.prisma.courseAllocation.findUnique({
      where: { id: allocationId },
      include: { course: true, faculty: true },
    });
    if (!existing || existing.course.departmentId !== departmentId) {
      throw new NotFoundException('Allocation not found');
    }

    const classType =
      body.classType !== undefined
        ? normalizeClassType(body.classType)
        : normalizeClassType(existing.classType);
    if (body.classType && !classType) {
      throw new BadRequestException('classType must be L, T, or P.');
    }

    const nextHours =
      body.hours != null && Number.isFinite(Number(body.hours))
        ? Number(body.hours)
        : existing.hours;
    if (nextHours <= 0) {
      throw new BadRequestException('Hours must be a positive number.');
    }

    const updated = await this.prisma.courseAllocation.update({
      where: { id: allocationId },
      data: {
        hours: nextHours,
        section: body.section !== undefined ? body.section || null : existing.section,
        classType: classType || existing.classType,
        courseId: body.courseId || existing.courseId,
        facultyId: body.facultyId || existing.facultyId,
        justification:
          body.justification !== undefined
            ? body.justification || null
            : existing.justification,
      },
      include: { course: true, faculty: true },
    });

    await this.workload.recalculateAndPersist(updated.facultyId);
    if (existing.facultyId !== updated.facultyId) {
      await this.workload.recalculateAndPersist(existing.facultyId);
    }

    return updated;
  }

  async deleteAllocation(departmentId: string, allocationId: string) {
    const existing = await this.prisma.courseAllocation.findUnique({
      where: { id: allocationId },
      include: { course: true },
    });
    if (!existing || existing.course.departmentId !== departmentId) {
      throw new NotFoundException('Allocation not found');
    }
    await this.prisma.courseAllocation.delete({ where: { id: allocationId } });
    await this.workload.recalculateAndPersist(existing.facultyId);
    return { ok: true, id: allocationId };
  }

  listTimetable(departmentId: string) {
    return this.prisma.timetableSlot.findMany({
      where: { course: { departmentId } },
      include: { course: true, faculty: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  private timeToMinutes(t: string) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  async addTimetableSlot(body: Record<string, unknown>) {
    const facultyId = String(body.facultyId);
    const dayOfWeek = Number(body.dayOfWeek);
    const startTime = String(body.startTime);
    const endTime = String(body.endTime);
    const start = this.timeToMinutes(startTime);
    const end = this.timeToMinutes(endTime);
    if (end <= start) throw new BadRequestException('Invalid time range');

    const existing = await this.prisma.timetableSlot.findMany({
      where: {
        dayOfWeek,
        OR: [{ facultyId }, ...(body.room ? [{ room: String(body.room) }] : [])],
      },
    });
    for (const s of existing) {
      const sStart = this.timeToMinutes(s.startTime);
      const sEnd = this.timeToMinutes(s.endTime);
      if (start < sEnd && end > sStart) {
        const kind = s.facultyId === facultyId ? 'Faculty clash' : 'Room clash';
        throw new BadRequestException(
          `${kind} with existing slot ${s.startTime}-${s.endTime}`,
        );
      }
    }

    const durationHrs = (end - start) / 60;
    const slot = await this.prisma.timetableSlot.create({
      data: {
        courseId: String(body.courseId),
        facultyId,
        dayOfWeek,
        startTime,
        endTime,
        room: body.room ? String(body.room) : null,
        contactType: (body.contactType as any) || 'THEORY',
        durationHrs,
        batchLabel: body.batchLabel ? String(body.batchLabel) : null,
        dataSource: 'REAL',
      },
    });
    await this.workload.recalculateAndPersist(facultyId);
    return slot;
  }

  async previewTimetableRows(
    departmentId: string,
    rows: Array<Record<string, string | number>>,
  ) {
    const results = [];
    for (const row of rows) {
      const faculty = await this.prisma.faculty.findFirst({
        where: {
          departmentId,
          OR: [
            { facultyCode: String(row.facultyCode || row['Faculty ID'] || '') },
            { email: String(row.facultyEmail || '') },
          ],
        },
      });
      const course = await this.prisma.course.findFirst({
        where: {
          departmentId,
          code: String(row.courseCode || row['Course Code'] || ''),
        },
      });
      if (!faculty || !course) {
        results.push({ ok: false, row, error: 'Faculty or course not found' });
        continue;
      }
      const startTime = String(row.startTime || row['Start Time'] || '');
      const endTime = String(row.endTime || row['End Time'] || '');
      if (!startTime || !endTime || startTime >= endTime) {
        results.push({ ok: false, row, error: 'Invalid time' });
        continue;
      }
      results.push({
        ok: true,
        row,
        resolved: {
          facultyId: faculty.id,
          facultyName: faculty.name,
          courseId: course.id,
          courseCode: course.code,
        },
      });
    }
    return {
      preview: true,
      valid: results.filter((r) => r.ok).length,
      invalid: results.filter((r) => !r.ok).length,
      results,
    };
  }

  async importTimetableRows(
    departmentId: string,
    rows: Array<Record<string, string | number>>,
    confirm = false,
  ) {
    if (!confirm) {
      return this.previewTimetableRows(departmentId, rows);
    }
    const results = [];
    for (const row of rows) {
      const faculty = await this.prisma.faculty.findFirst({
        where: {
          departmentId,
          OR: [
            { facultyCode: String(row.facultyCode || row['Faculty ID'] || '') },
            { email: String(row.facultyEmail || '') },
          ],
        },
      });
      const course = await this.prisma.course.findFirst({
        where: {
          departmentId,
          code: String(row.courseCode || row['Course Code'] || ''),
        },
      });
      if (!faculty || !course) {
        results.push({ ok: false, row, error: 'Faculty or course not found' });
        continue;
      }
      try {
        const slot = await this.addTimetableSlot({
          courseId: course.id,
          facultyId: faculty.id,
          dayOfWeek: Number(row.dayOfWeek ?? this.dayNameToNumber(String(row.Day || row.day || ''))),
          startTime: String(row.startTime || row['Start Time'] || ''),
          endTime: String(row.endTime || row['End Time'] || ''),
          room: row.room || row.Room,
          contactType: row.contactType || row.Type || 'THEORY',
          batchLabel: row.section || row.Section,
        });
        results.push({ ok: true, slot });
      } catch (e: any) {
        results.push({ ok: false, row, error: e.message });
      }
    }
    return results;
  }

  parseTimetableWorkbook(buffer: Buffer) {
    const XLSX = require('xlsx') as typeof import('xlsx');
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet);
  }

  listProjects(departmentId: string) {
    return this.prisma.project.findMany({
      where: { guide: { departmentId } },
      include: { guide: true, coGuide: true },
    });
  }

  async createProject(body: Record<string, unknown>) {
    const project = await this.prisma.project.create({
      data: {
        title: String(body.title),
        studentCount: Number(body.studentCount || 1),
        guideId: String(body.guideId),
        coGuideId: body.coGuideId ? String(body.coGuideId) : null,
        semester: Number(body.semester || 8),
        level: String(body.level || 'UG'),
        guideShare: Number(body.guideShare ?? 0.7),
      },
    });
    await this.workload.recalculateAndPersist(project.guideId);
    return project;
  }

  listResearch(departmentId: string) {
    return this.prisma.researchCommitment.findMany({
      where: { faculty: { departmentId } },
      include: { faculty: true },
    });
  }

  async createResearch(body: Record<string, unknown>) {
    const row = await this.prisma.researchCommitment.create({
      data: {
        facultyId: String(body.facultyId),
        projectTitle: String(body.projectTitle),
        role: String(body.role || 'PI'),
        commitmentPct: Number(body.commitmentPct || 10),
        status: String(body.status || 'Active'),
      },
    });
    await this.workload.recalculateAndPersist(row.facultyId);
    return row;
  }

  listAdmin(departmentId: string) {
    return this.prisma.adminResponsibility.findMany({
      where: { faculty: { departmentId } },
      include: { faculty: true },
    });
  }

  async createAdmin(body: Record<string, unknown>) {
    const row = await this.prisma.adminResponsibility.create({
      data: {
        facultyId: String(body.facultyId),
        roleName: String(body.roleName),
        weightOverride:
          body.weightOverride != null ? Number(body.weightOverride) : null,
        duration: String(body.duration || 'AY'),
      },
    });
    await this.workload.recalculateAndPersist(row.facultyId);
    return row;
  }

  async externalFeeds(facultyId: string) {
    return {
      phd: await this.phdProvider.listForFaculty(facultyId),
      committees: await this.committeeProvider.listForFaculty(facultyId),
    };
  }

  private dayNameToNumber(day: string) {
    const map: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };
    if (/^[0-6]$/.test(day)) return Number(day);
    return map[day.trim().toLowerCase()] ?? 1;
  }

  async deleteTimetableSlot(departmentId: string, id: string) {
    const slot = await this.prisma.timetableSlot.findUnique({
      where: { id },
      include: { course: true },
    });
    if (!slot || slot.course.departmentId !== departmentId) {
      throw new NotFoundException('Slot not found');
    }
    await this.prisma.timetableSlot.delete({ where: { id } });
    if (slot.facultyId) {
      await this.workload.recalculateAndPersist(slot.facultyId);
    }
    return { ok: true };
  }

  listCommittees(departmentId: string) {
    return this.prisma.committeeMembership.findMany({
      where: { faculty: { departmentId } },
      include: { faculty: true, committee: true },
    });
  }

  async createCommittee(body: Record<string, unknown>) {
    const name = String(body.committeeName || body.name || 'Committee');
    let committee = await this.prisma.committee.findFirst({ where: { name } });
    if (!committee) {
      committee = await this.prisma.committee.create({ data: { name } });
    }
    const row = await this.prisma.committeeMembership.create({
      data: {
        committeeId: committee.id,
        facultyId: String(body.facultyId),
        role: String(body.role || 'Member'),
        startDate: new Date(),
        source: 'AGENT56',
      },
    });
    await this.workload.recalculateAndPersist(row.facultyId);
    return row;
  }

  async submitForApproval(departmentId: string, userId: string) {
    const period = await this.prisma.academicPeriod.findFirst({
      where: { isActive: true },
    });
    if (!period) throw new BadRequestException('No active period');

    await this.workload.recalculateDepartment(departmentId);
    const balance = await this.workload.getDepartmentBalance(departmentId);

    const approval = await this.prisma.approvalRequest.create({
      data: {
        departmentId,
        periodId: period.id,
        submittedById: userId,
        level: 'DEAN',
        status: 'HOD_SUBMITTED',
        summaryJson: JSON.stringify({
          facultyCount: balance.faculty.length,
          overload: balance.faculty.filter((f) => f.status === 'OVERLOAD').length,
          underload: balance.faculty.filter((f) => f.status === 'UNDERLOAD').length,
          suggestions: balance.suggestions.length,
        }),
      },
    });

    await this.prisma.approvalAuditLog.create({
      data: {
        approvalRequestId: approval.id,
        actorId: userId,
        action: 'HOD_SUBMITTED',
        comment: 'HOD submitted department workload package',
      },
    });

    await this.notifications.notifyRole(
      'DEAN',
      'Workload package submitted',
      `Department ${departmentId} submitted for Dean approval.`,
    );

    return approval;
  }

  async listCorrections(departmentId: string) {
    const faculty = await this.prisma.faculty.findMany({
      where: { departmentId },
      select: { id: true },
    });
    const ids = faculty.map((f) => f.id);
    return this.prisma.correctionRequest.findMany({
      where: ids.length
        ? {
            OR: [
              { facultyId: { in: ids } },
              { submittedBy: { departmentId } },
            ],
          }
        : { submittedBy: { departmentId } },
      include: { submittedBy: true, reviewedBy: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewCorrection(
    departmentId: string,
    id: string,
    body: { status: 'APPROVED' | 'REJECTED'; note?: string },
    reviewerId: string,
  ) {
    const rows = await this.listCorrections(departmentId);
    const match = rows.find((r) => r.id === id);
    if (!match) throw new NotFoundException('Correction not found');
    const updated = await this.prisma.correctionRequest.update({
      where: { id },
      data: {
        status: body.status,
        resolutionNote: body.note,
        reviewedById: reviewerId,
      },
    });
    await this.notifications.create(
      updated.submittedById,
      `Correction ${body.status.toLowerCase()}`,
      body.note || `Your correction request was ${body.status.toLowerCase()}.`,
    );
    return updated;
  }
}
