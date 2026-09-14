import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { WorkloadService } from './workload.service';
import {
  DESIGNATION_RULES_META,
  getNormForDesignation,
  listDesignationWorkloadRules,
} from './designation-workload-rules';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard, RequirePerm } from '../common/permissions.guard';
import {
  assertCanAccessFaculty,
  assertDepartmentInSchool,
  type AuthUser,
} from '../common/scope';
import { PrismaService } from '../prisma/prisma.service';

@Controller('workload')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WorkloadController {
  constructor(
    private workload: WorkloadService,
    private prisma: PrismaService,
  ) {}

  @Get('summary')
  @RequirePerm('analytics', 'view')
  summary() {
    return this.workload.institutionSummary();
  }

  /** Centralized Excel-derived designation → required hours rules. */
  @Get('designation-rules')
  @RequirePerm('workload', 'view')
  designationRules(@Query('designation') designation?: string) {
    if (designation) {
      return {
        meta: DESIGNATION_RULES_META,
        designation,
        norm: getNormForDesignation(designation),
      };
    }
    return {
      meta: DESIGNATION_RULES_META,
      rules: listDesignationWorkloadRules().map((r) => ({
        cadre: r.cadre,
        prescribed: r.prescribed,
        min: r.min,
        expected: r.expected,
        max: r.max,
        requiredHours: r.expected,
      })),
    };
  }

  @Get('dashboard-summary')
  @RequirePerm('analytics', 'view')
  dashboardSummary(
    @Query('departmentId') departmentId: string | undefined,
    @Req() req: { user: AuthUser },
  ) {
    return this.workload.dashboardSummary({
      departmentId: req.user.role === 'HOD' ? req.user.departmentId || undefined : departmentId,
      schoolId: req.user.role === 'DEAN' ? req.user.schoolId : undefined,
    });
  }

  @Get('history')
  @RequirePerm('analytics', 'view')
  async history(
    @Query('facultyId') facultyId: string | undefined,
    @Req() req: { user: AuthUser },
  ) {
    if (req.user.role === 'FACULTY') {
      return this.workload.history(req.user.facultyId || undefined);
    }
    if (facultyId) {
      await assertCanAccessFaculty(this.prisma, req.user, facultyId);
    }
    return this.workload.history(facultyId);
  }

  @Get('faculty/:facultyId')
  @RequirePerm('workload', 'view')
  async getFaculty(
    @Param('facultyId') facultyId: string,
    @Req() req: { user: AuthUser },
  ) {
    await assertCanAccessFaculty(this.prisma, req.user, facultyId);
    return this.workload.getCachedWorkload(facultyId);
  }

  @Post('faculty/:facultyId/recalculate')
  @RequirePerm('workload', 'run')
  async recalculate(
    @Param('facultyId') facultyId: string,
    @Req() req: { user: AuthUser },
  ) {
    await assertCanAccessFaculty(this.prisma, req.user, facultyId);
    return this.workload.recalculateAndPersist(facultyId);
  }

  @Get('department/:departmentId')
  @RequirePerm('workload', 'view')
  async department(
    @Param('departmentId') departmentId: string,
    @Req() req: { user: AuthUser },
  ) {
    await assertDepartmentInSchool(this.prisma, req.user, departmentId);
    return this.workload.getDepartmentBalance(departmentId);
  }

  @Post('department/:departmentId/recalculate')
  @RequirePerm('workload', 'run')
  async recalculateDept(
    @Param('departmentId') departmentId: string,
    @Req() req: { user: AuthUser },
  ) {
    await assertDepartmentInSchool(this.prisma, req.user, departmentId);
    return this.workload.recalculateDepartment(departmentId);
  }

  @Post('simulate')
  @RequirePerm('whatif', 'run')
  async simulateBody(
    @Body()
    body: {
      facultyId: string;
      activityType?: string;
      additionalHours?: number;
      courseType?: string;
    },
    @Req() req: { user: AuthUser },
  ) {
    await assertCanAccessFaculty(this.prisma, req.user, body.facultyId);
    return this.workload.simulateProposal(body.facultyId, {
      activityType: body.activityType,
      additionalHours: body.additionalHours,
      courseType: body.courseType as any,
    });
  }

  @Post('faculty/:facultyId/simulate')
  @RequirePerm('whatif', 'run')
  async simulate(
    @Param('facultyId') facultyId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: { user: AuthUser },
  ) {
    await assertCanAccessFaculty(this.prisma, req.user, facultyId);
    if (body.additionalHours != null || body.activityType) {
      return this.workload.simulateProposal(facultyId, body as any);
    }
    return this.workload.simulateFaculty(facultyId, body as any);
  }

  @Get('department/:departmentId/balance')
  @RequirePerm('balancing', 'view')
  async balance(
    @Param('departmentId') departmentId: string,
    @Req() req: { user: AuthUser },
  ) {
    await assertDepartmentInSchool(this.prisma, req.user, departmentId);
    return this.workload.getDepartmentBalance(departmentId);
  }

  @Post('balance/apply')
  @RequirePerm('balancing', 'manage')
  async apply(
    @Body()
    body: {
      moves: Array<{ fromFacultyId: string; toFacultyId: string; hours: number }>;
    },
    @Req() req: { user: AuthUser },
  ) {
    for (const move of body.moves || []) {
      await assertCanAccessFaculty(this.prisma, req.user, move.fromFacultyId);
      await assertCanAccessFaculty(this.prisma, req.user, move.toFacultyId);
    }
    const snaps = await this.workload.applyBalanceMoves(body.moves || []);
    await this.workload.audit(req.user, 'APPLY_BALANCE', 'CourseAllocation', undefined, {
      newValue: body.moves,
    });
    return snaps;
  }
}
