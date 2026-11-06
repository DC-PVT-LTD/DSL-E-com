import { Module } from '@nestjs/common';
import { BackInStockService } from './back-in-stock.service';
import { BackInStockController } from './back-in-stock.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [BackInStockController],
  providers: [BackInStockService],
  exports: [BackInStockService],
})
export class BackInStockModule {}

