import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { PublicInventoryController } from './public-inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryGateway } from './inventory.gateway';
import { AuthModule } from '../auth/auth.module';
import { BackInStockModule } from '../back-in-stock/back-in-stock.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Module({
  imports: [AuthModule, BackInStockModule],
  controllers: [InventoryController, PublicInventoryController],
  providers: [InventoryService, InventoryGateway, JwtAuthGuard, RolesGuard],
  exports: [InventoryService, InventoryGateway],
})
export class InventoryModule {}
