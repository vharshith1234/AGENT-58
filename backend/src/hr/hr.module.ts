import { Module, forwardRef } from '@nestjs/common';
import { HrController } from './hr.controller';
import { HrService } from './hr.service';
import { WorkloadModule } from '../workload/workload.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [WorkloadModule, forwardRef(() => NotificationsModule)],
  controllers: [HrController],
  providers: [HrService],
  exports: [HrService],
})
export class HrModule {}
