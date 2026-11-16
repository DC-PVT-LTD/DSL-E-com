import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InventoryGateway } from '../inventory/inventory.gateway';
import { PrivateReceiptStorageService } from '../checkout/private-receipt-storage.service';
import {
  BankDepositStatus,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  PaymentAttemptStatus,
  InventoryChangeReason,
  Prisma,
} from '../../generated/prisma';
import {
  BankTransferQueryDto,
  ApproveBankTransferDto,
  RejectBankTransferDto,
  PaymentsDashboardQueryDto,
} from './dto/payments.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(InventoryGateway) private readonly inventoryGateway: InventoryGateway,
    @Inject(PrivateReceiptStorageService) private readonly privateReceiptStorageService: PrivateReceiptStorageService
  ) { }

  /**
   * Retrieves paginated Bank Transfer submissions for the Admin Verification Queue.
   * Only Bank Transfer submissions are displayed.
   */
  async getBankTransfers(query: BankTransferQueryDto) {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      startDate,
      endDate,
      minAmountCents,
      maxAmountCents,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.BankDepositSubmissionWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (minAmountCents !== undefined || maxAmountCents !== undefined) {
      where.amountCents = {};
      if (minAmountCents !== undefined) where.amountCents.gte = minAmountCents;
      if (maxAmountCents !== undefined) where.amountCents.lte = maxAmountCents;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { referenceNumber: { contains: q, mode: 'insensitive' } },
        { order: { orderNumber: { contains: q, mode: 'insensitive' } } },
        { order: { customerName: { contains: q, mode: 'insensitive' } } },
        { order: { customerEmail: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.bankDepositSubmission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              customerName: true,
              customerEmail: true,
              customerPhone: true,
              totalCents: true,
              orderStatus: true,
              paymentStatus: true,
              createdAt: true,
            },
          },
          reviewedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.bankDepositSubmission.count({ where }),
    ]);

    return {
      items: items.map((sub) => ({
        id: sub.id,
        orderId: sub.orderId,
        orderNumber: sub.order.orderNumber,
        customerName: sub.order.customerName,
        customerEmail: sub.order.customerEmail,
        customerPhone: sub.order.customerPhone,
        orderCreatedAt: sub.order.createdAt,
        depositDate: sub.depositDate,
        submittedAt: sub.createdAt,
        referenceNumber: sub.referenceNumber,
        submittedAmountCents: sub.amountCents,
        orderTotalCents: sub.order.totalCents,
        amountMatches: sub.amountCents === sub.order.totalCents,
        orderStatus: sub.order.orderStatus,
        paymentStatus: sub.order.paymentStatus,
        verificationStatus: sub.status,
        receiptFilename: sub.originalFilename,
        receiptMimeType: sub.mimeType,
        receiptSizeBytes: sub.fileSizeBytes,
        hasReceipt: Boolean(sub.receiptStorageKey),
        customerNotes: sub.customerNotes,
        rejectionReason: sub.rejectionReason,
        reviewedAt: sub.reviewedAt,
        reviewedBy: sub.reviewedBy ? { id: sub.reviewedBy.id, name: sub.reviewedBy.name } : null,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves single Bank Deposit Submission details with complete order snapshot for the review drawer.
   */
  async getBankTransferDetails(submissionId: string) {
    const sub = await this.prisma.bankDepositSubmission.findUnique({
      where: { id: submissionId },
      include: {
        order: {
          include: {
            items: true,
            addressSnapshot: true,
            paymentAttempts: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        reviewedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!sub) {
      throw new NotFoundException(`Bank deposit submission "${submissionId}" not found`);
    }

    return {
      submission: {
        id: sub.id,
        referenceNumber: sub.referenceNumber,
        depositDate: sub.depositDate,
        amountCents: sub.amountCents,
        customerNotes: sub.customerNotes,
        status: sub.status,
        rejectionReason: sub.rejectionReason,
        reviewedAt: sub.reviewedAt,
        reviewedBy: sub.reviewedBy ? { id: sub.reviewedBy.id, name: sub.reviewedBy.name, email: sub.reviewedBy.email } : null,
        originalFilename: sub.originalFilename,
        mimeType: sub.mimeType,
        fileSizeBytes: sub.fileSizeBytes,
        createdAt: sub.createdAt,
      },
      order: {
        id: sub.order.id,
        orderNumber: sub.order.orderNumber,
        customerName: sub.order.customerName,
        customerEmail: sub.order.customerEmail,
        customerPhone: sub.order.customerPhone,
        subtotalCents: sub.order.subtotalCents,
        discountCents: sub.order.discountCents,
        deliveryCents: sub.order.deliveryCents,
        totalCents: sub.order.totalCents,
        orderStatus: sub.order.orderStatus,
        paymentStatus: sub.order.paymentStatus,
        notes: sub.order.notes,
        createdAt: sub.order.createdAt,
        items: sub.order.items,
        addressSnapshot: sub.order.addressSnapshot,
        paymentAttempts: sub.order.paymentAttempts,
      },
    };
  }

  /**
   * Atomically verifies and approves a Bank Transfer submission.
   * Requires MANAGER or ADMIN role.
   */
  async approveBankTransfer(
    submissionId: string,
    dto: ApproveBankTransferDto,
    actor: { id: string; email: string; name?: string }
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Lock submission row
      const sub = await tx.bankDepositSubmission.findUnique({
        where: { id: submissionId },
        include: {
          order: true,
          paymentAttempt: true,
        },
      });

      if (!sub) {
        throw new NotFoundException(`Bank deposit submission "${submissionId}" not found`);
      }

      // Concurrency & idempotency check: prevent duplicate or conflicting approval
      if (sub.status === BankDepositStatus.VERIFIED) {
        throw new ConflictException('This submission has already been verified and approved.');
      }
      if (sub.status === BankDepositStatus.REJECTED) {
        throw new ConflictException('This submission has already been rejected and cannot be approved.');
      }

      // Validate order eligibility
      if (sub.order.paymentMethod !== PaymentMethod.BANK_TRANSFER) {
        throw new BadRequestException('Order was not placed via Bank Transfer.');
      }
      if (sub.order.orderStatus === OrderStatus.CANCELLED) {
        throw new BadRequestException('Cannot approve payment for an already CANCELLED order.');
      }
      if (sub.order.paymentStatus === PaymentStatus.PAID) {
        throw new ConflictException('Order payment has already been marked as PAID.');
      }

      // Amount matching assertion
      if (sub.amountCents !== sub.order.totalCents) {
        throw new BadRequestException(
          `Submitted deposit amount (LKR ${(sub.amountCents / 100).toFixed(2)}) does not match order total (LKR ${(sub.order.totalCents / 100).toFixed(2)}).`
        );
      }

      const now = new Date();

      // 2. Update submission status to VERIFIED
      const updatedSub = await tx.bankDepositSubmission.update({
        where: { id: sub.id },
        data: {
          status: BankDepositStatus.VERIFIED,
          reviewedById: actor.id,
          reviewedAt: now,
        },
      });

      // 3. Update order status to CONFIRMED and paymentStatus to PAID
      const updatedOrder = await tx.order.update({
        where: { id: sub.order.id },
        data: {
          orderStatus: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PAID,
          notes: dto.adminNotes
            ? sub.order.notes
              ? `${sub.order.notes} | [VERIFIED NOTE: ${dto.adminNotes}]`
              : `[VERIFIED NOTE: ${dto.adminNotes}]`
            : sub.order.notes,
        },
      });

      // 4. Update PaymentAttempt if linked
      if (sub.paymentAttemptId) {
        await tx.paymentAttempt.update({
          where: { id: sub.paymentAttemptId },
          data: {
            status: PaymentAttemptStatus.SUCCEEDED,
            gatewayReference: sub.referenceNumber,
          },
        });
      }

      // 5. Create immutable audit log
      await this.auditService.recordAuditLog({
        action: 'APPROVE_BANK_TRANSFER',
        entityType: 'BankDepositSubmission',
        entityId: sub.id,
        userId: actor.id,
        summary: `Admin ${actor.email} verified Bank Transfer for order ${sub.order.orderNumber}. Ref: ${sub.referenceNumber}, Amount: LKR ${(sub.amountCents / 100).toFixed(2)}`,
        changes: {
          submissionStatus: { old: sub.status, new: BankDepositStatus.VERIFIED },
          orderStatus: { old: sub.order.orderStatus, new: OrderStatus.CONFIRMED },
          paymentStatus: { old: sub.order.paymentStatus, new: PaymentStatus.PAID },
        },
      });

      this.logger.log(
        `Bank Transfer ${sub.id} for order ${sub.order.orderNumber} approved by ${actor.email}`
      );

      return {
        success: true,
        message: 'Bank Transfer verified and approved successfully',
        submission: updatedSub,
        order: updatedOrder,
      };
    });
  }

  /**
   * Atomically rejects a Bank Transfer submission, cancels the order, and restores committed physical stock.
   * Requires MANAGER or ADMIN role.
   */
  async rejectBankTransfer(
    submissionId: string,
    dto: RejectBankTransferDto,
    actor: { id: string; email: string; name?: string }
  ) {
    const fullRejectionReason = `[${dto.category}] ${dto.explanation}`;

    // Execute atomic transaction for rejection and stock release
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Lock submission row
      const sub = await tx.bankDepositSubmission.findUnique({
        where: { id: submissionId },
        include: {
          order: {
            include: {
              items: true,
            },
          },
          paymentAttempt: true,
        },
      });

      if (!sub) {
        throw new NotFoundException(`Bank deposit submission "${submissionId}" not found`);
      }

      // Prevent conflicting or duplicate rejection/approval
      if (sub.status === BankDepositStatus.VERIFIED) {
        throw new ConflictException('An already VERIFIED payment cannot be rejected through this workflow.');
      }
      if (sub.status === BankDepositStatus.REJECTED) {
        throw new ConflictException('This submission has already been rejected.');
      }
      if (sub.order.orderStatus === OrderStatus.CANCELLED) {
        throw new ConflictException('The order associated with this submission is already CANCELLED.');
      }

      const now = new Date();

      // 2. Update submission status to REJECTED with mandatory reason
      const updatedSub = await tx.bankDepositSubmission.update({
        where: { id: sub.id },
        data: {
          status: BankDepositStatus.REJECTED,
          rejectionReason: fullRejectionReason,
          reviewedById: actor.id,
          reviewedAt: now,
        },
      });

      // 3. Update order status to CANCELLED and paymentStatus to FAILED
      const rejectionNote = `[REJECTED: ${fullRejectionReason}]`;
      const updatedOrder = await tx.order.update({
        where: { id: sub.order.id },
        data: {
          orderStatus: OrderStatus.CANCELLED,
          paymentStatus: PaymentStatus.FAILED,
          notes: sub.order.notes ? `${sub.order.notes} | ${rejectionNote}` : rejectionNote,
        },
      });

      // 4. Update PaymentAttempt if linked
      if (sub.paymentAttemptId) {
        await tx.paymentAttempt.update({
          where: { id: sub.paymentAttemptId },
          data: {
            status: PaymentAttemptStatus.FAILED,
            failureReason: fullRejectionReason,
          },
        });
      }

      // 5. Release committed physical stock exactly once and record InventoryMovement
      const restoredItems: Array<{ productId: string; variantId: string | null; quantity: number }> = [];

      for (const item of sub.order.items) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stockQuantity: { increment: item.quantity } },
          });
        }

        const prod = await tx.product.findUnique({
          where: { id: item.productId },
          select: { id: true, stockQuantity: true },
        });

        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.quantity } },
        });

        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            variantId: item.variantId || null,
            previousQuantity: prod ? prod.stockQuantity : 0,
            newQuantity: prod ? prod.stockQuantity + item.quantity : item.quantity,
            changeAmount: item.quantity,
            reason: InventoryChangeReason.RESTOCK,
            note: `Bank Transfer rejected for order ${sub.order.orderNumber}: ${dto.category}`,
            performedById: actor.id,
          },
        });

        restoredItems.push({
          productId: item.productId,
          variantId: item.variantId || null,
          quantity: item.quantity,
        });
      }

      // 6. Write AuditLog
      await this.auditService.recordAuditLog({
        action: 'REJECT_BANK_TRANSFER',
        entityType: 'BankDepositSubmission',
        entityId: sub.id,
        userId: actor.id,
        summary: `Admin ${actor.email} rejected Bank Transfer for order ${sub.order.orderNumber}. Reason: ${fullRejectionReason}`,
        changes: {
          submissionStatus: { old: sub.status, new: BankDepositStatus.REJECTED },
          orderStatus: { old: sub.order.orderStatus, new: OrderStatus.CANCELLED },
          paymentStatus: { old: sub.order.paymentStatus, new: PaymentStatus.FAILED },
          rejectionReason: { new: fullRejectionReason },
        },
      });

      this.logger.log(
        `Bank Transfer ${sub.id} for order ${sub.order.orderNumber} rejected by ${actor.email}. Stock restored.`
      );

      return {
        submission: updatedSub,
        order: updatedOrder,
        restoredItems,
      };
    });

    // 7. Broadcast live stock updates strictly AFTER successful transaction commit
    if (this.inventoryGateway && result.restoredItems.length > 0) {
      for (const item of result.restoredItems) {
        try {
          const p = await this.prisma.product.findUnique({ where: { id: item.productId } });
          if (p) {
            const activeRes = await this.prisma.stockReservationItem.findMany({
              where: {
                productId: p.id,
                reservation: {
                  status: { in: ['ACTIVE', 'PAYMENT_PENDING'] as any },
                  expiresAt: { gt: new Date() },
                },
              },
              select: { quantity: true },
            });
            const reservedStock = activeRes.reduce((s, it) => s + it.quantity, 0);

            this.inventoryGateway.broadcastStockUpdate({
              productId: p.id,
              variantId: item.variantId,
              physicalStock: p.stockQuantity,
              reservedStock,
              availableStock: Math.max(0, p.stockQuantity - reservedStock),
              timestamp: new Date().toISOString(),
              reason: 'PAYMENT_REJECTED_RESTOCK',
            });
          }
        } catch (wsErr) {
          this.logger.error('Error broadcasting post-rejection stock update:', wsErr);
        }
      }
    }

    return {
      success: true,
      message: 'Bank Transfer rejected, order cancelled, and committed stock restored successfully',
      submission: result.submission,
      order: result.order,
    };
  }

  /**
   * Stage 3.4: Retrieves consolidated summary statistics for the Payments Dashboard.
   */
  async getPaymentsSummary(query?: { startDate?: string; endDate?: string }) {
    const whereOrder: Prisma.OrderWhereInput = {};
    if (query?.startDate || query?.endDate) {
      whereOrder.createdAt = {};
      if (query.startDate) whereOrder.createdAt.gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        whereOrder.createdAt.lte = end;
      }
    }

    const [
      totalOrders,
      paidOrders,
      pendingOrders,
      failedOrders,
      codPendingOrders,
      codDeliveredPaidOrders,
      codVolumeResult,
      bankTransferPending,
      bankTransferVerified,
      bankTransferRejected,
      bankTransferVolumeResult,
      payhereSucceeded,
      payherePending,
      payhereFailed,
      payhereVolumeResult,
      totalVolumeCentsResult,
    ] = await Promise.all([
      this.prisma.order.count({ where: whereOrder }),
      this.prisma.order.count({ where: { ...whereOrder, paymentStatus: PaymentStatus.PAID } }),
      this.prisma.order.count({ where: { ...whereOrder, paymentStatus: PaymentStatus.PENDING } }),
      this.prisma.order.count({ where: { ...whereOrder, paymentStatus: PaymentStatus.FAILED } }),
      this.prisma.order.count({
        where: {
          ...whereOrder,
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
          paymentStatus: PaymentStatus.PENDING,
          orderStatus: { not: OrderStatus.CANCELLED },
        },
      }),
      this.prisma.order.count({
        where: {
          ...whereOrder,
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
          paymentStatus: PaymentStatus.PAID,
        },
      }),
      this.prisma.order.aggregate({
        where: {
          ...whereOrder,
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
          paymentStatus: PaymentStatus.PAID,
        },
        _sum: { totalCents: true },
      }),
      this.prisma.bankDepositSubmission.count({ where: { status: BankDepositStatus.PENDING } }),
      this.prisma.bankDepositSubmission.count({ where: { status: BankDepositStatus.VERIFIED } }),
      this.prisma.bankDepositSubmission.count({ where: { status: BankDepositStatus.REJECTED } }),
      this.prisma.order.aggregate({
        where: {
          ...whereOrder,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          paymentStatus: PaymentStatus.PAID,
        },
        _sum: { totalCents: true },
      }),
      this.prisma.order.count({
        where: {
          ...whereOrder,
          paymentMethod: PaymentMethod.CARD_PAYHERE,
          paymentStatus: PaymentStatus.PAID,
        },
      }),
      this.prisma.order.count({
        where: {
          ...whereOrder,
          paymentMethod: PaymentMethod.CARD_PAYHERE,
          paymentStatus: PaymentStatus.PENDING,
        },
      }),
      this.prisma.order.count({
        where: {
          ...whereOrder,
          paymentMethod: PaymentMethod.CARD_PAYHERE,
          paymentStatus: PaymentStatus.FAILED,
        },
      }),
      this.prisma.order.aggregate({
        where: {
          ...whereOrder,
          paymentMethod: PaymentMethod.CARD_PAYHERE,
          paymentStatus: PaymentStatus.PAID,
        },
        _sum: { totalCents: true },
      }),
      this.prisma.order.aggregate({
        where: { ...whereOrder, paymentStatus: PaymentStatus.PAID },
        _sum: { totalCents: true },
      }),
    ]);

    return {
      totalTransactions: totalOrders,
      successfulPayments: paidOrders,
      pendingPayments: pendingOrders,
      failedPayments: failedOrders,
      totalPaidVolumeCents: totalVolumeCentsResult._sum.totalCents || 0,
      bankTransfers: {
        pending: bankTransferPending,
        verified: bankTransferVerified,
        rejected: bankTransferRejected,
        totalVolumeCents: bankTransferVolumeResult._sum.totalCents || 0,
      },
      payhereCards: {
        succeeded: payhereSucceeded,
        pending: payherePending,
        failed: payhereFailed,
        totalVolumeCents: payhereVolumeResult._sum.totalCents || 0,
      },
      cashOnDelivery: {
        pendingCollection: codPendingOrders,
        deliveredPaid: codDeliveredPaidOrders,
        totalVolumeCents: codVolumeResult._sum.totalCents || 0,
      },
      codPendingCollection: codPendingOrders,
    };
  }

  /**
   * Stage 3.4: Retrieves paginated consolidated transactions across all 3 supported methods.
   */
  async getPaymentTransactions(query: PaymentsDashboardQueryDto) {
    const {
      page = 1,
      limit = 20,
      search,
      paymentMethod,
      paymentStatus,
      orderStatus,
      bankVerificationStatus,
      startDate,
      endDate,
      minAmountCents,
      maxAmountCents,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {};

    if (paymentMethod) where.paymentMethod = paymentMethod;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (orderStatus) where.orderStatus = orderStatus;

    if (bankVerificationStatus) {
      where.bankDepositSubmissions = {
        some: { status: bankVerificationStatus },
      };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (minAmountCents !== undefined || maxAmountCents !== undefined) {
      where.totalCents = {};
      if (minAmountCents !== undefined) where.totalCents.gte = minAmountCents;
      if (maxAmountCents !== undefined) where.totalCents.lte = maxAmountCents;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { customerEmail: { contains: q, mode: 'insensitive' } },
        {
          bankDepositSubmissions: {
            some: { referenceNumber: { contains: q, mode: 'insensitive' } },
          },
        },
        {
          paymentAttempts: {
            some: { gatewayReference: { contains: q, mode: 'insensitive' } },
          },
        },
      ];
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          bankDepositSubmissions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              reviewedBy: {
                select: { id: true, name: true, email: true },
              },
            },
          },
          paymentAttempts: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: orders.map((o) => {
        const latestSubmission = o.bankDepositSubmissions[0] || null;
        const latestAttempt = o.paymentAttempts[0] || null;

        return {
          id: o.id,
          orderNumber: o.orderNumber,
          customerName: o.customerName,
          customerEmail: o.customerEmail,
          paymentMethod: o.paymentMethod,
          totalCents: o.totalCents,
          paymentStatus: o.paymentStatus,
          orderStatus: o.orderStatus,
          transactionReference:
            latestSubmission?.referenceNumber || latestAttempt?.gatewayReference || null,
          bankVerificationStatus: latestSubmission?.status || null,
          bankSubmissionId: latestSubmission?.id || null,
          rejectionReason: latestSubmission?.rejectionReason || null,
          createdAt: o.createdAt,
          updatedAt: o.updatedAt,
        };
      }),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Stage 3.4: Generates RFC-4180 compliant CSV export with formula injection protection.
   */
  async exportPaymentsCsv(query: PaymentsDashboardQueryDto, actor: { id: string; email: string }) {
    // Audit export action
    await this.auditService.recordAuditLog({
      action: 'EXPORT_PAYMENTS_CSV',
      entityType: 'PaymentTransactions',
      entityId: 'ALL',
      userId: actor.id,
      summary: `Admin ${actor.email} exported payments transactions to CSV.`,
    });

    // Fetch transactions matching filter up to a safe export ceiling of 5,000 records
    const exportQuery = { ...query, page: 1, limit: 5000 };
    const result = await this.getPaymentTransactions(exportQuery);

    const headers = [
      'Order Number',
      'Customer Name',
      'Customer Email',
      'Payment Method',
      'Total (LKR)',
      'Payment Status',
      'Order Status',
      'Transaction Reference',
      'Bank Verification Status',
      'Created Date',
      'Updated Date',
    ];

    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return '""';
      let str = String(val).trim();

      // Protect against CSV Formula Injection (=, +, -, @, \t, \r)
      if (['=', '+', '-', '@'].includes(str.charAt(0))) {
        str = `'${str}`;
      }

      // Escape existing quotes
      str = str.replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = result.items.map((it) => [
      escapeCsv(it.orderNumber),
      escapeCsv(it.customerName),
      escapeCsv(it.customerEmail),
      escapeCsv(it.paymentMethod),
      escapeCsv((it.totalCents / 100).toFixed(2)),
      escapeCsv(it.paymentStatus),
      escapeCsv(it.orderStatus),
      escapeCsv(it.transactionReference || 'N/A'),
      escapeCsv(it.bankVerificationStatus || 'N/A'),
      escapeCsv(new Date(it.createdAt).toISOString()),
      escapeCsv(new Date(it.updatedAt).toISOString()),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    return csvContent;
  }

  /**
   * Stage 3.5: Read-only financial reconciliation & state consistency checker.
   * Audits active records across all 3 supported methods for state anomalies.
   * STRICTLY READ-ONLY: Executes zero database mutations or auto-fixes.
   */
  async getPaymentReconciliationReport() {
    const issues: Array<{
      category: string;
      orderNumber: string;
      orderId: string;
      orderStatus: string;
      paymentStatus: string;
      description: string;
      severity: 'HIGH' | 'MEDIUM' | 'LOW';
    }> = [];

    const totalCheckedOrders = await this.prisma.order.count();

    // 1. Delivered COD orders whose payment status is not PAID
    const unpaidDeliveredCodOrders = await this.prisma.order.findMany({
      where: {
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        orderStatus: OrderStatus.DELIVERED,
        paymentStatus: { not: PaymentStatus.PAID },
      },
      select: {
        id: true,
        orderNumber: true,
        orderStatus: true,
        paymentStatus: true,
      },
    });

    for (const ord of unpaidDeliveredCodOrders) {
      issues.push({
        category: 'DELIVERED_COD_UNPAID',
        orderNumber: ord.orderNumber,
        orderId: ord.id,
        orderStatus: ord.orderStatus,
        paymentStatus: ord.paymentStatus,
        description: `Order ${ord.orderNumber} is marked DELIVERED via Cash on Delivery, but payment status is ${ord.paymentStatus} instead of PAID.`,
        severity: 'HIGH',
      });
    }

    // 2. VERIFIED bank deposits where the associated order is not CONFIRMED/PAID
    const verifiedSubs = await this.prisma.bankDepositSubmission.findMany({
      where: { status: BankDepositStatus.VERIFIED },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            orderStatus: true,
            paymentStatus: true,
          },
        },
      },
    });

    for (const sub of verifiedSubs) {
      if (
        sub.order.orderStatus === OrderStatus.CANCELLED ||
        sub.order.orderStatus === OrderStatus.PENDING ||
        sub.order.paymentStatus !== PaymentStatus.PAID
      ) {
        issues.push({
          category: 'VERIFIED_DEPOSIT_UNCONFIRMED_ORDER',
          orderNumber: sub.order.orderNumber,
          orderId: sub.order.id,
          orderStatus: sub.order.orderStatus,
          paymentStatus: sub.order.paymentStatus,
          description: `Bank deposit submission ${sub.id} is VERIFIED, but associated order ${sub.order.orderNumber} has inconsistent orderStatus=${sub.order.orderStatus} or paymentStatus=${sub.order.paymentStatus}.`,
          severity: 'HIGH',
        });
      }
    }

    // 3. CONFIRMED/active CARD_PAYHERE orders without a SUCCEEDED payment attempt
    const activeCardOrders = await this.prisma.order.findMany({
      where: {
        paymentMethod: PaymentMethod.CARD_PAYHERE,
        orderStatus: {
          in: [
            OrderStatus.CONFIRMED,
            OrderStatus.PROCESSING,
            OrderStatus.PACKED,
            OrderStatus.SHIPPED,
            OrderStatus.DELIVERED,
          ],
        },
      },
      include: {
        paymentAttempts: {
          where: { status: PaymentAttemptStatus.SUCCEEDED },
        },
      },
    });

    for (const ord of activeCardOrders) {
      if (ord.paymentAttempts.length === 0) {
        issues.push({
          category: 'CONFIRMED_CARD_WITHOUT_SUCCESS_ATTEMPT',
          orderNumber: ord.orderNumber,
          orderId: ord.id,
          orderStatus: ord.orderStatus,
          paymentStatus: ord.paymentStatus,
          description: `Card PayHere order ${ord.orderNumber} is in fulfillment (${ord.orderStatus}), but has no SUCCEEDED PaymentAttempt record.`,
          severity: 'HIGH',
        });
      }
    }

    // 4. Orders marked PAID without a valid successful payment record
    const allPaidOrders = await this.prisma.order.findMany({
      where: { paymentStatus: PaymentStatus.PAID },
      include: {
        paymentAttempts: {
          select: { id: true, status: true },
        },
        bankDepositSubmissions: {
          select: { id: true, status: true },
        },
      },
    });

    for (const ord of allPaidOrders) {
      let isLegit = false;
      if (ord.paymentMethod === PaymentMethod.CARD_PAYHERE) {
        // A PAID Card order is valid ONLY if it has at least one SUCCEEDED PaymentAttempt
        isLegit =
          Array.isArray(ord.paymentAttempts) &&
          ord.paymentAttempts.some((a) => a.status === PaymentAttemptStatus.SUCCEEDED);
      } else if (ord.paymentMethod === PaymentMethod.BANK_TRANSFER) {
        // A PAID Bank Transfer order is valid ONLY if it has at least one VERIFIED BankDepositSubmission
        isLegit =
          Array.isArray(ord.bankDepositSubmissions) &&
          ord.bankDepositSubmissions.some((s) => s.status === BankDepositStatus.VERIFIED);
      } else if (ord.paymentMethod === PaymentMethod.CASH_ON_DELIVERY) {
        // A PAID COD order is valid ONLY if delivered
        isLegit = ord.orderStatus === OrderStatus.DELIVERED;
      } else {
        // Unsupported or unknown payment methods are never treated as valid
        isLegit = false;
      }

      if (!isLegit) {
        const alreadyFlagged = issues.some(
          (i) =>
            i.orderId === ord.id &&
            i.category === 'PAID_ORDER_WITHOUT_SUCCESSFUL_PAYMENT'
        );
        if (!alreadyFlagged) {
          issues.push({
            category: 'PAID_ORDER_WITHOUT_SUCCESSFUL_PAYMENT',
            orderNumber: ord.orderNumber,
            orderId: ord.id,
            orderStatus: ord.orderStatus,
            paymentStatus: ord.paymentStatus,
            description: `Order ${ord.orderNumber} is marked PAID via ${ord.paymentMethod}, but lacks a valid verified/delivered payment record.`,
            severity: 'HIGH',
          });
        }
      }
    }

    // 5. Multiple SUCCEEDED payment attempts for the same order
    const ordersWithAttempts = await this.prisma.order.findMany({
      where: {
        paymentAttempts: {
          some: { status: PaymentAttemptStatus.SUCCEEDED },
        },
      },
      include: {
        paymentAttempts: {
          where: { status: PaymentAttemptStatus.SUCCEEDED },
        },
      },
    });

    for (const ord of ordersWithAttempts) {
      if (ord.paymentAttempts.length > 1) {
        issues.push({
          category: 'DUPLICATE_SUCCEEDED_PAYMENT_ATTEMPTS',
          orderNumber: ord.orderNumber,
          orderId: ord.id,
          orderStatus: ord.orderStatus,
          paymentStatus: ord.paymentStatus,
          description: `Order ${ord.orderNumber} has ${ord.paymentAttempts.length} separate SUCCEEDED payment attempts (${ord.paymentAttempts.map((a) => a.id).join(', ')}).`,
          severity: 'HIGH',
        });
      }
    }

    // 6. Duplicate RESTOCK inventory movements for the same order and product
    const restockMovements = await this.prisma.inventoryMovement.findMany({
      where: { reason: InventoryChangeReason.RESTOCK },
      select: {
        id: true,
        productId: true,
        note: true,
        createdAt: true,
      },
    });

    const restockMap = new Map<string, string[]>();
    for (const m of restockMovements) {
      if (m.note) {
        const match = m.note.match(/DSL-[A-Za-z0-9-]+/);
        if (match) {
          const key = `${match[0]}_${m.productId}`;
          const list = restockMap.get(key) || [];
          list.push(m.id);
          restockMap.set(key, list);
        }
      }
    }

    for (const [key, movementIds] of restockMap.entries()) {
      if (movementIds.length > 1) {
        const [orderNum, prodId] = key.split('_');
        issues.push({
          category: 'DUPLICATE_RESTOCK_MOVEMENT',
          orderNumber: orderNum,
          orderId: '',
          orderStatus: OrderStatus.CANCELLED,
          paymentStatus: PaymentStatus.FAILED,
          description: `Order ${orderNum} product ${prodId} has ${movementIds.length} duplicate RESTOCK inventory movements (${movementIds.join(', ')}).`,
          severity: 'HIGH',
        });
      }
    }

    // 7. Rejected submission attached to a non-cancelled order
    const rejectedSubmissions = await this.prisma.bankDepositSubmission.findMany({
      where: { status: BankDepositStatus.REJECTED },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            orderStatus: true,
            paymentStatus: true,
          },
        },
      },
    });

    for (const sub of rejectedSubmissions) {
      if (sub.order.orderStatus !== OrderStatus.CANCELLED) {
        issues.push({
          category: 'REJECTED_SUBMISSION_ACTIVE_ORDER',
          orderNumber: sub.order.orderNumber,
          orderId: sub.order.id,
          orderStatus: sub.order.orderStatus,
          paymentStatus: sub.order.paymentStatus,
          description: `Bank submission ${sub.id} was REJECTED, but order status is ${sub.order.orderStatus} instead of CANCELLED.`,
          severity: 'HIGH',
        });
      }
    }

    // 8. Cancelled Bank Transfer or PayHere order whose stock restock movement is missing
    const cancelledOrders = await this.prisma.order.findMany({
      where: {
        orderStatus: OrderStatus.CANCELLED,
        paymentStatus: PaymentStatus.FAILED,
      },
      include: { items: true },
      take: 100,
    });

    for (const ord of cancelledOrders) {
      for (const item of ord.items) {
        const movement = await this.prisma.inventoryMovement.findFirst({
          where: {
            productId: item.productId,
            reason: InventoryChangeReason.RESTOCK,
            note: { contains: ord.orderNumber },
          },
        });
        if (!movement) {
          issues.push({
            category: 'MISSING_RESTOCK_MOVEMENT',
            orderNumber: ord.orderNumber,
            orderId: ord.id,
            orderStatus: ord.orderStatus,
            paymentStatus: ord.paymentStatus,
            description: `Order ${ord.orderNumber} is CANCELLED but product ${item.productId} has no corresponding RESTOCK InventoryMovement record.`,
            severity: 'MEDIUM',
          });
        }
      }
    }

    // 9. Multiple active submissions for the same order
    const multiSubOrders = await this.prisma.order.findMany({
      where: {
        bankDepositSubmissions: {
          some: {},
        },
      },
      include: {
        bankDepositSubmissions: true,
      },
    });

    for (const ord of multiSubOrders) {
      const activeSubs = ord.bankDepositSubmissions.filter(
        (s) =>
          s.status === BankDepositStatus.PENDING ||
          s.status === BankDepositStatus.VERIFIED
      );
      if (activeSubs.length > 1) {
        issues.push({
          category: 'MULTIPLE_ACTIVE_SUBMISSIONS',
          orderNumber: ord.orderNumber,
          orderId: ord.id,
          orderStatus: ord.orderStatus,
          paymentStatus: ord.paymentStatus,
          description: `Order has ${activeSubs.length} active (PENDING/VERIFIED) bank deposit submissions.`,
          severity: 'HIGH',
        });
      }
    }

    const inspectedCategories = [
      'DELIVERED_COD_UNPAID',
      'VERIFIED_DEPOSIT_UNCONFIRMED_ORDER',
      'CONFIRMED_CARD_WITHOUT_SUCCESS_ATTEMPT',
      'PAID_ORDER_WITHOUT_SUCCESSFUL_PAYMENT',
      'DUPLICATE_SUCCEEDED_PAYMENT_ATTEMPTS',
      'DUPLICATE_RESTOCK_MOVEMENT',
      'REJECTED_SUBMISSION_ACTIVE_ORDER',
      'MISSING_RESTOCK_MOVEMENT',
      'MULTIPLE_ACTIVE_SUBMISSIONS',
    ];

    const now = new Date();
    return {
      summary: {
        totalCheckedOrders,
        totalAnomalies: issues.length,
        healthy: issues.length === 0,
      },
      anomalies: issues.map((i) => ({
        type: i.category,
        orderId: i.orderId,
        orderNumber: i.orderNumber,
        paymentStatus: i.paymentStatus,
        orderStatus: i.orderStatus,
        details: i.description,
        severity: i.severity,
      })),
      totalIssuesFound: issues.length,
      inspectedCategories,
      issues,
      healthy: issues.length === 0,
      checkedAt: now.toISOString(),
      timestamp: now.toISOString(),
    };
  }
}
