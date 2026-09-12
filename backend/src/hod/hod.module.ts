import { Module } from '@nestjs/common';
import { HodController } from './hod.controller';
import {
  HodService,
  StubCommitteeProvider,
  StubPhdProvider,
} from './hod.service';
import { WorkloadModule } from '../workload/workload.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [WorkloadModule, NotificationsModule],
  controllers: [HodController],
  providers: [HodService, StubPhdProvider, StubCommitteeProvider],
  exports: [HodService],
})
export class HodModule {}
