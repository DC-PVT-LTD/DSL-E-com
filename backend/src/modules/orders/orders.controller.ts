import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Req,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { OrdersService } from './orders.service';
import {
  ordersQuerySchema,
  OrdersQueryDto,
  updateOrderStatusSchema,
  UpdateOrderStatusDto,
  requestTrackingOtpSchema,
  RequestTrackingOtpDto,
  verifyTrackingOtpSchema,
  VerifyTrackingOtpDto,
} from './dto/orders-query.dto';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { createApiResponse } from '../../common/interfaces/api-response.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../generated/prisma';

@ApiTags('Orders')
@Controller('orders')
@UseGuards(OptionalJwtAuthGuard)
export class OrdersController {
  constructor(
    @Inject(OrdersService)
    private readonly ordersService: OrdersService
  ) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get order details by order ID or Order Number' })
  @ApiResponse({ status: 200, description: 'Order details returned' })
  async getOrderById(
    @Param('id') idOrNumber: string,
    @Req() req: Request,
    @Headers('x-tracking-token') trackingTokenHeader?: string,
    @Query('token') tokenQuery?: string
  ) {
    const user = (req as any).user;
    const trackingToken = trackingTokenHeader || tokenQuery || null;
    const order = await this.ordersService.getOrderById(
      idOrNumber,
      user,
      trackingToken
    );
    return createApiResponse(order, 'Order retrieved successfully');
  }

  @Post(':id/tracking-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request OTP to access guest order details' })
  async requestTrackingOtp(
    @Param('id') idOrNumber: string,
    @Body(createZodPipe(requestTrackingOtpSchema)) dto: RequestTrackingOtpDto
  ) {
    const result = await this.ordersService.requestTrackingOtp(idOrNumber, dto.email);
    return createApiResponse(result, 'Tracking code request processed');
  }

  @Post(':id/verify-tracking-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP to obtain signed guest tracking token' })
  async verifyTrackingOtp(
    @Param('id') idOrNumber: string,
    @Body(createZodPipe(verifyTrackingOtpSchema)) dto: VerifyTrackingOtpDto
  ) {
    const result = await this.ordersService.verifyTrackingOtp(idOrNumber, dto.email, dto.otp);
    return createApiResponse(result, 'Tracking verification successful');
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({ summary: 'Get paginated orders for authenticated user or staff' })
  async getOrders(
    @Query(createZodPipe(ordersQuerySchema)) query: OrdersQueryDto,
    @Req() req: Request
  ) {
    const user = (req as any).user;
    const result = await this.ordersService.getOrders(query, user);
    return result;
  }

  @Post(':id/buy-again')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearerAuth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder products from previous order' })
  @ApiResponse({ status: 200, description: 'Evaluation of products for reordering completed' })
  @ApiResponse({ status: 403, description: 'Forbidden if order does not belong to authenticated customer' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async buyAgain(
    @Param('id') id: string,
    @Req() req: Request
  ) {
    const user = (req as any).user;
    const result = await this.ordersService.buyAgain(id, user);
    return createApiResponse(result, 'Buy again evaluation completed');
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth('bearerAuth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update order status (Staff / Admin only)' })
  async updateStatus(
    @Param('id') id: string,
    @Body(createZodPipe(updateOrderStatusSchema)) dto: UpdateOrderStatusDto,
    @Req() req: Request
  ) {
    const user = (req as any).user;
    const updated = await this.ordersService.updateStatus(id, dto, user);
    return createApiResponse(updated, 'Order status updated successfully');
  }
}

