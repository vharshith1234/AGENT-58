import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { WorkloadModule } from './workload/workload.module';
import { HrModule } from './hr/hr.module';
import { HodModule } from './hod/hod.module';
import { FacultyModule } from './faculty/faculty.module';
import { DeanModule } from './dean/dean.module';
import { PrincipalModule } from './principal/principal.module';
import { ReportsModule } from './reports/reports.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    PrismaModule,
    AuthModule,
    WorkloadModule,
    NotificationsModule,
    HrModule,
    HodModule,
    FacultyModule,
    DeanModule,
    PrincipalModule,
    ReportsModule,
  ],
})
export class AppModule {}
