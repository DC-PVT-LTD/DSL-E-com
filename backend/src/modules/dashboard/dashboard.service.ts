import {
  Injectable,
  Inject,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportsService, parseColomboDateBoundaries, formatColomboDateTime } from '../reports/reports.service';
import {
  ReportQueryDto,
  DashboardKpisResponse,
  DashboardFinancialKpi,
  LowStockItem,
  TopSellingProduct,
  DashboardRecentOrder,
} from './dto/dashboard-query.dto';
import { OrderStatus, PaymentStatus, UserRole } from '../../generated/prisma';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ReportsService) private readonly reportsService: ReportsService
  ) {}

  /**
   * Retrieves role-filtered executive dashboard KPIs and operational metrics.
   * - ADMIN and MANAGER receive financial metrics derived from the authoritative ReportsService.
   * - STAFF receives operational metrics only (orders, inventory, top products, recent orders without financial totals).
   * - Omit financial metrics if report reconciliation indicates unverified data.
   */
  async getDashboardKpis(
    query: ReportQueryDto,
    userRole: UserRole
  ): Promise<DashboardKpisResponse> {
    try {
      const range = parseColomboDateBoundaries(query);

      const isFinancialPermitted =
        userRole === UserRole.ADMIN || userRole === UserRole.MANAGER;

      let financial: DashboardFinancialKpi | null = null;
      let financialVerificationStatus: string | undefined = undefined;
      let totalOrdersInPeriod = 0;

      // 1. Authoritative Financial Metrics (ADMIN & MANAGER only)
      if (isFinancialPermitted) {
        const reportSummary = await this.reportsService.getSummary(query);
        const verificationStatus =
          reportSummary.reconciliation?.independentVerification?.overallStatus;

        financialVerificationStatus = verificationStatus;

        if (verificationStatus === 'PASS') {
          financial = {
            grossSalesCents: reportSummary.kpi.grossSalesCents,
            netRevenueCents: reportSummary.kpi.netRevenueCents,
            completedRefundsCents: reportSummary.kpi.salesEligibleRefundsCents,
            paidOrdersCount: reportSummary.kpi.paidOrdersCount,
            averageOrderValueCents: reportSummary.kpi.averageOrderValueCents,
          };
          totalOrdersInPeriod = reportSummary.kpi.totalOrdersCount;
        } else {
          this.logger.warn(
            `Dashboard financial metrics unverified (status: ${verificationStatus}); omitting financial figures`
          );
          financial = null;
          // Count total orders directly if report was not verified
          totalOrdersInPeriod = await this.prisma.order.count({
            where: {
              createdAt: {
                gte: range.startUtc,
                lt: range.endExclusiveUtc,
              },
            },
          });
        }
      } else {
        // STAFF: Financial data strictly omitted
        totalOrdersInPeriod = await this.prisma.order.count({
          where: {
            createdAt: {
              gte: range.startUtc,
              lt: range.endExclusiveUtc,
            },
          },
        });
      }

      // 2. Pending Fulfillment Queue (Active non-terminal orders, independent of period filter)
      const pendingFulfillmentQueue = await this.prisma.order.count({
        where: {
          orderStatus: {
            notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
          },
        },
      });

      // 3. Inventory Low Stock Metrics (Variant-aware, strictly no double-counting)
      const [lowStockCountRaw, lowStockItemsRaw] = await Promise.all([
        this.prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS count
          FROM (
            SELECT p.id
            FROM "Product" p
            WHERE p."isActive" = true
              AND p."stockQuantity" <= p."lowStockThreshold"
              AND NOT EXISTS (
                SELECT 1 FROM "ProductVariant" v WHERE v."productId" = p.id AND v."isActive" = true
              )
            UNION ALL
            SELECT v.id
            FROM "ProductVariant" v
            JOIN "Product" p ON v."productId" = p.id
            WHERE v."isActive" = true
              AND p."isActive" = true
              AND v."stockQuantity" <= p."lowStockThreshold"
          ) combined
        `,
        this.prisma.$queryRaw<Array<{
          id: string;
          productId: string;
          name: string;
          sku: string;
          stockQuantity: number;
          lowStockThreshold: number;
          isVariant: boolean;
        }>>`
          SELECT id, "productId", name, sku, "stockQuantity", "lowStockThreshold", "isVariant"
          FROM (
            SELECT p.id, p.id AS "productId", p.name, p.sku, p."stockQuantity", p."lowStockThreshold", false AS "isVariant"
            FROM "Product" p
            WHERE p."isActive" = true
              AND p."stockQuantity" <= p."lowStockThreshold"
              AND NOT EXISTS (
                SELECT 1 FROM "ProductVariant" v WHERE v."productId" = p.id AND v."isActive" = true
              )
            UNION ALL
            SELECT v.id, p.id AS "productId", CONCAT(p.name, ' - ', v.name) AS name, v.sku, v."stockQuantity", p."lowStockThreshold", true AS "isVariant"
            FROM "ProductVariant" v
            JOIN "Product" p ON v."productId" = p.id
            WHERE v."isActive" = true
              AND p."isActive" = true
              AND v."stockQuantity" <= p."lowStockThreshold"
          ) combined
          ORDER BY "stockQuantity" ASC, name ASC, id ASC
          LIMIT 5
        `,
      ]);

      const lowStockSkuCount = Number(lowStockCountRaw[0]?.count || 0);
      const lowStockItems: LowStockItem[] = lowStockItemsRaw.map((row) => ({
        id: row.id,
        productId: row.productId,
        name: row.name,
        sku: row.sku,
        stockQuantity: Number(row.stockQuantity),
        lowStockThreshold: Number(row.lowStockThreshold),
        isVariant: Boolean(row.isVariant),
      }));

      // 4. Top Selling Products in Period (Sales-qualified: non-cancelled, captured payment)
      const topItems = await this.prisma.orderItem.groupBy({
        by: ['productId'],
        where: {
          order: {
            createdAt: {
              gte: range.startUtc,
              lt: range.endExclusiveUtc,
            },
            orderStatus: { not: OrderStatus.CANCELLED },
            paymentStatus: {
              in: [PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED],
            },
          },
        },
        _sum: {
          quantity: true,
        },
        orderBy: {
          _sum: {
            quantity: 'desc',
          },
        },
        take: 5,
      });

      let topSellingProducts: TopSellingProduct[] = [];
      if (topItems.length > 0) {
        const productIds = topItems.map((item) => item.productId);
        const products = await this.prisma.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            name: true,
            sku: true,
            images: true,
            priceCents: true,
          },
        });

        const productMap = new Map(products.map((p) => [p.id, p]));

        topSellingProducts = topItems
          .map((item) => {
            const prod = productMap.get(item.productId);
            if (!prod) return null;
            return {
              productId: prod.id,
              name: prod.name,
              sku: prod.sku,
              image: prod.images && prod.images.length > 0 ? prod.images[0] : null,
              priceCents: prod.priceCents,
              unitsSold: item._sum.quantity || 0,
            };
          })
          .filter((p): p is TopSellingProduct => p !== null);
      }

      // 5. Recent Orders (Deterministic ordering by createdAt DESC, id DESC)
      const recentOrdersRaw = await this.prisma.order.findMany({
        take: 5,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          orderStatus: true,
          paymentStatus: true,
          totalCents: true,
          createdAt: true,
        },
      });

      const recentOrders: DashboardRecentOrder[] = recentOrdersRaw.map((o) => {
        const orderData: DashboardRecentOrder = {
          id: o.id,
          orderNumber: o.orderNumber,
          customerName: o.customerName || 'Customer',
          orderStatus: o.orderStatus,
          paymentStatus: o.paymentStatus,
          createdAt: o.createdAt.toISOString(),
          createdAtColombo: formatColomboDateTime(o.createdAt),
        };

        // For ADMIN & MANAGER include totalCents, omit for STAFF
        if (isFinancialPermitted) {
          orderData.totalCents = o.totalCents;
        }

        return orderData;
      });

      return {
        period: range.period,
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        timezone: 'Asia/Colombo',
        userRole,
        ...(financial !== null ? { financial } : { financial: null }),
        ...(financialVerificationStatus ? { financialVerificationStatus } : {}),
        orders: {
          totalOrdersInPeriod,
          pendingFulfillmentQueue,
        },
        inventory: {
          lowStockSkuCount,
          lowStockItems,
        },
        topSellingProducts,
        recentOrders,
      };
    } catch (err: any) {
      this.logger.error('Failed to load executive dashboard KPIs:', err);
      throw err;
    }
  }
}
