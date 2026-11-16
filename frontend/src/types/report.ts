export type ReportPeriod = 'today' | 'last7days' | 'last30days' | 'custom';
export type ExportFormat = 'csv' | 'xlsx';

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
  cohortDescription?: string;
  asOfTimestamp?: string;
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
  grossSalesCheck?: {
    status: 'PASS' | 'MISMATCH';
    sharedValueCents: number;
    independentValueCents: number;
    differenceCents: number;
  };
  salesRefundsCheck?: {
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
  netRevenueCheck?: {
    status: 'PASS' | 'MISMATCH';
    sharedValueCents: number;
    independentValueCents: number;
    differenceCents: number;
  };
  cancelledCohortCheck?: {
    status: 'PASS' | 'MISMATCH';
    sharedCapturedCents: number;
    independentCapturedCents: number;
    sharedRefundedCents: number;
    independentRefundedCents: number;
    sharedOutstandingCents: number;
    independentOutstandingCents: number;
  };
  integrityChecks?: {
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
  independentVerification?: IndependentReconciliationResult;
  inconsistencies: ReportInconsistency[];
}

export interface PaymentMethodMetric {
  method: string;
  name: string;
  count: number;
  totalCents: number;
  percentage: number;
}

export interface OrderStatusMetric {
  status: string;
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
  customerEmail?: string;
  customerPhone?: string;
  totalCents: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  createdAt: string;
  createdAtFormatted?: string;
  district: string;
  refundedAmountCents?: number;
}

export interface ReportSummaryResponse {
  period: ReportPeriod;
  dateFrom: string;
  dateTo: string;
  timezone: string;
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

export interface ReportQueryFilters {
  period?: ReportPeriod;
  dateFrom?: string;
  dateTo?: string;
  format?: ExportFormat;
}
