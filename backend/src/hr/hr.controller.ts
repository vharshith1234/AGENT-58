import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard, RequirePerm } from '../common/permissions.guard';
import { HrService } from './hr.service';

@Controller('hr')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HrController {
  constructor(private hr: HrService) {}

  @Get('dashboard')
  @RequirePerm('analytics', 'view')
  dashboard() {
    return this.hr.dashboard();
  }

  @Get('schools')
  @RequirePerm('departments', 'view')
  listSchools() {
    return this.hr.listSchools();
  }

  @Get('faculty')
  @RequirePerm('faculty', 'view')
  listFaculty(
    @Query('q') q?: string,
    @Query('departmentId') departmentId?: string,
    @Query('dataSource') dataSource?: string,
    @Query('designation') designation?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.hr.listFaculty({
      q,
      departmentId,
      dataSource,
      designation,
      status,
      page,
      pageSize,
    });
  }

  @Get('faculty/:id')
  @RequirePerm('faculty', 'view')
  async getFaculty(@Param('id') id: string) {
    const row = await this.hr.getFaculty(id);
    if (!row) throw new NotFoundException('Faculty not found');
    return row;
  }

  @Post('faculty')
  @RequirePerm('faculty', 'manage')
  createFaculty(@Body() body: Record<string, unknown>) {
    return this.hr.createFaculty(body);
  }

  @Patch('faculty/:id')
  @RequirePerm('faculty', 'manage')
  updateFaculty(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.hr.updateFaculty(id, body);
  }

  @Get('departments')
  @RequirePerm('departments', 'view')
  listDepartments() {
    return this.hr.listDepartments();
  }

  @Post('departments')
  @RequirePerm('departments', 'manage')
  createDepartment(@Body() body: Record<string, unknown>) {
    return this.hr.createDepartment(body);
  }

  @Patch('departments/:id')
  @RequirePerm('departments', 'manage')
  updateDepartment(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.hr.updateDepartment(id, body);
  }

  @Get('policies')
  @RequirePerm('policies', 'view')
  listPolicies() {
    return this.hr.listPolicies();
  }

  @Post('policies')
  @RequirePerm('policies', 'manage')
  upsertPolicy(@Body() body: Record<string, unknown>, @Req() req: { user: { id: string } }) {
    return this.hr.upsertPolicy(body, req.user.id);
  }

  @Get('norms')
  @RequirePerm('norms', 'view')
  listNorms() {
    return this.hr.listNorms();
  }

  @Post('norms')
  @RequirePerm('norms', 'manage')
  createNorm(@Body() body: Record<string, unknown>, @Req() req: { user: { id: string } }) {
    return this.hr.createNorm(body, req.user.id);
  }

  @Get('corrections')
  @RequirePerm('corrections', 'view')
  listCorrections() {
    return this.hr.listCorrections();
  }

  @Post('corrections/:id/review')
  @RequirePerm('corrections', 'approve')
  reviewCorrection(
    @Param('id') id: string,
    @Body() body: { status: 'APPROVED' | 'REJECTED'; note?: string },
    @Req() req: { user: { id: string } },
  ) {
    return this.hr.reviewCorrection(id, body, req.user.id);
  }

  @Get('compliance')
  @RequirePerm('reports', 'view')
  compliance() {
    return this.hr.complianceReport();
  }
}
