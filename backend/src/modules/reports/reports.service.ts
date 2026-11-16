import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PaymentStatus,
  OrderStatus,
  PaymentMethod,
  RefundStatus,
} from '../../generated/prisma';
import {
  ReportQueryDto,
  ReportPeriod,
  ExportFormat,
  isValidCalendarDate,
} from './dto/report-query.dto';

export interface ColomboDateRange {
  period: ReportPeriod;
  dateFrom: string; // YYYY-MM-DD in Asia/Colombo
  dateTo: string;   // YYYY-MM-DD in Asia/Colombo
  startUtc: Date;
  endExclusiveUtc: Date;
}

export interface ReportKpiMetrics {
  grossSalesCents: number;
  netRevenueCents: number;
  totalRefundsCents: number;
  salesEligibleRefundsCents: number;
  cancelledOrderRefundsCents: number;
  totalOrdersCount: number;
  paidOrdersCount: number;
  averageOrderValueCents: number;
  deliveredOrdersCount: number;
  cancelledOrdersCount: number;
  pendingFulfillmentCount: number;
  codCollectedCents: number;
  codCollectedCount: number;
  codPendingCents: number;
  codPendingCount: number;
}

export interface CancellationReconciliation {
  cohortDescription: string;
  asOfTimestamp: string;
  cancelledPaidOrdersCount: number;
  cancelledPaidCapturedCents: number;
  cancelledPaidRefundedCents: number;
  cancelledPaidOutstandingCents: number;
}

export interface ReportInconsistency {
  code: string;
  message: string;
  orderId?: string;
  orderNumber?: string;
  amountCents?: number;
}

export type ReconciliationStatusEnum =
  | 'PASS'
  | 'MISMATCH'
  | 'INCONSISTENT_DATA'
  | 'NOT_VERIFIABLE';

export interface IndependentReconciliationResult {
  overallStatus: ReconciliationStatusEnum;
  grossSalesCheck: {
    status: 'PASS' | 'MISMATCH';
    sharedValueCents: number;
    independentValueCents: number;
    differenceCents: number;
  };
  salesRefundsCheck: {
    status: 'PASS' | 'MISMATCH';
    sharedValueCents: number;
    independentValueCents: number;
    differenceCents: number;
  };
  allRefundsCheck?: {
    status: 'PASS' | 'MISMATCH';
    sharedTotalCents: number;
    independentTotalCents: number;
    sharedSalesRefundsCents: number;
    independentSalesRefundsCents: number;
    sharedCancelledRefundsCents: number;
    independentCancelledRefundsCents: number;
    differenceCents: number;
  };
  netRevenueCheck: {
    status: 'PASS' | 'MISMATCH';
    sharedValueCents: number;
    independentValueCents: number;
    differenceCents: number;
  };
  cancelledCohortCheck: {
    status: 'PASS' | 'MISMATCH';
    sharedCapturedCents: number;
    independentCapturedCents: number;
    sharedRefundedCents: number;
    independentRefundedCents: number;
    sharedOutstandingCents: number;
    independentOutstandingCents: number;
  };
  integrityChecks: {
    status: 'PASS' | 'INCONSISTENT_DATA';
    duplicateRefundIdsCount: number;
    orphanedRefundsCount: number;
    overRefundedOrdersCount: number;
    refundedStatusWithoutRefundCount: number;
    negativeNetRevenue: boolean;
  };
  inconsistencies: ReportInconsistency[];
  asOfTimestamp: string;
}

export interface ReconciliationStatus {
  isNetRevenueReconciled: boolean;
  isRefundsReconciled: boolean;
  isCancelledReconciled: boolean;
  independentVerification: IndependentReconciliationResult;
  inconsistencies: ReportInconsistency[];
}

export interface PaymentMethodMetric {
  method: PaymentMethod;
  name: string;
  count: number;
  totalCents: number;
  percentage: number;
}

export interface OrderStatusMetric {
  status: OrderStatus;
  name: string;
  count: number;
  totalCents: number;
  percentage: number;
}

export interface DistrictMetric {
  district: string;
  count: number;
  totalCents: number;
  percentage: number;
}

export interface DailySalesMetric {
  date: string;
  grossSalesCents: number;
  netRevenueCents: number;
  refundsCents: number;
  cancelledRefundsCents: number;
  orderCount: number;
  paidOrderCount: number;
  averageOrderValueCents: number;
}

export interface OrderItemExportDto {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  totalCents: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  createdAt: string;
  createdAtFormatted: string;
  district: string;
  refundedAmountCents: number;
}

export interface ReportSummaryResponse {
  period: ReportPeriod;
  dateFrom: string;
  dateTo: string;
  timezone: 'Asia/Colombo';
  kpi: ReportKpiMetrics;
  cancellationReconciliation: CancellationReconciliation;
  reconciliation: ReconciliationStatus;
  paymentMethods: PaymentMethodMetric[];
  orderStatuses: OrderStatusMetric[];
  districtDistribution: DistrictMetric[];
}

export interface SalesReportResponse extends ReportSummaryResponse {
  dailySales: DailySalesMetric[];
  recentOrders: OrderItemExportDto[];
}

export interface ExportResult {
  buffer?: Buffer;
  filename: string;
  mimeType: string;
}

export const CAPTURED_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.PAID,
  PaymentStatus.PARTIALLY_REFUNDED,
  PaymentStatus.REFUNDED,
];

export function isPaymentCaptured(status: PaymentStatus): boolean {
  return CAPTURED_PAYMENT_STATUSES.includes(status);
}

/**
 * Escapes leading characters that could trigger CSV formula execution in spreadsheet applications.
 */
