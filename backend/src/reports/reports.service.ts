import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkloadService } from '../workload/workload.service';
import * as XLSX from 'xlsx';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private workload: WorkloadService,
  ) {}

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
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, sheet);
    return XLSX.write(wb, { type: 'buffer', bookType }) as Buffer;
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

  async institutionRows() {
    const departments = await this.prisma.department.findMany({ orderBy: { code: 'asc' } });
    const balances = await Promise.all(
      departments.map((d) => this.workload.getDepartmentBalance(d.id)),
    );
    const rows: unknown[] = [];
    departments.forEach((d, i) => {
      rows.push(
        ...this.facultyRows(balances[i].faculty as unknown as Array<Record<string, unknown>>, d.code),
      );
    });
    return rows;
  }

  async institutionExcel() {
    return this.workbook(await this.institutionRows(), 'Workload', 'xlsx');
  }

  async institutionCsv() {
    return this.workbook(await this.institutionRows(), 'Workload', 'csv');
  }

  async compliancePdf() {
    const summary = await this.workload.institutionSummary();
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    let y = 800;
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
}
