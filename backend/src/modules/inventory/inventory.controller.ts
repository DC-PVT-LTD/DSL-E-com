import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import {
  adjustInventorySchema,
  AdjustInventoryDto,
} from './dto/adjust-inventory.dto';
import {
  inventoryMovementQuerySchema,
  InventoryMovementQueryDto,
  lowStockQuerySchema,
  LowStockQueryDto,
} from './dto/inventory-query.dto';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../generated/prisma';
import { createApiResponse } from '../../common/interfaces/api-response.interface';

@ApiTags('Admin API', 'Inventory')
@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
export class InventoryController {
  constructor(
    @Inject(InventoryService)
    private readonly inventoryService: InventoryService
  ) {}

  @Post('adjust')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('dsl_access_token')
  @ApiOperation({
    summary: 'Adjust product or variant stock level',
    description:
      'Performs an atomic, transactional stock change (signed delta or target quantity) with pessimistic locking, recording previous quantity, new quantity, change reason, and the authenticated actor in the inventory audit log.',
  })
  @ApiResponse({
    status: 200,
    description: 'Stock adjusted successfully and inventory movement recorded',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed, delta is 0, or adjustment would result in negative stock',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid credentials',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions (CUSTOMER role denied)',
  })
  @ApiResponse({
    status: 404,
    description: 'Target product or variant not found',
  })
  async adjustStock(
    @Body(createZodPipe(adjustInventorySchema)) dto: AdjustInventoryDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    const result = await this.inventoryService.adjustStock(dto, actor);
    return createApiResponse(result, 'Stock adjusted successfully');
  }

  @Get('movements')
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('dsl_access_token')
  @ApiOperation({
    summary: 'List inventory movement audit log with pagination and filters',
    description:
      'Retrieves the chronological audit log of inventory changes. Supports filtering by product ID, variant ID, change reason, and date range.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated inventory movements returned successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid credentials',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions (CUSTOMER role denied)',
  })
  async getMovements(
    @Query(createZodPipe(inventoryMovementQuerySchema)) query: InventoryMovementQueryDto
  ) {
    return this.inventoryService.getMovements(query);
  }

  @Get('low-stock')
  @ApiBearerAuth('bearerAuth')
  @ApiCookieAuth('dsl_access_token')
  @ApiOperation({
    summary: 'List products currently at or below their low-stock threshold',
    description:
      'Evaluates stockQuantity <= lowStockThreshold at the PostgreSQL database level, supporting custom threshold cutoffs, category filters, and pagination.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated low-stock products returned successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid credentials',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions (CUSTOMER role denied)',
  })
  async getLowStock(
    @Query(createZodPipe(lowStockQuerySchema)) query: LowStockQueryDto
  ) {
    return this.inventoryService.getLowStock(query);
  }
}

