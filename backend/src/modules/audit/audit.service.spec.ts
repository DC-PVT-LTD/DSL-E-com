import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AuditService,
  redactSensitiveAuditData,
  isSensitiveKey,
  parseColomboDateRange,
  getStartOfTodayColombo,
} from './audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('AuditService', () => {
  let service: AuditService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      $queryRaw: vi.fn(),
      auditLog: {
        create: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
      },
      orderAuditLog: {
        create: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    service = new AuditService(mockPrisma as unknown as PrismaService);
  });

  describe('Security & Sensitive Data Redaction', () => {
    it('identifies sensitive keys regardless of case, separators, and naming conventions', () => {
      // Passwords
      expect(isSensitiveKey('password')).toBe(true);
      expect(isSensitiveKey('PASSWORD')).toBe(true);
      expect(isSensitiveKey('user_password_hash')).toBe(true);
      expect(isSensitiveKey('newPassword')).toBe(true);
      expect(isSensitiveKey('pass')).toBe(true);

      // Tokens & Secrets
      expect(isSensitiveKey('token')).toBe(true);
      expect(isSensitiveKey('access_token')).toBe(true);
      expect(isSensitiveKey('refreshToken')).toBe(true);
      expect(isSensitiveKey('AUTH_TOKEN')).toBe(true);
      expect(isSensitiveKey('client_secret')).toBe(true);
      expect(isSensitiveKey('JWT_SECRET')).toBe(true);
      expect(isSensitiveKey('jwt')).toBe(true);

      // API keys & Private keys
      expect(isSensitiveKey('apiKey')).toBe(true);
      expect(isSensitiveKey('api_key')).toBe(true);
      expect(isSensitiveKey('API_KEY')).toBe(true);
      expect(isSensitiveKey('private_key')).toBe(true);
      expect(isSensitiveKey('privateKey')).toBe(true);

      // Financial & Payment details
      expect(isSensitiveKey('creditCard')).toBe(true);
      expect(isSensitiveKey('credit_card_number')).toBe(true);
      expect(isSensitiveKey('card_number')).toBe(true);
      expect(isSensitiveKey('cvv')).toBe(true);
      expect(isSensitiveKey('CVV')).toBe(true);
      expect(isSensitiveKey('cvc')).toBe(true);
      expect(isSensitiveKey('accountnumber')).toBe(true);
      expect(isSensitiveKey('account_number')).toBe(true);

      // Cost price
      expect(isSensitiveKey('costPrice')).toBe(true);
      expect(isSensitiveKey('cost_price')).toBe(true);
      expect(isSensitiveKey('costPriceCents')).toBe(true);

      // Non-sensitive keys
      expect(isSensitiveKey('name')).toBe(false);
      expect(isSensitiveKey('priceCents')).toBe(false);
      expect(isSensitiveKey('orderNumber')).toBe(false);
      expect(isSensitiveKey('customerEmail')).toBe(false);
      expect(isSensitiveKey('description')).toBe(false);
    });

    it('redacts sensitive fields in deeply nested objects and arrays', () => {
      const payload = {
        title: 'Executive Pen',
        priceCents: 25000,
        COST_PRICE_CENTS: 12000,
        auth_details: {
          API_KEY: 'secret-key-123',
          nested: {
            client_secret: 'shhh',
            user_password: 'plainPassword123',
          },
        },
        items: [
          {
            sku: 'SKU-001',
            cost_price: 500,
            card_number: '4111222233334444',
            cvv: '999',
          },
        ],
        tags: ['stationery', 'luxury'],
      };

      const redacted = redactSensitiveAuditData(payload);

      expect(redacted.title).toBe('Executive Pen');
      expect(redacted.priceCents).toBe(25000);
      expect(redacted.COST_PRICE_CENTS).toBe('[REDACTED]');
      expect(redacted.auth_details.API_KEY).toBe('[REDACTED]');
      expect(redacted.auth_details.nested.client_secret).toBe('[REDACTED]');
      expect(redacted.auth_details.nested.user_password).toBe('[REDACTED]');
      expect(redacted.items[0].sku).toBe('SKU-001');
      expect(redacted.items[0].cost_price).toBe('[REDACTED]');
      expect(redacted.items[0].card_number).toBe('[REDACTED]');
      expect(redacted.items[0].cvv).toBe('[REDACTED]');
      expect(redacted.tags).toEqual(['stationery', 'luxury']);
    });

    it('redacts JWT tokens and bcrypt password hashes in string values', () => {
      const jwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHjvsnioQ_sample';
      const bcryptHash = '$2b$10$abcdefghijklmnopqrstuvwxyz0123456789012345678901234567';

      expect(redactSensitiveAuditData(jwtToken)).toBe('[REDACTED_TOKEN]');
      expect(redactSensitiveAuditData(bcryptHash)).toBe('[REDACTED_HASH]');
      expect(redactSensitiveAuditData('ordinary string')).toBe('ordinary string');
    });

    it('sanitizes changes and diffs without leaking sensitive attributes', () => {
      const oldObj = {
        name: 'DSL Notebook',
        priceCents: 1500,
        costPriceCents: 800,
        userPassword: 'old_secret_pass',
      };
      const newObj = {
        name: 'DSL Premium Notebook',
        priceCents: 2000,
        costPriceCents: 900,
        userPassword: 'new_secret_pass',
      };

      const diff = service.computeDiff(oldObj, newObj);
      expect(diff).toEqual({
        name: { old: 'DSL Notebook', new: 'DSL Premium Notebook' },
        priceCents: { old: 1500, new: 2000 },
      });
      expect(diff).not.toHaveProperty('costPriceCents');
      expect(diff).not.toHaveProperty('userPassword');
    });
  });

  describe('recordAuditLog', () => {
    it('creates an audit log row with sanitized changes and actor ID', async () => {
      const createdLog = {
        id: 'log-1',
        action: 'PRODUCT_UPDATE',
        entityType: 'product',
        entityId: 'prod-123',
        description: 'Updated product title | {"name":{"old":"A","new":"B"}}',
        userId: 'admin-user-1',
        createdAt: new Date(),
      };
      mockPrisma.auditLog.create.mockResolvedValue(createdLog);

      const result = await service.recordAuditLog({
        action: 'PRODUCT_UPDATE',
        entityType: 'product',
        entityId: 'prod-123',
        userId: 'admin-user-1',
        summary: 'Updated product title',
        changes: {
          name: { old: 'A', new: 'B' },
          costPriceCents: { old: 500, new: 600 },
        },
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: 'PRODUCT_UPDATE',
          entityType: 'product',
          entityId: 'prod-123',
          description: 'Updated product title | {"name":{"old":"A","new":"B"}}',
          userId: 'admin-user-1',
        },
      });
      expect(result).toEqual(createdLog);
    });

    it('uses provided transaction client when passed', async () => {
      const txMock = {
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: 'log-tx' }),
        },
      };

      await service.recordAuditLog(
        {
          action: 'CATEGORY_CREATE',
          entityType: 'category',
          entityId: 'cat-456',
          userId: 'mgr-1',
          summary: 'Created category',
        },
        txMock as any
      );

      expect(txMock.auditLog.create).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
    });
  });

  describe('Cross-Source Global Pagination & Deterministic Sorting', () => {
    it('handles more than 500 records in one source and executes deep pagination', async () => {
      // Simulate page 26 with limit 20 (skip: 500) where total is 800 items
      const mockRows = Array.from({ length: 20 }, (_, idx) => ({
        id: `audit-${501 + idx}`,
        source: 'AUDIT_LOG',
        action: 'PRODUCT_UPDATE',
        entityType: 'product',
        entityId: `prod-${501 + idx}`,
        description: `Updated product ${501 + idx}`,
        actorId: 'admin-1',
        actorName: 'Admin User',
        actorEmail: 'admin@dsl.lk',
        actorRole: 'ADMIN',
        orderNumber: null,
        fieldChanged: null,
        previousValue: null,
        newValue: null,
        reason: null,
        createdAt: new Date('2026-02-01T10:00:00Z'),
      }));

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockRows)
        .mockResolvedValueOnce([{ count: 800 }]);

      const result = await service.findAll({
        page: 26,
        limit: 20,
        source: 'ALL',
      });

      expect(result.data).toHaveLength(20);
      expect(result.data[0].id).toBe('audit-501');
      expect(result.data[19].id).toBe('audit-520');
      expect(result.meta.page).toBe(26);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.totalItems).toBe(800);
      expect(result.meta.totalPages).toBe(40);
      expect(result.meta.hasNextPage).toBe(true);
      expect(result.meta.hasPreviousPage).toBe(true);
    });

    it('unifies mixed records from both sources with accurate attributes', async () => {
      const mockRawRows = [
        {
          id: 'ord-101',
          source: 'ORDER_AUDIT_LOG',
          action: 'ORDER_STATUS_CHANGED',
          entityType: 'ORDER',
          entityId: 'ord-uuid-1',
          description: 'Payment verified',
          actorId: 'staff-1',
          actorName: 'Staff Member',
          actorEmail: null,
          actorRole: 'STAFF',
          orderNumber: 'DSL-2026-001',
          fieldChanged: 'status',
          previousValue: 'PENDING',
          newValue: 'PAID',
          reason: 'Bank transfer slip verified',
          createdAt: new Date('2026-03-01T12:00:00Z'),
        },
        {
          id: 'cat-202',
          source: 'AUDIT_LOG',
          action: 'CATEGORY_CREATE',
          entityType: 'CATEGORY',
          entityId: 'cat-uuid-2',
          description: 'Created category "Fine Liners" | {"slug":{"new":"fine-liners"}}',
          actorId: 'admin-1',
          actorName: 'Super Admin',
          actorEmail: 'admin@dsl.lk',
          actorRole: 'ADMIN',
          orderNumber: null,
          fieldChanged: null,
          previousValue: null,
          newValue: null,
          reason: null,
          createdAt: new Date('2026-03-01T11:00:00Z'),
        },
      ];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockRawRows)
        .mockResolvedValueOnce([{ count: 2 }]);

      const result = await service.findAll({ source: 'ALL' });

      expect(result.data).toHaveLength(2);
      // First is ORDER_AUDIT_LOG
      expect(result.data[0].id).toBe('ord-101');
      expect(result.data[0].source).toBe('ORDER_AUDIT_LOG');
      expect(result.data[0].orderNumber).toBe('DSL-2026-001');
      expect(result.data[0].fieldChanged).toBe('status');
      expect(result.data[0].actor.role).toBe('STAFF');

      // Second is AUDIT_LOG
      expect(result.data[1].id).toBe('cat-202');
      expect(result.data[1].source).toBe('AUDIT_LOG');
      expect(result.data[1].description).toBe('Created category "Fine Liners"');
      expect(result.data[1].metadata).toEqual({ slug: { new: 'fine-liners' } });
      expect(result.data[1].actor.role).toBe('ADMIN');
    });

    it('resolves actor role from user relation if available and returns null if unresolvable without inferring STAFF', async () => {
      // 1. When adminId is present and User relation exists
      const mappedWithUser = service.mapOrderAuditLogToUnified({
        id: 'ord-audit-1',
        orderId: 'ord-1',
        action: 'STATUS_CHANGE',
        adminId: 'admin-uuid-1',
        adminName: 'Actual Admin',
        createdAt: new Date(),
        admin: {
          id: 'admin-uuid-1',
          name: 'Actual Admin',
          email: 'admin@dsl.lk',
          role: 'ADMIN',
        },
      });
      expect(mappedWithUser.actor.role).toBe('ADMIN');
      expect(mappedWithUser.actor.email).toBe('admin@dsl.lk');

      // 2. When adminId is present but user cannot be established
      const mappedWithoutUser = service.mapOrderAuditLogToUnified({
        id: 'ord-audit-2',
        orderId: 'ord-2',
        action: 'STATUS_CHANGE',
        adminId: 'unresolvable-id',
        adminName: 'Former Employee',
        createdAt: new Date(),
      });
      expect(mappedWithoutUser.actor.role).toBeNull(); // Must NOT assume STAFF!

      // 3. When adminId is null (automated event)
      const mappedAutomated = service.mapOrderAuditLogToUnified({
        id: 'ord-audit-3',
        orderId: 'ord-3',
        action: 'STATUS_CHANGE',
        adminId: null,
        adminName: 'System',
        createdAt: new Date(),
      });
      expect(mappedAutomated.actor.role).toBe('SYSTEM');
    });

    it('guarantees deterministic ordering for records with identical timestamps using secondary sort by source and ID', async () => {
      const sameTime = new Date('2026-03-15T08:00:00.000Z');
      const mockRawRows = [
        {
          id: 'ord-a',
          source: 'ORDER_AUDIT_LOG',
          action: 'NOTE_ADDED',
          entityType: 'ORDER',
          entityId: 'o-1',
          description: 'Note',
          actorId: 'admin-1',
          actorName: 'Admin',
          actorEmail: 'admin@dsl.lk',
          actorRole: 'ADMIN',
          createdAt: sameTime,
        },
        {
          id: 'audit-a',
          source: 'AUDIT_LOG',
          action: 'SETTINGS_UPDATE',
          entityType: 'SETTINGS',
          entityId: 'default',
          description: 'Updated settings',
          actorId: 'admin-1',
          actorName: 'Admin',
          actorEmail: 'admin@dsl.lk',
          actorRole: 'ADMIN',
          createdAt: sameTime,
        },
      ];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(mockRawRows)
        .mockResolvedValueOnce([{ count: 2 }]);

      const result = await service.findAll({ sortOrder: 'desc' });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('ord-a');
      expect(result.data[0].source).toBe('ORDER_AUDIT_LOG');
      expect(result.data[1].id).toBe('audit-a');
      expect(result.data[1].source).toBe('AUDIT_LOG');
    });

    it('combines search and Asia/Colombo date filters simultaneously', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: 0 }]);

      await service.findAll({
        search: 'Atlas',
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
        source: 'ALL',
      });

      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2);
      // Both the items query and count query were called
    });

    it('ensures no duplicate or missing records across consecutive pages', async () => {
      const page1Rows = [
        { id: 'item-1', source: 'AUDIT_LOG', action: 'A', entityType: 'PROD', entityId: '1', createdAt: new Date() },
        { id: 'item-2', source: 'ORDER_AUDIT_LOG', action: 'B', entityType: 'ORDER', entityId: '2', createdAt: new Date() },
      ];
      const page2Rows = [
        { id: 'item-3', source: 'AUDIT_LOG', action: 'C', entityType: 'PROD', entityId: '3', createdAt: new Date() },
        { id: 'item-4', source: 'ORDER_AUDIT_LOG', action: 'D', entityType: 'ORDER', entityId: '4', createdAt: new Date() },
      ];

      mockPrisma.$queryRaw
        .mockResolvedValueOnce(page1Rows)
        .mockResolvedValueOnce([{ count: 4 }])
        .mockResolvedValueOnce(page2Rows)
        .mockResolvedValueOnce([{ count: 4 }]);

      const res1 = await service.findAll({ page: 1, limit: 2 });
      const res2 = await service.findAll({ page: 2, limit: 2 });

      const page1Ids = res1.data.map((r) => r.id);
      const page2Ids = res2.data.map((r) => r.id);

      // Verify no overlap
      const intersection = page1Ids.filter((id) => page2Ids.includes(id));
      expect(intersection).toHaveLength(0);

      // Verify union matches all 4 unique items
      const combined = [...page1Ids, ...page2Ids];
      expect(new Set(combined).size).toBe(4);
      expect(combined).toEqual(['item-1', 'item-2', 'item-3', 'item-4']);
    });
  });

  describe('getSummary', () => {
    it('aggregates total, general, order, and today audit event counts', async () => {
      mockPrisma.auditLog.count
        .mockResolvedValueOnce(100) // general total
        .mockResolvedValueOnce(15); // general today
      mockPrisma.orderAuditLog.count
        .mockResolvedValueOnce(50)  // order total
        .mockResolvedValueOnce(5);  // order today

      const summary = await service.getSummary();

      expect(summary.totalEvents).toBe(150);
      expect(summary.generalAuditEvents).toBe(100);
      expect(summary.orderAuditEvents).toBe(50);
      expect(summary.todayEvents).toBe(20);
    });
  });

  describe('findById', () => {
    it('retrieves an AuditLog by ID', async () => {
      const mockRecord = {
        id: 'audit-1',
        action: 'PRODUCT_CREATE',
        entityType: 'product',
        entityId: 'p-1',
        description: 'Created product',
        userId: 'admin-1',
        createdAt: new Date(),
        user: { id: 'admin-1', name: 'Admin', email: 'admin@dsl.lk', role: 'ADMIN' },
      };
      mockPrisma.auditLog.findUnique.mockResolvedValue(mockRecord);

      const result = await service.findById('audit-1', 'AUDIT_LOG');
      expect(result.id).toBe('audit-1');
      expect(result.source).toBe('AUDIT_LOG');
      expect(result.actor.name).toBe('Admin');
    });

    it('retrieves an OrderAuditLog by ID', async () => {
      const mockRecord = {
        id: 'ord-audit-1',
        orderId: 'ord-100',
        action: 'DELIVERY_UPDATE',
        fieldChanged: 'trackingNumber',
        previousValue: null,
        newValue: 'TRK-999',
        reason: 'Courier picked up',
        adminId: 'staff-1',
        adminName: 'Staff User',
        createdAt: new Date(),
        order: { id: 'ord-100', orderNumber: 'DSL-100', customerName: 'Buyer', customerEmail: 'b@test.lk' },
      };
      mockPrisma.orderAuditLog.findUnique.mockResolvedValue(mockRecord);

      const result = await service.findById('ord-audit-1', 'ORDER_AUDIT_LOG');
      expect(result.id).toBe('ord-audit-1');
      expect(result.source).toBe('ORDER_AUDIT_LOG');
      expect(result.orderNumber).toBe('DSL-100');
    });

    it('throws NotFoundException when record does not exist in either table', async () => {
      mockPrisma.auditLog.findUnique.mockResolvedValue(null);
      mockPrisma.orderAuditLog.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
