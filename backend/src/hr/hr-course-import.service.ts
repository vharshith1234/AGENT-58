import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HodService } from '../hod/hod.service';
import { WorkloadService } from '../workload/workload.service';
import { normalizeClassType } from '../workload/designation-workload-rules';

type RawRow = Record<string, string | number | null | undefined>;

export type ImportPreviewRow = {
  rowIndex: number;
  status: 'ready' | 'invalid' | 'duplicate';
  errors: string[];
  warnings: string[];
  courseCode: string;
  courseName: string;
  facultyName: string;
  facultyId?: string;
  year: string;
  semester: number | null;
  section: string;
  classType: string;
  hours: number | null;
  day: string;
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
  room: string;
  actions: {
    createCourse: boolean;
    createAllocation: boolean;
    createTimetable: boolean;
  };
};

@Injectable()
export class HrCourseImportService {
  constructor(
    private prisma: PrismaService,
    private hod: HodService,
    private workload: WorkloadService,
  ) {}

  parseWorkbook(buffer: Buffer): RawRow[] {
    if (!buffer?.length) throw new BadRequestException('Excel file is required.');
    const XLSX = require('xlsx') as typeof import('xlsx');
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: '' });
    if (!rows.length) throw new BadRequestException('Excel sheet is empty.');
    return rows;
  }

  private cell(row: RawRow, ...keys: string[]) {
    const entries = Object.entries(row);
    for (const key of keys) {
      const want = key.replace(/\s+/g, '').toLowerCase();
      for (const [k, v] of entries) {
        if (String(k).replace(/\s+/g, '').toLowerCase() === want) {
          return String(v ?? '').trim();
        }
      }
    }
    return '';
  }

  private dayNameToNumber(day: string): number | null {
    if (!day) return null;
    if (/^[0-6]$/.test(day)) return Number(day);
    const map: Record<string, number> = {
      sun: 0,
      sunday: 0,
      mon: 1,
      monday: 1,
      tue: 2,
      tues: 2,
      tuesday: 2,
      wed: 3,
      wednesday: 3,
      thu: 4,
      thur: 4,
      thursday: 4,
      fri: 5,
      friday: 5,
      sat: 6,
      saturday: 6,
    };
    return map[day.trim().toLowerCase()] ?? null;
  }

  private normalizeTime(raw: string) {
    if (!raw) return '';
    // Excel may give decimal day fraction
    if (/^\d+(\.\d+)?$/.test(raw) && !raw.includes(':')) {
      const n = Number(raw);
      if (n >= 0 && n < 1) {
        const mins = Math.round(n * 24 * 60);
        const hh = String(Math.floor(mins / 60)).padStart(2, '0');
        const mm = String(mins % 60).padStart(2, '0');
        return `${hh}:${mm}`;
      }
    }
    const m = raw.match(/^(\d{1,2}):(\d{2})/);
    if (!m) return raw;
    return `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`;
  }

  private courseTypeFromLtp(ltp: string) {
    if (ltp === 'T') return 'TUTORIAL';
    if (ltp === 'P') return 'LABORATORY';
    return 'THEORY';
  }

  async preview(departmentId: string, buffer: Buffer) {
    const rawRows = this.parseWorkbook(buffer);
    return this.buildPreview(departmentId, rawRows);
  }

  async buildPreview(departmentId: string, rawRows: RawRow[]) {
    const faculty = await this.prisma.faculty.findMany({
      where: { departmentId },
      select: {
        id: true,
        name: true,
        facultyCode: true,
        email: true,
        employeeId: true,
      },
    });
    const courses = await this.prisma.course.findMany({
      where: { departmentId },
      select: { id: true, code: true, name: true, section: true, semester: true },
    });
    const allocations = await this.prisma.courseAllocation.findMany({
      where: { course: { departmentId } },
      select: {
        id: true,
        courseId: true,
        facultyId: true,
        section: true,
        classType: true,
        hours: true,
      },
    });
    const slots = await this.prisma.timetableSlot.findMany({
      where: { course: { departmentId } },
      select: {
        id: true,
        courseId: true,
        facultyId: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        room: true,
        batchLabel: true,
      },
    });

    const seenKeys = new Set<string>();
    const results: ImportPreviewRow[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const errors: string[] = [];
      const warnings: string[] = [];

      const courseCode = this.cell(row, 'Course Code', 'Code', 'courseCode', 'Subject Code');
      const courseName = this.cell(row, 'Course Name', 'Name', 'courseName', 'Subject Name', 'Subject');
      const facultyRaw = this.cell(
        row,
        'Faculty',
        'Faculty Name',
        'Faculty Code',
        'Faculty ID',
        'Employee ID',
        'Email',
        'Faculty Email',
      );
      const year = this.cell(row, 'Year', 'Academic Year', 'academicYear');
      const semesterRaw = this.cell(row, 'Semester', 'Sem');
      const section = this.cell(row, 'Section', 'Sec', 'Batch');
      const classRaw = this.cell(row, 'Class Type', 'L/T/P', 'Type', 'classType', 'Contact Type');
      const hoursRaw = this.cell(row, 'Hours', 'Hours Per Week', 'hoursPerWeek', 'Hrs');
      const dayRaw = this.cell(row, 'Day', 'Day Of Week', 'dayOfWeek');
      const startTime = this.normalizeTime(this.cell(row, 'Start Time', 'Start', 'From'));
      const endTime = this.normalizeTime(this.cell(row, 'End Time', 'End', 'To'));
      const room = this.cell(row, 'Room', 'Venue', 'Hall');

      if (!courseCode) errors.push('Course Code missing');
      if (!courseName) errors.push('Course Name missing');
      if (!facultyRaw) errors.push('Faculty missing');

      const classType = normalizeClassType(classRaw) || (classRaw ? '' : 'L');
      if (classRaw && !normalizeClassType(classRaw)) {
        errors.push('Class Type must be L, T, or P');
      }

      const hours = hoursRaw ? Number(hoursRaw) : null;
      if (hoursRaw && (!Number.isFinite(hours) || Number(hours) <= 0)) {
        errors.push('Hours invalid');
      }

      const semester = semesterRaw ? Number(semesterRaw) : null;
      if (semesterRaw && (!Number.isFinite(semester) || Number(semester) < 1)) {
        errors.push('Semester invalid');
      }

      const dayOfWeek = this.dayNameToNumber(dayRaw);
      const hasTimetable = !!(dayRaw || startTime || endTime || room);
      if (hasTimetable) {
        if (dayOfWeek == null) errors.push('Day invalid');
        if (!startTime || !endTime) errors.push('Start/End Time missing');
        else if (startTime >= endTime) errors.push('Time range invalid');
      }

      const facKey = facultyRaw.toLowerCase();
      const matchedFaculty =
        faculty.find(
          (f) =>
            f.facultyCode?.toLowerCase() === facKey ||
            f.employeeId?.toLowerCase() === facKey ||
            f.email?.toLowerCase() === facKey ||
            f.name.toLowerCase() === facKey,
        ) ||
        faculty.find(
          (f) =>
            f.name.toLowerCase().includes(facKey) ||
            facKey.includes(f.name.toLowerCase()),
        );

      if (facultyRaw && !matchedFaculty) {
        errors.push('Faculty not found in department');
      }

      const existingCourse = courses.find(
        (c) => c.code.toLowerCase() === courseCode.toLowerCase(),
      );

      const ltp = normalizeClassType(classRaw) || 'L';
      const dedupeKey = [
        courseCode.toLowerCase(),
        matchedFaculty?.id || facKey,
        section.toLowerCase(),
        ltp,
        String(dayOfWeek ?? ''),
        startTime,
        endTime,
      ].join('|');

      let status: ImportPreviewRow['status'] = errors.length ? 'invalid' : 'ready';
      if (!errors.length && seenKeys.has(dedupeKey)) {
        status = 'duplicate';
        warnings.push('Duplicate row in file');
      }
      seenKeys.add(dedupeKey);

      const existingAlloc =
        matchedFaculty && existingCourse
          ? allocations.find(
              (a) =>
                a.courseId === existingCourse.id &&
                a.facultyId === matchedFaculty.id &&
                String(a.section || '') === String(section || existingCourse.section || '') &&
                String(a.classType || '') === ltp,
            )
          : null;

      const existingSlot =
        matchedFaculty &&
        existingCourse &&
        dayOfWeek != null &&
        startTime &&
        endTime
          ? slots.find(
              (s) =>
                s.courseId === existingCourse.id &&
                s.facultyId === matchedFaculty.id &&
                s.dayOfWeek === dayOfWeek &&
                s.startTime === startTime &&
                s.endTime === endTime,
            )
          : null;

      if (existingAlloc) warnings.push('Allocation already exists');
      if (existingSlot) warnings.push('Timetable slot already exists');

      if (!errors.length && existingAlloc && (!hasTimetable || existingSlot) && existingCourse) {
        status = 'duplicate';
        warnings.push('Nothing new to import for this row');
      }

      results.push({
        rowIndex: i + 2, // Excel header is row 1
        status,
        errors,
        warnings,
        courseCode,
        courseName,
        facultyName: matchedFaculty?.name || facultyRaw,
        facultyId: matchedFaculty?.id,
        year,
        semester: Number.isFinite(semester as number) ? Number(semester) : null,
        section,
        classType: ltp,
        hours: Number.isFinite(hours as number) ? Number(hours) : null,
        day: dayRaw,
        dayOfWeek,
        startTime,
        endTime,
        room,
        actions: {
          createCourse: !existingCourse && !!courseCode && !!courseName && !errors.includes('Course Code missing'),
          createAllocation: !!matchedFaculty && !existingAlloc && !errors.length,
          createTimetable:
            !!matchedFaculty &&
            hasTimetable &&
            !existingSlot &&
            !errors.length &&
            dayOfWeek != null &&
            !!startTime &&
            !!endTime,
        },
      });
    }

    return {
      preview: true,
      total: results.length,
      ready: results.filter((r) => r.status === 'ready').length,
      invalid: results.filter((r) => r.status === 'invalid').length,
      duplicate: results.filter((r) => r.status === 'duplicate').length,
      rows: results,
    };
  }

  async confirm(departmentId: string, rows: ImportPreviewRow[]) {
    const ready = rows.filter((r) => r.status === 'ready');
    if (!ready.length) {
      throw new BadRequestException('No valid rows to import.');
    }

    const summary = {
      coursesCreated: 0,
      coursesReused: 0,
      allocationsCreated: 0,
      allocationsSkipped: 0,
      timetableCreated: 0,
      timetableSkipped: 0,
      failed: 0,
      errors: [] as string[],
    };

    const touchedFaculty = new Set<string>();

    for (const row of ready) {
      try {
        let course = await this.prisma.course.findFirst({
          where: { departmentId, code: row.courseCode },
        });

        if (!course) {
          course = await this.hod.createCourse(departmentId, {
            code: row.courseCode,
            name: row.courseName,
            hoursPerWeek: row.hours || 3,
            type: this.courseTypeFromLtp(row.classType),
            credits: row.hours || 3,
            semester: row.semester || 1,
            section: row.section || undefined,
            academicYear: row.year || '2026-27',
          });
          summary.coursesCreated++;
        } else {
          summary.coursesReused++;
          await this.prisma.course.update({
            where: { id: course.id },
            data: {
              name: row.courseName || course.name,
              hoursPerWeek: row.hours != null ? row.hours : course.hoursPerWeek,
              semester: row.semester != null ? row.semester : course.semester,
              section: row.section || course.section,
              academicYear: row.year || course.academicYear,
              type: this.courseTypeFromLtp(row.classType),
            },
          });
        }

        if (!row.facultyId) {
          summary.failed++;
          summary.errors.push(`Row ${row.rowIndex}: faculty missing`);
          continue;
        }

        const sectionWanted = String(row.section || course.section || '');
        const allocCandidates = await this.prisma.courseAllocation.findMany({
          where: {
            courseId: course.id,
            facultyId: row.facultyId,
            classType: row.classType,
          },
        });
        const existingAlloc = allocCandidates.find(
          (a) => String(a.section || '') === sectionWanted,
        );

        if (!existingAlloc) {
          await this.hod.allocate(departmentId, {
            courseId: course.id,
            facultyId: row.facultyId,
            hours: row.hours || course.hoursPerWeek || 3,
            section: row.section || course.section || undefined,
            classType: row.classType,
            confirmOverload: true,
            justification: 'Imported from Excel by HR',
          });
          summary.allocationsCreated++;
          touchedFaculty.add(row.facultyId);
        } else {
          summary.allocationsSkipped++;
        }

        if (
          row.dayOfWeek != null &&
          row.startTime &&
          row.endTime
        ) {
          const existingSlot = await this.prisma.timetableSlot.findFirst({
            where: {
              courseId: course.id,
              facultyId: row.facultyId,
              dayOfWeek: row.dayOfWeek,
              startTime: row.startTime,
              endTime: row.endTime,
            },
          });
          if (!existingSlot) {
            await this.hod.addTimetableSlot({
              courseId: course.id,
              facultyId: row.facultyId,
              dayOfWeek: row.dayOfWeek,
              startTime: row.startTime,
              endTime: row.endTime,
              room: row.room || null,
              contactType: this.courseTypeFromLtp(row.classType),
              batchLabel: row.section || course.section || null,
            });
            summary.timetableCreated++;
            touchedFaculty.add(row.facultyId);
          } else {
            summary.timetableSkipped++;
          }
        }
      } catch (e: any) {
        summary.failed++;
        summary.errors.push(`Row ${row.rowIndex}: ${e?.message || 'Import failed'}`);
      }
    }

    for (const fid of touchedFaculty) {
      await this.workload.recalculateAndPersist(fid);
    }

    return { ok: true, summary };
  }
}
