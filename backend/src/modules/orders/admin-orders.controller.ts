import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminOrdersService } from './admin-orders.service';
import {
  adminOrdersQuerySchema,
  AdminOrdersQueryDto,
  adminUpdateStatusSchema,
  AdminUpdateStatusDto,
  adminUpdateCustomerSchema,
  AdminUpdateCustomerDto,
  adminUpdateDeliverySchema,
  AdminUpdateDeliveryDto,
  adminUpdateItemsSchema,
  AdminUpdateItemsDto,
  adminCancelOrderSchema,
  AdminCancelOrderDto,
  adminCreateReturnSchema,
  AdminCreateReturnDto,
  adminProcessReturnSchema,
  AdminProcessReturnDto,
  adminProcessRefundSchema,
  AdminProcessRefundDto,
  adminAddNoteSchema,
  AdminAddNoteDto,
} from './dto/admin-orders.dto';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { createApiResponse } from '../../common/interfaces/api-response.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../generated/prisma';

@ApiTags('Admin Orders')
@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
@ApiBearerAuth('bearerAuth')
export class AdminOrdersController {
  constructor(
    @Inject(AdminOrdersService)
    private readonly adminOrdersService: AdminOrdersService
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get aggregated order fulfillment metrics for dashboard' })
  async getOrderStats() {
    const stats = await this.adminOrdersService.getOrderStats();
    return createApiResponse(stats, 'Order statistics retrieved successfully');
  }

  @Get()
  @ApiOperation({ summary: 'Get paginated orders for Admin Portal with filtering and search' })
  async getOrders(@Query(createZodPipe(adminOrdersQuerySchema)) query: AdminOrdersQueryDto) {
    const result = await this.adminOrdersService.getOrders(query);
    return createApiResponse(result, 'Orders list retrieved successfully');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full order details with address, audit, notes, returns' })
  async getOrderById(@Param('id') id: string) {
    const order = await this.adminOrdersService.getOrderById(id);
    return createApiResponse(order, 'Order details retrieved successfully');
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update order fulfillment status with state machine transition rules' })
  async updateStatus(
    @Param('id') id: string,
    @Body(createZodPipe(adminUpdateStatusSchema)) dto: AdminUpdateStatusDto,
    @Req() req: Request
  ) {
    const user = (req as any).user;
    const updated = await this.adminOrdersService.updateStatus(id, dto, user);
    return createApiResponse(updated, 'Order status updated successfully');
  }

  @Patch(':id/customer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update customer contact info for this order snapshot' })
  async updateCustomerInfo(
    @Param('id') id: string,
    @Body(createZodPipe(adminUpdateCustomerSchema)) dto: AdminUpdateCustomerDto,
    @Req() req: Request
  ) {
    const user = (req as any).user;
    const updated = await this.adminOrdersService.updateCustomerInfo(id, dto, user);
    return createApiResponse(updated, 'Order customer details updated successfully');
  }

  @Patch(':id/delivery')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update delivery address details for this order' })
  async updateDeliveryInfo(
    @Param('id') id: string,
    @Body(createZodPipe(adminUpdateDeliverySchema)) dto: AdminUpdateDeliveryDto,
    @Req() req: Request
  ) {
    const user = (req as any).user;
    const updated = await this.adminOrdersService.updateDeliveryInfo(id, dto, user);
    return createApiResponse(updated, 'Order delivery address updated successfully');
  }

  @Patch(':id/items')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Modify order items and recalculate financial totals' })
  async updateOrderItems(
    @Param('id') id: string,
    @Body(createZodPipe(adminUpdateItemsSchema)) dto: AdminUpdateItemsDto,
    @Req() req: Request
  ) {
    const user = (req as any).user;
    const updated = await this.adminOrdersService.updateOrderItems(id, dto, user);
    return createApiResponse(updated, 'Order items modified and totals recalculated');
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel order with inventory restoration and refund options' })
  async cancelOrder(
    @Param('id') id: string,
    @Body(createZodPipe(adminCancelOrderSchema)) dto: AdminCancelOrderDto,
    @Req() req: Request
  ) {
    const user = (req as any).user;
    const updated = await this.adminOrdersService.cancelOrder(id, dto, user);
    return createApiResponse(updated, 'Order cancelled successfully');
  }

  @Get(':id/returns')
  @ApiOperation({ summary: 'Get return requests for order' })
  async getOrderReturns(@Param('id') id: string) {
    const returns = await this.adminOrdersService.getOrderReturns(id);
    return createApiResponse(returns, 'Order returns retrieved successfully');
  }

  @Post(':id/returns')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initiate a formal return request for order' })
  async createReturnRequest(
    @Param('id') id: string,
    @Body(createZodPipe(adminCreateReturnSchema)) dto: AdminCreateReturnDto,
    @Req() req: Request
  ) {
    const user = (req as any).user;
    const returnReq = await this.adminOrdersService.createReturnRequest(id, dto, user);
    return createApiResponse(returnReq, 'Return request created successfully');
  }

  @Patch(':id/returns/:returnId/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process return action (APPROVE, REJECT, CONFIRM_RECEIVED)' })
  async processReturnStatus(
    @Param('id') id: string,
    @Param('returnId') returnId: string,
    @Body(createZodPipe(adminProcessReturnSchema)) dto: AdminProcessReturnDto,
    @Req() req: Request
  ) {
    const user = (req as any).user;
    const updated = await this.adminOrdersService.processReturnStatus(id, returnId, dto, user);
    return createApiResponse(updated, 'Return status processed successfully');
  }

  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record official or manual refund for order' })
  async processRefund(
    @Param('id') id: string,
    @Body(createZodPipe(adminProcessRefundSchema)) dto: AdminProcessRefundDto,
    @Req() req: Request
  ) {
    const user = (req as any).user;
    const refund = await this.adminOrdersService.processRefund(id, dto, user);
    return createApiResponse(refund, 'Refund recorded and processed successfully');
  }

  @Get(':id/audit-history')
  @ApiOperation({ summary: 'Get comprehensive audit log history for order' })
  async getAuditHistory(@Param('id') id: string) {
    const logs = await this.adminOrdersService.getAuditHistory(id);
    return createApiResponse(logs, 'Order audit history retrieved successfully');
  }

  @Post(':id/notes')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add internal staff note to order' })
  async addAdminNote(
    @Param('id') id: string,
    @Body(createZodPipe(adminAddNoteSchema)) dto: AdminAddNoteDto,
    @Req() req: Request
  ) {
    const user = (req as any).user;
    const note = await this.adminOrdersService.addAdminNote(id, dto, user);
    return createApiResponse(note, 'Admin note added successfully');
  }
}

