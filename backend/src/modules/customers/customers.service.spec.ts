import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { UserRole } from '../../generated/prisma';

describe('CustomersService', () => {
  let service: CustomersService;
  let mockPrisma: any;
  let mockAuditService: any;

  const mockCustomers = [
    {
      id: 'cust-1',
      name: 'Test Customer One',
      email: 'cust1@example.com',
      phone: '+94771112233',
      role: UserRole.CUSTOMER,
      isActive: true,
      isEmailVerified: true,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
      addresses: [
        { id: 'addr-1', fullName: 'Customer One', district: 'Colombo', isDefault: true, city: 'Colombo 03' },
      ],
      orders: [
        { id: 'ord-1', totalCents: 50000, createdAt: new Date('2026-02-01') },
      ],
      _count: { wishlist: 2, savedLists: 1, savedStationeryLists: 0 },
    },
    {
      id: 'cust-2',
      name: 'Suspended Customer Two',
      email: 'cust2@example.com',
      phone: '+94712223344',
      role: UserRole.CUSTOMER,
      isActive: false,
      isEmailVerified: false,
      createdAt: new Date('2026-02-15'),
      updatedAt: new Date('2026-02-16'),
      addresses: [],
      orders: [],
      _count: { wishlist: 0, savedLists: 0, savedStationeryLists: 0 },
    },
  ];

  beforeEach(() => {
    mockPrisma = {
      user: {
        count: vi.fn().mockImplementation(({ where }) => {
          let filtered = mockCustomers.filter((c) => c.role === where.role);
          if (where.isActive !== undefined) {
            filtered = filtered.filter((c) => c.isActive === where.isActive);
          }
          return Promise.resolve(filtered.length);
        }),
        findMany: vi.fn().mockImplementation(({ where }) => {
          let filtered = mockCustomers.filter((c) => c.role === where.role);
          if (where.isActive !== undefined) {
            filtered = filtered.filter((c) => c.isActive === where.isActive);
          }
          return Promise.resolve(filtered);
        }),
        findUnique: vi.fn().mockImplementation(({ where }) => {
          const found = mockCustomers.find((c) => c.id === where.id);
          return Promise.resolve(found || null);
        }),
        update: vi.fn().mockImplementation(({ where, data }) => {
          const found = mockCustomers.find((c) => c.id === where.id);
          return Promise.resolve({ ...found, ...data, updatedAt: new Date() });
        }),
      },
      order: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'ord-1',
            orderNumber: 'DSL-2026-1001',
            totalCents: 50000,
            paymentMethod: 'KOKO',
            paymentStatus: 'PAID',
            orderStatus: 'DELIVERED',
            createdAt: new Date('2026-02-01'),
            _count: { items: 3 },
          },
        ]),
      },
    };

    mockAuditService = {
      recordAuditLog: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    service = new CustomersService(mockPrisma, mockAuditService);
  });

  describe('findAll', () => {
    it('strictly queries users with role = CUSTOMER', async () => {
      const result = await service.findAll({
        page: 1,
        limit: 25,
        status: 'all',
        hasOrders: 'all',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: UserRole.CUSTOMER }),
        })
      );
      expect(result.items.length).toBe(2);
      expect(result.items[0].id).toBe('cust-1');
      expect(result.items[0].orderCount).toBe(1);
      expect(result.items[0].totalSpendCents).toBe(50000);
    });

    it('filters by active status', async () => {
      const result = await service.findAll({
        page: 1,
        limit: 25,
        status: 'active',
        hasOrders: 'all',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: UserRole.CUSTOMER, isActive: true }),
        })
      );
      expect(result.items.length).toBe(1);
      expect(result.items[0].isActive).toBe(true);
    });
  });

  describe('findById', () => {
    it('returns customer details with order history and calculated metrics', async () => {
      const detail = await service.findById('cust-1');
      expect(detail.id).toBe('cust-1');
      expect(detail.name).toBe('Test Customer One');
      expect(detail.orders.length).toBe(1);
      expect(detail.orderSummary.totalOrders).toBe(1);
      expect(detail.orderSummary.totalSpendCents).toBe(50000);
      expect(detail.orderSummary.averageOrderValueCents).toBe(50000);
      expect(detail.wishlistCount).toBe(2);
    });

    it('throws NotFoundException if customer does not exist or is not a customer', async () => {
      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('updates active status and creates an audit log entry', async () => {
      const updated = await service.updateStatus(
        'cust-1',
        { isActive: false, reason: 'Suspicious activity reported' },
        'admin-user-id'
      );

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cust-1' },
          data: { isActive: false },
        })
      );
      expect(mockAuditService.recordAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CUSTOMER_STATUS_UPDATE',
          entityType: 'Customer',
          entityId: 'cust-1',
          userId: 'admin-user-id',
        })
      );
      expect(updated.isActive).toBe(false);
    });
  });

  describe('getAnalytics', () => {
    it('aggregates real customer counts and metrics', async () => {
      const analytics = await service.getAnalytics();
      expect(analytics.totalCustomers).toBe(2);
      expect(analytics.activeCustomers).toBe(1);
      expect(analytics.inactiveCustomers).toBe(1);
    });
  });

  describe('exportCustomers', () => {
    it('generates an Excel buffer with customer data', async () => {
      const result = await service.exportCustomers(
        { page: 1, limit: 25, status: 'all', hasOrders: 'all', sortBy: 'createdAt', sortOrder: 'desc' },
        'xlsx'
      );

      expect(result.buffer).toBeDefined();
      expect(result.filename).toMatch(/^dsl-customers-.*\.xlsx$/);
      expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });

    it('generates a CSV buffer when requested', async () => {
      const result = await service.exportCustomers(
        { page: 1, limit: 25, status: 'all', hasOrders: 'all', sortBy: 'createdAt', sortOrder: 'desc' },
        'csv'
      );

      expect(result.buffer).toBeDefined();
      expect(result.filename).toMatch(/^dsl-customers-.*\.csv$/);
      expect(result.mimeType).toBe('text/csv');
    });
  });
});

