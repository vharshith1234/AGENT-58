import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard, RequirePerm } from '../common/permissions.guard';
import { HrService } from './hr.service';
import {
  HrCourseImportService,
  ImportPreviewRow,
} from './hr-course-import.service';
import { ReassignmentService } from '../workload/reassignment.service';
import { WorkloadService } from '../workload/workload.service';
import { HodService } from '../hod/hod.service';
import type { AuthUser } from '../common/scope';

@Controller('hr')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HrController {
  constructor(
    private hr: HrService,
    private reassignment: ReassignmentService,
    private workload: WorkloadService,
    private hod: HodService,
    private courseImport: HrCourseImportService,
  ) {}

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

  @Get('workload/overview')
  @RequirePerm('workload', 'view')
  async workloadOverview(@Query('departmentId') departmentId?: string) {
    const depts = await this.hr.listDepartments();
    const cse = depts.find((d: any) => d.code === 'CSE') || depts[0];
    const id = departmentId || cse?.id;
    if (!id) return { faculty: [], stats: {}, courses: [] };
    const balance = await this.workload.getDepartmentBalance(id);
    const courses = await this.hod.listCourses(id);
    return {
      departmentId: id,
      faculty: balance.faculty,
      suggestions: balance.suggestions,
      courses,
      stats: {
        total: balance.faculty.length,
        normal: balance.faculty.filter((f: any) => f.status === 'NORMAL').length,
        underload: balance.faculty.filter((f: any) => f.status === 'UNDERLOAD').length,
        overload: balance.faculty.filter((f: any) => f.status === 'OVERLOAD').length,
      },
    };
  }

  @Get('courses')
  @RequirePerm('courses', 'view')
  async listCourses(@Query('departmentId') departmentId?: string) {
    const deptId = await this.resolveDeptId(departmentId);
    if (!deptId) return [];
    return this.hod.listCourses(deptId);
  }

  @Post('courses')
  @RequirePerm('courses', 'manage')
  async createCourse(
    @Body() body: Record<string, unknown> & { departmentId?: string },
  ) {
    const deptId = await this.resolveDeptId(body.departmentId as string | undefined);
    return this.hod.createCourse(deptId, body);
  }

  @Post('courses/import/preview')
  @RequirePerm('courses', 'manage')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 4 * 1024 * 1024 },
    }),
  )
  async previewCourseImport(
    @Req() req: { user: AuthUser },
    @UploadedFile() file?: Express.Multer.File,
    @Query('departmentId') departmentId?: string,
  ) {
    this.assertHrOnly(req.user);
    const deptId = await this.resolveDeptId(departmentId);
    if (!deptId) throw new NotFoundException('Department not found');
    return this.courseImport.preview(deptId, file?.buffer || Buffer.from(''));
  }

  @Post('courses/import/confirm')
  @RequirePerm('courses', 'manage')
  async confirmCourseImport(
    @Req() req: { user: AuthUser },
    @Body() body: { departmentId?: string; rows?: ImportPreviewRow[] },
  ) {
    this.assertHrOnly(req.user);
    const deptId = await this.resolveDeptId(body.departmentId);
    if (!deptId) throw new NotFoundException('Department not found');
    return this.courseImport.confirm(deptId, body.rows || []);
  }

  @Patch('courses/:id')
  @RequirePerm('courses', 'manage')
  async updateCourse(
    @Param('id') id: string,
    @Body() body: Record<string, unknown> & { departmentId?: string },
  ) {
    const deptId = await this.resolveDeptId(body.departmentId as string | undefined);
    return this.hod.updateCourse(deptId, id, body);
  }

  @Get('allocations')
  @RequirePerm('allocations', 'view')
  async listAllocations(@Query('departmentId') departmentId?: string) {
    const deptId = await this.resolveDeptId(departmentId);
    if (!deptId) return [];
    return this.hod.listAllocations(deptId);
  }

  @Post('allocations')
  @RequirePerm('allocations', 'manage')
  async allocate(@Body() body: Record<string, unknown> & { departmentId?: string }) {
    const deptId = await this.resolveDeptId(body.departmentId as string | undefined);
    return this.hod.allocate(deptId, body as any);
  }

  @Patch('allocations/:id')
  @RequirePerm('allocations', 'manage')
  async updateAllocation(
    @Param('id') id: string,
    @Body() body: Record<string, unknown> & { departmentId?: string },
  ) {
    const deptId = await this.resolveDeptId(body.departmentId as string | undefined);
    return this.hod.updateAllocation(deptId, id, body as any);
  }

  @Delete('allocations/:id')
  @RequirePerm('allocations', 'manage')
  async deleteAllocation(
    @Param('id') id: string,
    @Query('departmentId') departmentId?: string,
  ) {
    const deptId = await this.resolveDeptId(departmentId);
    return this.hod.deleteAllocation(deptId, id);
  }

  @Get('timetable')
  @RequirePerm('timetable', 'view')
  async listTimetable(@Query('departmentId') departmentId?: string) {
    const deptId = await this.resolveDeptId(departmentId);
    if (!deptId) return [];
    return this.hod.listTimetable(deptId);
  }

  @Post('timetable')
  @RequirePerm('timetable', 'manage')
  addSlot(@Body() body: Record<string, unknown>) {
    return this.hod.addTimetableSlot(body as any);
  }

  @Delete('timetable/:id')
  @RequirePerm('timetable', 'manage')
  async deleteSlot(
    @Param('id') id: string,
    @Query('departmentId') departmentId?: string,
  ) {
    const deptId = await this.resolveDeptId(departmentId);
    return this.hod.deleteTimetableSlot(deptId, id);
  }

  private assertHrOnly(user: AuthUser) {
    if (user.role !== 'HR') {
      throw new ForbiddenException('Only HR can import course Excel files.');
    }
  }

  private async resolveDeptId(departmentId?: string) {
    const depts = await this.hr.listDepartments();
    return (
      departmentId ||
      depts.find((d: any) => d.code === 'CSE')?.id ||
      depts[0]?.id
    );
  }

  @Get('reassignments')
  @RequirePerm('balancing', 'view')
  listReassignments(
    @Query('status') status?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.reassignment.listForMonitor({ status, departmentId });
  }

  @Get('reassignments/stats')
  @RequirePerm('balancing', 'view')
  reassignmentStats(@Query('departmentId') departmentId?: string) {
    return this.reassignment.stats({ departmentId });
  }

  @Post('reassignments/:id/accept')
  @RequirePerm('balancing', 'approve')
  accept(@Param('id') id: string, @Req() req: { user: AuthUser }) {
    return this.reassignment.accept(req.user, id);
  }

  @Post('reassignments/:id/reject')
  @RequirePerm('balancing', 'approve')
  reject(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Req() req: { user: AuthUser },
  ) {
    return this.reassignment.reject(req.user, id, body.reason);
  }
}
