import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkoutService } from '../checkoutService';
import { apiClient } from '@/lib/api/apiClient';

describe('Phase C: 10-Minute Stock Reservation & Expired Recovery Frontend Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Reservation Creation & Session Persistence', () => {
    it('creates 10-minute stock reservation with session ID', async () => {
      const mockResponse = {
        data: {
          reservationId: 'res-c-101',
          status: 'ACTIVE',
          expiresAt: '2026-11-05T18:00:00.000Z',
          expiresInSeconds: 600,
          isExpired: false,
          stockAvailable: true,
          items: [
            {
              id: 'it-1',
              productId: 'prod-atlas-book',
              variantId: null,
              productName: 'Atlas Exercise Book 120 Pgs',
              variantName: null,
              quantity: 2,
              unitPriceCents: 15000,
              totalPriceCents: 30000,
              stockQuantity: 40,
            },
          ],
        },
      };

      vi.spyOn(apiClient, 'post').mockResolvedValueOnce(mockResponse as any);

      const res = await checkoutService.createReservation({
        items: [{ productId: 'prod-atlas-book', quantity: 2 }],
        sessionId: 'csess_123456789',
      });

      expect(res.reservationId).toBe('res-c-101');
      expect(res.status).toBe('ACTIVE');
      expect(res.expiresInSeconds).toBe(600);
      expect(res.isExpired).toBe(false);
      expect(apiClient.post).toHaveBeenCalledWith('/checkout/reserve', {
        items: [{ productId: 'prod-atlas-book', quantity: 2 }],
        sessionId: 'csess_123456789',
      });
    });

    it('returns existing reservation with preserved timer upon page refresh with identical sessionId', async () => {
      // Refresh after 3 minutes: remaining time is 420 seconds
      const mockRefreshResponse = {
        data: {
          reservationId: 'res-c-101',
          status: 'ACTIVE',
          expiresAt: '2026-11-05T18:00:00.000Z',
          expiresInSeconds: 420,
          isExpired: false,
          stockAvailable: true,
          items: [
            {
              id: 'it-1',
              productId: 'prod-atlas-book',
              variantId: null,
              productName: 'Atlas Exercise Book 120 Pgs',
              variantName: null,
              quantity: 2,
              unitPriceCents: 15000,
              totalPriceCents: 30000,
              stockQuantity: 40,
            },
          ],
        },
      };

      vi.spyOn(apiClient, 'post').mockResolvedValueOnce(mockRefreshResponse as any);

      const res = await checkoutService.createReservation({
        items: [{ productId: 'prod-atlas-book', quantity: 2 }],
        sessionId: 'csess_123456789',
      });

      expect(res.reservationId).toBe('res-c-101');
      expect(res.expiresInSeconds).toBe(420); // Accurate remaining time preserved
      expect(res.isExpired).toBe(false);
    });
  });

  describe('Expired Reservation Recovery (Scenario A vs Scenario B)', () => {
    it('Scenario A: detects expired reservation, verifies stock is still available, and does not create a new 10-minute hold', async () => {
      const mockScenarioAResponse = {
        data: {
          reservationId: 'res-c-expired',
          status: 'EXPIRED',
          expiresAt: '2026-11-05T17:45:00.000Z',
          expiresInSeconds: 0,
          isExpired: true,
          stockAvailable: true,
          message:
            'Your previous reservation has expired. We checked the latest stock availability, and your selected items are still available. You can continue with payment.',
          items: [
            {
              id: 'it-1',
              productId: 'prod-atlas-book',
              variantId: null,
              productName: 'Atlas Exercise Book 120 Pgs',
              variantName: null,
              quantity: 2,
              unitPriceCents: 15000,
              totalPriceCents: 30000,
              stockQuantity: 25,
            },
          ],
        },
      };

      vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockScenarioAResponse as any);

      const res = await checkoutService.checkExpiredStock('res-c-expired');
      expect(res.isExpired).toBe(true);
      expect(res.stockAvailable).toBe(true);
      expect(res.expiresInSeconds).toBe(0);
      expect(res.message).toContain('Your previous reservation has expired. We checked the latest stock availability');
      expect(apiClient.get).toHaveBeenCalledWith('/checkout/reserve/res-c-expired/check-stock');
    });

    it('Scenario B: detects expired reservation and reports insufficient available stock with affected products', async () => {
      const mockScenarioBResponse = {
        data: {
          reservationId: 'res-c-depleted',
          status: 'EXPIRED',
          expiresAt: '2026-11-05T17:30:00.000Z',
          expiresInSeconds: 0,
          isExpired: true,
          stockAvailable: false,
          message: 'Sorry! Some of your selected items are no longer available in the requested quantities.',
          unavailableItems: [
            {
              productId: 'prod-atlas-book',
              variantId: null,
              productName: 'Atlas Exercise Book 120 Pgs',
              requestedQuantity: 5,
              availableQuantity: 1,
            },
          ],
          items: [],
        },
      };

      vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockScenarioBResponse as any);

      const res = await checkoutService.checkExpiredStock('res-c-depleted');
      expect(res.isExpired).toBe(true);
      expect(res.stockAvailable).toBe(false);
      expect(res.unavailableItems).toHaveLength(1);
      expect(res.unavailableItems?.[0].requestedQuantity).toBe(5);
      expect(res.unavailableItems?.[0].availableQuantity).toBe(1);
      expect(res.message).toContain('Sorry! Some of your selected items are no longer available');
    });
  });

  describe('Payment Cancellation & Stock Allocation Release', () => {
    it('dispatches payment cancellation to release PAYMENT_PENDING stock allocation immediately', async () => {
      vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: { success: true } } as any);

      await checkoutService.cancelPayment('res-c-101');
      expect(apiClient.post).toHaveBeenCalledWith('/checkout/payment-cancel', {
        reservationId: 'res-c-101',
      });
    });
  });
});

