import { Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get()
  list(@Req() req: { user: { id: string } }) {
    return this.notifications.listForUser(req.user.id);
  }

  @Get('unread-count')
  async unreadCount(@Req() req: { user: { id: string } }) {
    const count = await this.notifications.unreadCount(req.user.id);
    return { count };
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @Req() req: { user: { id: string } }) {
    return this.notifications.markRead(id, req.user.id);
  }
}
