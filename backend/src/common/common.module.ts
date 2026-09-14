import { Global, Module } from '@nestjs/common';
import { PermissionsGuard } from './permissions.guard';
import { MailService } from './mail.service';

@Global()
@Module({
  providers: [PermissionsGuard, MailService],
  exports: [PermissionsGuard, MailService],
})
export class CommonModule {}
