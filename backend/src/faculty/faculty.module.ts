import { Module } from '@nestjs/common';
import { FacultyController } from './faculty.controller';
import { FacultyPortalService } from './faculty.service';
import { WorkloadModule } from '../workload/workload.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [WorkloadModule, NotificationsModule],
  controllers: [FacultyController],
  providers: [FacultyPortalService],
})
export class FacultyModule {}
