import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  create(userId: string, title: string, body: string, kind?: string) {
    return this.prisma.notification.create({
      data: { userId, title, body, kind: kind || null },
    });
  }

  listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, read: false },
    });
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  }

  async notifyRole(role: 'HR' | 'HOD' | 'DEAN' | 'PRINCIPAL' | 'FACULTY', title: string, body: string, departmentId?: string) {
    const users = await this.prisma.user.findMany({
      where: {
        role,
        status: 'ACTIVE',
        ...(departmentId ? { departmentId } : {}),
      },
    });
    for (const u of users) {
      await this.create(u.id, title, body);
    }
  }
}
