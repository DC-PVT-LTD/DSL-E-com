import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { validateEnvironment } from './config/env.validation';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';

import { CategoriesModule } from './modules/categories/categories.module';
import { BrandsModule } from './modules/brands/brands.module';
import { ProductsModule } from './modules/products/products.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuditModule } from './modules/audit/audit.module';
import { StorageModule } from './modules/storage/storage.module';
import { UploadModule } from './modules/upload/upload.module';
import { CartModule } from './modules/cart/cart.module';
import { UploadedDocumentsModule } from './modules/uploaded-documents/uploaded-documents.module';
import { SchoolPacksModule } from './modules/school-packs/school-packs.module';
import { CheckoutModule } from './modules/checkout/checkout.module';
import { OrdersModule } from './modules/orders/orders.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RecommendationsModule } from './modules/recommendations/recommendations.module';
import { WishlistModule } from './modules/wishlist/wishlist.module';
import { SavedListsModule } from './modules/saved-lists/saved-lists.module';
import { BackInStockModule } from './modules/back-in-stock/back-in-stock.module';
import { BannersModule } from './modules/banners/banners.module';
import { NewsletterModule } from './modules/newsletter/newsletter.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 120,
      },
    ]),
    PrismaModule,
    HealthModule,
    AuthModule,
    AuditModule,
    StorageModule,
    UploadModule,
    CategoriesModule,
    BrandsModule,
    ProductsModule,
    InventoryModule,
    CartModule,
    UploadedDocumentsModule,
    SchoolPacksModule,
    CheckoutModule,
    OrdersModule,
    NotificationsModule,
    RecommendationsModule,
    WishlistModule,
    SavedListsModule,
    BackInStockModule,
    BannersModule,
    NewsletterModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('{*path}');
    consumer
      .apply(CsrfMiddleware)
      .forRoutes(
        { path: '*', method: RequestMethod.POST },
        { path: '*', method: RequestMethod.PUT },
        { path: '*', method: RequestMethod.PATCH },
        { path: '*', method: RequestMethod.DELETE }
      );
  }
}
