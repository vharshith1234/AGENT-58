import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkloadService } from './workload.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { AuthUser } from '../common/scope';

function statusFromTotal(total: number, min: number, max: number) {
  if (total < min) return 'UNDERLOAD';
  if (total > max) return 'OVERLOAD';
  return 'NORMAL';
}

@Injectable()
export class ReassignmentService {
  constructor(
    private prisma: PrismaService,
    private workload: WorkloadService,
    private notifications: NotificationsService,
  ) {}

  private async loadBreakdown(facultyId: string) {
    return this.workload.getCachedWorkload(facultyId);
  }

  async todaySlots(facultyId: string, dateIso?: string) {
    const d = dateIso ? new Date(dateIso) : new Date();
    // JS: 0=Sun … map to 1=Mon … 7=Sun. Real-time: only this calendar day's slots.
    const jsDay = d.getDay();
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;
    return this.prisma.timetableSlot.findMany({
      where: { facultyId, dayOfWeek },
      include: { course: true, faculty: true },
      orderBy: { startTime: 'asc' },
    });
  }

  async recommendCandidates(
    fromFacultyId: string,
    hours: number,
    departmentId?: string,
    courseId?: string,
  ) {
    const from = await this.prisma.faculty.findUnique({ where: { id: fromFacultyId } });
    if (!from) throw new NotFoundException('Faculty not found');
    const deptId = departmentId || from.departmentId;
    const hrs = Number(hours || 0) || 1;

    const peers = await this.prisma.faculty.findMany({
      where: {
        departmentId: deptId,
        status: 'Active',
        id: { not: fromFacultyId },
        OR: [{ user: { is: null } }, { user: { role: { in: ['FACULTY', 'HOD', 'DEAN', 'HR'] } } }],
      },
      select: { id: true, name: true, facultyCode: true },
    });

    let course: { id: string; code: string; name: string } | null = null;
    const sameCourseIds = new Set<string>();
    const sameSubjectIds = new Set<string>();

    if (courseId) {
      course = await this.prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true, code: true, name: true },
      });
      if (course) {
        const relatedCourses = await this.prisma.course.findMany({
          where: {
            departmentId: deptId,
            OR: [
              { id: course.id },
              { code: course.code },
              { name: { equals: course.name, mode: 'insensitive' } },
            ],
          },
          select: { id: true, code: true, name: true },
        });
        const relatedIds = relatedCourses.map((c) => c.id);
        const exactCodeIds = new Set(
          relatedCourses.filter((c) => c.code === course!.code).map((c) => c.id),
        );

        const [allocs, slots] = await Promise.all([
          this.prisma.courseAllocation.findMany({
            where: {
              courseId: { in: relatedIds },
              facultyId: { not: fromFacultyId },
              faculty: { departmentId: deptId, status: 'Active' },
            },
            select: { facultyId: true, courseId: true },
          }),
          this.prisma.timetableSlot.findMany({
            where: {
              courseId: { in: relatedIds },
              facultyId: { not: fromFacultyId },
              faculty: { departmentId: deptId, status: 'Active' },
            },
            select: { facultyId: true, courseId: true },
          }),
        ]);

        for (const row of [...allocs, ...slots]) {
          if (!row.facultyId) continue;
          if (exactCodeIds.has(row.courseId) || row.courseId === course.id) {
            sameCourseIds.add(row.facultyId);
          } else {
            sameSubjectIds.add(row.facultyId);
          }
        }
      }
    }

    type Ranked = {
      facultyId: string;
      name: string;
      facultyCode: string | null;
      current: number;
      hours: number;
      projected: number;
      currentStatus: string;
      projectedStatus: string;
      recommended: boolean;
      capacity: number;
      sameCourse: boolean;
      sameSubject: boolean;
      academicFit: 'SAME_COURSE' | 'SAME_SUBJECT' | 'NONE';
      score: number;
    };

    const ranked: Ranked[] = [];
    for (const p of peers) {
      const b = await this.loadBreakdown(p.id);
      const current = Number(b.total || 0);
      const projected = current + hrs;
      const projectedStatus = statusFromTotal(projected, b.normMin, b.normMax);
      const sameCourse = sameCourseIds.has(p.id);
      const sameSubject = sameSubjectIds.has(p.id) || sameCourse;
      const academicFit = sameCourse ? 'SAME_COURSE' : sameSubjectIds.has(p.id) ? 'SAME_SUBJECT' : 'NONE';

      let score = 0;
      if (sameCourse) score += 100;
      else if (sameSubjectIds.has(p.id)) score += 60;
      if (projectedStatus === 'UNDERLOAD') score += 30;
      else if (projectedStatus === 'NORMAL') score += 15;
      else score -= 100;
      score += Math.min(20, Math.max(0, b.normMax - current));

      ranked.push({
        facultyId: p.id,
        name: p.name,
        facultyCode: p.facultyCode,
        current,
        hours: hrs,
        projected,
        currentStatus: b.status,
        projectedStatus,
        recommended: projectedStatus !== 'OVERLOAD',
        capacity: Math.max(0, b.normMax - current),
        sameCourse,
        sameSubject,
        academicFit,
        score,
      });
    }

    const byStatusThenLoad = (a: (typeof ranked)[0], b: (typeof ranked)[0]) => {
      const rank = (s: string) => (s === 'UNDERLOAD' ? 0 : s === 'NORMAL' ? 1 : 2);
      const ra = rank(a.projectedStatus);
      const rb = rank(b.projectedStatus);
      if (ra !== rb) return ra - rb;
      return a.projected - b.projected;
    };

    const byLoad = [...ranked].filter((r) => r.recommended).sort(byStatusThenLoad);
    const byCourse = [...ranked]
      .filter((r) => r.sameSubject && r.recommended)
      .sort((a, b) => {
        if (a.sameCourse !== b.sameCourse) return a.sameCourse ? -1 : 1;
        return byStatusThenLoad(a, b);
      });
    const best = [...ranked]
      .filter((r) => r.recommended)
      .sort((a, b) => b.score - a.score || byStatusThenLoad(a, b));

    return {
      course: course
        ? { id: course.id, code: course.code, name: course.name }
        : null,
      /** Academic fit: already teaching same course code or same subject title */
      byCourse,
      /** Capacity fit: underload / normal after taking hours */
      byLoad,
      /** Combined best: same course preferred + still within norms */
      best,
      recommended: byLoad,
      notRecommended: ranked.filter((r) => !r.recommended).sort(byStatusThenLoad),
      all: ranked,
    };
  }

  async createLeaveAndReassignment(
    user: AuthUser,
    body: {
      date: string;
      reason: string;
      toFacultyId: string;
      timetableSlotId?: string;
      courseId?: string;
      allocationId?: string;
      startTime?: string;
      endTime?: string;
      hours?: number;
      section?: string;
    },
  ) {
    if (!user.facultyId) throw new ForbiddenException('Faculty profile required');
    if (!body.toFacultyId) throw new BadRequestException('toFacultyId required');
    if (!body.reason?.trim()) throw new BadRequestException('reason required');

    const fromId = user.facultyId;
    let hours = Number(body.hours || 0);
    let courseId = body.courseId || null;
    let section = body.section || null;
    let startTime = body.startTime || null;
    let endTime = body.endTime || null;
    let allocationId = body.allocationId || null;
    const slotId = body.timetableSlotId || null;

    if (slotId) {
      const slot = await this.prisma.timetableSlot.findUnique({
        where: { id: slotId },
        include: { course: true },
      });
      if (!slot || slot.facultyId !== fromId) {
        throw new BadRequestException('Invalid timetable slot for this faculty');
      }
      courseId = slot.courseId;
      hours = hours || Number(slot.durationHrs || 1);
      startTime = slot.startTime;
      endTime = slot.endTime;
      section = slot.batchLabel || slot.course.section || section;
    } else if (allocationId) {
      const alloc = await this.prisma.courseAllocation.findUnique({
        where: { id: allocationId },
        include: { course: true },
      });
      if (!alloc || alloc.facultyId !== fromId) {
        throw new BadRequestException('Invalid allocation for this faculty');
      }
      courseId = alloc.courseId;
      hours = hours || Number(alloc.hours || 1);
      section = alloc.section || alloc.course.section || section;
    }
    if (!hours || hours <= 0) hours = 1;

    const fromBefore = await this.loadBreakdown(fromId);
    const toBefore = await this.loadBreakdown(body.toFacultyId);
    const fromAfterTotal = Math.max(0, Number(fromBefore.total) - hours);
    const toAfterTotal = Number(toBefore.total) + hours;

    const leave = await this.prisma.leaveRequest.create({
      data: {
        facultyId: fromId,
        date: new Date(body.date || new Date().toISOString()),
        reason: body.reason.trim(),
        status: 'PENDING',
        createdById: user.id,
      },
    });

    const req = await this.prisma.workloadReassignmentRequest.create({
      data: {
        leaveRequestId: leave.id,
        fromFacultyId: fromId,
        toFacultyId: body.toFacultyId,
        courseId,
        timetableSlotId: slotId,
        allocationId,
        date: new Date(body.date || new Date().toISOString()),
        startTime,
        endTime,
        hours,
        section,
        reason: body.reason.trim(),
        fromBefore: Number(fromBefore.total),
        fromAfter: fromAfterTotal,
        toBefore: Number(toBefore.total),
        toAfter: toAfterTotal,
        fromStatusBefore: fromBefore.status,
        fromStatusAfter: statusFromTotal(fromAfterTotal, fromBefore.normMin, fromBefore.normMax),
        toStatusBefore: toBefore.status,
        toStatusAfter: statusFromTotal(toAfterTotal, toBefore.normMin, toBefore.normMax),
        status: 'PENDING_UTESH',
        createdById: user.id,
      },
      include: {
        fromFaculty: true,
        toFaculty: true,
        leaveRequest: true,
      },
    });

    const course = courseId
      ? await this.prisma.course.findUnique({ where: { id: courseId } })
      : null;
    const when = `${req.date.toISOString().slice(0, 10)}${startTime ? ` ${startTime}-${endTime || ''}` : ''}`;

    await this.notifications.notifyRole(
      'HR',
      'New Workload Reassignment Request',
      `${req.fromFaculty.name} requested to transfer ${course?.name || course?.code || 'work'} (${when}) to ${req.toFaculty.name}. Reason: ${req.reason}`,
    );
    const deptId = req.fromFaculty.departmentId;
    await this.notifications.notifyRole(
      'HOD',
      'New CSE leave / reassignment request',
      `${req.fromFaculty.name} → ${req.toFaculty.name}: ${req.reason} (${when}). Pending Uttej.`,
      deptId,
    );
    await this.notifications.notifyRole(
      'DEAN',
      'New CSE leave / reassignment request',
      `${req.fromFaculty.name} → ${req.toFaculty.name}: ${req.reason} (${when}). Pending Uttej.`,
    );
    await this.notifications.notifyRole(
      'PRINCIPAL',
      'New CSE leave / reassignment request',
      `${req.fromFaculty.name} → ${req.toFaculty.name}: ${req.reason} (${when}). Pending Uttej.`,
    );

    return req;
  }

  listForMonitor(opts: {
    departmentId?: string;
    schoolId?: string;
    status?: string;
    mineFacultyId?: string;
  }) {
    return this.prisma.workloadReassignmentRequest.findMany({
      where: {
        ...(opts.status ? { status: opts.status } : {}),
        ...(opts.mineFacultyId
          ? {
              OR: [
                { fromFacultyId: opts.mineFacultyId },
                { toFacultyId: opts.mineFacultyId },
              ],
            }
          : {}),
        ...(opts.departmentId
          ? { fromFaculty: { departmentId: opts.departmentId } }
          : {}),
        ...(opts.schoolId
          ? { fromFaculty: { department: { schoolId: opts.schoolId } } }
          : {}),
      },
      include: {
        fromFaculty: { include: { department: true } },
        toFaculty: true,
        decidedBy: { select: { id: true, name: true, email: true, role: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        leaveRequest: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async stats(opts: { departmentId?: string; schoolId?: string }) {
    const rows = await this.listForMonitor(opts);
    return {
      total: rows.length,
      pending: rows.filter((r) => r.status === 'PENDING_UTESH').length,
      accepted: rows.filter((r) => r.status === 'ACCEPTED').length,
      rejected: rows.filter((r) => r.status === 'REJECTED').length,
    };
  }

  async accept(user: AuthUser, id: string) {
    if (user.role !== 'HR') {
      throw new ForbiddenException('Only Uttej (Workload Controller / HR) can accept');
    }
    const req = await this.prisma.workloadReassignmentRequest.findUnique({
      where: { id },
      include: { fromFaculty: true, toFaculty: true },
    });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== 'PENDING_UTESH') {
      throw new BadRequestException('Request is not pending');
    }

    if (req.timetableSlotId) {
      await this.prisma.timetableSlot.update({
        where: { id: req.timetableSlotId },
        data: { facultyId: req.toFacultyId },
      });
    }

    // Move teaching hours: reduce from, increase/create to allocation on same course
    if (req.courseId) {
      const fromAlloc =
        (req.allocationId
          ? await this.prisma.courseAllocation.findUnique({ where: { id: req.allocationId } })
          : null) ||
        (await this.prisma.courseAllocation.findFirst({
          where: { facultyId: req.fromFacultyId, courseId: req.courseId },
        }));
      if (fromAlloc) {
        const next = Math.max(0, Number(fromAlloc.hours) - Number(req.hours));
        if (next <= 0.01) {
          await this.prisma.courseAllocation.delete({ where: { id: fromAlloc.id } });
        } else {
          await this.prisma.courseAllocation.update({
            where: { id: fromAlloc.id },
            data: { hours: next },
          });
        }
      }
      const toAlloc = await this.prisma.courseAllocation.findFirst({
        where: {
          facultyId: req.toFacultyId,
          courseId: req.courseId,
          section: req.section || undefined,
        },
      });
      if (toAlloc) {
        await this.prisma.courseAllocation.update({
          where: { id: toAlloc.id },
          data: { hours: Number(toAlloc.hours) + Number(req.hours) },
        });
      } else {
        await this.prisma.courseAllocation.create({
          data: {
            courseId: req.courseId,
            facultyId: req.toFacultyId,
            hours: Number(req.hours),
            section: req.section,
            justification: `Reassignment accepted: ${req.reason}`,
            dataSource: 'REAL',
          },
        });
      }
    }

    await this.workload.recalculateAndPersist(req.fromFacultyId);
    await this.workload.recalculateAndPersist(req.toFacultyId);

    const updated = await this.prisma.workloadReassignmentRequest.update({
      where: { id },
      data: {
        status: 'ACCEPTED',
        decidedById: user.id,
        decidedAt: new Date(),
      },
      include: { fromFaculty: true, toFaculty: true },
    });

    if (req.leaveRequestId) {
      await this.prisma.leaveRequest.update({
        where: { id: req.leaveRequestId },
        data: { status: 'LINKED' },
      });
    }

    const fromUser = await this.prisma.user.findFirst({ where: { facultyId: req.fromFacultyId } });
    const toUser = await this.prisma.user.findFirst({ where: { facultyId: req.toFacultyId } });
    if (fromUser) {
      await this.notifications.create(
        fromUser.id,
        'Reassignment accepted',
        `Your workload transfer to ${req.toFaculty.name} was accepted by Uttej.`,
        'REASSIGN_ACCEPTED',
      );
    }
    if (toUser) {
      await this.notifications.create(
        toUser.id,
        'Transferred workload assigned',
        `You received transferred work from ${req.fromFaculty.name} (${req.hours}h).`,
        'REASSIGN_ACCEPTED',
      );
    }
    await this.notifications.notifyRole(
      'HOD',
      'Workload reassignment approved',
      `${req.fromFaculty.name} → ${req.toFaculty.name} (${req.hours}h) accepted by Uttej.`,
      req.fromFaculty.departmentId,
    );
    await this.notifications.notifyRole(
      'DEAN',
      'Workload reassignment approved',
      `${req.fromFaculty.name} → ${req.toFaculty.name} (${req.hours}h) accepted by Uttej.`,
    );
    await this.notifications.notifyRole(
      'PRINCIPAL',
      'Workload reassignment approved',
      `${req.fromFaculty.name} → ${req.toFaculty.name} (${req.hours}h) accepted by Uttej.`,
    );

    return updated;
  }

  async reject(user: AuthUser, id: string, rejectionReason: string) {
    if (user.role !== 'HR') {
      throw new ForbiddenException('Only Uttej (Workload Controller / HR) can reject');
    }
    if (!rejectionReason?.trim()) {
      throw new BadRequestException('Rejection reason is required');
    }
    const req = await this.prisma.workloadReassignmentRequest.findUnique({
      where: { id },
      include: { fromFaculty: true, toFaculty: true },
    });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== 'PENDING_UTESH') {
      throw new BadRequestException('Request is not pending');
    }

    const updated = await this.prisma.workloadReassignmentRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        decidedById: user.id,
        decidedAt: new Date(),
        rejectionReason: rejectionReason.trim(),
      },
      include: { fromFaculty: true, toFaculty: true },
    });

    if (req.leaveRequestId) {
      await this.prisma.leaveRequest.update({
        where: { id: req.leaveRequestId },
        data: { status: 'PENDING' },
      });
    }

    const fromUser = await this.prisma.user.findFirst({ where: { facultyId: req.fromFacultyId } });
    if (fromUser) {
      await this.notifications.create(
        fromUser.id,
        'Reassignment rejected',
        `Uttej rejected your transfer request: ${rejectionReason.trim()}`,
        'REASSIGN_REJECTED',
      );
    }
    await this.notifications.notifyRole(
      'HOD',
      'Workload reassignment rejected',
      `${req.fromFaculty.name} → ${req.toFaculty.name} rejected: ${rejectionReason.trim()}`,
      req.fromFaculty.departmentId,
    );
    await this.notifications.notifyRole(
      'DEAN',
      'Workload reassignment rejected',
      `${req.fromFaculty.name} → ${req.toFaculty.name} rejected by Uttej.`,
    );
    await this.notifications.notifyRole(
      'PRINCIPAL',
      'Workload reassignment rejected',
      `${req.fromFaculty.name} → ${req.toFaculty.name} rejected by Uttej.`,
    );

    return updated;
  }
}
