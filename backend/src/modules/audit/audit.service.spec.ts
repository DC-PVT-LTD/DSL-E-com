import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditService } from './audit.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AuditService', () => {
  let service: AuditService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      auditLog: {
        create: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
      },
    };
    service = new AuditService(mockPrisma as unknown as PrismaService);
  });

  describe('sanitizeChanges', () => {
    it('strips costPriceCents, password, and tokens from changes', () => {
      const rawChanges = {
        name: { old: 'Old Pen', new: 'New Pen' },
        priceCents: { old: 2000, new: 2500 },
        costPriceCents: { old: 1200, new: 1400 }, // Sensitive
        password: { old: 'oldHash', new: 'newHash' }, // Sensitive
        refreshToken: { old: 'token1', new: 'token2' }, // Sensitive
      };

      const sanitized = service.sanitizeChanges(rawChanges);
      expect(sanitized).toBeDefined();
      expect(sanitized).toHaveProperty('name');
      expect(sanitized).toHaveProperty('priceCents');
      expect(sanitized).not.toHaveProperty('costPriceCents');
      expect(sanitized).not.toHaveProperty('password');
      expect(sanitized).not.toHaveProperty('refreshToken');
    });

    it('returns undefined if all keys are sensitive or changes undefined', () => {
      expect(service.sanitizeChanges(undefined)).toBeUndefined();
      expect(
        service.sanitizeChanges({
          costPriceCents: { old: 100, new: 200 },
          secret: { old: 'a', new: 'b' },
        })
      ).toBeUndefined();
    });
  });

  describe('computeDiff', () => {
    it('computes modified keys between old and new objects excluding sensitive fields', () => {
      const oldObj = {
        name: 'DSL Eraser',
        priceCents: 1500,
        costPriceCents: 800,
        tags: ['stationery', 'office'],
      };
      const newObj = {
        name: 'DSL Premium Eraser',
        priceCents: 1800,
        costPriceCents: 900,
        tags: ['stationery', 'school'],
      };

      const diff = service.computeDiff(oldObj, newObj);
      expect(diff).toEqual({
        name: { old: 'DSL Eraser', new: 'DSL Premium Eraser' },
        priceCents: { old: 1500, new: 1800 },
        tags: { old: ['stationery', 'office'], new: ['stationery', 'school'] },
      });
      expect(diff).not.toHaveProperty('costPriceCents');
    });

    it('respects trackedKeys whitelist when provided', () => {
      const oldObj = { name: 'A', priceCents: 10, other: 'X' };
      const newObj = { name: 'B', priceCents: 10, other: 'Y' };

      const diff = service.computeDiff(oldObj, newObj, ['name', 'priceCents']);
      expect(diff).toEqual({
        name: { old: 'A', new: 'B' },
      });
      expect(diff).not.toHaveProperty('other');
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
          costPriceCents: { old: 500, new: 600 }, // must be stripped
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

  describe('findAll', () => {
    it('returns paginated audit logs with metadata', async () => {
      mockPrisma.auditLog.count.mockResolvedValue(1);
      mockPrisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          action: 'PRODUCT_CREATE',
          entityType: 'product',
          entityId: 'p-1',
          description: 'Created product',
          userId: 'user-1',
          createdAt: new Date(),
          user: { id: 'user-1', name: 'Admin', email: 'admin@dsl.lk', role: 'ADMIN' },
        },
      ]);

      const result = await service.findAll({
        page: 1,
        limit: 10,
        entityType: 'product',
      } as any);

      expect(result.data).toHaveLength(1);
      expect(result.meta.totalItems).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { entityType: 'product' },
          skip: 0,
          take: 10,
        })
      );
    });
  });
});

