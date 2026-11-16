import { describe, it, expect, beforeEach, vi } from 'vitest';
import { orderService } from '../orderService';
import { productService } from '../productService';
import { apiClient } from '@/lib/api/apiClient';

describe('orderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    orderService.resetToDefault();
  });

  it('enforces permitted order status transitions', () => {
    const product = productService.getAll()[0];
    const newOrder = orderService.createOrder({
      customerName: 'Transition Test',
      customerEmail: 'transition@example.lk',
      customerPhone: '+94 77 111 2222',
      shippingAddress: {
        fullName: 'Transition Test',
        phone: '+94 77 111 2222',
        email: 'transition@example.lk',
        addressLine1: '45 Galle Rd',
        city: 'Colombo',
        district: 'Colombo',
      },
      items: [
        {
          id: product.id,
          productId: product.id,
          product,
          quantity: 1,
          unitPriceCents: product.priceCents,
          totalPriceCents: product.priceCents,
        },
      ],
      subtotalCents: product.priceCents,
      discountCents: 0,
      deliveryCents: 35000,
      totalCents: product.priceCents + 35000,
      paymentMethod: 'cash_on_delivery',
    });

    // Created order starts in 'confirmed' status
    expect(newOrder.orderStatus).toBe('confirmed');

    // Transitioning confirmed -> processing is allowed
    const valid = orderService.updateOrderStatus(newOrder.id, 'processing');
    expect(valid).toBe(true);

    // Transitioning processing -> delivered directly is NOT allowed (must go to packed first)
    const invalid = orderService.updateOrderStatus(newOrder.id, 'delivered');
    expect(invalid).toBe(false);

    // Transitioning processing -> packed is allowed
    const packedValid = orderService.updateOrderStatus(newOrder.id, 'packed');
    expect(packedValid).toBe(true);

    // Transitioning packed -> shipped is allowed
    const shippedValid = orderService.updateOrderStatus(newOrder.id, 'shipped');
    expect(shippedValid).toBe(true);

    // Transitioning shipped -> delivered is allowed
    const deliveredValid = orderService.updateOrderStatus(newOrder.id, 'delivered');
    expect(deliveredValid).toBe(true);
  });

  it('restores stock when an order is cancelled', () => {
    const product = productService.getAll()[0];
    const initialStock = product.stockQuantity;

    const newOrder = orderService.createOrder({
      customerName: 'Test Customer',
      customerEmail: 'test@example.lk',
      customerPhone: '+94 77 123 4567',
      shippingAddress: {
        fullName: 'Test Customer',
        phone: '+94 77 123 4567',
        email: 'test@example.lk',
        addressLine1: 'Test St',
        city: 'Colombo',
        district: 'Colombo',
      },
      items: [
        {
          id: product.id,
          productId: product.id,
          product,
          quantity: 2,
          unitPriceCents: product.priceCents,
          totalPriceCents: product.priceCents * 2,
        },
      ],
      subtotalCents: product.priceCents * 2,
      discountCents: 0,
      deliveryCents: 35000,
      totalCents: product.priceCents * 2 + 35000,
      paymentMethod: 'cash_on_delivery',
    });

    expect(productService.getById(product.id)?.stockQuantity).toBe(initialStock - 2);

    // Cancel order
    orderService.updateOrderStatus(newOrder.id, 'cancelled');
    expect(productService.getById(product.id)?.stockQuantity).toBe(initialStock);
  });

  describe('processReturnAction', () => {
    it('sends rejectionReason when rejecting a return request', async () => {
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        success: true,
        data: { id: 'ret-1', status: 'REJECTED' },
      } as any);

      const res = await orderService.processReturnAction(
        'ord-100',
        'ret-1',
        'REJECT',
        { rejectionReason: 'Item damaged by customer' }
      );

      expect(patchSpy).toHaveBeenCalledWith('/admin/orders/ord-100/returns/ret-1/status', {
        action: 'REJECT',
        rejectionReason: 'Item damaged by customer',
        restockItems: undefined,
      });
      expect(res.success).toBe(true);
      expect(res.data?.status).toBe('REJECTED');
    });

    it('sends restockItems: false when confirming receipt without restocking', async () => {
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        success: true,
        data: { id: 'ret-1', status: 'COMPLETED' },
      } as any);

      const res = await orderService.processReturnAction(
        'ord-100',
        'ret-1',
        'CONFIRM_RECEIVED',
        { restockItems: false }
      );

      expect(patchSpy).toHaveBeenCalledWith('/admin/orders/ord-100/returns/ret-1/status', {
        action: 'CONFIRM_RECEIVED',
        rejectionReason: undefined,
        restockItems: false,
      });
      expect(res.success).toBe(true);
    });

    it('sends restockItems: true when confirming receipt with restocking', async () => {
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        success: true,
        data: { id: 'ret-1', status: 'COMPLETED' },
      } as any);

      const res = await orderService.processReturnAction(
        'ord-100',
        'ret-1',
        'CONFIRM_RECEIVED',
        { restockItems: true }
      );

      expect(patchSpy).toHaveBeenCalledWith('/admin/orders/ord-100/returns/ret-1/status', {
        action: 'CONFIRM_RECEIVED',
        rejectionReason: undefined,
        restockItems: true,
      });
      expect(res.success).toBe(true);
    });

    it('returns error when backend rejects transition', async () => {
      vi.spyOn(apiClient, 'patch').mockRejectedValueOnce(
        new Error('Return request has already been completed')
      );

      const res = await orderService.processReturnAction(
        'ord-100',
        'ret-1',
        'CONFIRM_RECEIVED',
        { restockItems: true }
      );

      expect(res.success).toBe(false);
      expect(res.error).toBe('Return request has already been completed');
    });
  });

  describe('fetchOrderReturns (AUD-01)', () => {
    it('returns returns list on successful API response', async () => {
      const mockReturns = [
        { id: 'ret-1', returnNumber: 'RET-001', orderId: 'ord-100', status: 'PENDING', items: [] },
      ];
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        success: true,
        data: mockReturns,
      } as any);

      const res = await orderService.fetchOrderReturns('ord-100');
      expect(res).toEqual(mockReturns);
    });

    it('returns empty array when API legitimately returns empty data', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        success: true,
        data: [],
      } as any);

      const res = await orderService.fetchOrderReturns('ord-100');
      expect(res).toEqual([]);
    });

    it('rethrows error on API failure instead of swallowing into empty array', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValueOnce(
        new Error('Network timeout or 500 error')
      );

      await expect(orderService.fetchOrderReturns('ord-100')).rejects.toThrow(
        'Network timeout or 500 error'
      );
    });
  });
});
