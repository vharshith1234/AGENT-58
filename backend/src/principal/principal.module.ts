import { Module } from '@nestjs/common';
import { PrincipalController } from './principal.controller';
import { PrincipalService } from './principal.service';
import { WorkloadModule } from '../workload/workload.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [WorkloadModule, NotificationsModule],
  controllers: [PrincipalController],
  providers: [PrincipalService],
})
export class PrincipalModule {}