export function sanitizeCsvFormula(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/^[=+@-]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Formats a Date or timestamp string into Asia/Colombo calendar date (YYYY-MM-DD).
 * Fixed UTC+05:30 offset without relying on the host machine local timezone.
 */
export function formatColomboDate(d: Date | string | null | undefined): string {
  if (!d) return 'N/A';
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return 'N/A';
  const colomboTime = new Date(dateObj.getTime() + 5.5 * 3600 * 1000);
  return colomboTime.toISOString().slice(0, 10);
}

/**
 * Formats a Date or timestamp string into Asia/Colombo date & time (YYYY-MM-DD HH:mm:ss (+05:30)).
 * Fixed UTC+05:30 offset without relying on the host machine local timezone.
 */
export function formatColomboDateTime(d: Date | string | null | undefined): string {
  if (!d) return 'N/A';
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return 'N/A';
  const colomboTime = new Date(dateObj.getTime() + 5.5 * 3600 * 1000);
  const datePart = colomboTime.toISOString().slice(0, 10);
  const timePart = colomboTime.toISOString().slice(11, 19);
  return `${datePart} ${timePart} (+05:30)`;
}

/**
 * Returns current calendar date in Asia/Colombo (+05:30) as YYYY-MM-DD.
 */
export function getColomboCurrentDate(): string {
  const colomboTime = new Date(Date.now() + 5.5 * 3600 * 1000);
  return colomboTime.toISOString().slice(0, 10);
}

/**
 * Returns calendar date in Asia/Colombo shifted by calendar days as YYYY-MM-DD.
 */
export function getColomboDateOffset(daysOffset: number): string {
  const colomboTime = new Date(Date.now() + 5.5 * 3600 * 1000 + daysOffset * 24 * 3600 * 1000);
  return colomboTime.toISOString().slice(0, 10);
}

/**
 * Converts a UTC Date to its Asia/Colombo calendar date string (YYYY-MM-DD).
 */
export function getColomboBucketKey(d: Date): string {
  return formatColomboDate(d);
}

/**
 * Generates an array of all continuous YYYY-MM-DD dates between dateFrom and dateTo.
 */
export function generateDateBuckets(dateFrom: string, dateTo: string): string[] {
  const buckets: string[] = [];
  const [startY, startM, startD] = dateFrom.split('-').map(Number);
  const [endY, endM, endD] = dateTo.split('-').map(Number);

  let cur = new Date(Date.UTC(startY, startM - 1, startD));
  const end = new Date(Date.UTC(endY, endM - 1, endD));

  while (cur <= end) {
    buckets.push(cur.toISOString().slice(0, 10));
    cur = new Date(cur.getTime() + 24 * 3600 * 1000);
  }
  return buckets;
}

/**
 * Parses user query parameters into a half-open UTC interval for Asia/Colombo boundaries,
 * verifying calendar date validity and bounds.
 */
export function parseColomboDateBoundaries(query: ReportQueryDto): ColomboDateRange {
  const period = query.period || 'last30days';
  let dateFrom: string;
  let dateTo: string;

  if (period === 'today') {
    dateFrom = getColomboCurrentDate();
    dateTo = dateFrom;
  } else if (period === 'last7days') {
    dateTo = getColomboCurrentDate();
    dateFrom = getColomboDateOffset(-6); // 7 days inclusive: today and previous 6
  } else if (period === 'last30days') {
    dateTo = getColomboCurrentDate();
    dateFrom = getColomboDateOffset(-29); // 30 days inclusive: today and previous 29
  } else {
    // Custom range
    dateFrom = query.dateFrom || getColomboCurrentDate();
    dateTo = query.dateTo || getColomboCurrentDate();

    if (!isValidCalendarDate(dateFrom)) {
      throw new BadRequestException(`dateFrom is not a valid calendar date: ${dateFrom}`);
    }
    if (!isValidCalendarDate(dateTo)) {
      throw new BadRequestException(`dateTo is not a valid calendar date: ${dateTo}`);
    }
    if (dateFrom > dateTo) {
      throw new BadRequestException('dateFrom cannot be greater than dateTo');
    }

    const diffMs = new Date(dateTo).getTime() - new Date(dateFrom).getTime();
    const diffDays = Math.round(diffMs / (24 * 3600 * 1000)) + 1;
    if (diffDays > 366) {
      throw new BadRequestException(
        'Custom reporting period cannot exceed 366 days (1 year). Please select a narrower date range.'
      );
    }
  }

  // startUtc: 00:00:00.000 in Asia/Colombo (+05:30)
  const startUtc = new Date(`${dateFrom}T00:00:00.000+05:30`);

  // endExclusiveUtc: start of the day after dateTo in Asia/Colombo (+05:30)
  const [endY, endM, endD] = dateTo.split('-').map(Number);
  const nextDayUtc = new Date(Date.UTC(endY, endM - 1, endD + 1));
  const nextDayStr = nextDayUtc.toISOString().slice(0, 10);
  const endExclusiveUtc = new Date(`${nextDayStr}T00:00:00.000+05:30`);

  return {
    period,
    dateFrom,
    dateTo,
    startUtc,
    endExclusiveUtc,
  };
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) { }

  /**
   * Independent financial reconciliation performing separate database aggregate queries
   * to independently verify Gross Sales, completed refunds, Net Revenue, cancelled cohort
   * liability, and ledger integrity.
   */
  async performIndependentReconciliation(
    range: ColomboDateRange,
    sharedData: {
      grossSalesCents: number;
      totalRefundsCents: number;
      salesEligibleRefundsCents: number;
      cancelledOrderRefundsCents: number;
      netRevenueCents: number;
      cancelledCohortCapturedCents: number;
      cancelledCohortCumulativeRefundedCents: number;
      cancelledCohortOutstandingCents: number;
      inconsistencies: ReportInconsistency[];
    }
  ): Promise<IndependentReconciliationResult> {
    try {
      // 1. Independent Gross Sales Aggregate from Order table
      const grossSalesAgg = await this.prisma.order.aggregate({
        _sum: { totalCents: true },
        where: {
          createdAt: { gte: range.startUtc, lt: range.endExclusiveUtc },
          orderStatus: { not: OrderStatus.CANCELLED },
          paymentStatus: { in: CAPTURED_PAYMENT_STATUSES },
        },
      });
      const indGrossCents = grossSalesAgg._sum.totalCents || 0;

      // 2. Independent Sales-Eligible Completed Refunds Aggregate from RefundRecord table
      const salesRefundsAgg = await this.prisma.refundRecord.aggregate({
        _sum: { amountCents: true },
        where: {
          status: RefundStatus.COMPLETED,
          order: { orderStatus: { not: OrderStatus.CANCELLED } },
          OR: [
            {
              completedAt: {
                gte: range.startUtc,
                lt: range.endExclusiveUtc,
              },
            },
            {
              completedAt: null,
              updatedAt: {
                gte: range.startUtc,
                lt: range.endExclusiveUtc,
              },
            },
          ],
        },
      });
      const indSalesRefundsCents = salesRefundsAgg._sum.amountCents || 0;

      // Independent Cancelled-Order Completed Refunds Aggregate in period
      const cancelledPeriodRefundsAgg = await this.prisma.refundRecord.aggregate({
        _sum: { amountCents: true },
        where: {
          status: RefundStatus.COMPLETED,
          order: { orderStatus: OrderStatus.CANCELLED },
          OR: [
            {
              completedAt: {
                gte: range.startUtc,
                lt: range.endExclusiveUtc,
              },
            },
            {
              completedAt: null,
              updatedAt: {
                gte: range.startUtc,
                lt: range.endExclusiveUtc,
              },
            },
          ],
        },
      });
      const indCancelledPeriodRefundsCents =
        cancelledPeriodRefundsAgg._sum.amountCents || 0;
      const indTotalRefundsCents = indSalesRefundsCents + indCancelledPeriodRefundsCents;

      // 3. Independent Net Revenue
      const indNetRevenueCents = indGrossCents - indSalesRefundsCents;

      // 4. Independent Cancelled Order Cohort Reconciliation via database aggregation
      const cancelledCohortAgg = await this.prisma.order.aggregate({
        _sum: { totalCents: true },
        where: {
          createdAt: { gte: range.startUtc, lt: range.endExclusiveUtc },
          orderStatus: OrderStatus.CANCELLED,
          paymentStatus: { in: CAPTURED_PAYMENT_STATUSES },
        },
      });
      const indCancelledCapturedCents = cancelledCohortAgg._sum.totalCents || 0;

      const cohortRefundsAgg = await this.prisma.refundRecord.aggregate({
        _sum: { amountCents: true },
        where: {
          status: RefundStatus.COMPLETED,
          order: {
            createdAt: { gte: range.startUtc, lt: range.endExclusiveUtc },
            orderStatus: OrderStatus.CANCELLED,
            paymentStatus: { in: CAPTURED_PAYMENT_STATUSES },
          },
          OR: [
            {
              completedAt: { lt: range.endExclusiveUtc },
            },
            {
              completedAt: null,
              updatedAt: { lt: range.endExclusiveUtc },
            },
          ],
        },
      });
      const indCohortRefundedCents = cohortRefundsAgg._sum.amountCents || 0;
      const indCancelledOutstandingCents =
        indCancelledCapturedCents - indCohortRefundedCents;

      // 5. Independent Integrity Checks
      // Query database directly for duplicate refund primary keys (errors bubble to outer catch so result becomes NOT_VERIFIABLE)
      const duplicateRefundsRaw = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint as count
        FROM (
          SELECT id FROM "RefundRecord" GROUP BY id HAVING COUNT(*) > 1
        ) sub
      `;
      const duplicateRefundIdsCount = Number(duplicateRefundsRaw[0]?.count || 0);

      // Query database directly for orphaned refund records where orderId does not point to an existing Order
      const orphanedRefundsRaw = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint as count
        FROM "RefundRecord" r
        LEFT JOIN "Order" o ON r."orderId" = o.id
        WHERE o.id IS NULL
      `;
      const orphanedRefundsCount = Number(orphanedRefundsRaw[0]?.count || 0);

      // Check for over-refunded orders in the period
      let overRefundedOrdersCount = 0;
      let refundedStatusWithoutRefundCount = 0;

      for (const item of sharedData.inconsistencies) {
        if (item.code === 'REFUND_EXCEEDS_ORDER') overRefundedOrdersCount++;
        if (item.code === 'REFUNDED_STATUS_NO_RECORDS') refundedStatusWithoutRefundCount++;
      }

      if (duplicateRefundIdsCount > 0) {
        sharedData.inconsistencies.push({
          code: 'DUPLICATE_REFUND_IDS',
          message: `Detected ${duplicateRefundIdsCount} duplicate refund record identifiers in database`,
        });
      }

      if (orphanedRefundsCount > 0) {
        sharedData.inconsistencies.push({
          code: 'ORPHANED_REFUND_RECORDS',
          message: `Detected ${orphanedRefundsCount} orphaned refund records with invalid order associations`,
        });
      }

      // Check for negative net revenue
      const negativeNetRevenue = sharedData.netRevenueCents < 0;

      // Verification checks
      const grossSalesMatch = indGrossCents === sharedData.grossSalesCents;
      const salesRefundsMatch = indSalesRefundsCents === sharedData.salesEligibleRefundsCents;
      const cancelledPeriodRefundsMatch =
        indCancelledPeriodRefundsCents === sharedData.cancelledOrderRefundsCents;
      const totalRefundsMatch = indTotalRefundsCents === sharedData.totalRefundsCents;
      const netRevenueMatch = indNetRevenueCents === sharedData.netRevenueCents;
      const cancelledCapturedMatch =
        indCancelledCapturedCents === sharedData.cancelledCohortCapturedCents;
      const cancelledRefundedMatch =
        indCohortRefundedCents === sharedData.cancelledCohortCumulativeRefundedCents;
      const cancelledOutstandingMatch =
        indCancelledOutstandingCents === sharedData.cancelledCohortOutstandingCents;

      const allCalculationsMatch =
        grossSalesMatch &&
        salesRefundsMatch &&
        cancelledPeriodRefundsMatch &&
        totalRefundsMatch &&
        netRevenueMatch &&
        cancelledCapturedMatch &&
        cancelledRefundedMatch &&
        cancelledOutstandingMatch;

      const hasInconsistentData =
        sharedData.inconsistencies.length > 0 ||
        overRefundedOrdersCount > 0 ||
        refundedStatusWithoutRefundCount > 0 ||
        duplicateRefundIdsCount > 0 ||
        orphanedRefundsCount > 0;

      let overallStatus: ReconciliationStatusEnum = 'PASS';
      if (!allCalculationsMatch) {
        overallStatus = 'MISMATCH';
      } else if (hasInconsistentData) {
        overallStatus = 'INCONSISTENT_DATA';
      }

      return {
        overallStatus,
        grossSalesCheck: {
          status: grossSalesMatch ? 'PASS' : 'MISMATCH',
          sharedValueCents: sharedData.grossSalesCents,
          independentValueCents: indGrossCents,
          differenceCents: Math.abs(sharedData.grossSalesCents - indGrossCents),
        },
        salesRefundsCheck: {
          status: salesRefundsMatch ? 'PASS' : 'MISMATCH',
          sharedValueCents: sharedData.salesEligibleRefundsCents,
          independentValueCents: indSalesRefundsCents,
          differenceCents: Math.abs(sharedData.salesEligibleRefundsCents - indSalesRefundsCents),
        },
        allRefundsCheck: {
          status:
            totalRefundsMatch && salesRefundsMatch && cancelledPeriodRefundsMatch
              ? 'PASS'
              : 'MISMATCH',
          sharedTotalCents: sharedData.totalRefundsCents,
          independentTotalCents: indTotalRefundsCents,
          sharedSalesRefundsCents: sharedData.salesEligibleRefundsCents,
          independentSalesRefundsCents: indSalesRefundsCents,
          sharedCancelledRefundsCents: sharedData.cancelledOrderRefundsCents,
          independentCancelledRefundsCents: indCancelledPeriodRefundsCents,
          differenceCents: Math.abs(sharedData.totalRefundsCents - indTotalRefundsCents),
        },
        netRevenueCheck: {
          status: netRevenueMatch ? 'PASS' : 'MISMATCH',
          sharedValueCents: sharedData.netRevenueCents,
          independentValueCents: indNetRevenueCents,
          differenceCents: Math.abs(sharedData.netRevenueCents - indNetRevenueCents),
        },
        cancelledCohortCheck: {
          status:
            cancelledCapturedMatch && cancelledRefundedMatch && cancelledOutstandingMatch
              ? 'PASS'
              : 'MISMATCH',
          sharedCapturedCents: sharedData.cancelledCohortCapturedCents,
          independentCapturedCents: indCancelledCapturedCents,
          sharedRefundedCents: sharedData.cancelledCohortCumulativeRefundedCents,
          independentRefundedCents: indCohortRefundedCents,
          sharedOutstandingCents: sharedData.cancelledCohortOutstandingCents,
          independentOutstandingCents: indCancelledOutstandingCents,
        },
        integrityChecks: {
          status: hasInconsistentData ? 'INCONSISTENT_DATA' : 'PASS',
          duplicateRefundIdsCount,
          orphanedRefundsCount,
          overRefundedOrdersCount,
          refundedStatusWithoutRefundCount,
          negativeNetRevenue,
        },
        inconsistencies: sharedData.inconsistencies,
        asOfTimestamp: range.endExclusiveUtc.toISOString(),
      };
    } catch (err: any) {
      this.logger.error('Independent reconciliation query execution failed:', err);
      return {
        overallStatus: 'NOT_VERIFIABLE',
        grossSalesCheck: {
          status: 'MISMATCH',
          sharedValueCents: sharedData.grossSalesCents,
          independentValueCents: 0,
          differenceCents: sharedData.grossSalesCents,
        },
        salesRefundsCheck: {
          status: 'MISMATCH',
          sharedValueCents: sharedData.salesEligibleRefundsCents,
          independentValueCents: 0,
          differenceCents: sharedData.salesEligibleRefundsCents,
        },
        allRefundsCheck: {
          status: 'MISMATCH',
          sharedTotalCents: sharedData.totalRefundsCents,
          independentTotalCents: 0,
          sharedSalesRefundsCents: sharedData.salesEligibleRefundsCents,
          independentSalesRefundsCents: 0,
          sharedCancelledRefundsCents: sharedData.cancelledOrderRefundsCents,
          independentCancelledRefundsCents: 0,
          differenceCents: sharedData.totalRefundsCents,
        },
        netRevenueCheck: {
          status: 'MISMATCH',
          sharedValueCents: sharedData.netRevenueCents,
          independentValueCents: 0,
          differenceCents: sharedData.netRevenueCents,
        },
        cancelledCohortCheck: {
          status: 'MISMATCH',
          sharedCapturedCents: sharedData.cancelledCohortCapturedCents,
          independentCapturedCents: 0,
          sharedRefundedCents: sharedData.cancelledCohortCumulativeRefundedCents,
          independentRefundedCents: 0,
          sharedOutstandingCents: sharedData.cancelledCohortOutstandingCents,
          independentOutstandingCents: 0,
        },
        integrityChecks: {
          status: 'INCONSISTENT_DATA',
          duplicateRefundIdsCount: 0,
          orphanedRefundsCount: 0,
          overRefundedOrdersCount: 0,
          refundedStatusWithoutRefundCount: 0,
          negativeNetRevenue: false,
        },
        inconsistencies: [
          ...sharedData.inconsistencies,
          {
            code: 'INDEPENDENT_VERIFICATION_FAILED',
            message: `Independent verification queries could not be executed: ${err?.message || 'Database error'}`,
          },
        ],
        asOfTimestamp: range.endExclusiveUtc.toISOString(),
      };
    }
  }

  /**
   * Core reporting calculation engine enforcing authoritative financial contracts,
   * cohort-based cancellation reconciliation, and independent verification.
   * Shared by getSummary, getSalesReport, and exportReport.
   */
  async calculateReportingData(query: ReportQueryDto): Promise<{
    range: ColomboDateRange;
    kpi: ReportKpiMetrics;
    cancellationReconciliation: CancellationReconciliation;
    reconciliation: ReconciliationStatus;
    paymentMethods: PaymentMethodMetric[];
    orderStatuses: OrderStatusMetric[];
    districtDistribution: DistrictMetric[];
    dailySales: DailySalesMetric[];
    allOrdersToExport: OrderItemExportDto[];
    recentOrders: OrderItemExportDto[];
  }> {
    const range = parseColomboDateBoundaries(query);

    // 1. Fetch all orders created within the reporting window
    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: {
          gte: range.startUtc,
          lt: range.endExclusiveUtc,
        },
      },
      include: {
        addressSnapshot: {
          select: {
            district: true,
            city: true,
          },
        },
        refundRecords: {
          where: {
            status: RefundStatus.COMPLETED,
          },
          select: {
            id: true,
            amountCents: true,
            completedAt: true,
            updatedAt: true,
            createdAt: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 2. Fetch all completed refunds whose authoritative completion timestamp falls in this reporting window
    const rawCompletedRefunds = await this.prisma.refundRecord.findMany({
      where: {
        status: RefundStatus.COMPLETED,
        OR: [
          {
            completedAt: {
              gte: range.startUtc,
              lt: range.endExclusiveUtc,
            },
          },
          {
            completedAt: null,
            updatedAt: {
              gte: range.startUtc,
              lt: range.endExclusiveUtc,
            },
          },
        ],
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            totalCents: true,
            orderStatus: true,
            paymentStatus: true,
            paymentMethod: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Filter strictly by effective completion timestamp in range
    const completedRefunds = rawCompletedRefunds.filter((r) => {
      const effectiveDate = r.completedAt || r.updatedAt || r.createdAt;
      return effectiveDate >= range.startUtc && effectiveDate < range.endExclusiveUtc;
    });

    // 3. Separate Sales-Eligible Refunds vs Cancelled-Order Refunds for Financial Period Activity
    let salesEligibleRefundsCents = 0;
    let cancelledOrderRefundsCents = 0;

    for (const refund of completedRefunds) {
      if (refund.order.orderStatus === OrderStatus.CANCELLED) {
        cancelledOrderRefundsCents += refund.amountCents;
      } else {
        salesEligibleRefundsCents += refund.amountCents;
      }
    }
    const totalRefundsCents = salesEligibleRefundsCents + cancelledOrderRefundsCents;

    // 4. Calculate Order & Sales Metrics
    let grossSalesCents = 0;
    let totalOrdersCount = orders.length;
    let paidOrdersCount = 0;
    let deliveredOrdersCount = 0;
    let cancelledOrdersCount = 0;
    let pendingFulfillmentCount = 0;
    let codCollectedCents = 0;
    let codCollectedCount = 0;
    let codPendingCents = 0;
    let codPendingCount = 0;

    // Cancelled cohort tracking (orders created in the selected period)
    const cancelledPaidOrders = orders.filter(
      (o) => o.orderStatus === OrderStatus.CANCELLED && isPaymentCaptured(o.paymentStatus)
    );
    const cancelledPaidOrdersCount = cancelledPaidOrders.length;
    const cancelledPaidCapturedCents = cancelledPaidOrders.reduce(
      (sum, o) => sum + o.totalCents,
      0
    );

    // Calculate cumulative completed refunds associated with *these specific cancelled orders*
    // across all history up to range.endExclusiveUtc
    let cancelledCohortCumulativeRefundedCents = 0;
    for (const order of cancelledPaidOrders) {
      for (const ref of order.refundRecords) {
        if (ref.status === RefundStatus.COMPLETED) {
          const effectiveDate = ref.completedAt || ref.updatedAt || ref.createdAt;
          if (effectiveDate < range.endExclusiveUtc) {
            cancelledCohortCumulativeRefundedCents += ref.amountCents;
          }
        }
      }
    }

    // Cancelled Outstanding Balance = Captured - Cumulative Completed Refunds (unclamped)
    const cancelledPaidOutstandingCents =
      cancelledPaidCapturedCents - cancelledCohortCumulativeRefundedCents;

    // Payment method counters for sales-eligible captured orders
    const paymentMethodMap: Record<PaymentMethod, { count: number; totalCents: number }> = {
      [PaymentMethod.CASH_ON_DELIVERY]: { count: 0, totalCents: 0 },
      [PaymentMethod.BANK_TRANSFER]: { count: 0, totalCents: 0 },
      [PaymentMethod.CARD_PAYHERE]: { count: 0, totalCents: 0 },
      [PaymentMethod.KOKO_BNPL]: { count: 0, totalCents: 0 },
    };

    // Order status counters across all orders
    const orderStatusMap: Record<OrderStatus, { count: number; totalCents: number }> = {
      [OrderStatus.PENDING]: { count: 0, totalCents: 0 },
      [OrderStatus.CONFIRMED]: { count: 0, totalCents: 0 },
      [OrderStatus.PROCESSING]: { count: 0, totalCents: 0 },
      [OrderStatus.PACKED]: { count: 0, totalCents: 0 },
      [OrderStatus.SHIPPED]: { count: 0, totalCents: 0 },
      [OrderStatus.DELIVERED]: { count: 0, totalCents: 0 },
      [OrderStatus.CANCELLED]: { count: 0, totalCents: 0 },
    };

    // District distribution for sales-eligible captured orders
    const districtMap = new Map<string, { count: number; totalCents: number }>();

    // Inconsistencies tracking
    const inconsistencies: ReportInconsistency[] = [];

    for (const order of orders) {
      // Order status tracking
      if (orderStatusMap[order.orderStatus]) {
        orderStatusMap[order.orderStatus].count += 1;
        orderStatusMap[order.orderStatus].totalCents += order.totalCents;
      }

      if (order.orderStatus === OrderStatus.DELIVERED) {
        deliveredOrdersCount++;
      } else if (order.orderStatus === OrderStatus.CANCELLED) {
        cancelledOrdersCount++;
      } else if (
        ([
          OrderStatus.CONFIRMED,
          OrderStatus.PROCESSING,
          OrderStatus.PACKED,
          OrderStatus.SHIPPED,
        ] as OrderStatus[]).includes(order.orderStatus)
      ) {
        pendingFulfillmentCount++;
      }

      const isCaptured = isPaymentCaptured(order.paymentStatus);

      // Check COD Collection
      if (order.paymentMethod === PaymentMethod.CASH_ON_DELIVERY) {
        if (order.orderStatus === OrderStatus.DELIVERED && isCaptured) {
          codCollectedCount++;
          codCollectedCents += order.totalCents;
        } else if (order.orderStatus !== OrderStatus.CANCELLED && order.orderStatus !== OrderStatus.DELIVERED) {
          codPendingCount++;
          codPendingCents += order.totalCents;
        }
      }

      // Gross Sales: only non-cancelled captured orders
      if (isCaptured && order.orderStatus !== OrderStatus.CANCELLED) {
        grossSalesCents += order.totalCents;
        paidOrdersCount++;

        // Payment method breakdown
        if (paymentMethodMap[order.paymentMethod]) {
          paymentMethodMap[order.paymentMethod].count += 1;
          paymentMethodMap[order.paymentMethod].totalCents += order.totalCents;
        }

        // District breakdown
        const rawDistrict = order.addressSnapshot?.district?.trim();
        const districtName = rawDistrict && rawDistrict.length > 0 ? rawDistrict : 'Unknown / Unavailable';
        const existing = districtMap.get(districtName) || { count: 0, totalCents: 0 };
        districtMap.set(districtName, {
          count: existing.count + 1,
          totalCents: existing.totalCents + order.totalCents,
        });
      }

      // Detect order-level refund inconsistencies
      const orderCompletedRefundCents = order.refundRecords.reduce(
        (sum, r) => sum + r.amountCents,
        0
      );
      if (orderCompletedRefundCents > order.totalCents) {
        inconsistencies.push({
          code: 'REFUND_EXCEEDS_ORDER',
          message: `Order ${order.orderNumber} completed refunds (LKR ${(orderCompletedRefundCents / 100).toFixed(2)}) exceed total (LKR ${(order.totalCents / 100).toFixed(2)})`,
          orderId: order.id,
          orderNumber: order.orderNumber,
          amountCents: orderCompletedRefundCents,
        });
      }
      if (
        (order.paymentStatus === PaymentStatus.REFUNDED ||
          order.paymentStatus === PaymentStatus.PARTIALLY_REFUNDED) &&
        orderCompletedRefundCents === 0
      ) {
        inconsistencies.push({
          code: 'REFUNDED_STATUS_NO_RECORDS',
          message: `Order ${order.orderNumber} marked as ${order.paymentStatus} but has 0 completed refund records`,
          orderId: order.id,
          orderNumber: order.orderNumber,
        });
      }
    }

    // Flag if cumulative refunds exceed captured amount for the cancelled cohort
    if (cancelledCohortCumulativeRefundedCents > cancelledPaidCapturedCents) {
      inconsistencies.push({
        code: 'CANCELLED_REFUND_EXCEEDS_CAPTURED',
        message: `Cumulative completed refunds (LKR ${(cancelledCohortCumulativeRefundedCents / 100).toFixed(2)}) exceed captured payment (LKR ${(cancelledPaidCapturedCents / 100).toFixed(2)}) for cancelled order cohort`,
        amountCents: cancelledCohortCumulativeRefundedCents - cancelledPaidCapturedCents,
      });
    }

    // 5. Compute Net Revenue and AOV (Authoritative Formula: Net Revenue / Paid Qualifying Orders)
    const netRevenueCents = grossSalesCents - salesEligibleRefundsCents;
    const averageOrderValueCents =
      paidOrdersCount > 0 && netRevenueCents > 0
        ? Math.round(netRevenueCents / paidOrdersCount)
        : 0;

    if (netRevenueCents < 0) {
      inconsistencies.push({
        code: 'NEGATIVE_NET_REVENUE',
        message: `Net Revenue is negative (LKR ${(netRevenueCents / 100).toFixed(2)}) due to completed refunds exceeding gross sales in this period`,
        amountCents: netRevenueCents,
      });
    }

    // 6. Execute Genuine Independent Financial Reconciliation via separate database aggregations
    const independentVerification = await this.performIndependentReconciliation(
      range,
      {
        grossSalesCents,
        totalRefundsCents,
        salesEligibleRefundsCents,
        cancelledOrderRefundsCents,
        netRevenueCents,
        cancelledCohortCapturedCents: cancelledPaidCapturedCents,
        cancelledCohortCumulativeRefundedCents,
        cancelledCohortOutstandingCents: cancelledPaidOutstandingCents,
        inconsistencies,
      }
    );

    // 7. Non-Circular Reconciliation Status: derived strictly from independent aggregate verification
    const isNetRevenueReconciled =
      independentVerification.netRevenueCheck?.status === 'PASS';
    const isRefundsReconciled =
      independentVerification.allRefundsCheck?.status === 'PASS';
    const isCancelledReconciled =
      independentVerification.cancelledCohortCheck?.status === 'PASS';

    // 8. Prepare Payment Method Array
    const paymentMethodDisplayNames: Record<PaymentMethod, string> = {
      [PaymentMethod.CASH_ON_DELIVERY]: 'Cash on Delivery (COD)',
      [PaymentMethod.BANK_TRANSFER]: 'Direct Bank Transfer',
      [PaymentMethod.CARD_PAYHERE]: 'Card Payment (PayHere)',
      [PaymentMethod.KOKO_BNPL]: 'Koko Buy Now Pay Later',
    };

    const paymentMethods: PaymentMethodMetric[] = Object.entries(paymentMethodMap).map(
      ([method, data]) => ({
        method: method as PaymentMethod,
        name: paymentMethodDisplayNames[method as PaymentMethod] || method,
        count: data.count,
        totalCents: data.totalCents,
        percentage:
          grossSalesCents > 0
            ? Number(((data.totalCents / grossSalesCents) * 100).toFixed(2))
            : 0,
      })
    );

    // 9. Prepare Order Status Array
    const orderStatusDisplayNames: Record<OrderStatus, string> = {
      [OrderStatus.PENDING]: 'Pending Payment',
      [OrderStatus.CONFIRMED]: 'Confirmed',
      [OrderStatus.PROCESSING]: 'Processing',
      [OrderStatus.PACKED]: 'Packed',
      [OrderStatus.SHIPPED]: 'Shipped',
      [OrderStatus.DELIVERED]: 'Delivered',
      [OrderStatus.CANCELLED]: 'Cancelled',
    };

    const orderStatuses: OrderStatusMetric[] = Object.entries(orderStatusMap).map(
      ([status, data]) => ({
        status: status as OrderStatus,
        name: orderStatusDisplayNames[status as OrderStatus] || status,
        count: data.count,
        totalCents: data.totalCents,
        percentage:
          totalOrdersCount > 0
            ? Number(((data.count / totalOrdersCount) * 100).toFixed(2))
            : 0,
      })
    );

    // 10. Prepare District Array
    const districtDistribution: DistrictMetric[] = Array.from(districtMap.entries())
      .map(([district, data]) => ({
        district,
        count: data.count,
        totalCents: data.totalCents,
        percentage:
          grossSalesCents > 0
            ? Number(((data.totalCents / grossSalesCents) * 100).toFixed(2))
            : 0,
      }))
      .sort((a, b) => b.totalCents - a.totalCents);

    // 11. Prepare Daily Sales Breakdown (Colombo calendar buckets)
    const dateBucketKeys = generateDateBuckets(range.dateFrom, range.dateTo);
    const dailyMap = new Map<
      string,
      {
        grossSalesCents: number;
        salesEligibleRefundsCents: number;
        cancelledRefundsCents: number;
        orderCount: number;
        paidOrderCount: number;
      }
    >();

    for (const bKey of dateBucketKeys) {
      dailyMap.set(bKey, {
        grossSalesCents: 0,
        salesEligibleRefundsCents: 0,
        cancelledRefundsCents: 0,
        orderCount: 0,
        paidOrderCount: 0,
      });
    }

    for (const order of orders) {
      const bKey = getColomboBucketKey(order.createdAt);
      const entry = dailyMap.get(bKey);
      if (entry) {
        entry.orderCount++;
        if (isPaymentCaptured(order.paymentStatus) && order.orderStatus !== OrderStatus.CANCELLED) {
          entry.paidOrderCount++;
          entry.grossSalesCents += order.totalCents;
        }
      }
    }

    for (const refund of completedRefunds) {
      const effectiveDate = refund.completedAt || refund.updatedAt || refund.createdAt;
      const bKey = getColomboBucketKey(effectiveDate);
      const entry = dailyMap.get(bKey);
      if (entry) {
        if (refund.order.orderStatus === OrderStatus.CANCELLED) {
          entry.cancelledRefundsCents += refund.amountCents;
        } else {
          entry.salesEligibleRefundsCents += refund.amountCents;
        }
      }
    }

    const dailySales: DailySalesMetric[] = dateBucketKeys.map((date) => {
      const data = dailyMap.get(date)!;
      const net = data.grossSalesCents - data.salesEligibleRefundsCents;
      const aov =
        data.paidOrderCount > 0 ? Math.round(data.grossSalesCents / data.paidOrderCount) : 0;
      return {
        date,
        grossSalesCents: data.grossSalesCents,
        netRevenueCents: net,
        refundsCents: data.salesEligibleRefundsCents,
        cancelledRefundsCents: data.cancelledRefundsCents,
        orderCount: data.orderCount,
        paidOrderCount: data.paidOrderCount,
        averageOrderValueCents: aov,
      };
    });

    // 12. Full Orders Dataset for Export (unrestricted by pagination/display limits)
    const allOrdersToExport: OrderItemExportDto[] = orders.map((o) => {
      const refundedCents = o.refundRecords.reduce((sum, r) => sum + r.amountCents, 0);
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        customerEmail: o.customerEmail,
        customerPhone: o.customerPhone,
        totalCents: o.totalCents,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        orderStatus: o.orderStatus,
        createdAt: o.createdAt.toISOString(),
        createdAtFormatted: formatColomboDateTime(o.createdAt),
        district: o.addressSnapshot?.district || 'Unknown / Unavailable',
        refundedAmountCents: refundedCents,
      };
    });

    // Display slice for UI table
    const recentOrders = allOrdersToExport.slice(0, 50);

    const kpi: ReportKpiMetrics = {
      grossSalesCents,
      netRevenueCents,
      totalRefundsCents,
      salesEligibleRefundsCents,
      cancelledOrderRefundsCents,
      totalOrdersCount,
      paidOrdersCount,
      averageOrderValueCents,
      deliveredOrdersCount,
      cancelledOrdersCount,
      pendingFulfillmentCount,
      codCollectedCents,
      codCollectedCount,
      codPendingCents,
      codPendingCount,
    };

    const cancellationReconciliation: CancellationReconciliation = {
      cohortDescription: `Cancelled orders placed between ${range.dateFrom} and ${range.dateTo}`,
      asOfTimestamp: range.endExclusiveUtc.toISOString(),
      cancelledPaidOrdersCount,
      cancelledPaidCapturedCents,
      cancelledPaidRefundedCents: cancelledCohortCumulativeRefundedCents,
      cancelledPaidOutstandingCents,
    };

    const mergedInconsistencies = [
      ...inconsistencies,
      ...independentVerification.inconsistencies.filter(
        (iv) => !inconsistencies.some((inc) => inc.code === iv.code)
      ),
    ];

    const reconciliation: ReconciliationStatus = {
      isNetRevenueReconciled,
      isRefundsReconciled,
      isCancelledReconciled,
      independentVerification,
      inconsistencies: mergedInconsistencies,
    };

    return {
      range,
      kpi,
      cancellationReconciliation,
      reconciliation,
      paymentMethods,
      orderStatuses,
      districtDistribution,
      dailySales,
      allOrdersToExport,
      recentOrders,
    };
  }

  /**
   * Retrieves summary report KPIs, distribution breakdowns, and reconciliation indicators.
   */
  async getSummary(query: ReportQueryDto): Promise<ReportSummaryResponse> {
    const data = await this.calculateReportingData(query);
    return {
      period: data.range.period,
      dateFrom: data.range.dateFrom,
      dateTo: data.range.dateTo,
      timezone: 'Asia/Colombo',
      kpi: data.kpi,
      cancellationReconciliation: data.cancellationReconciliation,
      reconciliation: data.reconciliation,
      paymentMethods: data.paymentMethods,
      orderStatuses: data.orderStatuses,
      districtDistribution: data.districtDistribution,
    };
  }

  /**
   * Retrieves detailed sales report including daily trend buckets and recent orders.
   */
  async getSalesReport(query: ReportQueryDto): Promise<SalesReportResponse> {
    const data = await this.calculateReportingData(query);
    return {
      period: data.range.period,
      dateFrom: data.range.dateFrom,
      dateTo: data.range.dateTo,
      timezone: 'Asia/Colombo',
      kpi: data.kpi,
      cancellationReconciliation: data.cancellationReconciliation,
      reconciliation: data.reconciliation,
      paymentMethods: data.paymentMethods,
      orderStatuses: data.orderStatuses,
      districtDistribution: data.districtDistribution,
      dailySales: data.dailySales,
      recentOrders: data.recentOrders,
    };
  }

  /**
   * Exports complete financial and sales data to XLSX or CSV using ExcelJS with
   * full dataset streaming (all qualifying orders), Colombo date formatting,
   * and CSV formula sanitization.
   */
  async exportReport(
    query: ReportQueryDto,
    format: ExportFormat = 'xlsx',
    res?: any
  ): Promise<ExportResult> {
    const data = await this.calculateReportingData(query);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'DSL Stationery Reporting Engine';
    workbook.created = new Date();

    const formatLkr = (cents: number) => (cents / 100).toFixed(2);

    if (format === 'xlsx') {
      // 1. Sheet: Summary & Reconciliation
      const summarySheet = workbook.addWorksheet('Summary & Reconciliation');
      summarySheet.columns = [
        { header: 'Metric', key: 'metric', width: 38 },
        { header: 'Value (LKR / Count)', key: 'value', width: 28 },
        { header: 'Notes / Contract Rule', key: 'notes', width: 55 },
      ];
      summarySheet.getRow(1).font = { bold: true };
      summarySheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' },
      };

      summarySheet.addRow({
        metric: 'Reporting Period',
        value: `${data.range.period} (${data.range.dateFrom} to ${data.range.dateTo})`,
        notes: 'Asia/Colombo Timezone (+05:30)',
      });
      summarySheet.addRow({
        metric: 'Report Generated At',
        value: formatColomboDateTime(new Date()),
        notes: 'Asia/Colombo (+05:30)',
      });
      summarySheet.addRow({
        metric: 'Gross Sales',
        value: `LKR ${formatLkr(data.kpi.grossSalesCents)}`,
        notes: 'Captured non-cancelled orders only (PAID, PARTIALLY_REFUNDED, REFUNDED)',
      });
      summarySheet.addRow({
        metric: 'Completed Sales-Eligible Refunds',
        value: `LKR ${formatLkr(data.kpi.salesEligibleRefundsCents)}`,
        notes: 'RefundRecord status=COMPLETED for non-cancelled orders in period',
      });
      summarySheet.addRow({
        metric: 'Net Revenue',
        value: `LKR ${formatLkr(data.kpi.netRevenueCents)}`,
        notes: 'Gross Sales - Completed Sales-Eligible Refunds',
      });
      summarySheet.addRow({
        metric: 'Average Order Value (AOV)',
        value: `LKR ${formatLkr(data.kpi.averageOrderValueCents)}`,
        notes: 'Net Revenue / Sales-Eligible Captured Orders',
      });
      summarySheet.addRow({
        metric: 'Total Orders Placed',
        value: data.kpi.totalOrdersCount,
        notes: 'All orders created within reporting period',
      });
      summarySheet.addRow({
        metric: 'Sales-Eligible Captured Orders',
        value: data.kpi.paidOrdersCount,
        notes: 'Orders with payment captured and not cancelled',
      });
      summarySheet.addRow({
        metric: 'Delivered Orders',
        value: data.kpi.deliveredOrdersCount,
        notes: 'Successfully fulfilled orders',
      });
      summarySheet.addRow({
        metric: 'Pending Fulfillment',
        value: data.kpi.pendingFulfillmentCount,
        notes: 'CONFIRMED, PROCESSING, PACKED, SHIPPED',
      });
      summarySheet.addRow({
        metric: 'Cash on Delivery (COD) Collected',
        value: `LKR ${formatLkr(data.kpi.codCollectedCents)} (${data.kpi.codCollectedCount} orders)`,
        notes: 'COD orders DELIVERED and marked PAID',
      });
      summarySheet.addRow({
        metric: 'Cash on Delivery (COD) Pending',
        value: `LKR ${formatLkr(data.kpi.codPendingCents)} (${data.kpi.codPendingCount} orders)`,
        notes: 'COD orders in transit or awaiting delivery',
      });

      // Cancellation Reconciliation
      summarySheet.addRow({});
      summarySheet.addRow({
        metric: '--- CANCELLED ORDERS COHORT RECONCILIATION ---',
        value: data.cancellationReconciliation.cohortDescription,
        notes: `As-of Timestamp: ${formatColomboDateTime(data.cancellationReconciliation.asOfTimestamp)}`,
      });
      summarySheet.addRow({
        metric: 'Cancelled-but-Paid Orders Count',
        value: data.cancellationReconciliation.cancelledPaidOrdersCount,
        notes: 'Cancelled orders with captured payment in this cohort',
      });
      summarySheet.addRow({
        metric: 'Cancelled Captured Payment',
        value: `LKR ${formatLkr(data.cancellationReconciliation.cancelledPaidCapturedCents)}`,
        notes: 'Total payment captured for cancelled orders in cohort',
      });
      summarySheet.addRow({
        metric: 'Cancelled Cohort Cumulative Refunds',
        value: `LKR ${formatLkr(data.cancellationReconciliation.cancelledPaidRefundedCents)}`,
        notes: 'Cumulative completed refunds associated with this cohort up to as-of timestamp',
      });
      summarySheet.addRow({
        metric: 'Outstanding Cancelled Funds (Liability)',
        value: `LKR ${formatLkr(data.cancellationReconciliation.cancelledPaidOutstandingCents)}`,
        notes: 'Captured Amount - Cumulative Completed Refunds',
      });

      // Financial Verification
      summarySheet.addRow({});
      summarySheet.addRow({
        metric: '--- INDEPENDENT FINANCIAL VERIFICATION ---',
        value: data.reconciliation.independentVerification.overallStatus,
        notes: 'Independent database aggregations vs shared calculation layer',
      });
      summarySheet.addRow({
        metric: 'Gross Sales Independent Check',
        value: data.reconciliation.independentVerification.grossSalesCheck.status,
        notes: `Shared: LKR ${formatLkr(data.reconciliation.independentVerification.grossSalesCheck.sharedValueCents)} | Independent: LKR ${formatLkr(data.reconciliation.independentVerification.grossSalesCheck.independentValueCents)}`,
      });
      summarySheet.addRow({
        metric: 'Sales Refunds Independent Check',
        value: data.reconciliation.independentVerification.salesRefundsCheck.status,
        notes: `Shared: LKR ${formatLkr(data.reconciliation.independentVerification.salesRefundsCheck.sharedValueCents)} | Independent: LKR ${formatLkr(data.reconciliation.independentVerification.salesRefundsCheck.independentValueCents)}`,
      });
      summarySheet.addRow({
        metric: 'Net Revenue Independent Check',
        value: data.reconciliation.independentVerification.netRevenueCheck.status,
        notes: `Shared: LKR ${formatLkr(data.reconciliation.independentVerification.netRevenueCheck.sharedValueCents)} | Independent: LKR ${formatLkr(data.reconciliation.independentVerification.netRevenueCheck.independentValueCents)}`,
      });
      summarySheet.addRow({
        metric: 'Cancelled Cohort Independent Check',
        value: data.reconciliation.independentVerification.cancelledCohortCheck.status,
        notes: `Captured: LKR ${formatLkr(data.reconciliation.independentVerification.cancelledCohortCheck.sharedCapturedCents)} | Refunded: LKR ${formatLkr(data.reconciliation.independentVerification.cancelledCohortCheck.sharedRefundedCents)}`,
      });
      summarySheet.addRow({
        metric: 'Detected Inconsistencies',
        value: data.reconciliation.inconsistencies.length,
        notes:
          data.reconciliation.inconsistencies.length === 0
            ? 'None detected'
            : data.reconciliation.inconsistencies.map((i) => i.message).join(' | '),
      });

      // 2. Sheet: Daily Breakdown
      const dailySheet = workbook.addWorksheet('Daily Breakdown');
      dailySheet.columns = [
        { header: 'Date (Colombo)', key: 'date', width: 16 },
        { header: 'Gross Sales (LKR)', key: 'grossSales', width: 18 },
        { header: 'Refunds (LKR)', key: 'refunds', width: 16 },
        { header: 'Net Revenue (LKR)', key: 'netRevenue', width: 18 },
        { header: 'Paid Orders', key: 'paidOrders', width: 14 },
        { header: 'Total Orders', key: 'totalOrders', width: 14 },
        { header: 'AOV (LKR)', key: 'aov', width: 16 },
      ];
      dailySheet.getRow(1).font = { bold: true };
      dailySheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' },
      };

      for (const d of data.dailySales) {
        dailySheet.addRow({
          date: d.date,
          grossSales: formatLkr(d.grossSalesCents),
          refunds: formatLkr(d.refundsCents),
          netRevenue: formatLkr(d.netRevenueCents),
          paidOrders: d.paidOrderCount,
          totalOrders: d.orderCount,
          aov: formatLkr(d.averageOrderValueCents),
        });
      }

      // 3. Sheet: Payment Methods
      const paySheet = workbook.addWorksheet('Payment Methods');
      paySheet.columns = [
        { header: 'Payment Method', key: 'name', width: 28 },
        { header: 'Code', key: 'code', width: 22 },
        { header: 'Paid Orders', key: 'count', width: 14 },
        { header: 'Gross Sales (LKR)', key: 'sales', width: 18 },
        { header: 'Share (%)', key: 'share', width: 14 },
      ];
      paySheet.getRow(1).font = { bold: true };
      paySheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' },
      };

      for (const pm of data.paymentMethods) {
        paySheet.addRow({
          name: pm.name,
          code: pm.method,
          count: pm.count,
          sales: formatLkr(pm.totalCents),
          share: `${pm.percentage}%`,
        });
      }

      // 4. Sheet: District Distribution
      const distSheet = workbook.addWorksheet('District Distribution');
      distSheet.columns = [
        { header: 'District', key: 'district', width: 25 },
        { header: 'Orders', key: 'count', width: 14 },
        { header: 'Gross Sales (LKR)', key: 'sales', width: 18 },
        { header: 'Share (%)', key: 'share', width: 14 },
      ];
      distSheet.getRow(1).font = { bold: true };
      distSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' },
      };

      for (const dst of data.districtDistribution) {
        distSheet.addRow({
          district: dst.district,
          count: dst.count,
          sales: formatLkr(dst.totalCents),
          share: `${dst.percentage}%`,
        });
      }

      // 5. Sheet: Complete Order Details (ALL qualifying orders)
      const ordersSheet = workbook.addWorksheet('Order Details');
      ordersSheet.columns = [
        { header: 'Order Number', key: 'orderNumber', width: 20 },
        { header: 'Date (Colombo)', key: 'date', width: 24 },
        { header: 'Customer Name', key: 'customerName', width: 25 },
        { header: 'Email', key: 'customerEmail', width: 28 },
        { header: 'Phone', key: 'customerPhone', width: 18 },
        { header: 'Total (LKR)', key: 'total', width: 16 },
        { header: 'Refunded (LKR)', key: 'refunded', width: 16 },
        { header: 'Payment Method', key: 'paymentMethod', width: 22 },
        { header: 'Payment Status', key: 'paymentStatus', width: 16 },
        { header: 'Order Status', key: 'orderStatus', width: 16 },
        { header: 'District', key: 'district', width: 20 },
      ];
      ordersSheet.getRow(1).font = { bold: true };
      ordersSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' },
      };

      for (const o of data.allOrdersToExport) {
        ordersSheet.addRow({
          orderNumber: o.orderNumber,
          date: o.createdAtFormatted,
          customerName: o.customerName,
          customerEmail: o.customerEmail,
          customerPhone: o.customerPhone,
          total: formatLkr(o.totalCents),
          refunded: formatLkr(o.refundedAmountCents),
          paymentMethod: o.paymentMethod,
          paymentStatus: o.paymentStatus,
          orderStatus: o.orderStatus,
          district: o.district,
        });
      }

      const filename = `dsl-sales-report-${data.range.period}-${data.range.dateFrom}-to-${data.range.dateTo}.xlsx`;
      const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      if (res && typeof res.setHeader === 'function') {
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
        await workbook.xlsx.write(res);
        res.end();
        return { filename, mimeType };
      }

      const xlsxOutput = await workbook.xlsx.writeBuffer();
      const buffer = Buffer.from(xlsxOutput);
      return {
        buffer,
        filename,
        mimeType,
      };
    } else {
      // CSV format: export all orders and daily sales with sanitized formulas and Colombo date formatting
      const csvSheet = workbook.addWorksheet('Sales Report');
      csvSheet.columns = [
        { header: 'Record Type', key: 'type' },
        { header: 'Identifier / Date', key: 'id' },
        { header: 'Customer / Metric', key: 'col1' },
        { header: 'Email', key: 'email' },
        { header: 'Phone', key: 'phone' },
        { header: 'Payment Method / Status', key: 'col2' },
        { header: 'District', key: 'district' },
        { header: 'Gross Amount (LKR)', key: 'gross' },
        { header: 'Refunded Amount (LKR)', key: 'refund' },
        { header: 'Net Amount (LKR)', key: 'net' },
      ];

      // Section 1: Daily breakdown
      csvSheet.addRow({
        type: sanitizeCsvFormula('--- DAILY BREAKDOWN (ASIA/COLOMBO) ---'),
      });
      for (const d of data.dailySales) {
        csvSheet.addRow({
          type: 'DAILY_SUMMARY',
          id: sanitizeCsvFormula(d.date),
          col1: sanitizeCsvFormula(`${d.paidOrderCount} paid / ${d.orderCount} total orders`),
          col2: sanitizeCsvFormula(`AOV: LKR ${formatLkr(d.averageOrderValueCents)}`),
          district: 'All Districts',
          gross: sanitizeCsvFormula(formatLkr(d.grossSalesCents)),
          refund: sanitizeCsvFormula(formatLkr(d.refundsCents)),
          net: sanitizeCsvFormula(formatLkr(d.netRevenueCents)),
        });
      }

      // Section 2: Summary Totals
      csvSheet.addRow({});
      csvSheet.addRow({
        type: sanitizeCsvFormula('--- TOTAL PERIOD SUMMARY ---'),
        id: sanitizeCsvFormula(`${data.range.dateFrom} to ${data.range.dateTo}`),
        col1: sanitizeCsvFormula(`Total Orders: ${data.kpi.totalOrdersCount}`),
        col2: sanitizeCsvFormula(`Paid Orders: ${data.kpi.paidOrdersCount}`),
        district: 'All Island',
        gross: sanitizeCsvFormula(formatLkr(data.kpi.grossSalesCents)),
        refund: sanitizeCsvFormula(formatLkr(data.kpi.salesEligibleRefundsCents)),
        net: sanitizeCsvFormula(formatLkr(data.kpi.netRevenueCents)),
      });

      // Section 3: Cancelled Cohort Reconciliation
      csvSheet.addRow({});
      csvSheet.addRow({
        type: sanitizeCsvFormula('--- CANCELLED ORDERS COHORT RECONCILIATION ---'),
        id: sanitizeCsvFormula(data.cancellationReconciliation.cohortDescription),
        col1: sanitizeCsvFormula(`${data.cancellationReconciliation.cancelledPaidOrdersCount} cancelled orders`),
        col2: sanitizeCsvFormula(`As of: ${formatColomboDateTime(data.cancellationReconciliation.asOfTimestamp)}`),
        district: 'N/A',
        gross: sanitizeCsvFormula(formatLkr(data.cancellationReconciliation.cancelledPaidCapturedCents)),
        refund: sanitizeCsvFormula(formatLkr(data.cancellationReconciliation.cancelledPaidRefundedCents)),
        net: sanitizeCsvFormula(formatLkr(data.cancellationReconciliation.cancelledPaidOutstandingCents)),
      });

      // Section 4: All Qualifying Orders (complete dataset)
      csvSheet.addRow({});
      csvSheet.addRow({
        type: sanitizeCsvFormula('--- COMPLETE QUALIFYING ORDER DETAILS ---'),
      });
      for (const o of data.allOrdersToExport) {
        csvSheet.addRow({
          type: 'ORDER_RECORD',
          id: sanitizeCsvFormula(o.orderNumber),
          col1: sanitizeCsvFormula(o.customerName),
          email: sanitizeCsvFormula(o.customerEmail),
          phone: sanitizeCsvFormula(o.customerPhone),
          col2: sanitizeCsvFormula(`${o.paymentMethod} | ${o.orderStatus}`),
          district: sanitizeCsvFormula(o.district),
          gross: sanitizeCsvFormula(formatLkr(o.totalCents)),
          refund: sanitizeCsvFormula(formatLkr(o.refundedAmountCents)),
          net: sanitizeCsvFormula(formatLkr(Math.max(0, o.totalCents - o.refundedAmountCents))),
        });
      }

      const filename = `dsl-sales-report-${data.range.period}-${data.range.dateFrom}-to-${data.range.dateTo}.csv`;
      const mimeType = 'text/csv';

      if (res && typeof res.setHeader === 'function') {
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
        await workbook.csv.write(res);
        res.end();
        return { filename, mimeType };
      }

      const csvOutput = await workbook.csv.writeBuffer();
      const buffer = Buffer.from(csvOutput);
      return {
        buffer,
        filename,
        mimeType,
      };
    }
  }
}
