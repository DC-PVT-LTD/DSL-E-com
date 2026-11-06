import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  Inject,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { ReservationsService } from './reservations.service';
import { CheckoutService } from './checkout.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import {
  createReservationSchema,
  CreateReservationDto,
  validatePaySchema,
  ValidatePayDto,
  processPaymentSchema,
  ProcessPaymentDto,
  payHereWebhookSchema,
  PayHereWebhookDto,
} from './dto/checkout.dto';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { createApiResponse } from '../../common/interfaces/api-response.interface';

@ApiTags('Checkout & Reservations')
@Controller('checkout')
@UseGuards(OptionalJwtAuthGuard)
export class CheckoutController {
  constructor(
    @Inject(ReservationsService)
    private readonly reservationsService: ReservationsService,
    @Inject(CheckoutService)
    private readonly checkoutService: CheckoutService
  ) {}

  @Post('reserve')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Initiate 10-minute all-or-nothing stock reservation',
    description:
      'Pessimistically locks inventory rows, validates available stock, creates an all-or-nothing reservation for 10 minutes, and broadcasts inventory availability.',
  })
  @ApiResponse({ status: 201, description: 'Stock reserved for 10 minutes' })
  async createReservation(
    @Body(createZodPipe(createReservationSchema)) dto: CreateReservationDto,
    @Req() req: Request,
    @Headers('x-session-id') sessionHeader?: string
  ) {
    const user = (req as any).user;
    const userId = user?.id || null;
    const sessionId = sessionHeader || dto.sessionId || req.cookies?.dsl_cart_session || null;

    const result = await this.reservationsService.createReservation(
      dto,
      userId,
      sessionId
    );
    return createApiResponse(result, 'Stock reservation confirmed for 10 minutes');
  }

  @Post('reserve/:id/renew')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Safely renew an expired or expiring stock reservation',
  })
  @ApiResponse({ status: 200, description: 'Reservation renewed for 10 minutes' })
  async renewReservation(
    @Param('id') reservationId: string,
    @Req() req: Request,
    @Headers('x-session-id') sessionHeader?: string
  ) {
    const user = (req as any).user;
    const userId = user?.id || null;
    const sessionId = sessionHeader || req.cookies?.dsl_cart_session || null;

    const result = await this.reservationsService.renewReservation(
      reservationId,
      userId,
      sessionId
    );
    return createApiResponse(result, 'Reservation renewed with fresh 10-minute window');
  }

  @Get('reserve/:id/check-stock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check current stock availability for an expired reservation (Scenario A vs B)',
  })
  @ApiResponse({ status: 200, description: 'Live stock checked for expired reservation' })
  async checkReservationStock(@Param('id') reservationId: string) {
    const result = await this.reservationsService.checkExpiredStockForReservation(reservationId);
    return createApiResponse(result, result.message);
  }

  @Post('payment-cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Release PAYMENT_PENDING stock allocation on customer cancellation',
  })
  @ApiResponse({ status: 200, description: 'Stock allocation released' })
  async cancelPayment(
    @Body('reservationId') reservationId: string,
    @Req() req: Request,
    @Headers('x-session-id') sessionHeader?: string
  ) {
    const user = (req as any).user;
    const userId = user?.id || null;
    const sessionId = sessionHeader || req.cookies?.dsl_cart_session || null;

    const result = await this.reservationsService.releaseReservation(
      reservationId,
      userId,
      sessionId
    );
    return createApiResponse(result, 'Payment allocation released');
  }

  @Post('reserve/:id/release')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Explicitly release a stock reservation on cancellation or cart modification',
  })
  @ApiResponse({ status: 200, description: 'Reservation released and stock returned to available pool' })
  async releaseReservation(
    @Param('id') reservationId: string,
    @Req() req: Request,
    @Headers('x-session-id') sessionHeader?: string
  ) {
    const user = (req as any).user;
    const userId = user?.id || null;
    const sessionId = sessionHeader || req.cookies?.dsl_cart_session || null;

    const result = await this.reservationsService.releaseReservation(
      reservationId,
      userId,
      sessionId
    );
    return createApiResponse(result, 'Reservation released successfully');
  }

  @Post('validate-pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mandatory validation before payment initiation (Phase 10)',
    description:
      'Validates reservation state, active stock commitment, authoritative pricing from PostgreSQL, vouchers, delivery fees, and prepares idempotent payment attempt.',
  })
  async validatePay(
    @Body(createZodPipe(validatePaySchema)) dto: ValidatePayDto,
    @Req() req: Request,
    @Headers('x-session-id') sessionHeader?: string
  ) {
    const user = (req as any).user;
    const userId = user?.id || null;
    const sessionId = sessionHeader || dto.sessionId || req.cookies?.dsl_cart_session || null;

    const result = await this.checkoutService.validatePrePay(
      dto,
      userId,
      sessionId
    );
    return createApiResponse(result, 'Pre-payment validation succeeded');
  }

  @Post('pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Finalize payment, convert reserved stock to sold, and create order',
  })
  async processPayment(
    @Body(createZodPipe(processPaymentSchema)) dto: ProcessPaymentDto,
    @Req() req: Request,
    @Headers('x-session-id') sessionHeader?: string
  ) {
    const user = (req as any).user;
    const userId = user?.id || null;
    const sessionId = sessionHeader || dto.sessionId || req.cookies?.dsl_cart_session || null;

    const result = await this.checkoutService.processPayment(
      dto,
      userId,
      sessionId
    );
    return createApiResponse(result, 'Payment processed and order confirmed');
  }

  @Post('payhere/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'PayHere server-to-server payment verification callback',
  })
  async payHereWebhook(
    @Body(createZodPipe(payHereWebhookSchema)) dto: PayHereWebhookDto
  ) {
    const result = await this.checkoutService.handlePayHereWebhook(dto);
    return createApiResponse(result, 'PayHere webhook handled successfully');
  }

  @Get('status/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reconcile and get authoritative checkout payment status',
  })
  async reconcilePayment(@Param('id') id: string) {
    const result = await this.checkoutService.reconcilePaymentStatus(id);
    return createApiResponse(result, 'Payment status retrieved successfully');
  }
}

