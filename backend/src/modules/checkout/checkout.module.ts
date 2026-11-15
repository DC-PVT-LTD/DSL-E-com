import { Module } from '@nestjs/common';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { ReservationsService } from './reservations.service';
import { PrivateReceiptStorageService } from './private-receipt-storage.service';
import { InventoryModule } from '../inventory/inventory.module';
import { CartModule } from '../cart/cart.module';
import { AuthModule } from '../auth/auth.module';
import { PromotionsModule } from '../promotions/promotions.module';

@Module({
  imports: [InventoryModule, CartModule, AuthModule, PromotionsModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, ReservationsService, PrivateReceiptStorageService],
  exports: [CheckoutService, ReservationsService, PrivateReceiptStorageService],
})
export class CheckoutModule {}

