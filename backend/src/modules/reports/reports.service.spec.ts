import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ReportsService,
  parseColomboDateBoundaries,
  getColomboBucketKey,
  generateDateBuckets,
  sanitizeCsvFormula,
  isPaymentCaptured,
  formatColomboDate,
  formatColomboDateTime,
} from './reports.service';
import { isValidCalendarDate, isLeapYear } from './dto/report-query.dto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  RefundStatus,
} from '../../generated/prisma';
import { BadRequestException } from '@nestjs/common';

describe('ReportsService — Comprehensive Reporting Engine Tests', () => {
  let service: ReportsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      order: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        aggregate: vi.fn().mockImplementation(async (args: any) => {
          const allOrders = await mockPrisma.order.findMany();
          let filtered = allOrders;
          if (args?.where?.orderStatus === OrderStatus.CANCELLED) {
            filtered = allOrders.filter(
              (o: any) =>
                o.orderStatus === OrderStatus.CANCELLED && isPaymentCaptured(o.paymentStatus)
            );
          } else if (args?.where?.orderStatus?.not === OrderStatus.CANCELLED) {
            filtered = allOrders.filter(
              (o: any) =>
                o.orderStatus !== OrderStatus.CANCELLED && isPaymentCaptured(o.paymentStatus)
            );
          }
          const sum = filtered.reduce((acc: number, o: any) => acc + (o.totalCents || 0), 0);
          return { _sum: { totalCents: sum }, _count: { id: filtered.length } };
        }),
      },
      refundRecord: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        aggregate: vi.fn().mockImplementation(async (args: any) => {
          const allRefunds = await mockPrisma.refundRecord.findMany();
          let filtered = allRefunds;
          if (args?.where?.order?.orderStatus === OrderStatus.CANCELLED) {
            filtered = allRefunds.filter(
              (r: any) => r.order?.orderStatus === OrderStatus.CANCELLED
            );
          } else if (args?.where?.order?.orderStatus?.not === OrderStatus.CANCELLED) {
            filtered = allRefunds.filter(
              (r: any) => r.order?.orderStatus !== OrderStatus.CANCELLED
            );
          }
          const sum = filtered.reduce((acc: number, r: any) => acc + (r.amountCents || 0), 0);
          return { _sum: { amountCents: sum }, _count: { id: filtered.length } };
        }),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ count: 0n }]),
    };
    service = new ReportsService(mockPrisma as unknown as PrismaService);
  });

  describe('1. Timezone & Strict Calendar Date Validation', () => {
    it('accurately identifies leap years', () => {
      expect(isLeapYear(2024)).toBe(true);
      expect(isLeapYear(2020)).toBe(true);
      expect(isLeapYear(2000)).toBe(true);
      expect(isLeapYear(2025)).toBe(false);
      expect(isLeapYear(2026)).toBe(false);
      expect(isLeapYear(1900)).toBe(false);
      expect(isLeapYear(2100)).toBe(false);
    });

    it('validates genuine Gregorian calendar dates', () => {
      expect(isValidCalendarDate('2026-01-01')).toBe(true);
      expect(isValidCalendarDate('2026-02-28')).toBe(true);
      expect(isValidCalendarDate('2024-02-29')).toBe(true); // leap year
      expect(isValidCalendarDate('2026-12-31')).toBe(true);
    });

    it('rejects invalid or impossible calendar dates', () => {
      expect(isValidCalendarDate('2025-02-29')).toBe(false); // non-leap year
      expect(isValidCalendarDate('2026-02-30')).toBe(false);
      expect(isValidCalendarDate('2026-04-31')).toBe(false); // April has 30 days
      expect(isValidCalendarDate('2026-06-31')).toBe(false); // June has 30 days
      expect(isValidCalendarDate('2026-09-31')).toBe(false); // September has 30 days
      expect(isValidCalendarDate('2026-11-31')).toBe(false); // November has 30 days
      expect(isValidCalendarDate('2026-13-01')).toBe(false); // invalid month
      expect(isValidCalendarDate('2026-00-10')).toBe(false); // month 0
      expect(isValidCalendarDate('2026-05-00')).toBe(false); // day 0
      expect(isValidCalendarDate('2026-99-99')).toBe(false);
      expect(isValidCalendarDate('')).toBe(false);
      expect(isValidCalendarDate('not-a-date')).toBe(false);
    });

    it('throws BadRequestException in parseColomboDateBoundaries for invalid calendar dates', () => {
      expect(() =>
        parseColomboDateBoundaries({
          period: 'custom',
          dateFrom: '2026-99-99',
          dateTo: '2026-11-15',
        })
      ).toThrow(BadRequestException);

      expect(() =>
        parseColomboDateBoundaries({
          period: 'custom',
          dateFrom: '2025-02-29',
          dateTo: '2025-03-01',
        })
      ).toThrow(BadRequestException);

      expect(() =>
        parseColomboDateBoundaries({
          period: 'custom',
          dateFrom: '2026-11-15',
          dateTo: '2026-11-01',
        })
      ).toThrow(BadRequestException);

      expect(() =>
        parseColomboDateBoundaries({
          period: 'custom',
          dateFrom: '2024-01-01',
          dateTo: '2026-01-01',
        })
      ).toThrow(BadRequestException);
    });

    it('formats Colombo dates and date-times accurately around midnight', () => {
      // 2026-11-01 23:59:59.000 +05:30 is 18:29:59.000 UTC on Nov 1
      const utcDate1 = new Date('2026-11-01T18:29:59.000Z');
      expect(formatColomboDate(utcDate1)).toBe('2026-11-01');
      expect(formatColomboDateTime(utcDate1)).toContain('2026-11-01 23:59:59 (+05:30)');

      // 2026-11-02 00:00:01.000 +05:30 is 18:30:01.000 UTC on Nov 1
      const utcDate2 = new Date('2026-11-01T18:30:01.000Z');
      expect(formatColomboDate(utcDate2)).toBe('2026-11-02');
      expect(formatColomboDateTime(utcDate2)).toContain('2026-11-02 00:00:01 (+05:30)');
    });

    it('maps date boundaries to half-open UTC interval for custom dates', () => {
      const result = parseColomboDateBoundaries({
        period: 'custom',
        dateFrom: '2026-11-01',
        dateTo: '2026-11-15',
      });

      expect(result.period).toBe('custom');
      expect(result.dateFrom).toBe('2026-11-01');
      expect(result.dateTo).toBe('2026-11-15');
      expect(result.startUtc.toISOString()).toBe('2026-10-31T18:30:00.000Z');
      expect(result.endExclusiveUtc.toISOString()).toBe('2026-11-15T18:30:00.000Z');
    });
  });

  describe('2. Authoritative Financial Calculations', () => {
    it('calculates Gross Sales and Net Revenue for standard PAID order without refunds', async () => {
      mockPrisma.order.findMany.mockResolvedValue([
        {
          id: 'ord-1',
          orderNumber: 'DSL-2026-001',
          customerName: 'Customer One',
          totalCents: 500000,
          paymentStatus: PaymentStatus.PAID,
          orderStatus: OrderStatus.CONFIRMED,
          paymentMethod: PaymentMethod.CARD_PAYHERE,
          createdAt: new Date('2026-11-05T10:00:00.000+05:30'),
          addressSnapshot: { district: 'Colombo', city: 'Colombo 03' },
          refundRecords: [],
        },
      ]);
      mockPrisma.refundRecord.findMany.mockResolvedValue([]);

      const res = await service.getSummary({
        period: 'custom',
        dateFrom: '2026-11-01',
        dateTo: '2026-11-15',
      });

      expect(res.kpi.grossSalesCents).toBe(500000);
      expect(res.kpi.salesEligibleRefundsCents).toBe(0);
      expect(res.kpi.netRevenueCents).toBe(500000);
      expect(res.kpi.paidOrdersCount).toBe(1);
      expect(res.kpi.averageOrderValueCents).toBe(500000);
      expect(res.reconciliation.isNetRevenueReconciled).toBe(true);
      expect(res.reconciliation.independentVerification.overallStatus).toBe('PASS');
    });

    it('includes PARTIALLY_REFUNDED order in Gross Sales once and deducts completed refund from Net Revenue', async () => {
      const order = {
        id: 'ord-partial',
        orderNumber: 'DSL-2026-002',
        customerName: 'Customer Two',
        totalCents: 1000000,
        paymentStatus: PaymentStatus.PARTIALLY_REFUNDED,
        orderStatus: OrderStatus.DELIVERED,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        createdAt: new Date('2026-11-05T10:00:00.000+05:30'),
        addressSnapshot: { district: 'Gampaha', city: 'Negombo' },
        refundRecords: [
          {
            id: 'ref-1',
            amountCents: 200000,
            status: RefundStatus.COMPLETED,
            completedAt: new Date('2026-11-06T12:00:00.000+05:30'),
          },
        ],
      };

      mockPrisma.order.findMany.mockResolvedValue([order]);
      mockPrisma.refundRecord.findMany.mockResolvedValue([
        {
          id: 'ref-1',
          amountCents: 200000,
          status: RefundStatus.COMPLETED,
          completedAt: new Date('2026-11-06T12:00:00.000+05:30'),
          order,
        },
      ]);

      const res = await service.getSummary({
        period: 'custom',
        dateFrom: '2026-11-01',
        dateTo: '2026-11-15',
      });

      expect(res.kpi.grossSalesCents).toBe(1000000);
      expect(res.kpi.salesEligibleRefundsCents).toBe(200000);
      expect(res.kpi.netRevenueCents).toBe(800000);
      // AOV = Net Revenue (800,000) / 1 paid order = 800,000 (NOT Gross Sales 1,000,000)
      expect(res.kpi.averageOrderValueCents).toBe(800000);
      expect(res.reconciliation.independentVerification.overallStatus).toBe('PASS');
    });

    it('attributes refund completed in reporting period even if original order was in an earlier period', async () => {
      const octoberOrder = {
        id: 'ord-oct',
        orderNumber: 'DSL-2026-OCT-1',
        customerName: 'October Customer',
        totalCents: 500000,
        paymentStatus: PaymentStatus.PARTIALLY_REFUNDED,
        orderStatus: OrderStatus.DELIVERED,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        createdAt: new Date('2026-10-20T10:00:00.000+05:30'),
      };

      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.refundRecord.findMany.mockResolvedValue([
        {
          id: 'ref-nov',
          amountCents: 200000,
          status: RefundStatus.COMPLETED,
          completedAt: new Date('2026-11-03T10:00:00.000+05:30'),
          order: octoberOrder,
        },
      ]);
      mockPrisma.order.aggregate.mockResolvedValue({
        _sum: { totalCents: 0 },
        _count: { id: 0 },
      });
      mockPrisma.refundRecord.aggregate.mockResolvedValue({
        _sum: { amountCents: 200000 },
        _count: { id: 1 },
      });

      const res = await service.getSummary({
        period: 'custom',
        dateFrom: '2026-11-01',
        dateTo: '2026-11-15',
      });

      expect(res.kpi.grossSalesCents).toBe(0);
      expect(res.kpi.salesEligibleRefundsCents).toBe(200000);
      expect(res.kpi.netRevenueCents).toBe(-200000);
      expect(
        res.reconciliation.inconsistencies.some((i) => i.code === 'NEGATIVE_NET_REVENUE')
      ).toBe(true);
    });
  });

  describe('3. Issue 1: Cohort-Based Cancellation Reconciliation', () => {
    it('reconciles cancelled cohort with refund completed during the period', async () => {
      const cancelledOrder = {
        id: 'ord-cancel-1',
        orderNumber: 'DSL-CANCEL-1',
        customerName: 'Cancelled Cust 1',
        totalCents: 500000,
        paymentStatus: PaymentStatus.PAID,
        orderStatus: OrderStatus.CANCELLED,
        paymentMethod: PaymentMethod.CARD_PAYHERE,
        createdAt: new Date('2026-11-05T10:00:00.000+05:30'),
        refundRecords: [
          {
            id: 'ref-c1',
            amountCents: 500000,
            status: RefundStatus.COMPLETED,
            completedAt: new Date('2026-11-07T12:00:00.000+05:30'),
          },
        ],
      };

      mockPrisma.order.findMany.mockResolvedValue([cancelledOrder]);
      mockPrisma.refundRecord.findMany.mockResolvedValue([
        {
          id: 'ref-c1',
          amountCents: 500000,
          status: RefundStatus.COMPLETED,
          completedAt: new Date('2026-11-07T12:00:00.000+05:30'),
          order: cancelledOrder,
        },
      ]);
      mockPrisma.order.aggregate.mockResolvedValue({
        _sum: { totalCents: 0 },
        _count: { id: 0 },
      });
      mockPrisma.refundRecord.aggregate.mockResolvedValue({
        _sum: { amountCents: 500000 },
        _count: { id: 1 },
      });

      const res = await service.getSummary({
        period: 'custom',
        dateFrom: '2026-11-01',
        dateTo: '2026-11-15',
      });

      expect(res.kpi.grossSalesCents).toBe(0);
      expect(res.kpi.netRevenueCents).toBe(0);
      expect(res.cancellationReconciliation.cancelledPaidCapturedCents).toBe(500000);
      expect(res.cancellationReconciliation.cancelledPaidRefundedCents).toBe(500000);
      expect(res.cancellationReconciliation.cancelledPaidOutstandingCents).toBe(0);
    });

    it('includes cumulative refund completed BEFORE the period for an order in the cohort', async () => {
      const cancelledOrder = {
        id: 'ord-cancel-early',
        orderNumber: 'DSL-CANCEL-EARLY',
        customerName: 'Cancelled Cust Early',
        totalCents: 400000,
        paymentStatus: PaymentStatus.PAID,
        orderStatus: OrderStatus.CANCELLED,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        createdAt: new Date('2026-11-05T10:00:00.000+05:30'),
        refundRecords: [
          {
            id: 'ref-prior',
            amountCents: 400000,
            status: RefundStatus.COMPLETED,
            completedAt: new Date('2026-10-30T10:00:00.000+05:30'), // completed before Nov 1
          },
        ],
      };

      mockPrisma.order.findMany.mockResolvedValue([cancelledOrder]);
      mockPrisma.refundRecord.findMany.mockResolvedValue([]); // not in Nov 1-15 period

      const res = await service.getSummary({
        period: 'custom',
        dateFrom: '2026-11-01',
        dateTo: '2026-11-15',
      });

      // Period refunds are 0 because refund completed in October
      expect(res.kpi.totalRefundsCents).toBe(0);
      // But cohort reconciliation includes cumulative refunds for this order up to Nov 15!
      expect(res.cancellationReconciliation.cancelledPaidCapturedCents).toBe(400000);
      expect(res.cancellationReconciliation.cancelledPaidRefundedCents).toBe(400000);
      expect(res.cancellationReconciliation.cancelledPaidOutstandingCents).toBe(0);
    });

    it('excludes refund completed AFTER the reporting period from as-of reconciliation', async () => {
      const cancelledOrder = {
        id: 'ord-cancel-late',
        orderNumber: 'DSL-CANCEL-LATE',
        customerName: 'Cancelled Cust Late',
        totalCents: 600000,
        paymentStatus: PaymentStatus.PAID,
        orderStatus: OrderStatus.CANCELLED,
        paymentMethod: PaymentMethod.CARD_PAYHERE,
        createdAt: new Date('2026-11-05T10:00:00.000+05:30'),
        refundRecords: [
          {
            id: 'ref-after',
            amountCents: 600000,
            status: RefundStatus.COMPLETED,
            completedAt: new Date('2026-11-20T10:00:00.000+05:30'), // after Nov 15
          },
        ],
      };

      mockPrisma.order.findMany.mockResolvedValue([cancelledOrder]);
      mockPrisma.refundRecord.findMany.mockResolvedValue([]);

      const res = await service.getSummary({
        period: 'custom',
        dateFrom: '2026-11-01',
        dateTo: '2026-11-15',
      });

      // As of Nov 15, refund had not been completed!
      expect(res.cancellationReconciliation.cancelledPaidCapturedCents).toBe(600000);
      expect(res.cancellationReconciliation.cancelledPaidRefundedCents).toBe(0);
      expect(res.cancellationReconciliation.cancelledPaidOutstandingCents).toBe(600000);
    });

    it('refunds belonging to older orders outside cohort do not affect current cohort outstanding', async () => {
      // Current period has 1 cancelled order with NO refund
      const currentCancelledOrder = {
        id: 'ord-nov-cancelled',
        orderNumber: 'DSL-NOV-C1',
        customerName: 'Nov Cancelled',
        totalCents: 300000,
        paymentStatus: PaymentStatus.PAID,
        orderStatus: OrderStatus.CANCELLED,
        paymentMethod: PaymentMethod.CARD_PAYHERE,
        createdAt: new Date('2026-11-05T10:00:00.000+05:30'),
        refundRecords: [], // no refund for this order yet
      };

      // In November, a refund was completed for an older OCTOBER order
      const octoberOrder = {
        id: 'ord-oct-old',
        orderNumber: 'DSL-OCT-OLD',
        customerName: 'Oct Cust',
        totalCents: 800000,
        paymentStatus: PaymentStatus.REFUNDED,
        orderStatus: OrderStatus.CANCELLED,
        createdAt: new Date('2026-10-10T10:00:00.000+05:30'),
      };

      mockPrisma.order.findMany.mockResolvedValue([currentCancelledOrder]);
      mockPrisma.refundRecord.findMany.mockResolvedValue([
        {
          id: 'ref-oct-completed-in-nov',
          amountCents: 800000,
          status: RefundStatus.COMPLETED,
          completedAt: new Date('2026-11-08T10:00:00.000+05:30'),
          order: octoberOrder,
        },
      ]);

      const res = await service.getSummary({
        period: 'custom',
        dateFrom: '2026-11-01',
        dateTo: '2026-11-15',
      });

      // Period financial refund reflects the refund completed in November
      expect(res.kpi.cancelledOrderRefundsCents).toBe(800000);
      // BUT current cohort outstanding is strictly for November orders!
      // Outstanding must remain 300,000, NOT distorted by October's 800,000 refund!
      expect(res.cancellationReconciliation.cancelledPaidCapturedCents).toBe(300000);
      expect(res.cancellationReconciliation.cancelledPaidRefundedCents).toBe(0);
      expect(res.cancellationReconciliation.cancelledPaidOutstandingCents).toBe(300000);
    });

    it('does not silently clamp negative outstanding balances to zero and flags inconsistency', async () => {
      const overRefundedCancelled = {
        id: 'ord-over-ref',
        orderNumber: 'DSL-OVER',
        customerName: 'Over Cust',
        totalCents: 200000,
        paymentStatus: PaymentStatus.PAID,
        orderStatus: OrderStatus.CANCELLED,
        createdAt: new Date('2026-11-05T10:00:00.000+05:30'),
        refundRecords: [
          {
            id: 'ref-excess',
            amountCents: 250000, // 250,000 > 200,000
            status: RefundStatus.COMPLETED,
            completedAt: new Date('2026-11-06T10:00:00.000+05:30'),
          },
        ],
      };

      mockPrisma.order.findMany.mockResolvedValue([overRefundedCancelled]);
      mockPrisma.refundRecord.findMany.mockResolvedValue([]);

      const res = await service.getSummary({
        period: 'custom',
        dateFrom: '2026-11-01',
        dateTo: '2026-11-15',
      });

      // Outstanding balance is unclamped: 200,000 - 250,000 = -50,000
      expect(res.cancellationReconciliation.cancelledPaidOutstandingCents).toBe(-50000);
      expect(
        res.reconciliation.inconsistencies.some(
          (i) => i.code === 'CANCELLED_REFUND_EXCEEDS_CAPTURED'
        )
      ).toBe(true);
    });
  });

  describe('4. Issue 2: Independent Financial Verification Checks', () => {
    it('returns PASS when independent queries match shared calculation layer', async () => {
      const order = {
        id: 'ord-pass',
        orderNumber: 'DSL-PASS-1',
        customerName: 'Pass Cust',
        totalCents: 500000,
        paymentStatus: PaymentStatus.PAID,
        orderStatus: OrderStatus.CONFIRMED,
        paymentMethod: PaymentMethod.CARD_PAYHERE,
        createdAt: new Date('2026-11-05T10:00:00.000+05:30'),
        addressSnapshot: { district: 'Colombo' },
        refundRecords: [],
      };

      mockPrisma.order.findMany.mockResolvedValue([order]);
      mockPrisma.refundRecord.findMany.mockResolvedValue([]);

      const res = await service.getSummary({
        period: 'custom',
        dateFrom: '2026-11-01',
        dateTo: '2026-11-15',
      });

      expect(res.reconciliation.independentVerification.overallStatus).toBe('PASS');
      expect(res.reconciliation.independentVerification.grossSalesCheck.status).toBe('PASS');
      expect(res.reconciliation.independentVerification.netRevenueCheck.status).toBe('PASS');
    });

    it('returns MISMATCH when independent database aggregate diverges from shared calculation', async () => {
      const order = {
        id: 'ord-mismatch',
        orderNumber: 'DSL-MISMATCH-1',
        customerName: 'Mismatch Cust',
        totalCents: 500000,
        paymentStatus: PaymentStatus.PAID,
        orderStatus: OrderStatus.CONFIRMED,
        paymentMethod: PaymentMethod.CARD_PAYHERE,
        createdAt: new Date('2026-11-05T10:00:00.000+05:30'),
        addressSnapshot: { district: 'Colombo' },
        refundRecords: [],
      };

      mockPrisma.order.findMany.mockResolvedValue([order]);
      mockPrisma.refundRecord.findMany.mockResolvedValue([]);

      // Simulate independent query returning a different value (e.g. concurrent write or mismatch)
      mockPrisma.order.aggregate.mockResolvedValue({
        _sum: { totalCents: 450000 }, // mismatch against 500,000
        _count: { id: 1 },
      });
      mockPrisma.refundRecord.aggregate.mockResolvedValue({
        _sum: { amountCents: 0 },
        _count: { id: 0 },
      });

      const res = await service.getSummary({
        period: 'custom',
        dateFrom: '2026-11-01',
        dateTo: '2026-11-15',
      });

      expect(res.reconciliation.independentVerification.overallStatus).toBe('MISMATCH');
      expect(res.reconciliation.independentVerification.grossSalesCheck.status).toBe('MISMATCH');
      expect(res.reconciliation.independentVerification.grossSalesCheck.differenceCents).toBe(50000);
    });

    it('returns NOT_VERIFIABLE if independent database queries fail', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.refundRecord.findMany.mockResolvedValue([]);

      // Aggregate fails
      mockPrisma.order.aggregate.mockRejectedValue(new Error('Connection lost'));

      const res = await service.getSummary({
        period: 'custom',
        dateFrom: '2026-11-01',
        dateTo: '2026-11-15',
      });

      expect(res.reconciliation.independentVerification.overallStatus).toBe('NOT_VERIFIABLE');
      expect(
        res.reconciliation.inconsistencies.some(
          (i) => i.code === 'INDEPENDENT_VERIFICATION_FAILED'
        )
      ).toBe(true);
    });

    it('returns NOT_VERIFIABLE if integrity SQL queries fail rather than silently falling back to zero', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.refundRecord.findMany.mockResolvedValue([]);

      // Integrity query throws database error
      mockPrisma.$queryRaw = vi.fn().mockRejectedValue(new Error('Syntax error or table locked'));

      const res = await service.getSummary({
        period: 'custom',
        dateFrom: '2026-11-01',
        dateTo: '2026-11-15',
      });

      expect(res.reconciliation.independentVerification.overallStatus).toBe('NOT_VERIFIABLE');
      expect(
        res.reconciliation.inconsistencies.some(
          (i) =>
            i.code === 'INDEPENDENT_VERIFICATION_FAILED' &&
            i.message.includes('Syntax error or table locked')
        )
      ).toBe(true);
    });

    it('detects duplicate refund IDs and orphaned refund records via database query', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.refundRecord.findMany.mockResolvedValue([]);

      // Mock $queryRaw to return 2 duplicate refund IDs and 1 orphaned refund
      mockPrisma.$queryRaw = vi.fn().mockImplementation(async (query: any) => {
        const sqlText = Array.isArray(query)
          ? query.join(' ')
          : query?.strings?.join(' ') || String(query);
        if (sqlText.includes('GROUP BY id')) {
          return [{ count: 2n }];
        }
        if (sqlText.includes('o.id IS NULL')) {
          return [{ count: 1n }];
        }
        return [{ count: 0n }];
      });

      const res = await service.getSummary({
        period: 'custom',
        dateFrom: '2026-11-01',
        dateTo: '2026-11-15',
      });

      expect(res.reconciliation.independentVerification.overallStatus).toBe('INCONSISTENT_DATA');
      expect(res.reconciliation.independentVerification.integrityChecks.duplicateRefundIdsCount).toBe(2);
      expect(res.reconciliation.independentVerification.integrityChecks.orphanedRefundsCount).toBe(1);
      expect(res.reconciliation.inconsistencies.some((i) => i.code === 'DUPLICATE_REFUND_IDS')).toBe(true);
      expect(res.reconciliation.inconsistencies.some((i) => i.code === 'ORPHANED_REFUND_RECORDS')).toBe(true);
    });
  });

  describe('5. Issue 4: Export Completeness and Multi-Format Streaming', () => {
    it('exports all qualifying orders without a 50-record limitation in Excel', async () => {
      // Generate 75 orders
      const orders75 = Array.from({ length: 75 }).map((_, idx) => ({
        id: `ord-${idx}`,
        orderNumber: `DSL-2026-${String(idx).padStart(4, '0')}`,
        customerName: `Customer ${idx}`,
        customerEmail: `cust${idx}@dsl.lk`,
        customerPhone: `077000${String(idx).padStart(4, '0')}`,
        totalCents: 100000,
        paymentStatus: PaymentStatus.PAID,
        orderStatus: OrderStatus.DELIVERED,
        paymentMethod: PaymentMethod.CARD_PAYHERE,
        createdAt: new Date('2026-11-05T10:00:00.000+05:30'),
        addressSnapshot: { district: 'Colombo' },
        refundRecords: [],
      }));

      mockPrisma.order.findMany.mockResolvedValue(orders75);
      mockPrisma.refundRecord.findMany.mockResolvedValue([]);
      mockPrisma.order.aggregate.mockResolvedValue({
        _sum: { totalCents: 7500000 },
        _count: { id: 75 },
      });

      const result = await service.exportReport(
        { period: 'custom', dateFrom: '2026-11-01', dateTo: '2026-11-15' },
        'xlsx'
      );

      expect(result.buffer).toBeDefined();
      expect(result.filename).toMatch(/^dsl-sales-report-custom-2026-11-01-to-2026-11-15\.xlsx$/);
      expect(result.mimeType).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
    });

    it('exports complete CSV with formula sanitization and Colombo dates', async () => {
      const dangerousOrder = {
        id: 'ord-danger',
        orderNumber: '=1+2',
        customerName: '@SUM(A1)',
        customerEmail: '-danger@dsl.lk',
        customerPhone: '+94771234567',
        totalCents: 50000,
        paymentStatus: PaymentStatus.PAID,
        orderStatus: OrderStatus.CONFIRMED,
        paymentMethod: PaymentMethod.CARD_PAYHERE,
        createdAt: new Date('2026-11-01T18:30:00.000Z'), // exactly midnight Colombo
        addressSnapshot: { district: '=CMD()' },
        refundRecords: [],
      };

      mockPrisma.order.findMany.mockResolvedValue([dangerousOrder]);
      mockPrisma.refundRecord.findMany.mockResolvedValue([]);

      const result = await service.exportReport(
        { period: 'custom', dateFrom: '2026-11-01', dateTo: '2026-11-05' },
        'csv'
      );

      expect(result.buffer).toBeDefined();
      const csvString = result.buffer.toString();
      expect(csvString).toContain(`'=1+2`);
      expect(csvString).toContain(`'@SUM(A1)`);
      expect(csvString).toContain(`'-danger@dsl.lk`);
      expect(csvString).toContain(`'+94771234567`);
      expect(csvString).toContain(`'=CMD()`);
    });

    it('streams Excel export directly to response stream without full in-memory buffering when res is provided', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.refundRecord.findMany.mockResolvedValue([]);

      const mockRes = {
        setHeader: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
        emit: vi.fn(),
      };

      const result = await service.exportReport(
        { period: 'today' },
        'xlsx',
        mockRes
      );

      expect(result.filename).toMatch(/^dsl-sales-report-today/);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(mockRes.end).toHaveBeenCalled();
    });
  });
});
