import { Module } from '@nestjs/common';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { ReservationsService } from './reservations.service';
import { InventoryModule } from '../inventory/inventory.module';
import { CartModule } from '../cart/cart.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [InventoryModule, CartModule, AuthModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, ReservationsService],
  exports: [CheckoutService, ReservationsService],
})
export class CheckoutModule {}

