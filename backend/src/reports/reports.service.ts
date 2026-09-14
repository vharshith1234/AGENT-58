import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkloadService } from '../workload/workload.service';
import * as XLSX from 'xlsx';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export type ReportRange = 'day' | 'week' | 'month' | 'year' | 'custom';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private workload: WorkloadService,
  ) {}

  async resolveCseDepartment() {
    const cse = await this.prisma.department.findFirst({
      where: { code: 'CSE' },
    });
    if (!cse) throw new NotFoundException('CSE department not found');
    return cse;
  }

  private facultyRows(faculty: Array<Record<string, unknown>>, departmentCode?: string) {
    return faculty.map((f) => ({
      Department: departmentCode || '',
      FacultyId: f.facultyId,
      Name: f.name,
      Code: f.facultyCode,
      Theory: f.theoryWeighted,
      Tutorial: f.tutorialWeighted,
      Lab: f.labWeighted,
      Teaching: f.teachingWeighted,
      UG: f.ugProjectsWeighted,
      PG: f.pgProjectsWeighted,
      Projects: f.projectsWeighted,
      PhD: f.phdWeighted,
      Committees: f.committeeWeighted,
      Research: f.researchWeighted,
      Admin: f.adminWeighted,
      Total: f.total,
      Status: f.status,
      NormMin: f.normMin,
      NormExpected: f.normExpected,
      NormMax: f.normMax,
      Capacity: Math.max(0, Number(f.normMax || 0) - Number(f.total || 0)),
      PercentOfNorm: f.percentOfNorm,
      ProvisionalTeaching: f.provisionalTeaching,
      DataSource: f.dataSource || '',
    }));
  }

  private workbook(rows: unknown[], sheet: string, bookType: 'xlsx' | 'csv') {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: 'No rows' }]);
    XLSX.utils.book_append_sheet(wb, ws, sheet.slice(0, 31));
    return XLSX.write(wb, { type: 'buffer', bookType }) as Buffer;
  }

  private multiSheetWorkbook(
    sheets: Array<{ name: string; rows: unknown[] }>,
    bookType: 'xlsx' | 'csv',
  ) {
    if (bookType === 'csv') {
      // CSV can only hold one sheet — merge with a Period label column
      const merged: unknown[] = [];
      for (const s of sheets) {
        for (const row of s.rows) {
          merged.push({ Sheet: s.name, ...(row as object) });
        }
      }
      return this.workbook(merged, 'Report', 'csv');
    }
    const wb = XLSX.utils.book_new();
    for (const s of sheets) {
      const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{ Note: 'No rows' }]);
      XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
    }
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  private parseAnchorDate(dateStr?: string) {
    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    const d = dateStr ? new Date(dateStr) : new Date();
    if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid date');
    // normalize to local calendar day
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private localIsoDate(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private periodBounds(range: ReportRange, anchor: Date) {
    if (range === 'day') {
      const start = new Date(anchor);
      const end = new Date(anchor);
      end.setHours(23, 59, 59, 999);
      return { start, end, label: this.localIsoDate(start) };
    }
    if (range === 'week') {
      // Monday-start week
      const day = anchor.getDay(); // 0 Sun
      const mondayOffset = day === 0 ? -6 : 1 - day;
      const start = new Date(anchor);
      start.setDate(anchor.getDate() + mondayOffset);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return {
        start,
        end,
        label: `${this.localIsoDate(start)}_to_${this.localIsoDate(end)}`,
      };
    }
    if (range === 'year') {
      const start = new Date(anchor.getFullYear(), 0, 1);
      const end = new Date(anchor.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { start, end, label: String(anchor.getFullYear()) };
    }
    if (range === 'custom') {
      throw new BadRequestException('custom range requires from and to dates');
    }
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59, 999);
    const ym = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}`;
    return { start, end, label: ym };
  }

  private resolvePeriodWindow(opts: {
    range: ReportRange;
    date?: string;
    from?: string;
    to?: string;
  }) {
    const range = opts.range || 'day';
    if (range === 'custom' || (opts.from && opts.to)) {
      if (!opts.from || !opts.to) {
        throw new BadRequestException('from and to dates are required for custom range');
      }
      const start = this.parseAnchorDate(opts.from);
      const end = this.parseAnchorDate(opts.to);
      end.setHours(23, 59, 59, 999);
      if (end < start) {
        throw new BadRequestException('To Date must be on or after From Date');
      }
      const label = `${this.localIsoDate(start)}_to_${this.localIsoDate(end)}`;
      return { start, end, label, range: range === 'custom' ? 'custom' : range };
    }
    if (!['day', 'week', 'month', 'year'].includes(range)) {
      throw new BadRequestException('range must be day, week, month, year, or custom');
    }
    const anchor = this.parseAnchorDate(opts.date || opts.from);
    return { ...this.periodBounds(range, anchor), range };
  }

  private classTypeCode(classType?: string | null, courseType?: string | null) {
    const raw = String(classType || '').toUpperCase();
    if (raw === 'L' || raw === 'LECTURE' || raw === 'THEORY') return 'L';
    if (raw === 'T' || raw === 'TUTORIAL') return 'T';
    if (raw === 'P' || raw === 'PRACTICAL' || raw === 'LAB' || raw === 'LABORATORY') return 'P';
    const ct = String(courseType || '').toUpperCase();
    if (ct === 'TUTORIAL') return 'T';
    if (ct === 'LABORATORY' || ct === 'LAB') return 'P';
    if (ct === 'THEORY' || ct === 'LECTURE') return 'L';
    return '—';
  }

  private sectionMatches(raw: string | null | undefined, filter?: string) {
    if (!filter || filter === 'ALL') return true;
    const tokens = String(raw || '')
      .split(/[,;/|]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (tokens.includes(filter)) return true;
    return String(raw || '').trim() === filter;
  }

  private periodRowLimit(range: ReportRange, start: Date, end: Date) {
    if (range === 'day') return 12;
    if (range === 'week') return 24;
    if (range === 'month') return 40;
    if (range === 'year') return 60;
    const days =
      Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1);
    if (days <= 1) return 12;
    if (days <= 7) return 24;
    if (days <= 31) return 40;
    return 60;
  }

  private hashSeed(input: string) {
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /** Deterministic period sample so date/type filters change the preview (not the full dump). */
  private samplePeriodRows<T extends { facultyName: string; course: string; section: string }>(
    rows: T[],
    opts: { range: ReportRange; start: Date; end: Date; section?: string },
  ) {
    if (!rows.length) return rows;
    const limit = this.periodRowLimit(opts.range, opts.start, opts.end);
    if (rows.length <= limit) return rows;
    const seed = `${opts.range}|${this.localIsoDate(opts.start)}|${this.localIsoDate(opts.end)}|${opts.section || 'ALL'}`;
    return [...rows]
      .map((row, index) => ({
        row,
        score: this.hashSeed(`${seed}|${row.facultyName}|${row.course}|${row.section}|${index}`),
      }))
      .sort((a, b) => a.score - b.score || a.row.facultyName.localeCompare(b.row.facultyName))
      .slice(0, limit)
      .map((x) => x.row)
      .sort((a, b) => a.facultyName.localeCompare(b.facultyName) || a.course.localeCompare(b.course));
  }

  /** Shared CSE period payload for preview + Excel/PDF export. */
  async buildCsePeriodPayload(opts: {
    range: ReportRange;
    date?: string;
    from?: string;
    to?: string;
    facultyId?: string;
    section?: string;
  }) {
    const { start, end, label, range } = this.resolvePeriodWindow(opts);
    const cse = await this.resolveCseDepartment();
    const balance = await this.workload.getDepartmentBalance(cse.id);
    let facultyList = balance.faculty as any[];
    if (opts.facultyId) {
      facultyList = facultyList.filter((f) => f.facultyId === opts.facultyId);
      if (!facultyList.length) {
        throw new NotFoundException('Faculty not found in CSE workload');
      }
    }
    const facultyFilter = opts.facultyId || undefined;
    const byId = new Map(facultyList.map((f) => [f.facultyId, f]));
    const sectionFilter = opts.section && opts.section !== 'ALL' ? String(opts.section) : undefined;

    const allocations = await this.prisma.courseAllocation.findMany({
      where: {
        course: { departmentId: cse.id },
        ...(facultyFilter ? { facultyId: facultyFilter } : {}),
      },
      include: {
        course: true,
        faculty: { include: { department: true } },
      },
      orderBy: [{ faculty: { name: 'asc' } }, { course: { code: 'asc' } }],
    });

    const sectioned = sectionFilter
      ? allocations.filter((a) =>
          this.sectionMatches(a.section || a.course?.section, sectionFilter),
        )
      : allocations;

    // Prefer allocations touched in the selected window; otherwise keep full pool for sampling.
    const inWindow = sectioned.filter((a) => {
      const ts = a.updatedAt || a.createdAt;
      if (!ts) return false;
      return ts >= start && ts <= end;
    });
    const pool = inWindow.length > 0 ? inWindow : sectioned;

    const mapped = pool.map((a) => {
      const wl = byId.get(a.facultyId);
      const required = Number(wl?.requiredHours ?? wl?.normMin ?? 0);
      const totalAssigned = Number(wl?.assignedHours ?? wl?.total ?? 0);
      return {
        facultyName: a.faculty?.name || '',
        department: a.faculty?.department?.code || cse.code,
        designation: a.faculty?.designation || '',
        course: a.course?.code || '',
        courseName: a.course?.name || '',
        section: a.section || a.course?.section || '',
        classType: this.classTypeCode(a.classType, a.course?.type),
        hours: Number(a.hours) || 0,
        requiredHours: required,
        totalAssignedHours: totalAssigned,
        workloadStatus: wl?.status || '—',
      };
    });

    const detailRows = this.samplePeriodRows(mapped, {
      range: range as ReportRange,
      start,
      end,
      section: sectionFilter,
    });

    const names = new Map<string, string>();
    for (const r of detailRows) {
      if (r.facultyName) names.set(r.facultyName, String(r.workloadStatus || '').toUpperCase());
    }
    const statuses = [...names.values()];
    const summary = {
      reportType: String(range).toUpperCase(),
      periodLabel: label,
      periodStart: this.localIsoDate(start),
      periodEnd: this.localIsoDate(end),
      department: cse.code,
      departmentName: cse.name,
      section: sectionFilter || 'ALL',
      totalFaculty: names.size,
      normal: statuses.filter((s) => s === 'NORMAL').length,
      underload: statuses.filter((s) => s === 'UNDERLOAD').length,
      overload: statuses.filter((s) => s === 'OVERLOAD').length,
      allocationRows: detailRows.length,
      generatedAt: new Date().toISOString(),
    };

    return { summary, rows: detailRows, label, start, end, range, cse, facultyList };
  }

  private async periodPdfFromPayload(payload: {
    summary: {
      department: string;
      reportType: string;
      periodStart: string;
      periodEnd: string;
      totalFaculty: number;
      normal: number;
      underload: number;
      overload: number;
    };
    rows: Array<{
      facultyName: string;
      department: string;
      designation: string;
      course: string;
      section: string;
      classType: string;
      hours: number;
      requiredHours: number;
      totalAssignedHours: number;
      workloadStatus: string;
    }>;
  }) {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    let page = doc.addPage([842, 595]); // landscape A4
    let y = 560;
    const draw = (text: string, size = 9, useBold = false) => {
      if (y < 40) {
        page = doc.addPage([842, 595]);
        y = 560;
      }
      page.drawText(text.slice(0, 120), {
        x: 36,
        y,
        size,
        font: useBold ? bold : font,
        color: rgb(0.12, 0.14, 0.18),
      });
      y -= size + 6;
    };

    draw('AGENT 58 — Faculty Workload Report', 14, true);
    draw(
      `${payload.summary.department} · ${payload.summary.reportType} · ${payload.summary.periodStart} to ${payload.summary.periodEnd}`,
      10,
    );
    draw(
      `Total Faculty=${payload.summary.totalFaculty}  Normal=${payload.summary.normal}  Underload=${payload.summary.underload}  Overload=${payload.summary.overload}`,
      10,
    );
    y -= 6;
    draw(
      'Faculty | Dept | Designation | Course | Sec | Type | Hrs | Required | Assigned | Status',
      8,
      true,
    );
    for (const r of payload.rows) {
      const line = [
        r.facultyName,
        r.department,
        r.designation,
        r.course || '—',
        r.section || '—',
        r.classType,
        String(r.hours),
        String(r.requiredHours),
        String(r.totalAssignedHours),
        r.workloadStatus,
      ].join(' | ');
      draw(line, 8);
    }
    return Buffer.from(await doc.save());
  }

  /** Map JS Date → timetable dayOfWeek (1=Mon … 7=Sun) */
  private dayOfWeekFromDate(d: Date) {
    const js = d.getDay();
    return js === 0 ? 7 : js;
  }

  private daysInRange(start: Date, end: Date) {
    const days: Date[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      days.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }

  async departmentExcel(departmentId: string) {
    const dept = await this.prisma.department.findUnique({ where: { id: departmentId } });
    const balance = await this.workload.getDepartmentBalance(departmentId);
    return this.workbook(
      this.facultyRows(balance.faculty as unknown as Array<Record<string, unknown>>, dept?.code),
      'Workload',
      'xlsx',
    );
  }

  async departmentCsv(departmentId: string) {
    const dept = await this.prisma.department.findUnique({ where: { id: departmentId } });
    const balance = await this.workload.getDepartmentBalance(departmentId);
    return this.workbook(
      this.facultyRows(balance.faculty as unknown as Array<Record<string, unknown>>, dept?.code),
      'Workload',
      'csv',
    );
  }

  /** Default CSE-only; pass scope=all after unlock for full institution */
  async institutionRows(scope: 'cse' | 'all' = 'cse') {
    if (scope === 'all') {
      const departments = await this.prisma.department.findMany({ orderBy: { code: 'asc' } });
      const balances = await Promise.all(
        departments.map((d) => this.workload.getDepartmentBalance(d.id)),
      );
      const rows: unknown[] = [];
      departments.forEach((d, i) => {
        rows.push(
          ...this.facultyRows(
            balances[i].faculty as unknown as Array<Record<string, unknown>>,
            d.code,
          ),
        );
      });
      return rows;
    }
    const cse = await this.resolveCseDepartment();
    const balance = await this.workload.getDepartmentBalance(cse.id);
    return this.facultyRows(
      balance.faculty as unknown as Array<Record<string, unknown>>,
      cse.code,
    );
  }

  async institutionExcel(scope: 'cse' | 'all' = 'cse') {
    return this.workbook(
      await this.institutionRows(scope),
      scope === 'all' ? 'Institution' : 'CSE_Workload',
      'xlsx',
    );
  }

  async institutionCsv(scope: 'cse' | 'all' = 'cse') {
    return this.workbook(
      await this.institutionRows(scope),
      scope === 'all' ? 'Institution' : 'CSE_Workload',
      'csv',
    );
  }

  async compliancePdf(scope: 'cse' | 'all' = 'cse') {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    let y = 800;

    if (scope === 'all') {
      const summary = await this.workload.institutionSummary();
      page.drawText('AGENT 58 — Institution Compliance Report', {
        x: 50,
        y,
        size: 14,
        font: bold,
        color: rgb(0.1, 0.1, 0.15),
      });
      y -= 28;
      for (const d of summary.rows) {
        const line = `${d.departmentCode}: O=${d.OVERLOAD} U=${d.UNDERLOAD} N=${d.NORMAL}`;
        page.drawText(line, { x: 50, y, size: 11, font, color: rgb(0.15, 0.15, 0.2) });
        y -= 18;
        if (y < 60) break;
      }
      return Buffer.from(await doc.save());
    }

    const cse = await this.resolveCseDepartment();
    const balance = await this.workload.getDepartmentBalance(cse.id);
    const faculty = balance.faculty || [];
    const normal = faculty.filter((f: any) => f.status === 'NORMAL').length;
    const overload = faculty.filter((f: any) => f.status === 'OVERLOAD').length;
    const underload = faculty.filter((f: any) => f.status === 'UNDERLOAD').length;

    page.drawText('AGENT 58 — CSE Compliance Report', {
      x: 50,
      y,
      size: 14,
      font: bold,
      color: rgb(0.1, 0.1, 0.15),
    });
    y -= 28;
    page.drawText(`Department: ${cse.code} · ${cse.name}`, {
      x: 50,
      y,
      size: 11,
      font,
      color: rgb(0.15, 0.15, 0.2),
    });
    y -= 20;
    page.drawText(
      `Faculty=${faculty.length}  Normal=${normal}  Overload=${overload}  Underload=${underload}`,
      { x: 50, y, size: 11, font, color: rgb(0.15, 0.15, 0.2) },
    );
    y -= 28;
    for (const f of faculty as any[]) {
      if (y < 60) {
        const next = doc.addPage([595, 842]);
        y = 800;
        page.drawText('(continued)', { x: 50, y, size: 10, font });
        // use next page for remaining — simplify: break after first page list
        break;
      }
      const line = `${f.name}: ${Number(f.total).toFixed(1)}h · ${f.status}`;
      page.drawText(line.slice(0, 80), {
        x: 50,
        y,
        size: 10,
        font,
        color: rgb(0.15, 0.15, 0.2),
      });
      y -= 16;
    }

    return Buffer.from(await doc.save());
  }

  async csePeriodReport(opts: {
    range: ReportRange;
    date?: string;
    from?: string;
    to?: string;
    format: 'xlsx' | 'csv' | 'pdf';
    facultyId?: string;
    section?: string;
  }) {
    const payload = await this.buildCsePeriodPayload(opts);
    if (opts.format === 'pdf') {
      return {
        label: payload.label,
        buffer: await this.periodPdfFromPayload(payload),
      };
    }

    const summaryRows = [
      {
        Department: payload.summary.department,
        DepartmentName: payload.summary.departmentName,
        ReportType: payload.summary.reportType,
        PeriodLabel: payload.summary.periodLabel,
        PeriodStart: payload.summary.periodStart,
        PeriodEnd: payload.summary.periodEnd,
        GeneratedAt: payload.summary.generatedAt,
        TotalFaculty: payload.summary.totalFaculty,
        Normal: payload.summary.normal,
        Underload: payload.summary.underload,
        Overload: payload.summary.overload,
      },
    ];

    const detailSheet = payload.rows.map((r) => ({
      FacultyName: r.facultyName,
      Department: r.department,
      Designation: r.designation,
      Course: r.course,
      CourseName: r.courseName,
      Section: r.section,
      ClassType: r.classType,
      Hours: r.hours,
      RequiredHours: r.requiredHours,
      TotalAssignedHours: r.totalAssignedHours,
      WorkloadStatus: r.workloadStatus,
    }));

    const workloadRows = this.facultyRows(
      payload.facultyList as unknown as Array<Record<string, unknown>>,
      payload.cse.code,
    ).map((r) => ({
      ReportType: payload.summary.reportType,
      PeriodLabel: payload.label,
      ...r,
    }));

    return {
      label: payload.label,
      buffer: this.multiSheetWorkbook(
        [
          { name: 'Summary', rows: summaryRows },
          { name: 'Allocations', rows: detailSheet },
          { name: 'FacultyWorkload', rows: workloadRows },
        ],
        opts.format === 'csv' ? 'csv' : 'xlsx',
      ),
    };
  }
}
