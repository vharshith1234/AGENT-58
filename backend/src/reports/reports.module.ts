import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { WorkloadModule } from '../workload/workload.module';

@Module({
  imports: [WorkloadModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
