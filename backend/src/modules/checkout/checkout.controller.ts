import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Inject,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import { ReservationsService } from './reservations.service';
import { CheckoutService } from './checkout.service';
import { PrivateReceiptStorageService } from './private-receipt-storage.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../generated/prisma';
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
    private readonly checkoutService: CheckoutService,
    @Inject(PrivateReceiptStorageService)
    private readonly privateReceiptStorageService: PrivateReceiptStorageService
  ) { }

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

  @Post(['payhere/webhook', 'payhere/notify'])
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

  @Get('settings')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Public checkout settings and payment method availability',
  })
  async getCheckoutSettings() {
    const result = await this.checkoutService.getCheckoutSettings();
    return createApiResponse(result, 'Checkout settings retrieved successfully');
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

  @Post('bank-receipt-upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('receipt', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB limit
      },
    })
  )
  @ApiOperation({
    summary: 'Upload bank transfer payment slip/receipt into private storage',
    description:
      'Uploads receipt file to private filesystem outside public access. Validates magic bytes, formats (JPEG, PNG, WebP, PDF), and 10MB ceiling. Returns staging receipt token bound to customer/session.',
  })
  @ApiConsumes('multipart/form-data')
  async uploadBankReceipt(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
    @Headers('x-session-id') sessionHeader?: string
  ) {
    if (!file) {
      throw new BadRequestException('No receipt file provided for upload');
    }
    const user = (req as any).user;
    const userId = user?.id || null;
    const sessionId = sessionHeader || req.cookies?.dsl_cart_session || null;

    const result = await this.privateReceiptStorageService.stageReceipt(file, {
      userId,
      sessionId,
    });
    return createApiResponse(result, 'Receipt uploaded and staged successfully');
  }

  @Get('bank-receipt/:submissionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({
    summary: 'Stream private bank transfer receipt file to authorized manager/admin',
    description:
      'Enforces strict RBAC and directory traversal protections. Streams receipt file securely from private storage. Restricted to MANAGER and ADMIN roles; STAFF role is strictly denied receipt file access.',
  })
  async getBankReceipt(
    @Param('submissionId') submissionId: string,
    @Res() res: Response
  ) {
    const submission = await this.checkoutService.getBankDepositSubmission(submissionId);
    const filePath = this.privateReceiptStorageService.getSecureFilePath(submission.receiptStorageKey);

    res.setHeader('Content-Type', submission.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(submission.originalFilename || 'receipt')}"`
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }
}

