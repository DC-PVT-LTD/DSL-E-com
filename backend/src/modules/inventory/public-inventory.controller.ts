import {
  Controller,
  Get,
  Param,
  Query,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { createApiResponse } from '../../common/interfaces/api-response.interface';

@ApiTags('Public Inventory')
@Controller('public/inventory')
export class PublicInventoryController {
  constructor(
    @Inject(InventoryService)
    private readonly inventoryService: InventoryService
  ) {}

  @Get('product/:id/status')
  @ApiOperation({
    summary: 'Get live inventory status (physical, reserved, available) for a product',
  })
  @ApiResponse({ status: 200, description: 'Live inventory status returned' })
  async getProductStockStatus(
    @Param('id') id: string,
    @Query('variantId') variantId?: string
  ) {
    const status = await this.inventoryService.getLiveStockStatus(id, variantId || null);
    return createApiResponse(status, 'Live inventory status retrieved');
  }

  @Get('batch-status')
  @ApiOperation({
    summary: 'Batch fetch live inventory status for multiple products',
  })
  @ApiResponse({ status: 200, description: 'Batch inventory statuses returned' })
  async getBatchStockStatus(@Query('ids') ids?: string) {
    const productIds = ids ? ids.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const statuses = await this.inventoryService.getBatchLiveStockStatus(productIds);
    return createApiResponse(statuses, 'Batch inventory statuses retrieved');
  }
}

