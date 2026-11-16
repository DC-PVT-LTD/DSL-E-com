import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CustomersService, normalizeEmail, normalizePhone, sanitizeCsvFormula } from './customers.service';
import { UserRole, PaymentStatus, OrderStatus } from '../../generated/prisma';

describe('CustomersService', () => {
  let service: CustomersService;
  let mockPrisma: any;
  let mockAuditService: any;

  const mockUsers = [
    {
      id: 'cust-1',
      name: 'Anura Bandara',
      email: 'anura@example.com',
      phone: '+94771112233',
      role: UserRole.CUSTOMER,
      isActive: true,
      isEmailVerified: true,
      createdAt: new Date('2026-01-10T08:00:00Z'),
      updatedAt: new Date('2026-01-12T08:00:00Z'),
      addresses: [
        {
          id: 'addr-1',
          fullName: 'Anura Bandara',
          district: 'Colombo',
          isDefault: true,
          city: 'Colombo 03',
          addressLine1: '123 Galle Rd',
          addressLine2: null,
          postalCode: '00300',
          phone: '+94771112233',
          email: 'anura@example.com',
          createdAt: new Date('2026-01-10T08:00:00Z'),
        },
      ],
      orders: [
        {
          id: 'ord-reg-1',
          orderNumber: 'DSL-2026-1001',
          totalCents: 50000,
          createdAt: new Date('2026-01-15T10:00:00Z'),
          paymentMethod: 'CARD_PAYHERE',
          paymentStatus: 'PAID',
          orderStatus: 'DELIVERED',
        },
        {
          id: 'ord-reg-2',
          orderNumber: 'DSL-2026-1002',
          totalCents: 30000,
          createdAt: new Date('2026-02-01T12:00:00Z'),
          paymentMethod: 'CASH_ON_DELIVERY',
          paymentStatus: 'PAID',
          orderStatus: 'DELIVERED',
        },
      ],
      _count: { wishlist: 2, savedLists: 1, savedStationeryLists: 0 },
    },
    {
      id: 'cust-2',
      name: 'Dilani Perera',
      email: 'dilani@example.com',
      phone: '+94712223344',
      role: UserRole.CUSTOMER,
      isActive: false,
      isEmailVerified: false,
      createdAt: new Date('2026-01-20T09:00:00Z'),
      updatedAt: new Date('2026-01-20T09:00:00Z'),
      addresses: [
        {
          id: 'addr-2',
          fullName: 'Dilani Perera',
          district: 'Kandy',
          isDefault: true,
          city: 'Peradeniya',
          addressLine1: '45 Kandy Rd',
          addressLine2: null,
          postalCode: '20000',
          phone: '+94712223344',
          email: 'dilani@example.com',
          createdAt: new Date('2026-01-20T09:00:00Z'),
        },
      ],
      orders: [],
      _count: { wishlist: 0, savedLists: 0, savedStationeryLists: 0 },
    },
  ];

  const mockGuestOrders = [
    {
      id: 'guest-ord-1',
      orderNumber: 'DSL-2026-9001',
      userId: null,
      customerName: 'Kamal Silva',
      customerEmail: 'kamal@guest.lk',
      customerPhone: '0773334455',
      totalCents: 45000,
      paymentMethod: 'CASH_ON_DELIVERY',
      paymentStatus: 'PAID',
      orderStatus: 'DELIVERED',
      createdAt: new Date('2026-01-18T10:00:00Z'),
      addressSnapshot: {
        id: 'snap-1',
        fullName: 'Kamal Silva',
        phone: '0773334455',
        email: 'kamal@guest.lk',
        addressLine1: '78 Highlevel Rd',
        addressLine2: null,
        city: 'Nugegoda',
        district: 'Colombo',
        postalCode: '10250',
      },
      _count: { items: 2 },
    },
    {
      id: 'guest-ord-2',
      orderNumber: 'DSL-2026-9002',
      userId: null,
      customerName: 'Kamal Silva',
      customerEmail: 'KAMAL@GUEST.LK', // Test case-insensitive grouping
      customerPhone: '+94 77 333 4455', // Test phone formatting normalization
      totalCents: 25000,
      paymentMethod: 'CARD_PAYHERE',
      paymentStatus: 'PAID',
      orderStatus: 'DELIVERED',
      createdAt: new Date('2026-02-05T14:30:00Z'),
      addressSnapshot: {
        id: 'snap-2',
        fullName: 'Kamal Silva',
        phone: '+94 77 333 4455',
        email: 'kamal@guest.lk',
        addressLine1: '78 Highlevel Rd',
        addressLine2: null,
        city: 'Nugegoda',
        district: 'Colombo',
        postalCode: '10250',
      },
      _count: { items: 1 },
    },
    {
      id: 'guest-ord-3',
      orderNumber: 'DSL-2026-9003',
      userId: null,
      customerName: 'Sunil Fernando',
      customerEmail: 'sunil@guest.lk',
      customerPhone: '0715556677',
      totalCents: 15000,
      paymentMethod: 'BANK_TRANSFER',
      paymentStatus: 'PAID',
      orderStatus: 'CONFIRMED',
      createdAt: new Date('2026-02-10T11:00:00Z'),
      addressSnapshot: {
        id: 'snap-3',
        fullName: 'Sunil Fernando',
        phone: '0715556677',
        email: 'sunil@guest.lk',
        addressLine1: '12 Beach Rd',
        addressLine2: null,
        city: 'Galle',
        district: 'Galle',
        postalCode: '80000',
      },
      _count: { items: 3 },
    },
  ];

  beforeEach(() => {
    mockPrisma = {
      user: {
        count: vi.fn().mockImplementation(({ where }) => {
          let list = mockUsers.filter((u) => u.role === where.role);
          if (where.isActive !== undefined) {
            list = list.filter((u) => u.isActive === where.isActive);
          }
          if (where.isEmailVerified !== undefined) {
            list = list.filter((u) => u.isEmailVerified === where.isEmailVerified);
          }
          return Promise.resolve(list.length);
        }),
        findMany: vi.fn().mockImplementation(({ where }) => {
          let list = mockUsers.filter((u) => u.role === where.role);
          if (where.isActive !== undefined) {
            list = list.filter((u) => u.isActive === where.isActive);
          }
          return Promise.resolve(list);
        }),
        findUnique: vi.fn().mockImplementation(({ where }) => {
          const found = mockUsers.find((u) => u.id === where.id);
          return Promise.resolve(found || null);
        }),
        update: vi.fn().mockImplementation(({ where, data }) => {
          const found = mockUsers.find((u) => u.id === where.id);
          return Promise.resolve({ ...found, ...data, updatedAt: new Date() });
        }),
      },
      order: {
        findMany: vi.fn().mockImplementation(({ where }) => {
          if (where?.userId === null) {
            return Promise.resolve(mockGuestOrders);
          }
          if (where?.userId) {
            const user = mockUsers.find((u) => u.id === where.userId);
            return Promise.resolve(
              (user?.orders || []).map((o) => ({
                ...o,
                _count: { items: 2 },
              }))
            );
          }
          return Promise.resolve([]);
        }),
      },
    };

    mockAuditService = {
      recordAuditLog: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    service = new CustomersService(mockPrisma, mockAuditService);
  });

  describe('Utility normalization & CSV sanitization', () => {
    it('normalizes email addresses correctly', () => {
      expect(normalizeEmail('  USER@Domain.COM  ')).toBe('user@domain.com');
      expect(normalizeEmail(null)).toBe('');
    });

    it('normalizes Sri Lankan phone numbers', () => {
      expect(normalizePhone('0771234567')).toBe('94771234567');
      expect(normalizePhone('+94 77 123 4567')).toBe('94771234567');
      expect(normalizePhone('071-222-3344')).toBe('94712223344');
      expect(normalizePhone(null)).toBe('');
    });

    it('protects against CSV formula injection', () => {
      expect(sanitizeCsvFormula('=1+2')).toBe(`'=1+2`);
      expect(sanitizeCsvFormula('+cmd|')).toBe(`'+cmd|`);
      expect(sanitizeCsvFormula('-100')).toBe(`'-100`);
      expect(sanitizeCsvFormula('@SUM(A1:A10)')).toBe(`'@SUM(A1:A10)`);
      expect(sanitizeCsvFormula('Safe Text')).toBe('Safe Text');
      expect(sanitizeCsvFormula(123)).toBe('123');
    });
  });

  describe('findAll — Customer Classification & Grouping', () => {
    it('returns combined registered and guest customers when customerType is all', async () => {
      const res = await service.findAll({ customerType: 'all', page: 1, limit: 25 });
      // 2 registered + 2 unique guest buyers (Kamal Silva 2 orders grouped into 1, Sunil Fernando 1 order)
      expect(res.items.length).toBe(4);
      expect(res.pagination.total).toBe(4);

      const registered = res.items.filter((c) => c.customerType === 'REGISTERED');
      const guests = res.items.filter((c) => c.customerType === 'GUEST');
      expect(registered.length).toBe(2);
      expect(guests.length).toBe(2);
    });

    it('filters strictly registered customers when customerType is registered', async () => {
      const res = await service.findAll({ customerType: 'registered', page: 1, limit: 25 });
      expect(res.items.length).toBe(2);
      expect(res.items.every((c) => c.customerType === 'REGISTERED')).toBe(true);
      expect(mockPrisma.order.findMany).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: null } })
      );
    });

    it('filters strictly guest customers when customerType is guest', async () => {
      const res = await service.findAll({ customerType: 'guest', page: 1, limit: 25 });
      expect(res.items.length).toBe(2);
      expect(res.items.every((c) => c.customerType === 'GUEST')).toBe(true);
    });

    it('groups multiple guest orders with same normalized email/phone into a single guest customer', async () => {
      const res = await service.findAll({ customerType: 'guest' });
      const kamal = res.items.find((c) => c.name === 'Kamal Silva');
      expect(kamal).toBeDefined();
      expect(kamal?.orderCount).toBe(2);
      expect(kamal?.totalSpendCents).toBe(70000); // 45000 + 25000
      expect(kamal?.primaryDistrict).toBe('Colombo');
      expect(kamal?.associatedOrderNumbers).toContain('DSL-2026-9001');
      expect(kamal?.associatedOrderNumbers).toContain('DSL-2026-9002');
    });

    it('prevents accidental merging of different guests with same name but different contact info', async () => {
      mockPrisma.order.findMany.mockResolvedValueOnce([
        {
          id: 'g-1',
          orderNumber: 'DSL-1',
          customerName: 'Nimal Perera',
          customerEmail: 'nimal1@example.com',
          customerPhone: '0771111111',
          totalCents: 1000,
          createdAt: new Date('2026-01-01'),
          addressSnapshot: null,
        },
        {
          id: 'g-2',
          orderNumber: 'DSL-2',
          customerName: 'Nimal Perera', // Same name, completely different contact
          customerEmail: 'nimal2@example.com',
          customerPhone: '0772222222',
          totalCents: 2000,
          createdAt: new Date('2026-01-02'),
          addressSnapshot: null,
        },
      ]);

      const res = await service.findAll({ customerType: 'guest' });
      expect(res.items.length).toBe(2);
      expect(res.items[0].email).not.toBe(res.items[1].email);
    });

    it('safely handles guest buyers with missing phone or missing email', async () => {
      mockPrisma.order.findMany.mockResolvedValueOnce([
        {
          id: 'g-no-phone',
          orderNumber: 'DSL-NP',
          customerName: 'No Phone Buyer',
          customerEmail: 'nophone@example.com',
          customerPhone: null,
          totalCents: 1000,
          createdAt: new Date('2026-01-01'),
          addressSnapshot: null,
        },
        {
          id: 'g-no-email',
          orderNumber: 'DSL-NE',
          customerName: 'No Email Buyer',
          customerEmail: null,
          customerPhone: '0779998888',
          totalCents: 2000,
          createdAt: new Date('2026-01-02'),
          addressSnapshot: null,
        },
      ]);

      const res = await service.findAll({ customerType: 'guest' });
      expect(res.items.length).toBe(2);
      const noPhone = res.items.find((c) => c.name === 'No Phone Buyer');
      const noEmail = res.items.find((c) => c.name === 'No Email Buyer');
      expect(noPhone?.phone).toBeNull();
      expect(noEmail?.email).toBe('');
    });

    it('excludes pending/unpaid orders, excludes cancelled orders, and deducts completed refunds from purchase value', async () => {
      mockPrisma.order.findMany.mockResolvedValueOnce([
        {
          id: 'g-paid-refunded',
          orderNumber: 'DSL-R1',
          customerName: 'Refunded Buyer',
          customerEmail: 'refunded@example.com',
          customerPhone: '0771231234',
          totalCents: 10000,
          paymentStatus: PaymentStatus.PAID,
          orderStatus: OrderStatus.DELIVERED,
          createdAt: new Date('2026-01-01'),
          refundRecords: [{ amountCents: 2000 }],
          addressSnapshot: null,
        },
        {
          id: 'g-pending',
          orderNumber: 'DSL-PEND',
          customerName: 'Refunded Buyer',
          customerEmail: 'refunded@example.com',
          customerPhone: '0771231234',
          totalCents: 5000,
          paymentStatus: PaymentStatus.PENDING,
          orderStatus: OrderStatus.CONFIRMED,
          createdAt: new Date('2026-01-02'),
          refunds: [],
          addressSnapshot: null,
        },
        {
          id: 'g-cancelled',
          orderNumber: 'DSL-CANC',
          customerName: 'Refunded Buyer',
          customerEmail: 'refunded@example.com',
          customerPhone: '0771231234',
          totalCents: 4000,
          paymentStatus: PaymentStatus.FAILED,
          orderStatus: OrderStatus.CANCELLED,
          createdAt: new Date('2026-01-03'),
          refunds: [],
          addressSnapshot: null,
        },
      ]);

      const res = await service.findAll({ customerType: 'guest' });
      expect(res.items.length).toBe(1);
      const buyer = res.items[0];
      // Total orders count should be all 3 associated orders
      expect(buyer.orderCount).toBe(3);
      // Net purchase value should be 10000 - 2000 = 8000 (pending and cancelled excluded)
      expect(buyer.totalSpendCents).toBe(8000);
    });
  });

  describe('Guest Customer Identity Grouping Edge Cases', () => {
    it('Case 1: Same email and same phone -> groups into single guest customer', async () => {
      mockPrisma.order.findMany.mockResolvedValueOnce([
        {
          id: 'g-c1-1',
          orderNumber: 'DSL-C1-1',
          customerName: 'Saman Silva',
          customerEmail: 'saman@example.com',
          customerPhone: '0771234567',
          totalCents: 5000,
          paymentStatus: PaymentStatus.PAID,
          orderStatus: OrderStatus.DELIVERED,
          createdAt: new Date('2026-01-01'),
          refundRecords: [],
          addressSnapshot: null,
        },
        {
          id: 'g-c1-2',
          orderNumber: 'DSL-C1-2',
          customerName: 'Saman Silva',
          customerEmail: 'saman@example.com',
          customerPhone: '0771234567',
          totalCents: 7000,
          paymentStatus: PaymentStatus.PAID,
          orderStatus: OrderStatus.DELIVERED,
          createdAt: new Date('2026-01-02'),
          refundRecords: [],
          addressSnapshot: null,
        },
      ]);

      const res = await service.findAll({ customerType: 'guest' });
      expect(res.items.length).toBe(1);
      expect(res.items[0].orderCount).toBe(2);
      expect(res.items[0].totalSpendCents).toBe(12000);
    });

    it('Case 2: Same email with different phone numbers -> keeps distinct to avoid conflation', async () => {
      mockPrisma.order.findMany.mockResolvedValueOnce([
        {
          id: 'g-c2-1',
          orderNumber: 'DSL-C2-1',
          customerName: 'Amal',
          customerEmail: 'amal@example.com',
          customerPhone: '0771111111',
          totalCents: 5000,
          paymentStatus: PaymentStatus.PAID,
          orderStatus: OrderStatus.DELIVERED,
          createdAt: new Date('2026-01-01'),
          refundRecords: [],
          addressSnapshot: null,
        },
        {
          id: 'g-c2-2',
          orderNumber: 'DSL-C2-2',
          customerName: 'Amal',
          customerEmail: 'amal@example.com',
          customerPhone: '0772222222',
          totalCents: 6000,
          paymentStatus: PaymentStatus.PAID,
          orderStatus: OrderStatus.DELIVERED,
          createdAt: new Date('2026-01-02'),
          refundRecords: [],
          addressSnapshot: null,
        },
      ]);

      const res = await service.findAll({ customerType: 'guest' });
      expect(res.items.length).toBe(2);
      expect(res.items[0].phone).not.toBe(res.items[1].phone);
    });

    it('Case 3: Same phone with different email addresses -> keeps distinct', async () => {
      mockPrisma.order.findMany.mockResolvedValueOnce([
        {
          id: 'g-c3-1',
          orderNumber: 'DSL-C3-1',
          customerName: 'Alice',
          customerEmail: 'alice@company.com',
          customerPhone: '0112345678',
          totalCents: 5000,
          paymentStatus: PaymentStatus.PAID,
          orderStatus: OrderStatus.DELIVERED,
          createdAt: new Date('2026-01-01'),
          refundRecords: [],
          addressSnapshot: null,
        },
        {
          id: 'g-c3-2',
          orderNumber: 'DSL-C3-2',
          customerName: 'Bob',
          customerEmail: 'bob@company.com',
          customerPhone: '0112345678',
          totalCents: 6000,
          paymentStatus: PaymentStatus.PAID,
          orderStatus: OrderStatus.DELIVERED,
          createdAt: new Date('2026-01-02'),
          refundRecords: [],
          addressSnapshot: null,
        },
      ]);

      const res = await service.findAll({ customerType: 'guest' });
      expect(res.items.length).toBe(2);
      expect(res.items[0].email).not.toBe(res.items[1].email);
    });

    it('Case 4: Shared family or business phone numbers (no email, different names) -> keeps distinct', async () => {
      mockPrisma.order.findMany.mockResolvedValueOnce([
        {
          id: 'g-c4-1',
          orderNumber: 'DSL-C4-1',
          customerName: 'Father Perera',
          customerEmail: null,
          customerPhone: '0112345678',
          totalCents: 4000,
          paymentStatus: PaymentStatus.PAID,
          orderStatus: OrderStatus.DELIVERED,
          createdAt: new Date('2026-01-01'),
          refundRecords: [],
          addressSnapshot: null,
        },
        {
          id: 'g-c4-2',
          orderNumber: 'DSL-C4-2',
          customerName: 'Son Perera',
          customerEmail: null,
          customerPhone: '0112345678',
          totalCents: 5000,
          paymentStatus: PaymentStatus.PAID,
          orderStatus: OrderStatus.DELIVERED,
          createdAt: new Date('2026-01-02'),
          refundRecords: [],
          addressSnapshot: null,
        },
      ]);

      const res = await service.findAll({ customerType: 'guest' });
      expect(res.items.length).toBe(2);
      const names = res.items.map((i) => i.name);
      expect(names).toContain('Father Perera');
      expect(names).toContain('Son Perera');
    });

    it('Case 5: Missing email or phone -> isolates correctly and falls back to order ID if both missing', async () => {
      mockPrisma.order.findMany.mockResolvedValueOnce([
        {
          id: 'g-c5-1',
          orderNumber: 'DSL-C5-1',
          customerName: 'Anon One',
          customerEmail: null,
          customerPhone: null,
          totalCents: 3000,
          paymentStatus: PaymentStatus.PAID,
          orderStatus: OrderStatus.DELIVERED,
          createdAt: new Date('2026-01-01'),
          refundRecords: [],
          addressSnapshot: null,
        },
        {
          id: 'g-c5-2',
          orderNumber: 'DSL-C5-2',
          customerName: 'Anon Two',
          customerEmail: null,
          customerPhone: null,
          totalCents: 4000,
          paymentStatus: PaymentStatus.PAID,
          orderStatus: OrderStatus.DELIVERED,
          createdAt: new Date('2026-01-02'),
          refundRecords: [],
          addressSnapshot: null,
        },
      ]);

      const res = await service.findAll({ customerType: 'guest' });
      expect(res.items.length).toBe(2);
      expect(res.items[0].id).not.toBe(res.items[1].id);
    });

    it('Case 6: Conflicting customer names sharing same email -> keeps distinct to avoid silent conflation', async () => {
      mockPrisma.order.findMany.mockResolvedValueOnce([
        {
          id: 'g-c6-1',
          orderNumber: 'DSL-C6-1',
          customerName: 'Kasun Perera',
          customerEmail: 'office@institution.edu',
          customerPhone: '0112000000',
          totalCents: 5000,
          paymentStatus: PaymentStatus.PAID,
          orderStatus: OrderStatus.DELIVERED,
          createdAt: new Date('2026-01-01'),
          refundRecords: [],
          addressSnapshot: null,
        },
        {
          id: 'g-c6-2',
          orderNumber: 'DSL-C6-2',
          customerName: 'Saman Silva',
          customerEmail: 'office@institution.edu',
          customerPhone: '0112000000',
          totalCents: 7000,
          paymentStatus: PaymentStatus.PAID,
          orderStatus: OrderStatus.DELIVERED,
          createdAt: new Date('2026-01-02'),
          refundRecords: [],
          addressSnapshot: null,
        },
      ]);

      const res = await service.findAll({ customerType: 'guest' });
      expect(res.items.length).toBe(2);
      const names = res.items.map((i) => i.name);
      expect(names).toContain('Kasun Perera');
      expect(names).toContain('Saman Silva');
    });

    it('Case 7: Multiple orders from the same contact -> aggregates order count, dates, and spend', async () => {
      mockPrisma.order.findMany.mockResolvedValueOnce([
        {
          id: 'g-c7-1',
          orderNumber: 'DSL-C7-1',
          customerName: 'Repeat Buyer',
          customerEmail: 'repeat@example.com',
          customerPhone: '0779991111',
          totalCents: 10000,
          paymentStatus: PaymentStatus.PAID,
          orderStatus: OrderStatus.DELIVERED,
          createdAt: new Date('2026-01-01'),
          refundRecords: [],
          addressSnapshot: null,
        },
        {
          id: 'g-c7-2',
          orderNumber: 'DSL-C7-2',
          customerName: 'Repeat Buyer',
          customerEmail: 'repeat@example.com',
          customerPhone: '0779991111',
          totalCents: 15000,
          paymentStatus: PaymentStatus.PAID,
          orderStatus: OrderStatus.DELIVERED,
          createdAt: new Date('2026-01-05'),
          refundRecords: [],
          addressSnapshot: null,
        },
        {
          id: 'g-c7-3',
          orderNumber: 'DSL-C7-3',
          customerName: 'Repeat Buyer',
          customerEmail: 'repeat@example.com',
          customerPhone: '0779991111',
          totalCents: 20000,
          paymentStatus: PaymentStatus.PAID,
          orderStatus: OrderStatus.DELIVERED,
          createdAt: new Date('2026-01-10'),
          refundRecords: [],
          addressSnapshot: null,
        },
      ]);

      const res = await service.findAll({ customerType: 'guest' });
      expect(res.items.length).toBe(1);
      expect(res.items[0].orderCount).toBe(3);
      expect(res.items[0].totalSpendCents).toBe(45000);
      expect(res.items[0].firstPurchaseDate).toEqual(new Date('2026-01-01'));
      expect(res.items[0].lastPurchaseDate).toEqual(new Date('2026-01-10'));
    });

    it('Case 8: Guest orders placed before a customer registers -> kept in guest view without contaminating registered user account', async () => {
      // When querying registered customers, mockPrisma.user.findMany returns registered users and their user-linked orders
      const resRegistered = await service.findAll({ customerType: 'registered' });
      expect(resRegistered.items.every((c) => c.customerType === 'REGISTERED')).toBe(true);
      // Registered user only has their authenticated orders, guest orders (userId: null) are not silently absorbed
      for (const item of resRegistered.items) {
        expect(item.id.startsWith('cust-')).toBe(true);
      }
    });
  });

  describe('findAll — Search & Multi-Filters', () => {
    it('searches across customer name, email, phone, and order number', async () => {
      // By order number
      const resOrder = await service.findAll({ search: 'DSL-2026-1002' });
      expect(resOrder.items.length).toBe(1);
      expect(resOrder.items[0].name).toBe('Anura Bandara');

      // By phone substring
      const resPhone = await service.findAll({ search: '3334455' });
      expect(resPhone.items.length).toBe(1);
      expect(resPhone.items[0].name).toBe('Kamal Silva');

      // By email substring
      const resEmail = await service.findAll({ search: 'dilani' });
      expect(resEmail.items.length).toBe(1);
      expect(resEmail.items[0].name).toBe('Dilani Perera');
    });

    it('filters by district', async () => {
      const resKandy = await service.findAll({ district: 'Kandy' });
      expect(resKandy.items.length).toBe(1);
      expect(resKandy.items[0].name).toBe('Dilani Perera');

      const resGalle = await service.findAll({ district: 'Galle' });
      expect(resGalle.items.length).toBe(1);
      expect(resGalle.items[0].name).toBe('Sunil Fernando');
    });

    it('filters by hasOrders (with_orders vs no_orders)', async () => {
      const resNoOrders = await service.findAll({ hasOrders: 'no_orders' });
      expect(resNoOrders.items.length).toBe(1);
      expect(resNoOrders.items[0].name).toBe('Dilani Perera');

      const resWithOrders = await service.findAll({ hasOrders: 'with_orders' });
      expect(resWithOrders.items.length).toBe(3);
    });

    it('filters by order count and spend range', async () => {
      const resSpend = await service.findAll({ minSpendCents: 50000 });
      expect(resSpend.items.length).toBe(2); // Anura (80,000) and Kamal (70,000)

      const resCount = await service.findAll({ minOrderCount: 2 });
      expect(resCount.items.length).toBe(2); // Anura (2 orders) and Kamal (2 orders)
    });

    it('sorts customers by totalSpendCents, orderCount, name', async () => {
      const resSpendDesc = await service.findAll({ sortBy: 'totalSpendCents', sortOrder: 'desc' });
      expect(resSpendDesc.items[0].name).toBe('Anura Bandara'); // 80,000 cents
      expect(resSpendDesc.items[1].name).toBe('Kamal Silva'); // 70,000 cents

      const resNameAsc = await service.findAll({ sortBy: 'name', sortOrder: 'asc' });
      expect(resNameAsc.items[0].name).toBe('Anura Bandara');
    });

    it('paginates accurately', async () => {
      const page1 = await service.findAll({ page: 1, limit: 2 });
      expect(page1.items.length).toBe(2);
      expect(page1.pagination.totalPages).toBe(2);
      expect(page1.pagination.total).toBe(4);

      const page2 = await service.findAll({ page: 2, limit: 2 });
      expect(page2.items.length).toBe(2);
      expect(page2.items[0].id).not.toBe(page1.items[0].id);
    });
  });

  describe('findById — Profiles', () => {
    it('retrieves registered customer profile with orders, summary, and addresses', async () => {
      const detail = await service.findById('cust-1');
      expect(detail.id).toBe('cust-1');
      expect(detail.customerType).toBe('REGISTERED');
      expect(detail.name).toBe('Anura Bandara');
      expect(detail.orders.length).toBe(2);
      expect(detail.orderSummary.totalOrders).toBe(2);
      expect(detail.orderSummary.totalSpendCents).toBe(80000);
      expect(detail.orderSummary.averageOrderValueCents).toBe(40000);
      expect(detail.addresses.length).toBe(1);
      expect(detail.wishlistCount).toBe(2);
    });

    it('retrieves guest customer profile with associated guest orders', async () => {
      const guestId = `guest:${encodeURIComponent('email:kamal@guest.lk')}`;
      const detail = await service.findById(guestId);
      expect(detail.id).toBe(guestId);
      expect(detail.customerType).toBe('GUEST');
      expect(detail.name).toBe('Kamal Silva');
      expect(detail.orders.length).toBe(2);
      expect(detail.orderSummary.totalOrders).toBe(2);
      expect(detail.orderSummary.totalSpendCents).toBe(70000);
      expect(detail.wishlistCount).toBe(0);
      expect(detail.isActive).toBe(true);
    });

    it('calculates AOV = Net Purchase Value / Paid Non-Cancelled Order Count and returns zero when no qualifying paid orders exist', async () => {
      // cust-2 has 0 orders
      const detailZero = await service.findById('cust-2');
      expect(detailZero.orderSummary.totalOrders).toBe(0);
      expect(detailZero.orderSummary.totalSpendCents).toBe(0);
      expect(detailZero.orderSummary.averageOrderValueCents).toBe(0);

      // User with 1 paid order (10000 with 2000 refund = 8000 net) and 1 cancelled order
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'cust-aov',
        name: 'AOV User',
        email: 'aov@example.com',
        phone: '0771234567',
        isActive: true,
        isEmailVerified: true,
        role: UserRole.CUSTOMER,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
        addresses: [],
        _count: { wishlist: 0, savedLists: 0, savedStationeryLists: 0 },
      });
      mockPrisma.order.findMany.mockResolvedValueOnce([
        {
          id: 'ord-paid',
          orderNumber: 'DSL-PAID',
          totalCents: 10000,
          paymentMethod: 'CASH_ON_DELIVERY',
          paymentStatus: PaymentStatus.PAID,
          orderStatus: OrderStatus.DELIVERED,
          createdAt: new Date('2026-01-01'),
          refundRecords: [{ amountCents: 2000 }],
          _count: { items: 2 },
        },
        {
          id: 'ord-cancelled',
          orderNumber: 'DSL-CANCELLED',
          totalCents: 5000,
          paymentMethod: 'CARD_PAYHERE',
          paymentStatus: PaymentStatus.FAILED,
          orderStatus: OrderStatus.CANCELLED,
          createdAt: new Date('2026-01-02'),
          refundRecords: [],
          _count: { items: 1 },
        },
      ]);

      const detailAov = await service.findById('cust-aov');
      expect(detailAov.orderSummary.totalOrders).toBe(2);
      expect(detailAov.orderSummary.totalSpendCents).toBe(8000); // 10000 - 2000
      // AOV = Net Purchase Value (8000) / Paid Non-Cancelled Orders (1) = 8000 (not 8000 / 2 = 4000)
      expect(detailAov.orderSummary.averageOrderValueCents).toBe(8000);
    });

    it('throws NotFoundException when customer or guest is not found', async () => {
      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
      await expect(service.findById('guest:non-existent-guest')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus & Audit Logging', () => {
    it('updates active status of registered customer and creates audit log', async () => {
      const updated = await service.updateStatus('cust-1', {
        isActive: false,
        reason: 'Payment disputes',
      }, 'admin-123');

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
          userId: 'admin-123',
        })
      );
    });

    it('rejects status update on guest buyers with BadRequestException', async () => {
      await expect(
        service.updateStatus('guest:email:kamal@guest.lk', { isActive: false })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAnalytics', () => {
    it('aggregates real customer counts and metrics across registered and guest buyers', async () => {
      const analytics = await service.getAnalytics();
      expect(analytics.registeredCustomers).toBe(2);
      expect(analytics.guestBuyers).toBe(2); // Kamal Silva + Sunil Fernando
      expect(analytics.totalCustomers).toBe(4);
      expect(analytics.activeCustomers).toBe(3); // 1 active registered + 2 guest buyers
      expect(analytics.inactiveCustomers).toBe(1); // 1 inactive registered
      expect(analytics.customersWithOrders).toBe(3); // 1 registered with orders + 2 guest buyers
      expect(analytics.customersWithoutOrders).toBe(1); // 1 registered with 0 orders
      expect(analytics.totalCustomerRevenueCents).toBe(165000); // 80,000 reg + 70,000 Kamal + 15,000 Sunil
      expect(analytics.averageOrderValueCents).toBe(33000); // 165000 / 5 paid orders
      expect(analytics.byDistrict.length).toBeGreaterThan(0);
    });
  });

  describe('exportCustomers', () => {
    it('exports customers to XLSX buffer with proper headers and data', async () => {
      const result = await service.exportCustomers({ customerType: 'all' }, 'xlsx');
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(result.filename).toContain('.xlsx');
    });

    it('exports customers to CSV buffer with formula injection protection', async () => {
      const result = await service.exportCustomers({ customerType: 'all' }, 'csv');
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.mimeType).toBe('text/csv');
      expect(result.filename).toContain('.csv');
      const csvContent = result.buffer.toString('utf-8');
      expect(csvContent).toContain('Customer ID');
      expect(csvContent).toContain('Type');
      expect(csvContent).toContain('Anura Bandara');
      expect(csvContent).toContain('Kamal Silva');
    });

    it('exports only selected customer IDs when selectedIds are passed', async () => {
      const result = await service.exportCustomers(
        { customerType: 'all' },
        'csv',
        ['cust-1']
      );
      const csvContent = result.buffer.toString('utf-8');
      expect(csvContent).toContain('Anura Bandara');
      expect(csvContent).not.toContain('Dilani Perera');
    });
  });
});
