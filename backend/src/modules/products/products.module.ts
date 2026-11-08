import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { SkuGeneratorService } from './sku-generator.service';
import { ProductImportService } from './product-import.service';
import { AuditModule } from '../audit/audit.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [AuditModule, InventoryModule],
  controllers: [ProductsController],
  providers: [ProductsService, SkuGeneratorService, ProductImportService],
  exports: [ProductsService, SkuGeneratorService, ProductImportService],
})
export class ProductsModule {}
