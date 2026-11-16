import { OrderStatus, PaymentStatus, UserRole } from '../../../generated/prisma';
import { ReportPeriod } from '../../reports/dto/report-query.dto';

export {
  reportPeriodEnum,
  ReportPeriod,
  isValidCalendarDate,
  reportQuerySchema,
  ReportQueryDto,
} from '../../reports/dto/report-query.dto';

export interface DashboardFinancialKpi {
  grossSalesCents: number;
  netRevenueCents: number;
  completedRefundsCents: number;
  paidOrdersCount: number;
  averageOrderValueCents: number;
}

export interface DashboardOrderKpi {
  totalOrdersInPeriod: number;
  pendingFulfillmentQueue: number;
}

export interface LowStockItem {
  id: string;
  productId: string;
  name: string;
  sku: string;
  stockQuantity: number;
  lowStockThreshold: number;
  isVariant: boolean;
}

export interface DashboardInventoryKpi {
  lowStockSkuCount: number;
  lowStockItems: LowStockItem[];
}

export interface TopSellingProduct {
  productId: string;
  name: string;
  sku: string;
  image: string | null;
  priceCents: number;
  unitsSold: number;
}

export interface DashboardRecentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  totalCents?: number;
  createdAt: string;
  createdAtColombo: string;
}

export interface DashboardKpisResponse {
  period: ReportPeriod;
  dateFrom: string;
  dateTo: string;
  timezone: 'Asia/Colombo';
  userRole: UserRole;
  financial?: DashboardFinancialKpi | null;
  financialVerificationStatus?: string;
  orders: DashboardOrderKpi;
  inventory: DashboardInventoryKpi;
  topSellingProducts: TopSellingProduct[];
  recentOrders: DashboardRecentOrder[];
}
