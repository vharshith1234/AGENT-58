import { Module } from '@nestjs/common';
import { WorkloadService } from './workload.service';
import { WorkloadController } from './workload.controller';
import { ReassignmentService } from './reassignment.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [WorkloadController],
  providers: [WorkloadService, ReassignmentService],
  exports: [WorkloadService, ReassignmentService],
})
export class WorkloadModule {}
