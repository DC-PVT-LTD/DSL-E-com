import {
  Order,
  OrderStatus,
  PaymentStatus,
  ShippingAddress,
  PaymentMethod,
  OrderStats,
  OrderAuditEntry,
  OrderReturnRequest,
  OrderAdminNote,
  OrderQueryParams,
  OrderListResult,
  BuyAgainResponse,
} from '@/types/order';
import { CartItem } from '@/types/cart';
import { INITIAL_ORDERS } from '@/mocks/customers';
import { productService } from './productService';
import { apiClient, BackendApiResponse, BackendPaginatedResponse } from '@/lib/api/apiClient';

const ORDERS_STORAGE_KEY = 'dsl_orders_data_v1';

// Permitted status transitions map (supports both uppercase and lowercase)
export const PERMITTED_ORDER_TRANSITIONS: Record<string, string[]> = {
  // Uppercase (authoritative backend)
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
  // Lowercase (legacy/mock compatibility)
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export function normalizeOrderStatus(status: string | undefined): string {
  if (!status) return 'PENDING';
  return status.toUpperCase();
}

export function normalizePaymentStatus(status: string | undefined): string {
  if (!status) return 'PENDING';
  const upper = status.toUpperCase();
  if (upper === 'SIMULATED_PAID' || upper === 'PAID') return 'PAID';
  return upper;
}

class OrderService {
  private orders: Order[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.initData();
  }

  private initData() {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(ORDERS_STORAGE_KEY);
        if (stored) {
          this.orders = JSON.parse(stored);
          return;
        }
      } catch (err) {
        console.error('Error loading orders:', err);
      }
    }
    this.orders = [...INITIAL_ORDERS];
  }

  private persistAndNotify() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(this.orders));
      } catch (err) {
        console.error('Error saving orders:', err);
      }
    }
    this.listeners.forEach((listener) => listener());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public resetToDefault(): void {
    this.orders = [...INITIAL_ORDERS];
    this.persistAndNotify();
  }

  public getAll(): Order[] {
    return [...this.orders];
  }

  public getById(id: string): Order | undefined {
    return this.orders.find((o) => o.id === id || o.orderNumber === id);
  }

  /**
   * Normalizes raw backend order object to UI order structure
   */
  private normalizeOrder(raw: any): Order {
    const address = raw.addressSnapshot || raw.shippingAddress || {
      fullName: raw.customerName || 'Customer',
      phone: raw.customerPhone || '',
      email: raw.customerEmail || '',
      addressLine1: 'N/A',
      city: 'Colombo',
      district: 'Colombo',
    };

    const items = Array.isArray(raw.items)
      ? raw.items.map((it: any) => ({
          id: it.id,
          productId: it.productId,
          productName: it.productName || it.product?.name || 'Stationery Item',
          variantName: it.variantName || it.variant?.name || null,
          sku: it.sku || it.product?.sku || 'SKU-DSL',
          unitPriceCents: it.unitPriceCents || 0,
          quantity: it.quantity || 1,
          totalPriceCents: it.totalPriceCents || (it.unitPriceCents || 0) * (it.quantity || 1),
          product: it.product || {
            id: it.productId,
            name: it.productName || 'Stationery Item',
            images: it.product?.images || [],
            sku: it.sku || 'SKU-DSL',
          },
          variant: it.variant || null,
        }))
      : [];

    return {
      id: raw.id,
      orderNumber: raw.orderNumber || raw.id,
      userId: raw.userId || null,
      customerName: raw.customerName || address.fullName || 'Customer',
      customerEmail: raw.customerEmail || address.email || '',
      customerPhone: raw.customerPhone || address.phone || '',
      shippingAddress: {
        fullName: address.fullName || raw.customerName || 'Customer',
        phone: address.phone || raw.customerPhone || '',
        email: address.email || raw.customerEmail || '',
        addressLine1: address.addressLine1 || '',
        addressLine2: address.addressLine2 || '',
        city: address.city || '',
        district: address.district || 'Colombo',
        postalCode: address.postalCode || '',
        province: address.province || '',
        deliveryNotes: address.deliveryNotes || '',
      },
      addressSnapshot: address,
      items,
      subtotalCents: raw.subtotalCents ?? 0,
      discountCents: raw.discountCents ?? 0,
      deliveryCents: raw.deliveryCents ?? 0,
      totalCents: raw.totalCents ?? 0,
      paymentMethod: raw.paymentMethod || 'CASH_ON_DELIVERY',
      paymentStatus: raw.paymentStatus || 'PENDING',
      orderStatus: raw.orderStatus || 'PENDING',
      notes: raw.notes || null,
      customerNotes: raw.customerNotes || null,
      schoolPacksSnapshot: raw.schoolPacksSnapshot || null,
      trackingNumber: raw.trackingNumber || null,
      estimatedDeliveryDate: raw.estimatedDeliveryDate || null,
      paymentAttempts: Array.isArray(raw.paymentAttempts) ? raw.paymentAttempts : [],
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || new Date().toISOString(),
    };
  }

  /**
   * Fetch paginated orders from backend API with server-side filters and fallback
   */
  public async fetchOrders(params: OrderQueryParams = {}): Promise<OrderListResult> {
    const queryParams: Record<string, any> = {
      page: params.page || 1,
      limit: params.limit || 20,
    };

    if (params.status && params.status !== 'all' && params.status !== 'ALL') {
      queryParams.status = params.status.toUpperCase();
    }
    if (params.search && params.search.trim()) {
      queryParams.search = params.search.trim();
    }
    if (params.paymentStatus && params.paymentStatus !== 'all' && params.paymentStatus !== 'ALL') {
      queryParams.paymentStatus = params.paymentStatus.toUpperCase();
    }
    if (params.startDate) {
      queryParams.startDate = params.startDate;
    }
    if (params.endDate) {
      queryParams.endDate = params.endDate;
    }
    if (params.sortBy) {
      queryParams.sortBy = params.sortBy;
      queryParams.sortOrder = params.sortOrder || 'desc';
    }

    try {
      const res = await apiClient.get<any>('/admin/orders', { params: queryParams });
      
      let rawList: any[] = [];
      let total = 0;
      let totalPages = 1;

      if (res && res.data) {
        if (Array.isArray(res.data.orders)) {
          rawList = res.data.orders;
          total = res.data.total ?? rawList.length;
          totalPages = res.data.totalPages ?? Math.ceil(total / (params.limit || 20));
        } else if (Array.isArray(res.data)) {
          rawList = res.data;
          total = res.meta?.totalItems ?? rawList.length;
          totalPages = res.meta?.totalPages ?? Math.ceil(total / (params.limit || 20));
        }
      } else if (Array.isArray(res)) {
        rawList = res;
        total = rawList.length;
        totalPages = Math.ceil(total / (params.limit || 20));
      }

      if (rawList.length > 0 || (res && res.data && res.data.orders !== undefined)) {
        const normalizedOrders = rawList.map((o) => this.normalizeOrder(o));
        return {
          orders: normalizedOrders,
          total,
          page: params.page || 1,
          limit: params.limit || 20,
          totalPages: Math.max(1, totalPages),
          hasNextPage: (params.page || 1) < totalPages,
          hasPreviousPage: (params.page || 1) > 1,
        };
      }
    } catch (err) {
      console.warn('Failed to fetch orders from admin server API, checking store fallback:', err);
    }

    // Local fallback for offline/development resilience
    let filtered = [...this.orders];

    if (params.status && params.status !== 'all' && params.status !== 'ALL') {
      const s = params.status.toLowerCase();
      filtered = filtered.filter((o) => o.orderStatus.toLowerCase() === s);
    }
    if (params.paymentStatus && params.paymentStatus !== 'all' && params.paymentStatus !== 'ALL') {
      const ps = params.paymentStatus.toLowerCase();
      filtered = filtered.filter((o) => {
        const oPay = o.paymentStatus.toLowerCase();
        if (ps === 'paid' && (oPay === 'paid' || oPay === 'simulated_paid')) return true;
        return oPay === ps;
      });
    }
    if (params.search && params.search.trim()) {
      const q = params.search.toLowerCase().trim();
      filtered = filtered.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerEmail.toLowerCase().includes(q) ||
          o.customerPhone.toLowerCase().includes(q)
      );
    }
    if (params.startDate) {
      const start = new Date(params.startDate).getTime();
      filtered = filtered.filter((o) => new Date(o.createdAt).getTime() >= start);
    }
    if (params.endDate) {
      const end = new Date(params.endDate).getTime() + 86400000;
      filtered = filtered.filter((o) => new Date(o.createdAt).getTime() <= end);
    }

    if (params.sortBy === 'totalCents') {
      filtered.sort((a, b) =>
        params.sortOrder === 'asc' ? a.totalCents - b.totalCents : b.totalCents - a.totalCents
      );
    } else {
      filtered.sort((a, b) =>
        params.sortOrder === 'asc'
          ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    const page = params.page || 1;
    const limit = params.limit || 20;
    const startIndex = (page - 1) * limit;
    const paged = filtered.slice(startIndex, startIndex + limit);
    const totalPages = Math.ceil(filtered.length / limit) || 1;

    return {
      orders: paged,
      total: filtered.length,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  /**
   * Fetch order details by ID or orderNumber from backend API.
   * Supports staff/customer session cookies or guest signed tracking token / email.
   */
  public async fetchOrderById(id: string, tokenOrEmail?: string): Promise<Order | undefined> {
    try {
      // 1. Try Admin API first if admin is authenticated
      const resAdmin = await apiClient
        .get<BackendApiResponse<any>>(`/admin/orders/${id}`)
        .catch(() => null);
      if (resAdmin?.data) {
        return this.normalizeOrder(resAdmin.data);
      }

      // 2. Try customer/guest orders endpoint
      const headers: Record<string, string> = {};
      const params: Record<string, string> = {};

      // Check if session storage or argument contains tracking token
      let trackingToken: string | null = null;
      if (typeof window !== 'undefined') {
        trackingToken =
          sessionStorage.getItem(`order_token_${id}`) ||
          sessionStorage.getItem(`last_tracking_token`) ||
          null;
      }

      if (tokenOrEmail && tokenOrEmail.includes('.')) {
        trackingToken = tokenOrEmail;
      }

      if (trackingToken) {
        headers['x-tracking-token'] = trackingToken;
        params['token'] = trackingToken;
      }

      const res = await apiClient.get<BackendApiResponse<any>>(`/orders/${id}`, { headers, params });
      if (res?.data) {
        return this.normalizeOrder(res.data);
      }
    } catch (err: any) {
      if (err?.response?.status === 403 || err?.status === 403) {
        throw err;
      }
      console.warn(`Failed to fetch order ${id} from server:`, err);
    }
    return this.getById(id);
  }

  /**
   * Phase B.1: Requests a 6-digit OTP sent to customerEmail to access guest order details.
   */
  public async requestTrackingOtp(
    idOrNumber: string,
    email: string
  ): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.post<BackendApiResponse<{ success: boolean; message: string }>>(
      `/orders/${idOrNumber}/tracking-otp`,
      { email }
    );
    return res.data || { success: true, message: res.message || 'Verification code sent.' };
  }

  /**
   * Phase B.1: Verifies 6-digit OTP and retrieves signed tracking token.
   */
  public async verifyTrackingOtp(
    idOrNumber: string,
    email: string,
    otp: string
  ): Promise<{ success: boolean; trackingToken: string; orderId: string; orderNumber: string }> {
    const res = await apiClient.post<
      BackendApiResponse<{ success: boolean; trackingToken: string; orderId: string; orderNumber: string }>
    >(`/orders/${idOrNumber}/verify-tracking-otp`, { email, otp });

    if (res?.data?.trackingToken && typeof window !== 'undefined') {
      sessionStorage.setItem(`order_token_${res.data.orderId}`, res.data.trackingToken);
      sessionStorage.setItem(`order_token_${res.data.orderNumber}`, res.data.trackingToken);
      sessionStorage.setItem('last_tracking_token', res.data.trackingToken);
    }

    return res.data;
  }

  /**
   * Phase 15.3: Reorders products from previous order.
   * Evaluates live catalog, stock availability, variants and bundles on the server.
   */
  public async buyAgain(orderId: string): Promise<BuyAgainResponse> {
    const res = await apiClient.post<BackendApiResponse<BuyAgainResponse>>(
      `/orders/${orderId}/buy-again`
    );
    if (!res?.data) {
      throw new Error(res?.message || 'Failed to evaluate products for reorder');
    }
    return res.data;
  }

  /**
   * Fetch aggregate order statistics for the Admin Dashboard
   */
  public async fetchOrderStats(): Promise<OrderStats> {
    try {
      const res = await apiClient.get<BackendApiResponse<OrderStats>>('/admin/orders/stats');
      if (res?.data) {
        return res.data;
      }
    } catch {
      // Backend statistics endpoint pending - calculate from orders listing
    }

    try {
      const resList = await this.fetchOrders({ limit: 100 });
      const list = resList.orders;
      const stats: OrderStats = {
        total: resList.total || list.length,
        pending: 0,
        confirmed: 0,
        processing: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0,
        totalRevenueCents: 0,
      };

      list.forEach((order) => {
        const s = order.orderStatus.toLowerCase();
        if (s === 'pending') stats.pending += 1;
        else if (s === 'confirmed') stats.confirmed += 1;
        else if (s === 'processing') stats.processing += 1;
        else if (s === 'shipped') stats.shipped += 1;
        else if (s === 'delivered') stats.delivered += 1;
        else if (s === 'cancelled') stats.cancelled += 1;

        if (s !== 'cancelled') {
          stats.totalRevenueCents = (stats.totalRevenueCents || 0) + order.totalCents;
        }
      });

      return stats;
    } catch {
      return {
        total: 0,
        pending: 0,
        confirmed: 0,
        processing: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0,
        totalRevenueCents: 0,
      };
    }
  }

  /**
   * Transitions order status via real backend API PATCH /api/v1/admin/orders/:id/status
   */
  public async transitionStatusApi(
    id: string,
    dto: { status: OrderStatus; trackingNumber?: string | null; notes?: string | null; reason?: string }
  ): Promise<{ success: boolean; data?: Order; error?: string }> {
    try {
      const targetStatus = dto.status.toUpperCase();
      let res: any;
      try {
        res = await apiClient.patch<BackendApiResponse<any>>(`/admin/orders/${id}/status`, {
          status: targetStatus,
          trackingNumber: dto.trackingNumber,
          notes: dto.notes,
          reason: dto.reason,
        });
      } catch {
        res = await apiClient.patch<BackendApiResponse<any>>(`/orders/${id}/status`, {
          status: targetStatus,
          trackingNumber: dto.trackingNumber,
          notes: dto.notes,
        });
      }

      if (res?.data) {
        const updated = this.normalizeOrder(res.data);
        // Sync local cache
        const idx = this.orders.findIndex((o) => o.id === id || o.orderNumber === id);
        if (idx >= 0) {
          this.orders[idx] = updated;
          this.persistAndNotify();
        }
        return { success: true, data: updated };
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to update order status on server';
      return { success: false, error: msg };
    }

    // Local fallback for offline/test environments
    const success = this.updateOrderStatus(id, dto.status);
    const updated = this.getById(id);
    return { success, data: updated, error: success ? undefined : 'Transition not permitted' };
  }

  /**
   * Cancel order via backend API
   */
  public async cancelOrderApi(
    orderId: string,
    data: { reason: string; restoreInventory?: boolean; processRefund?: boolean }
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await apiClient.post<BackendApiResponse<any>>(`/admin/orders/${orderId}/cancel`, data);
      if (res?.data) {
        const normalized = this.normalizeOrder(res.data);
        const idx = this.orders.findIndex((o) => o.id === orderId || o.orderNumber === orderId);
        if (idx >= 0) {
          this.orders[idx] = normalized;
          this.persistAndNotify();
        }
        return { success: true, data: normalized };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to cancel order' };
    }
    return { success: false, error: 'Unexpected response' };
  }

  /**
   * Process refund via backend API
   */
  public async processRefundApi(
    orderId: string,
    data: { amountCents: number; method: string; reference?: string; reason: string }
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await apiClient.post<BackendApiResponse<any>>(`/admin/orders/${orderId}/refund`, data);
      if (res?.data) {
        return { success: true, data: res.data };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to process refund' };
    }
    return { success: false, error: 'Unexpected response' };
  }

  /**
   * Create return request via backend API
   */
  public async createReturnApi(
    orderId: string,
    data: { reason: string; items: Array<{ orderItemId: string; quantity: number; reason: string }> }
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await apiClient.post<BackendApiResponse<any>>(`/admin/orders/${orderId}/returns`, data);
      if (res?.data) {
        return { success: true, data: res.data };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to create return request' };
    }
    return { success: false, error: 'Unexpected response' };
  }

  /**
   * Update customer information
   */
  public async updateCustomerInfo(
    orderId: string,
    data: { customerName: string; customerEmail: string; customerPhone: string }
  ): Promise<{ success: boolean; data?: any; error?: string; isBackendPending?: boolean }> {
    try {
      const res = await apiClient.patch<BackendApiResponse<any>>(`/admin/orders/${orderId}/customer`, data);
      if (res?.data) {
        return { success: true, data: res.data };
      }
    } catch (err: any) {
      if (err?.status === 404 || err?.status === 501) {
        // Backend API not yet implemented by backend developer
        return {
          success: false,
          isBackendPending: true,
          error: 'Backend API [PATCH /api/v1/admin/orders/:id/customer] is currently being implemented by backend developer (documented in PHASE_11_BACKEND_API_REQUIREMENTS.md).',
        };
      }
      return { success: false, error: err?.message || 'Failed to update customer info' };
    }
    return { success: false, error: 'Unexpected response' };
  }

  /**
   * Update delivery information
   */
  public async updateDeliveryInfo(
    orderId: string,
    data: Partial<ShippingAddress>
  ): Promise<{ success: boolean; data?: any; error?: string; isBackendPending?: boolean }> {
    try {
      const res = await apiClient.patch<BackendApiResponse<any>>(`/admin/orders/${orderId}/delivery`, data);
      if (res?.data) {
        return { success: true, data: res.data };
      }
    } catch (err: any) {
      if (err?.status === 404 || err?.status === 501) {
        return {
          success: false,
          isBackendPending: true,
          error: 'Backend API [PATCH /api/v1/admin/orders/:id/delivery] is currently being implemented by backend developer (documented in PHASE_11_BACKEND_API_REQUIREMENTS.md).',
        };
      }
      return { success: false, error: err?.message || 'Failed to update delivery info' };
    }
    return { success: false, error: 'Unexpected response' };
  }

  /**
   * Update order items and recalculate totals
   */
  public async updateOrderItems(
    orderId: string,
    items: Array<{ productId: string; variantId?: string | null; quantity: number }>,
    reason?: string
  ): Promise<{ success: boolean; data?: any; error?: string; isBackendPending?: boolean }> {
    try {
      const res = await apiClient.patch<BackendApiResponse<any>>(`/admin/orders/${orderId}/items`, {
        items,
        reason,
      });
      if (res?.data) {
        return { success: true, data: res.data };
      }
    } catch (err: any) {
      if (err?.status === 404 || err?.status === 501) {
        return {
          success: false,
          isBackendPending: true,
          error: 'Backend API [PATCH /api/v1/admin/orders/:id/items] is currently being implemented by backend developer (documented in PHASE_11_BACKEND_API_REQUIREMENTS.md).',
        };
      }
      return { success: false, error: err?.message || 'Failed to update order items' };
    }
    return { success: false, error: 'Unexpected response' };
  }

  /**
   * Fetch Return Requests for order
   */
  public async fetchOrderReturns(orderId: string): Promise<OrderReturnRequest[]> {
    try {
      const res = await apiClient.get<BackendApiResponse<OrderReturnRequest[]>>(`/admin/orders/${orderId}/returns`);
      if (res?.data && Array.isArray(res.data)) {
        return res.data;
      }
    } catch {
      // Missing backend returns endpoint
    }
    return [];
  }

  /**
   * Process return action (approve / reject / confirm received)
   */
  public async processReturnAction(
    orderId: string,
    returnId: string,
    action: 'APPROVE' | 'REJECT' | 'CONFIRM_RECEIVED',
    reason?: string
  ): Promise<{ success: boolean; error?: string; isBackendPending?: boolean }> {
    try {
      await apiClient.patch(`/admin/orders/${orderId}/returns/${returnId}/status`, {
        action,
        reason,
      });
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        isBackendPending: err?.status === 404 || err?.status === 501,
        error: err?.message || 'Failed to process return request',
      };
    }
  }

  /**
   * Fetch audit history
   */
  public async fetchOrderAuditHistory(orderId: string): Promise<OrderAuditEntry[]> {
    try {
      const res = await apiClient.get<BackendApiResponse<OrderAuditEntry[]>>(
        `/admin/orders/${orderId}/audit-history`
      );
      if (res?.data && Array.isArray(res.data)) {
        return res.data;
      }
    } catch {
      // Backend audit log endpoint pending
    }
    return [];
  }

  /**
   * Add internal staff note
   */
  public async addAdminNote(
    orderId: string,
    note: string,
    isInternal = true
  ): Promise<{ success: boolean; data?: any; error?: string; isBackendPending?: boolean }> {
    try {
      const res = await apiClient.post<BackendApiResponse<any>>(`/admin/orders/${orderId}/notes`, {
        note,
        isInternal,
      });
      if (res?.data) {
        return { success: true, data: res.data };
      }
    } catch (err: any) {
      return {
        success: false,
        isBackendPending: err?.status === 404 || err?.status === 501,
        error: err?.message || 'Failed to save admin note',
      };
    }
    return { success: false, error: 'Unexpected response' };
  }

  // --- Local / Mock helper methods preserved for backward compatibility ---

  public createOrder(params: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    shippingAddress: ShippingAddress;
    items: CartItem[];
    subtotalCents: number;
    discountCents: number;
    deliveryCents: number;
    totalCents: number;
    paymentMethod: PaymentMethod;
    notes?: string;
  }): Order {
    const orderNumber = `DSL-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber,
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      customerPhone: params.customerPhone,
      shippingAddress: params.shippingAddress,
      items: params.items,
      subtotalCents: params.subtotalCents,
      discountCents: params.discountCents,
      deliveryCents: params.deliveryCents,
      totalCents: params.totalCents,
      paymentMethod: params.paymentMethod,
      paymentStatus: params.paymentMethod === 'cash_on_delivery' || params.paymentMethod === 'CASH_ON_DELIVERY' ? 'pending' : 'simulated_paid',
      orderStatus: 'confirmed',
      notes: params.notes,
      trackingNumber: `DSL-EXP-${Math.floor(10000 + Math.random() * 89999)}`,
      estimatedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    params.items.forEach((item) => {
      productService.adjustStock(item.productId, -item.quantity);
    });

    this.orders.unshift(newOrder);
    this.persistAndNotify();
    return newOrder;
  }

  public updateOrderStatus(id: string, newStatus: OrderStatus): boolean {
    const order = this.orders.find((o) => o.id === id || o.orderNumber === id);
    if (!order) return false;

    const allowed = PERMITTED_ORDER_TRANSITIONS[order.orderStatus] || [];
    const target = newStatus;
    const isAllowed =
      allowed.includes(target) ||
      allowed.map((s) => s.toLowerCase()).includes(target.toLowerCase());

    if (!isAllowed) {
      console.warn(`Transition from ${order.orderStatus} to ${newStatus} is not permitted.`);
      return false;
    }

    order.orderStatus = newStatus;
    order.updatedAt = new Date().toISOString();

    if (newStatus.toLowerCase() === 'cancelled') {
      order.items.forEach((item: any) => {
        if (item.productId) {
          productService.adjustStock(item.productId, item.quantity);
        }
      });
      if (order.paymentStatus === 'simulated_paid' || order.paymentStatus === 'PAID') {
        order.paymentStatus = 'refunded';
      }
    }

    this.persistAndNotify();
    return true;
  }

  public updatePaymentStatus(id: string, paymentStatus: PaymentStatus): boolean {
    const order = this.orders.find((o) => o.id === id || o.orderNumber === id);
    if (!order) return false;

    order.paymentStatus = paymentStatus;
    order.updatedAt = new Date().toISOString();
    this.persistAndNotify();
    return true;
  }
}

export const orderService = new OrderService();
