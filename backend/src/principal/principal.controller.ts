import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard, RequirePerm } from '../common/permissions.guard';
import { PrincipalService } from './principal.service';

@Controller('principal')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PrincipalController {
  constructor(private principal: PrincipalService) {}

  @Get('dashboard')
  @RequirePerm('analytics', 'view')
  dashboard() {
    return this.principal.dashboard();
  }

  @Get('hierarchy')
  @RequirePerm('analytics', 'view')
  hierarchy() {
    return this.principal.hierarchy();
  }

  @Get('faculty')
  @RequirePerm('faculty', 'view')
  faculty(
    @Query('q') q?: string,
    @Query('departmentId') departmentId?: string,
    @Query('dataSource') dataSource?: string,
    @Query('designation') designation?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.principal.searchFaculty({
      q,
      departmentId,
      dataSource,
      designation,
      page,
      pageSize,
    });
  }

  @Get('approvals')
  @RequirePerm('approvals', 'view')
  approvals() {
    return this.principal.listEscalated();
  }

  @Post('approvals/:id/approve')
  @RequirePerm('approvals', 'approve')
  approve(
    @Param('id') id: string,
    @Body() body: { comment?: string },
    @Req() req: { user: { id: string } },
  ) {
    return this.principal.approve(id, req.user.id, body.comment);
  }

  @Post('approvals/:id/finalize')
  @RequirePerm('approvals', 'approve')
  finalize(
    @Param('id') id: string,
    @Body() body: { comment?: string },
    @Req() req: { user: { id: string } },
  ) {
    return this.principal.finalize(id, req.user.id, body.comment);
  }

  @Post('approvals/:id/send-back')
  @RequirePerm('approvals', 'approve')
  sendBack(
    @Param('id') id: string,
    @Body() body: { comment: string },
    @Req() req: { user: { id: string } },
  ) {
    return this.principal.sendBack(id, req.user.id, body.comment);
  }
}
