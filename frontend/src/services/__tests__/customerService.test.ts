import { describe, it, expect, vi, beforeEach } from 'vitest';
import { customerService } from '../customerService';
import { apiClient } from '@/lib/api/apiClient';

describe('customerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchCustomers', () => {
    it('calls GET admin/customers with correct query parameters and returns items', async () => {
      const mockResult = {
        success: true,
        data: [
          {
            id: 'cust-1',
            customerType: 'REGISTERED',
            name: 'Sunil Perera',
            email: 'sunil@test.lk',
            phone: '0771234567',
            isActive: true,
            isEmailVerified: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            firstPurchaseDate: '2026-01-05T00:00:00.000Z',
            lastPurchaseDate: '2026-01-10T00:00:00.000Z',
            primaryDistrict: 'Colombo',
            addressesCount: 1,
            orderCount: 2,
            totalSpendCents: 500000,
          },
          {
            id: 'guest:email:guest@test.lk',
            customerType: 'GUEST',
            name: 'Guest Buyer',
            email: 'guest@test.lk',
            phone: null,
            isActive: true,
            isEmailVerified: false,
            createdAt: '2026-01-08T00:00:00.000Z',
            firstPurchaseDate: '2026-01-08T00:00:00.000Z',
            lastPurchaseDate: '2026-01-08T00:00:00.000Z',
            primaryDistrict: 'Kandy',
            addressesCount: 1,
            orderCount: 1,
            totalSpendCents: 250000,
          },
        ],
        meta: {
          total: 2,
          page: 1,
          limit: 25,
          totalPages: 1,
        },
      };

      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockResult as any);

      const result = await customerService.fetchCustomers({
        page: 1,
        limit: 25,
        search: 'sunil',
        customerType: 'all',
        status: 'active',
        hasOrders: 'with_orders',
        district: 'Colombo',
        minSpendCents: 100000,
        maxSpendCents: 1000000,
        minOrderCount: 1,
        maxOrderCount: 5,
        firstPurchaseDate: '2026-01-01',
        lastPurchaseDate: '2026-01-31',
        sortBy: 'totalSpendCents',
        sortOrder: 'desc',
      });

      expect(getSpy).toHaveBeenCalledWith(
        'admin/customers',
        expect.objectContaining({
          params: expect.objectContaining({
            page: 1,
            limit: 25,
            search: 'sunil',
            status: 'active',
            hasOrders: 'with_orders',
            district: 'Colombo',
            minSpendCents: 100000,
            maxSpendCents: 1000000,
            minOrderCount: 1,
            maxOrderCount: 5,
            firstPurchaseDate: '2026-01-01',
            lastPurchaseDate: '2026-01-31',
            sortBy: 'totalSpendCents',
            sortOrder: 'desc',
          }),
        })
      );

      expect(result.items).toHaveLength(2);
      expect(result.items[0].name).toBe('Sunil Perera');
      expect(result.items[1].customerType).toBe('GUEST');
      expect(result.total).toBe(2);
    });

    it('passes customerType filter when set to registered or guest', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        success: true,
        data: [],
        meta: { total: 0, page: 1, limit: 25, totalPages: 0 },
      } as any);

      await customerService.fetchCustomers({ customerType: 'registered' });

      expect(getSpy).toHaveBeenCalledWith(
        'admin/customers',
        expect.objectContaining({
          params: expect.objectContaining({
            customerType: 'registered',
          }),
        })
      );
    });
  });

  describe('fetchCustomerById', () => {
    it('calls GET admin/customers/:id and returns customer detail', async () => {
      const mockDetail = {
        id: 'cust-123',
        customerType: 'REGISTERED',
        name: 'Kamal Silva',
        email: 'kamal@test.lk',
        phone: '0777123456',
        isActive: true,
        isEmailVerified: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        addresses: [],
        orders: [],
        orderSummary: {
          totalOrders: 0,
          totalSpendCents: 0,
          averageOrderValueCents: 0,
          firstOrderDate: null,
          lastOrderDate: null,
        },
        wishlistCount: 2,
        savedListsCount: 1,
      };

      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        success: true,
        data: mockDetail,
      } as any);

      const result = await customerService.fetchCustomerById('cust-123');
      expect(getSpy).toHaveBeenCalledWith('admin/customers/cust-123');
      expect(result.name).toBe('Kamal Silva');
      expect(result.wishlistCount).toBe(2);
    });

    it('properly encodes guest ID containing special characters', async () => {
      const guestId = 'guest:email:test@example.com|phone:0771234567';
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        success: true,
        data: {
          id: guestId,
          customerType: 'GUEST',
          name: 'Guest Buyer',
          email: 'test@example.com',
        },
      } as any);

      await customerService.fetchCustomerById(guestId);
      expect(getSpy).toHaveBeenCalledWith(`admin/customers/${encodeURIComponent(guestId)}`);
    });
  });

  describe('fetchCustomerAnalytics', () => {
    it('calls GET admin/customers/analytics and returns metric totals', async () => {
      const mockAnalytics = {
        totalCustomers: 15,
        registeredCustomers: 10,
        guestBuyers: 5,
        activeCustomers: 14,
        inactiveCustomers: 1,
        verifiedEmailCount: 9,
        newCustomersLast30Days: 4,
        customersWithOrders: 8,
        customersWithoutOrders: 7,
        totalCustomerRevenueCents: 15000000,
        byDistrict: [{ district: 'Colombo', count: 6 }],
      };

      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        success: true,
        data: mockAnalytics,
      } as any);

      const result = await customerService.fetchCustomerAnalytics();
      expect(getSpy).toHaveBeenCalledWith('admin/customers/analytics');
      expect(result.totalCustomers).toBe(15);
      expect(result.guestBuyers).toBe(5);
      expect(result.registeredCustomers).toBe(10);
    });
  });

  describe('updateCustomerStatus', () => {
    it('calls PATCH admin/customers/:id/status with target state and reason', async () => {
      const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        success: true,
        data: {
          id: 'cust-1',
          isActive: false,
          updatedAt: '2026-02-01T00:00:00.000Z',
        },
      } as any);

      const result = await customerService.updateCustomerStatus('cust-1', false, 'Fraud verification');
      expect(patchSpy).toHaveBeenCalledWith('admin/customers/cust-1/status', {
        isActive: false,
        reason: 'Fraud verification',
      });
      expect(result.isActive).toBe(false);
    });

    it('throws error when status update fails', async () => {
      vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        success: false,
        message: 'Guest customers cannot be deactivated',
      } as any);

      await expect(
        customerService.updateCustomerStatus('guest:123', false)
      ).rejects.toThrow('Guest customers cannot be deactivated');
    });
  });

  describe('exportCustomers', () => {
    it('builds export URL with active filters and requests blob from server', async () => {
      const mockBlob = new Blob(['sample data'], { type: 'text/csv' });
      const buildUrlSpy = vi
        .spyOn(apiClient, 'buildUrl')
        .mockReturnValue('http://localhost:3001/api/admin/customers/export?format=csv&customerType=registered');

      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        blob: vi.fn().mockResolvedValueOnce(mockBlob),
      } as any);

      try {
        const result = await customerService.exportCustomers('csv', {
          customerType: 'registered',
          search: 'test',
        });

        expect(buildUrlSpy).toHaveBeenCalledWith(
          'admin/customers/export',
          expect.objectContaining({
            format: 'csv',
            customerType: 'registered',
            search: 'test',
          })
        );
        expect(result).toBe(mockBlob);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
