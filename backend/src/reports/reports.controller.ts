import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard, RequirePerm } from '../common/permissions.guard';
import { ReportsService, type ReportRange } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { assertDepartmentInSchool, type AuthUser } from '../common/scope';

@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(
    private reports: ReportsService,
    private prisma: PrismaService,
  ) {}

  private assertInstitution(user: AuthUser) {
    if (user.role === 'FACULTY') {
      throw new ForbiddenException('Unauthorized access.');
    }
  }

  @Get('department/:departmentId/excel')
  @RequirePerm('reports', 'view')
  async excel(
    @Param('departmentId') departmentId: string,
    @Req() req: { user: AuthUser },
    @Res() res: Response,
  ) {
    await assertDepartmentInSchool(this.prisma, req.user, departmentId);
    const buf = await this.reports.departmentExcel(departmentId);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="cse-department-workload.xlsx"',
    );
    res.send(buf);
  }

  @Get('department/:departmentId/csv')
  @RequirePerm('reports', 'view')
  async csv(
    @Param('departmentId') departmentId: string,
    @Req() req: { user: AuthUser },
    @Res() res: Response,
  ) {
    await assertDepartmentInSchool(this.prisma, req.user, departmentId);
    const buf = await this.reports.departmentCsv(departmentId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="cse-department-workload.csv"',
    );
    res.send(buf);
  }

  @Get('institution/excel')
  @RequirePerm('reports', 'view')
  async institutionExcel(
    @Query('scope') scope: string | undefined,
    @Req() req: { user: AuthUser },
    @Res() res: Response,
  ) {
    this.assertInstitution(req.user);
    const mode = scope === 'all' ? 'all' : 'cse';
    const buf = await this.reports.institutionExcel(mode);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${mode === 'all' ? 'institution' : 'cse'}-workload.xlsx"`,
    );
    res.send(buf);
  }

  @Get('institution/csv')
  @RequirePerm('reports', 'view')
  async institutionCsv(
    @Query('scope') scope: string | undefined,
    @Req() req: { user: AuthUser },
    @Res() res: Response,
  ) {
    this.assertInstitution(req.user);
    const mode = scope === 'all' ? 'all' : 'cse';
    const buf = await this.reports.institutionCsv(mode);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${mode === 'all' ? 'institution' : 'cse'}-workload.csv"`,
    );
    res.send(buf);
  }

  @Get('compliance.pdf')
  @RequirePerm('reports', 'view')
  async compliancePdf(
    @Query('scope') scope: string | undefined,
    @Req() req: { user: AuthUser },
    @Res() res: Response,
  ) {
    this.assertInstitution(req.user);
    const mode = scope === 'all' ? 'all' : 'cse';
    const buf = await this.reports.compliancePdf(mode);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${mode === 'all' ? 'institution' : 'cse'}-compliance.pdf"`,
    );
    res.send(buf);
  }

  /** CSE period reports — day/week/month/year/custom + Excel/CSV/PDF */
  @Get('cse/period')
  @RequirePerm('reports', 'view')
  async csePeriod(
    @Query('range') range: ReportRange,
    @Query('date') date: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('format') format: 'xlsx' | 'csv' | 'pdf' | undefined,
    @Query('facultyId') facultyId: string | undefined,
    @Query('section') section: string | undefined,
    @Req() req: { user: AuthUser },
    @Res() res: Response,
  ) {
    this.assertInstitution(req.user);
    const fmt = format === 'csv' ? 'csv' : format === 'pdf' ? 'pdf' : 'xlsx';
    const { buffer, label } = await this.reports.csePeriodReport({
      range: range || 'day',
      date,
      from,
      to,
      format: fmt,
      facultyId: facultyId || undefined,
      section: section || undefined,
    });
    const ext = fmt === 'csv' ? 'csv' : fmt === 'pdf' ? 'pdf' : 'xlsx';
    const filename = `cse-${range || 'day'}-${label}.${ext}`;
    res.setHeader(
      'Content-Type',
      fmt === 'csv'
        ? 'text/csv; charset=utf-8'
        : fmt === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  /** JSON preview for the Reports UI */
  @Get('cse/period/preview')
  @RequirePerm('reports', 'view')
  async csePeriodPreview(
    @Query('range') range: ReportRange,
    @Query('date') date: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Query('facultyId') facultyId: string | undefined,
    @Query('section') section: string | undefined,
    @Req() req: { user: AuthUser },
  ) {
    this.assertInstitution(req.user);
    const payload = await this.reports.buildCsePeriodPayload({
      range: range || 'day',
      date,
      from,
      to,
      facultyId: facultyId || undefined,
      section: section || undefined,
    });
    return {
      summary: payload.summary,
      rows: payload.rows,
      label: payload.label,
    };
  }
}
