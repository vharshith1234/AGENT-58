import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard, RequirePerm } from '../common/permissions.guard';
import { HodService } from './hod.service';
import { ReassignmentService } from '../workload/reassignment.service';

@Controller('hod')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HodController {
  constructor(
    private hod: HodService,
    private reassignment: ReassignmentService,
  ) {}

  private dept(req: { user: { departmentId?: string } }) {
    return req.user.departmentId!;
  }

  @Get('dashboard')
  @RequirePerm('analytics', 'view')
  dashboard(@Req() req: { user: { departmentId?: string } }) {
    return this.hod.dashboard(this.dept(req));
  }

  @Get('faculty')
  @RequirePerm('faculty', 'view')
  faculty(@Req() req: { user: { departmentId?: string } }) {
    return this.hod.listFaculty(this.dept(req));
  }

  @Get('faculty/:facultyId')
  @RequirePerm('faculty', 'view')
  facultyDetail(
    @Req() req: { user: { departmentId?: string } },
    @Param('facultyId') facultyId: string,
  ) {
    return this.hod.facultyDetail(this.dept(req), facultyId);
  }

  @Get('courses')
  @RequirePerm('courses', 'view')
  courses(@Req() req: { user: { departmentId?: string } }) {
    return this.hod.listCourses(this.dept(req));
  }

  @Post('courses')
  @RequirePerm('courses', 'manage')
  createCourse(
    @Req() req: { user: { departmentId?: string } },
    @Body() body: Record<string, unknown>,
  ) {
    return this.hod.createCourse(this.dept(req), body);
  }

  @Patch('courses/:id')
  @RequirePerm('courses', 'manage')
  updateCourse(
    @Req() req: { user: { departmentId?: string } },
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.hod.updateCourse(this.dept(req), id, body);
  }

  @Get('allocations')
  @RequirePerm('allocations', 'view')
  allocations(@Req() req: { user: { departmentId?: string } }) {
    return this.hod.listAllocations(this.dept(req));
  }

  @Post('allocations')
  @RequirePerm('allocations', 'manage')
  allocate(
    @Req() req: { user: { departmentId?: string } },
    @Body()
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
    return this.hod.allocate(this.dept(req), body);
  }

  @Get('timetable')
  @RequirePerm('timetable', 'view')
  timetable(@Req() req: { user: { departmentId?: string } }) {
    return this.hod.listTimetable(this.dept(req));
  }

  @Post('timetable')
  @RequirePerm('timetable', 'manage')
  addSlot(@Body() body: Record<string, unknown>) {
    return this.hod.addTimetableSlot(body);
  }

  @Post('timetable/import')
  @RequirePerm('timetable', 'manage')
  importTimetable(
    @Req() req: { user: { departmentId?: string } },
    @Body() body: { rows: Array<Record<string, string | number>>; confirm?: boolean },
  ) {
    return this.hod.importTimetableRows(
      this.dept(req),
      body.rows || [],
      Boolean(body.confirm),
    );
  }

  @Post('timetable/preview')
  @RequirePerm('timetable', 'manage')
  previewTimetable(
    @Req() req: { user: { departmentId?: string } },
    @Body() body: { rows: Array<Record<string, string | number>> },
  ) {
    return this.hod.previewTimetableRows(this.dept(req), body.rows || []);
  }

  @Post('timetable/excel')
  @RequirePerm('timetable', 'manage')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } }))
  async excelPreview(
    @Req() req: { user: { departmentId?: string } },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const rows = this.hod.parseTimetableWorkbook(file?.buffer || Buffer.from(''));
    return this.hod.previewTimetableRows(this.dept(req), rows);
  }

  @Get('projects')
  @RequirePerm('projects', 'view')
  projects(@Req() req: { user: { departmentId?: string } }) {
    return this.hod.listProjects(this.dept(req));
  }

  @Post('projects')
  @RequirePerm('projects', 'manage')
  createProject(@Body() body: Record<string, unknown>) {
    return this.hod.createProject(body);
  }

  @Get('research')
  @RequirePerm('research', 'view')
  research(@Req() req: { user: { departmentId?: string } }) {
    return this.hod.listResearch(this.dept(req));
  }

  @Post('research')
  @RequirePerm('research', 'manage')
  createResearch(@Body() body: Record<string, unknown>) {
    return this.hod.createResearch(body);
  }

  @Get('admin-roles')
  @RequirePerm('admin_roles', 'view')
  admin(@Req() req: { user: { departmentId?: string } }) {
    return this.hod.listAdmin(this.dept(req));
  }

  @Post('admin-roles')
  @RequirePerm('admin_roles', 'manage')
  createAdmin(@Body() body: Record<string, unknown>) {
    return this.hod.createAdmin(body);
  }

  @Get('committees')
  @RequirePerm('committees', 'view')
  committees(@Req() req: { user: { departmentId?: string } }) {
    return this.hod.listCommittees(this.dept(req));
  }

  @Post('committees')
  @RequirePerm('committees', 'manage')
  createCommittee(@Body() body: Record<string, unknown>) {
    return this.hod.createCommittee(body);
  }

  @Delete('timetable/:id')
  @RequirePerm('timetable', 'manage')
  deleteSlot(
    @Req() req: { user: { departmentId?: string } },
    @Param('id') id: string,
  ) {
    return this.hod.deleteTimetableSlot(this.dept(req), id);
  }

  @Get('feeds/:facultyId')
  @RequirePerm('phd', 'view')
  feeds(@Param('facultyId') facultyId: string) {
    return this.hod.externalFeeds(facultyId);
  }

  @Get('corrections')
  @RequirePerm('corrections', 'view')
  corrections(@Req() req: { user: { departmentId?: string } }) {
    return this.hod.listCorrections(this.dept(req));
  }

  @Post('corrections/:id/review')
  @RequirePerm('corrections', 'approve')
  reviewCorrection(
    @Req() req: { user: { id: string; departmentId?: string } },
    @Param('id') id: string,
    @Body() body: { status: 'APPROVED' | 'REJECTED'; note?: string },
  ) {
    return this.hod.reviewCorrection(this.dept(req), id, body, req.user.id);
  }

  @Post('submit-approval')
  @RequirePerm('approvals', 'submit')
  submit(@Req() req: { user: { id: string; departmentId?: string } }) {
    return this.hod.submitForApproval(this.dept(req), req.user.id);
  }

  @Get('reassignments')
  @RequirePerm('balancing', 'view')
  reassignments(@Req() req: { user: { departmentId?: string } }) {
    return this.reassignment.listForMonitor({
      departmentId: this.dept(req),
    });
  }

  @Get('reassignments/stats')
  @RequirePerm('balancing', 'view')
  reassignmentStats(@Req() req: { user: { departmentId?: string } }) {
    return this.reassignment.stats({ departmentId: this.dept(req) });
  }
}
