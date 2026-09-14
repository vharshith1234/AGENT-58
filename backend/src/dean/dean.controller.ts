import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard, RequirePerm } from '../common/permissions.guard';
import { DeanService } from './dean.service';
import { ReassignmentService } from '../workload/reassignment.service';

@Controller('dean')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DeanController {
  constructor(
    private dean: DeanService,
    private reassignment: ReassignmentService,
  ) {}

  @Get('dashboard')
  @RequirePerm('analytics', 'view')
  dashboard() {
    // Institution-wide overview (not limited to Dean's assigned school).
    return this.dean.dashboard(null);
  }

  @Get('departments')
  @RequirePerm('analytics', 'view')
  departments() {
    return this.dean.allDepartments();
  }

  @Get('approvals')
  @RequirePerm('approvals', 'view')
  approvals(@Req() req: { user: { schoolId?: string } }) {
    return this.dean.listApprovals(req.user.schoolId);
  }

  @Post('approvals/:id/approve')
  @RequirePerm('approvals', 'approve')
  approve(
    @Param('id') id: string,
    @Body() body: { comment?: string },
    @Req() req: { user: { id: string; schoolId?: string } },
  ) {
    return this.dean.approve(id, req.user.id, body.comment, req.user.schoolId);
  }

  @Post('approvals/:id/send-back')
  @RequirePerm('approvals', 'approve')
  sendBack(
    @Param('id') id: string,
    @Body() body: { comment: string },
    @Req() req: { user: { id: string; schoolId?: string } },
  ) {
    return this.dean.sendBack(id, req.user.id, body.comment, req.user.schoolId);
  }

  @Post('approvals/:id/escalate')
  @RequirePerm('approvals', 'approve')
  escalate(
    @Param('id') id: string,
    @Body() body: { comment?: string },
    @Req() req: { user: { id: string; schoolId?: string } },
  ) {
    return this.dean.escalateToPrincipal(id, req.user.id, body.comment, req.user.schoolId);
  }

  @Get('reassignments')
  @RequirePerm('balancing', 'view')
  reassignments(@Req() req: { user: { schoolId?: string } }) {
    return this.reassignment.listForMonitor({ schoolId: req.user.schoolId || undefined });
  }

  @Get('reassignments/stats')
  @RequirePerm('balancing', 'view')
  reassignmentStats(@Req() req: { user: { schoolId?: string } }) {
    return this.reassignment.stats({ schoolId: req.user.schoolId || undefined });
  }
}
