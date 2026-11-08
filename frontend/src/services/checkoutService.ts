import { apiClient, BackendApiResponse } from '@/lib/api/apiClient';
import { ShippingAddress, PaymentMethod } from '@/types/order';

export interface ReservationItem {
  id: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
  stockQuantity: number;
}

export interface ReservationResponse {
  reservationId: string;
  status: 'ACTIVE' | 'CONSUMED' | 'EXPIRED' | 'RELEASED' | 'PAYMENT_PENDING';
  expiresAt: string;
  expiresInSeconds: number;
  isExpired?: boolean;
  stockAvailable?: boolean;
  message?: string;
  unavailableItems?: Array<{
    productId: string;
    variantId: string | null;
    productName: string;
    requestedQuantity: number;
    availableQuantity: number;
  }>;
  items: ReservationItem[];
}

export interface PackSelectionItem {
  productId: string;
  variantId?: string | null;
  packId: string;
}

export interface AuthoritativeTotals {
  subtotalCents: number;
  bundleDiscountCents?: number;
  voucherDiscountCents?: number;
  discountCents: number;
  deliveryCents: number;
  totalCents: number;
  freeDeliveryThresholdCents: number;
  isFreeDelivery: boolean;
  schoolPacksSnapshot?: Array<{
    packId: string;
    packName: string;
    savingsPercentage: number;
    componentCount: number;
    bundleSubtotalCents: number;
    bundleDiscountCents: number;
    items: Array<{
      productId: string;
      variantId?: string | null;
      productName: string;
      variantName?: string | null;
      unitPriceCents: number;
      quantity: number;
      lineSubtotalCents: number;
      lineDiscountCents: number;
    }>;
  }>;
  voucherApplied?: {
    code: string;
    discountType: string;
    discountValue: number;
    isFreeDelivery?: boolean;
  };
}

export interface PrePayValidationResult {
  isValid: boolean;
  reservationId: string;
  paymentAttemptId: string;
  idempotencyKey: string;
  totals: AuthoritativeTotals;
  payHerePayload?: Record<string, any> | null;
}

export interface ProcessPaymentPayload {
  reservationId: string;
  deliveryAddress: ShippingAddress;
  paymentMethod: PaymentMethod;
  voucherCode?: string | null;
  idempotencyKey: string;
  paymentData?: Record<string, any> | null;
  packSelections?: PackSelectionItem[] | null;
}

export interface ProcessPaymentResult {
  order: any;
  isDuplicate: boolean;
}

class CheckoutService {
  /**
   * Creates an all-or-nothing 10-minute stock reservation.
   */
  async createReservation(params: {
    items: Array<{ productId: string; variantId?: string | null; quantity: number; packId?: string | null }>;
    sessionId?: string | null;
    idempotencyKey?: string | null;
  }): Promise<ReservationResponse> {
    const res = await apiClient.post<BackendApiResponse<ReservationResponse>>(
      '/checkout/reserve',
      params
    );
    if (!res?.data?.reservationId) {
      throw new Error(res?.message || 'Failed to create stock reservation');
    }
    return res.data;
  }

  /**
   * Renews an expiring or expired reservation if stock is still available.
   */
  async renewReservation(reservationId: string): Promise<ReservationResponse> {
    const res = await apiClient.post<BackendApiResponse<ReservationResponse>>(
      `/checkout/reserve/${reservationId}/renew`,
      {}
    );
    if (!res?.data?.reservationId) {
      throw new Error(res?.message || 'Failed to renew stock reservation');
    }
    return res.data;
  }

  /**
   * Rechecks live stock availability for an expired reservation (Phase C).
   */
  async checkExpiredStock(reservationId: string): Promise<ReservationResponse> {
    const res = await apiClient.get<BackendApiResponse<ReservationResponse>>(
      `/checkout/reserve/${reservationId}/check-stock`
    );
    if (!res?.data?.reservationId) {
      throw new Error(res?.message || 'Failed to recheck stock for reservation');
    }
    return res.data;
  }

  /**
   * Cancels payment attempt and releases PAYMENT_PENDING allocation immediately.
   */
  async cancelPayment(reservationId: string): Promise<void> {
    await apiClient.post('/checkout/payment-cancel', { reservationId });
  }

  /**
   * MANDATORY VALIDATION WHEN PAY IS CLICKED (Phase 10)
   * Validates active reservation, revalidates prices against PostgreSQL,
   * calculates authoritative delivery and discount totals, and prepares payment attempt.
   */
  async validatePrePay(params: {
    reservationId: string;
    deliveryAddress: ShippingAddress;
    paymentMethod: PaymentMethod;
    voucherCode?: string | null;
    idempotencyKey?: string | null;
    packSelections?: PackSelectionItem[] | null;
  }): Promise<PrePayValidationResult> {
    const res = await apiClient.post<BackendApiResponse<PrePayValidationResult>>(
      '/checkout/validate-pay',
      params
    );
    if (!res?.data?.isValid) {
      throw new Error(res?.message || 'Pre-payment validation failed');
    }
    return res.data;
  }

  /**
   * Process and finalize payment transactionally (Phase 11).
   */
  async processPayment(params: ProcessPaymentPayload): Promise<ProcessPaymentResult> {
    const res = await apiClient.post<BackendApiResponse<ProcessPaymentResult>>(
      '/checkout/pay',
      params
    );
    if (!res?.data?.order) {
      throw new Error(res?.message || 'Failed to process payment and confirm order');
    }
    return res.data;
  }

  /**
   * Fetch live stock breakdown (physical, reserved, available) for a product.
   */
  async fetchLiveStock(productId: string, variantId?: string | null): Promise<{
    productId: string;
    variantId: string | null;
    physicalStock: number;
    reservedStock: number;
    availableStock: number;
  }> {
    const query = variantId ? `?variantId=${encodeURIComponent(variantId)}` : '';
    const res = await apiClient.get<BackendApiResponse<any>>(
      `/public/inventory/product/${productId}/status${query}`
    );
    return res.data;
  }

  /**
   * Reconciles authoritative payment status for an order or attempt.
   */
  async reconcilePaymentStatus(idOrNumber: string): Promise<{
    orderId: string | null;
    orderNumber: string | null;
    orderStatus: string | null;
    paymentStatus: string;
    isConfirmed: boolean;
    paymentAttempt?: any;
  }> {
    const res = await apiClient.get<BackendApiResponse<any>>(
      `/checkout/status/${encodeURIComponent(idOrNumber)}`
    );
    return res.data;
  }
}

export const checkoutService = new CheckoutService();

