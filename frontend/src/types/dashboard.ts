import { OrderStatus, PaymentStatus } from './order';
import { ReportPeriod } from './report';

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
  orderStatus: OrderStatus | string;
  paymentStatus: PaymentStatus | string;
  totalCents?: number;
  createdAt: string;
  createdAtColombo: string;
}

export interface DashboardKpisResponse {
  period: ReportPeriod;
  dateFrom: string;
  dateTo: string;
  timezone: 'Asia/Colombo';
  userRole: string;
  financial?: DashboardFinancialKpi | null;
  financialVerificationStatus?: string;
  orders: DashboardOrderKpi;
  inventory: DashboardInventoryKpi;
  topSellingProducts: TopSellingProduct[];
  recentOrders: DashboardRecentOrder[];
}

export interface DashboardQueryFilters {
  period?: ReportPeriod;
  dateFrom?: string;
  dateTo?: string;
}
