import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { PaymentsService } from './payments.service';
import { ConfirmationService } from '../security/confirmation.service';
import {
  bankTransferQuerySchema,
  BankTransferQueryDto,
  approveBankTransferSchema,
  ApproveBankTransferDto,
  rejectBankTransferSchema,
  RejectBankTransferDto,
  paymentsDashboardQuerySchema,
  PaymentsDashboardQueryDto,
} from './dto/payments.dto';
import { createZodPipe } from '../../common/pipes/zod-validation.pipe';
import { createApiResponse } from '../../common/interfaces/api-response.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../admin/roles/guards/permissions.guard';
import { RequirePermissions } from '../admin/roles/decorators/require-permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../generated/prisma';

@ApiTags('Admin Payments & Bank Transfer Verification')
@Controller('admin/payments')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth('bearerAuth')
export class PaymentsController {
  constructor(
    @Inject(PaymentsService)
    private readonly paymentsService: PaymentsService,
    @Inject(ConfirmationService)
    private readonly confirmationService: ConfirmationService,
  ) {}

  // ============================================================================
  // STAGE 3.4: PAYMENTS DASHBOARD & TRANSACTIONS
  // ============================================================================

  @Get('summary')
  @RequirePermissions('orders.view')
  @Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Consolidated payment operation metrics across all payment methods',
  })
  async getPaymentsSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const summary = await this.paymentsService.getPaymentsSummary({ startDate, endDate });
    return createApiResponse(summary, 'Payments summary retrieved successfully');
  }

  @Get('transactions')
  @RequirePermissions('orders.view')
  @Roles(UserRole.STAFF, UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Paginated consolidated payment transactions table across PayHere, Bank, and COD',
  })
  async getPaymentTransactions(
    @Query(createZodPipe(paymentsDashboardQuerySchema)) query: PaymentsDashboardQueryDto
  ) {
    const result = await this.paymentsService.getPaymentTransactions(query);
    return createApiResponse(result, 'Payment transactions retrieved successfully');
  }

  @Get('export/csv')
  @RequirePermissions('orders.view')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Export filtered transactions to CSV with formula-injection protection',
  })
  async exportPaymentsCsv(
    @Query(createZodPipe(paymentsDashboardQuerySchema)) query: PaymentsDashboardQueryDto,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const user = (req as any).user;
    const csvData = await this.paymentsService.exportPaymentsCsv(query, user);

    const filename = `dsl_payments_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(HttpStatus.OK).send(csvData);
  }

  // ============================================================================
  // STAGE 3.3: BANK TRANSFER VERIFICATION QUEUE & ACTIONS
  // ============================================================================

  @Get('bank-transfers')
  @RequirePermissions('orders.view')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Pending Bank Transfer verification queue',
  })
  async getBankTransfers(
    @Query(createZodPipe(bankTransferQuerySchema)) query: BankTransferQueryDto
  ) {
    const result = await this.paymentsService.getBankTransfers(query);
    return createApiResponse(result, 'Bank transfer queue retrieved successfully');
  }

  @Get('bank-transfers/:submissionId')
  @RequirePermissions('orders.view')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Detailed Bank Transfer submission details with order snapshot for review drawer',
  })
  async getBankTransferDetails(@Param('submissionId') submissionId: string) {
    const details = await this.paymentsService.getBankTransferDetails(submissionId);
    return createApiResponse(details, 'Bank transfer details retrieved successfully');
  }

  @Post('bank-transfers/:submissionId/approve')
  @RequirePermissions('payments.verify_bank_deposit')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Manually approve Bank Transfer after comparing corporate bank statement',
  })
  async approveBankTransfer(
    @Param('submissionId') submissionId: string,
    @Body(createZodPipe(approveBankTransferSchema)) dto: ApproveBankTransferDto,
    @Req() req: Request
  ) {
    const user = (req as any).user;

    await this.confirmationService.validateConfirmation({
      action: 'APPROVE_BANK_DEPOSIT',
      req,
      targetEntity: 'BankDepositSubmission',
      targetId: submissionId,
      expectedValue: 'APPROVE BANK DEPOSIT',
      actor: {
        id: user?.id || 'admin',
        email: user?.email,
        name: user?.name,
        roleSlug: user?.assignedRole?.slug || user?.roleSlug,
      },
    });

    const result = await this.paymentsService.approveBankTransfer(submissionId, dto, user);
    return createApiResponse(result, 'Bank transfer approved successfully');
  }

  @Post('bank-transfers/:submissionId/reject')
  @RequirePermissions('payments.verify_bank_deposit')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Reject Bank Transfer, cancel order, and atomically restore committed physical inventory',
  })
  async rejectBankTransfer(
    @Param('submissionId') submissionId: string,
    @Body(createZodPipe(rejectBankTransferSchema)) dto: RejectBankTransferDto,
    @Req() req: Request
  ) {
    const user = (req as any).user;

    await this.confirmationService.validateConfirmation({
      action: 'REJECT_BANK_DEPOSIT',
      req,
      targetEntity: 'BankDepositSubmission',
      targetId: submissionId,
      expectedValue: 'REJECT BANK DEPOSIT',
      actor: {
        id: user?.id || 'admin',
        email: user?.email,
        name: user?.name,
        roleSlug: user?.assignedRole?.slug || user?.roleSlug,
      },
    });

    const result = await this.paymentsService.rejectBankTransfer(submissionId, dto, user);
    return createApiResponse(result, 'Bank transfer rejected successfully');
  }

  // ============================================================================
  // STAGE 3.5: FINANCIAL RECONCILIATION & CONSISTENCY CHECK
  // ============================================================================

  @Get('reconciliation-report')
  @RequirePermissions('orders.view')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Read-only financial and payment state consistency verification report',
  })
  async getPaymentReconciliationReport() {
    const report = await this.paymentsService.getPaymentReconciliationReport();
    return createApiResponse(report, 'Reconciliation report generated successfully');
  }
}
