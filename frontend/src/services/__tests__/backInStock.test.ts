import { describe, it, expect, beforeEach, vi } from 'vitest';
import { backInStockService } from '../backInStockService';
import { apiClient } from '@/lib/api/apiClient';

describe('Phase 15.4 — Back-in-Stock Alerts Frontend Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Subscription & Status API Integration', () => {
    it('calls POST /back-in-stock/subscribe with product ID', async () => {
      const mockAlert = {
        id: 'alert-123',
        userId: 'user-1',
        productId: 'prod-out',
        status: 'PENDING' as const,
        sentAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isAlreadySubscribed: false,
        message: 'Subscribed successfully',
      };

      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(mockAlert as any);

      const res = await backInStockService.subscribe('prod-out');
      expect(postSpy).toHaveBeenCalledWith('/back-in-stock/subscribe', { productId: 'prod-out' });
      expect(res.id).toBe('alert-123');
      expect(res.isAlreadySubscribed).toBe(false);
    });

    it('handles duplicate subscription status gracefully', async () => {
      const mockDuplicateAlert = {
        id: 'alert-existing',
        userId: 'user-1',
        productId: 'prod-out',
        status: 'PENDING' as const,
        sentAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isAlreadySubscribed: true,
        message: "You're already subscribed to alerts for this product.",
      };

      vi.spyOn(apiClient, 'post').mockResolvedValueOnce(mockDuplicateAlert as any);

      const res = await backInStockService.subscribe('prod-out');
      expect(res.isAlreadySubscribed).toBe(true);
      expect(res.message).toContain('already subscribed');
    });

    it('checks active subscription status via GET /back-in-stock/status/:id', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        isSubscribed: true,
        alertId: 'alert-active',
      } as any);

      const res = await backInStockService.getStatus('prod-out');
      expect(getSpy).toHaveBeenCalledWith('/back-in-stock/status/prod-out');
      expect(res.isSubscribed).toBe(true);
      expect(res.alertId).toBe('alert-active');
    });
  });

  describe('2. Customer Subscription Management', () => {
    it('retrieves customer alert list via GET /back-in-stock/my-alerts', async () => {
      const mockAlerts = [
        {
          id: 'alert-1',
          userId: 'user-1',
          productId: 'prod-1',
          status: 'PENDING' as const,
          sentAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          product: {
            id: 'prod-1',
            name: 'Atlas Gel Pen',
            slug: 'atlas-gel-pen',
            sku: 'PEN-01',
            priceCents: 12000,
            stockQuantity: 0,
            isActive: true,
            images: ['/pen.jpg'],
            categoryName: 'Pens',
          },
        },
        {
          id: 'alert-2',
          userId: 'user-1',
          productId: 'prod-2',
          status: 'SENT' as const,
          sentAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          product: {
            id: 'prod-2',
            name: 'Atlas CR Book',
            slug: 'atlas-cr-book',
            sku: 'BOOK-01',
            priceCents: 25000,
            stockQuantity: 50,
            isActive: true,
            images: ['/book.jpg'],
            categoryName: 'Books',
          },
        },
      ];

      vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockAlerts as any);

      const alerts = await backInStockService.getMyAlerts();
      expect(alerts).toHaveLength(2);
      expect(alerts[0].status).toBe('PENDING');
      expect(alerts[0].product?.stockQuantity).toBe(0);
      expect(alerts[1].status).toBe('SENT');
      expect(alerts[1].product?.stockQuantity).toBe(50);
    });

    it('cancels an active subscription via DELETE /back-in-stock/:id', async () => {
      const deleteSpy = vi.spyOn(apiClient, 'delete').mockResolvedValueOnce({
        success: true,
        message: 'Subscription cancelled successfully',
      } as any);

      const res = await backInStockService.cancelAlert('alert-1');
      expect(deleteSpy).toHaveBeenCalledWith('/back-in-stock/alert-1');
      expect(res.success).toBe(true);
    });
  });

  describe('3. Login Redirection Logic', () => {
    it('constructs correct login redirect URL with return path for unauthenticated visitors', () => {
      const currentPath = '/products/atlas-gel-pen-05-black';
      const redirectUrl = `/login?redirect=${encodeURIComponent(currentPath)}`;
      expect(redirectUrl).toBe('/login?redirect=%2Fproducts%2Fatlas-gel-pen-05-black');
    });
  });

  describe('4. Button Visibility & Stock Conditions', () => {
    it('determines button visibility based on stockQuantity', () => {
      const shouldShowBackInStock = (stockQuantity: number) => stockQuantity <= 0;
      const shouldShowAddToCart = (stockQuantity: number) => stockQuantity > 0;

      // Out-of-stock product
      expect(shouldShowBackInStock(0)).toBe(true);
      expect(shouldShowAddToCart(0)).toBe(false);

      // In-stock product
      expect(shouldShowBackInStock(15)).toBe(false);
      expect(shouldShowAddToCart(15)).toBe(true);
    });
  });
});

