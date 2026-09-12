import { Controller, ForbiddenException, Get, Param, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard, RequirePerm } from '../common/permissions.guard';
import { ReportsService } from './reports.service';
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
      'attachment; filename="department-workload.xlsx"',
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
      'attachment; filename="department-workload.csv"',
    );
    res.send(buf);
  }

  @Get('institution/excel')
  @RequirePerm('reports', 'view')
  async institutionExcel(@Req() req: { user: AuthUser }, @Res() res: Response) {
    this.assertInstitution(req.user);
    const buf = await this.reports.institutionExcel();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="institution-workload.xlsx"',
    );
    res.send(buf);
  }

  @Get('institution/csv')
  @RequirePerm('reports', 'view')
  async institutionCsv(@Req() req: { user: AuthUser }, @Res() res: Response) {
    this.assertInstitution(req.user);
    const buf = await this.reports.institutionCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="institution-workload.csv"',
    );
    res.send(buf);
  }

  @Get('compliance.pdf')
  @RequirePerm('reports', 'view')
  async compliancePdf(@Req() req: { user: AuthUser }, @Res() res: Response) {
    this.assertInstitution(req.user);
    const buf = await this.reports.compliancePdf();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="compliance.pdf"',
    );
    res.send(buf);
  }
}
