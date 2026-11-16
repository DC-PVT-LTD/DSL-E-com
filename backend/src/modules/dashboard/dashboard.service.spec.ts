import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DashboardService } from './dashboard.service';
import { UserRole, OrderStatus, PaymentStatus } from '../../generated/prisma';

describe('DashboardService', () => {
  let service: DashboardService;
  let mockPrisma: any;
  let mockReportsService: any;

  beforeEach(() => {
    mockReportsService = {
      getSummary: vi.fn().mockResolvedValue({
        period: 'last30days',
        dateFrom: '2026-10-17',
        dateTo: '2026-11-15',
        kpi: {
          grossSalesCents: 500000,
          netRevenueCents: 450000,
          salesEligibleRefundsCents: 50000,
          totalRefundsCents: 50000,
          paidOrdersCount: 10,
          averageOrderValueCents: 45000,
          totalOrdersCount: 12,
        },
        reconciliation: {
          independentVerification: {
            overallStatus: 'PASS',
          },
        },
      }),
    };

    mockPrisma = {
      order: {
        count: vi.fn().mockImplementation(async ({ where }: any) => {
          if (where?.orderStatus?.notIn) {
            // Pending fulfillment queue
            return 3;
          }
          if (where?.createdAt?.gte) {
            // Period order count
            return 12;
          }
          return 0;
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'ord-1',
            orderNumber: 'DSL-2026-001',
            customerName: 'Saman Perera',
            orderStatus: OrderStatus.CONFIRMED,
            paymentStatus: PaymentStatus.PAID,
            totalCents: 25000,
            createdAt: new Date('2026-11-15T05:30:00.000Z'), // 11:00 AM Colombo
          },
          {
            id: 'ord-2',
            orderNumber: 'DSL-2026-002',
            customerName: null,
            orderStatus: OrderStatus.PENDING,
            paymentStatus: PaymentStatus.PENDING,
            totalCents: 15000,
            createdAt: new Date('2026-11-14T02:00:00.000Z'), // 07:30 AM Colombo
          },
        ]),
      },
      orderItem: {
        groupBy: vi.fn().mockResolvedValue([
          { productId: 'prod-1', _sum: { quantity: 45 } },
          { productId: 'prod-2', _sum: { quantity: 30 } },
        ]),
      },
      product: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'prod-1',
            name: 'Atlas CR Book 120 Pages',
            sku: 'DSL-ATL-CR-120',
            images: ['https://example.com/cr.png'],
            priceCents: 45000,
          },
          {
            id: 'prod-2',
            name: 'Deli Ballpoint Pen Blue',
            sku: 'DSL-DELI-BP-BL',
            images: [],
            priceCents: 12000,
          },
        ]),
      },
      $queryRaw: vi.fn().mockImplementation(async (query: any) => {
        const sqlText = Array.isArray(query) ? query.join(' ') : query?.strings?.join(' ') || '';
        if (sqlText.includes('COUNT(*)::bigint AS count')) {
          return [{ count: 4n }];
        }
        if (sqlText.includes('ORDER BY "stockQuantity" ASC')) {
          return [
            {
              id: 'prod-low-1',
              productId: 'prod-low-1',
              name: 'Highlighter Yellow',
              sku: 'DSL-HL-YLW',
              stockQuantity: 2,
              lowStockThreshold: 5,
              isVariant: false,
            },
            {
              id: 'var-low-2',
              productId: 'prod-parent-2',
              name: 'Pastel Gel Pen - Pink',
              sku: 'DSL-PEN-PNK',
              stockQuantity: 1,
              lowStockThreshold: 10,
              isVariant: true,
            },
          ];
        }
        return [];
      }),
    };

    service = new DashboardService(mockPrisma, mockReportsService);
  });

  describe('Financial metrics & Role Authorization', () => {
    it('returns authoritative Stage 4.3 financial values for ADMIN', async () => {
      const result = await service.getDashboardKpis({ period: 'last30days' }, UserRole.ADMIN);

      expect(mockReportsService.getSummary).toHaveBeenCalled();
      expect(result.financial).not.toBeNull();
      expect(result.financial?.grossSalesCents).toBe(500000);
      expect(result.financial?.netRevenueCents).toBe(450000);
      expect(result.financial?.completedRefundsCents).toBe(50000);
      expect(result.financial?.paidOrdersCount).toBe(10);
      expect(result.financial?.averageOrderValueCents).toBe(45000);
      expect(result.orders.totalOrdersInPeriod).toBe(12);
      expect(result.userRole).toBe(UserRole.ADMIN);
      expect(result.recentOrders[0].totalCents).toBe(25000);
    });

    it('returns authoritative Stage 4.3 financial values for MANAGER', async () => {
      const result = await service.getDashboardKpis({ period: 'last30days' }, UserRole.MANAGER);

      expect(result.financial).not.toBeNull();
      expect(result.financial?.grossSalesCents).toBe(500000);
      expect(result.recentOrders[0].totalCents).toBe(25000);
    });

    it('strictly omits financial figures and order totals for STAFF', async () => {
      const result = await service.getDashboardKpis({ period: 'last30days' }, UserRole.STAFF);

      expect(mockReportsService.getSummary).not.toHaveBeenCalled();
      expect(result.financial).toBeNull();
      expect(result.userRole).toBe(UserRole.STAFF);

      // Operational metrics remain present
      expect(result.orders.totalOrdersInPeriod).toBe(12);
      expect(result.orders.pendingFulfillmentQueue).toBe(3);
      expect(result.inventory.lowStockSkuCount).toBe(4);

      // Recent orders do not contain totalCents for STAFF
      expect(result.recentOrders[0].totalCents).toBeUndefined();
      expect(result.recentOrders[1].totalCents).toBeUndefined();
    });

    it('omits financial metrics if Stage 4.3 report reconciliation fails verification', async () => {
      mockReportsService.getSummary.mockResolvedValueOnce({
        period: 'last30days',
        dateFrom: '2026-10-17',
        dateTo: '2026-11-15',
        kpi: {
          grossSalesCents: 500000,
          netRevenueCents: 450000,
          salesEligibleRefundsCents: 50000,
          paidOrdersCount: 10,
          averageOrderValueCents: 45000,
          totalOrdersCount: 12,
        },
        reconciliation: {
          independentVerification: {
            overallStatus: 'NOT_VERIFIABLE',
          },
        },
      });

      const result = await service.getDashboardKpis({ period: 'last30days' }, UserRole.ADMIN);

      expect(result.financial).toBeNull();
      expect(result.financialVerificationStatus).toBe('NOT_VERIFIABLE');
      // Total orders still counted safely via Prisma
      expect(result.orders.totalOrdersInPeriod).toBe(12);
    });
  });

  describe('Order Metrics & Pending Fulfillment Queue', () => {
    it('calculates current pending-fulfillment queue excluding CANCELLED and DELIVERED', async () => {
      const result = await service.getDashboardKpis({ period: 'last30days' }, UserRole.ADMIN);

      expect(mockPrisma.order.count).toHaveBeenCalledWith({
        where: {
          orderStatus: {
            notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
          },
        },
      });
      expect(result.orders.pendingFulfillmentQueue).toBe(3);
    });
  });

  describe('Inventory Low-Stock Metrics', () => {
    it('executes database query for low stock accounting for variants without double counting', async () => {
      const result = await service.getDashboardKpis({ period: 'last30days' }, UserRole.ADMIN);

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      expect(result.inventory.lowStockSkuCount).toBe(4);
      expect(result.inventory.lowStockItems).toHaveLength(2);

      const standalone = result.inventory.lowStockItems[0];
      expect(standalone.isVariant).toBe(false);
      expect(standalone.stockQuantity).toBe(2);
      expect(standalone.lowStockThreshold).toBe(5);

      const variant = result.inventory.lowStockItems[1];
      expect(variant.isVariant).toBe(true);
      expect(variant.name).toBe('Pastel Gel Pen - Pink');
      expect(variant.stockQuantity).toBe(1);
    });
  });

  describe('Top Selling Products', () => {
    it('aggregates quantities for eligible non-cancelled orders with captured payment', async () => {
      const result = await service.getDashboardKpis({ period: 'last30days' }, UserRole.ADMIN);

      expect(mockPrisma.orderItem.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['productId'],
          where: expect.objectContaining({
            order: expect.objectContaining({
              orderStatus: { not: OrderStatus.CANCELLED },
              paymentStatus: {
                in: [PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED],
              },
            }),
          }),
        })
      );

      expect(result.topSellingProducts).toHaveLength(2);
      expect(result.topSellingProducts[0]).toEqual({
        productId: 'prod-1',
        name: 'Atlas CR Book 120 Pages',
        sku: 'DSL-ATL-CR-120',
        image: 'https://example.com/cr.png',
        priceCents: 45000,
        unitsSold: 45,
      });
      expect(result.topSellingProducts[1].image).toBeNull();
      expect(result.topSellingProducts[1].unitsSold).toBe(30);
    });

    it('returns empty array when no sales occurred in the period', async () => {
      mockPrisma.orderItem.groupBy.mockResolvedValueOnce([]);

      const result = await service.getDashboardKpis({ period: 'today' }, UserRole.ADMIN);

      expect(result.topSellingProducts).toEqual([]);
      expect(mockPrisma.product.findMany).not.toHaveBeenCalled();
    });
  });

  describe('Recent Orders & Colombo Date Formatting', () => {
    it('orders by createdAt DESC, id DESC and formats dates with Asia/Colombo offset (+05:30)', async () => {
      const result = await service.getDashboardKpis({ period: 'last30days' }, UserRole.ADMIN);

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith({
        take: 5,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: expect.any(Object),
      });

      expect(result.recentOrders).toHaveLength(2);

      // ord-1: 2026-11-15T05:30:00Z -> 2026-11-15 11:00:00 (+05:30)
      expect(result.recentOrders[0].orderNumber).toBe('DSL-2026-001');
      expect(result.recentOrders[0].customerName).toBe('Saman Perera');
      expect(result.recentOrders[0].createdAtColombo).toBe('2026-11-15 11:00:00 (+05:30)');

      // ord-2: null customerName defaults to 'Customer'
      expect(result.recentOrders[1].customerName).toBe('Customer');
      expect(result.recentOrders[1].createdAtColombo).toBe('2026-11-14 07:30:00 (+05:30)');
    });
  });

  describe('Database Error Handling', () => {
    it('bubbles database exceptions rather than masking errors as false zero-valued data', async () => {
      mockPrisma.order.findMany.mockRejectedValueOnce(new Error('PostgreSQL connection terminated'));

      await expect(
        service.getDashboardKpis({ period: 'last30days' }, UserRole.ADMIN)
      ).rejects.toThrow('PostgreSQL connection terminated');
    });
  });
});
