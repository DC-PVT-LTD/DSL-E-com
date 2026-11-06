import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUserStore } from '../userStore';
import { orderService } from '../orderService';
import { apiClient } from '@/lib/api/apiClient';

describe('Phase B.1 — Email Ownership Verification & Guest Tracking Security', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
      localStorage.clear();
    }
    useUserStore.setState({
      currentUser: null,
      isAdminLoggedIn: false,
      adminEmail: null,
      isLoading: false,
    });
  });

  describe('1. Customer Registration & Email Verification (useUserStore)', () => {
    it('registerCustomer returns requiresVerification and does NOT log in user prematurely', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        success: true,
        requiresVerification: true,
        email: 'customer@dsl.lk',
        message: 'A 6-digit verification code has been dispatched',
      });

      const res = await useUserStore
        .getState()
        .registerCustomer('Jane Doe', 'customer@dsl.lk', 'Password123!', '0771234567');

      expect(postSpy).toHaveBeenCalledWith('/auth/register', {
        name: 'Jane Doe',
        email: 'customer@dsl.lk',
        password: 'Password123!',
        phone: '0771234567',
        orderId: undefined,
      });

      expect(res.success).toBe(true);
      expect(res.requiresVerification).toBe(true);
      // User must NOT be logged in yet
      expect(useUserStore.getState().currentUser).toBeNull();
    });

    it('verifyEmail submits OTP, verifies account, and establishes user session', async () => {
      vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        success: true,
        message: 'Email verified successfully',
        linkedOrdersCount: 1,
        data: {
          id: 'usr-verified-1',
          name: 'Jane Doe',
          email: 'customer@dsl.lk',
          phone: '0771234567',
          role: 'CUSTOMER',
        },
      });

      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        success: true,
        data: [],
      });

      const res = await useUserStore.getState().verifyEmail('customer@dsl.lk', '123456');

      expect(res.success).toBe(true);
      expect(useUserStore.getState().currentUser?.id).toBe('usr-verified-1');
      expect(useUserStore.getState().currentUser?.email).toBe('customer@dsl.lk');
    });

    it('resendVerificationOtp dispatches resend request', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        success: true,
        message: 'A fresh verification code has been sent',
      });

      const res = await useUserStore.getState().resendVerificationOtp('customer@dsl.lk');

      expect(postSpy).toHaveBeenCalledWith('/auth/resend-verification-otp', {
        email: 'customer@dsl.lk',
      });
      expect(res.success).toBe(true);
    });
  });

  describe('2. Guest Order Tracking Security (orderService)', () => {
    it('requestTrackingOtp calls the backend tracking OTP endpoint', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        success: true,
        message: 'Verification code dispatched',
      });

      const res = await orderService.requestTrackingOtp('ord-123', 'guest@dsl.lk');

      expect(postSpy).toHaveBeenCalledWith('/orders/ord-123/tracking-otp', {
        email: 'guest@dsl.lk',
      });
      expect(res.success).toBe(true);
    });

    it('verifyTrackingOtp stores signed token in sessionStorage upon success', async () => {
      vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        success: true,
        data: {
          success: true,
          trackingToken: 'signed.tracking.token.xyz',
          orderId: 'ord-123',
          orderNumber: 'DSL-2026-000123',
        },
      });

      const res = await orderService.verifyTrackingOtp('ord-123', 'guest@dsl.lk', '654321');

      expect(res.trackingToken).toBe('signed.tracking.token.xyz');
      expect(sessionStorage.getItem('order_token_ord-123')).toBe('signed.tracking.token.xyz');
      expect(sessionStorage.getItem('order_token_DSL-2026-000123')).toBe('signed.tracking.token.xyz');
    });

    it('fetchOrderById includes x-tracking-token header when signed token is available', async () => {
      sessionStorage.setItem('order_token_ord-123', 'sample.signed.token.abc');

      const getSpy = vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
        if (url.startsWith('/admin/orders')) {
          throw new Error('401 Unauthorized');
        }
        return {
          success: true,
          data: {
            id: 'ord-123',
            orderNumber: 'DSL-2026-000123',
            customerEmail: 'guest@dsl.lk',
            items: [],
            totalCents: 25000,
          },
        };
      });

      const order = await orderService.fetchOrderById('ord-123');

      expect(getSpy).toHaveBeenCalledWith(
        '/orders/ord-123',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-tracking-token': 'sample.signed.token.abc',
          }),
          params: expect.objectContaining({
            token: 'sample.signed.token.abc',
          }),
        })
      );
      expect(order?.id).toBe('ord-123');
    });
  });
});

