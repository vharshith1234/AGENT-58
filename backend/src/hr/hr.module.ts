import { Module, forwardRef } from '@nestjs/common';
import { HrController } from './hr.controller';
import { HrService } from './hr.service';
import { HrCourseImportService } from './hr-course-import.service';
import { WorkloadModule } from '../workload/workload.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { HodModule } from '../hod/hod.module';

@Module({
  imports: [WorkloadModule, forwardRef(() => NotificationsModule), HodModule],
  controllers: [HrController],
  providers: [HrService, HrCourseImportService],
  exports: [HrService],
})
export class HrModule {}
