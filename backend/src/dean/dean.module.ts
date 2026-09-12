import { Module } from '@nestjs/common';
import { DeanController } from './dean.controller';
import { DeanService } from './dean.service';
import { WorkloadModule } from '../workload/workload.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [WorkloadModule, NotificationsModule],
  controllers: [DeanController],
  providers: [DeanService],
})
export class DeanModule {}
