import { Global, Module } from '@nestjs/common';
import { SecurityService } from './security.service';
import { SecurityController } from './security.controller';
import { ConfirmationService } from './confirmation.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';

@Global()
@Module({
  imports: [PrismaModule, NotificationsModule, AuditModule],
  controllers: [SecurityController],
  providers: [SecurityService, ConfirmationService],
  exports: [SecurityService, ConfirmationService],
})
export class SecurityModule {}
