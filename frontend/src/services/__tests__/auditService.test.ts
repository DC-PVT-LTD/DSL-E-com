import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auditService } from '../auditService';
import { apiClient } from '@/lib/api/apiClient';

describe('auditService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchAuditLogs', () => {
    it('calls GET audit-logs with correct parameters and returns mapped paginated response', async () => {
      const mockResult = {
        data: [
          {
            id: 'audit-1',
            source: 'AUDIT_LOG',
            timestamp: '2026-03-30T10:00:00.000Z',
            actor: { id: 'admin-1', name: 'Super Admin', email: 'admin@dsl.lk', role: 'ADMIN' },
            action: 'PRODUCT_CREATE',
            entityType: 'PRODUCT',
            entityId: 'prod-123',
            description: 'Created product "Ballpoint Pen"',
            metadata: { title: 'Ballpoint Pen' },
          },
        ],
        meta: {
          page: 1,
          limit: 20,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };

      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockResult as any);

      const result = await auditService.fetchAuditLogs({
        page: 1,
        limit: 20,
        search: 'pen',
        source: 'AUDIT_LOG',
        action: 'PRODUCT_CREATE',
        entityType: 'PRODUCT',
        entityId: 'prod-123',
        actorId: 'admin-1',
        dateFrom: '2026-03-01',
        dateTo: '2026-03-31',
        sortBy: 'createdAt',
        sortOrder: 'asc',
      });

      expect(getSpy).toHaveBeenCalledWith(
        'audit-logs',
        expect.objectContaining({
          params: expect.objectContaining({
            page: 1,
            limit: 20,
            search: 'pen',
            source: 'AUDIT_LOG',
            action: 'PRODUCT_CREATE',
            entityType: 'PRODUCT',
            entityId: 'prod-123',
            actorId: 'admin-1',
            dateFrom: '2026-03-01',
            dateTo: '2026-03-31',
            sortBy: 'createdAt',
            sortOrder: 'asc',
          }),
        })
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('audit-1');
      expect(result.items[0].source).toBe('AUDIT_LOG');
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('omits source when source is ALL', async () => {
      const mockResult = {
        data: [],
        meta: { page: 1, limit: 20, totalItems: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false },
      };

      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockResult as any);

      await auditService.fetchAuditLogs({ source: 'ALL' });

      expect(getSpy).toHaveBeenCalledWith(
        'audit-logs',
        expect.objectContaining({
          params: expect.objectContaining({
            source: undefined,
          }),
        })
      );
    });

    it('returns empty fallback structure when res or res.data is missing', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce(null as any);

      const result = await auditService.fetchAuditLogs({ page: 2, limit: 10 });

      expect(result).toEqual({
        items: [],
        total: 0,
        page: 2,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });
  });

  describe('fetchAuditSummary', () => {
    it('calls GET audit-logs/summary and returns summary metrics', async () => {
      const mockSummary = {
        success: true,
        data: {
          totalEvents: 1402,
          generalAuditEvents: 1397,
          orderAuditEvents: 5,
          todayEvents: 12,
        },
      };

      vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockSummary as any);

      const result = await auditService.fetchAuditSummary();

      expect(result).toEqual({
        totalEvents: 1402,
        generalAuditEvents: 1397,
        orderAuditEvents: 5,
        todayEvents: 12,
      });
    });

    it('returns default fallback when response data is missing', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce(null as any);

      const result = await auditService.fetchAuditSummary();

      expect(result).toEqual({
        totalEvents: 0,
        generalAuditEvents: 0,
        orderAuditEvents: 0,
        todayEvents: 0,
      });
    });
  });

  describe('fetchAuditLogById', () => {
    it('calls GET audit-logs/:id with optional source query parameter', async () => {
      const mockEntry = {
        success: true,
        data: {
          id: 'order-audit-1',
          source: 'ORDER_AUDIT_LOG',
          timestamp: '2026-03-30T11:00:00.000Z',
          actor: { id: 'admin-1', name: 'Order Admin', email: null, role: 'ADMIN' },
          action: 'ORDER_STATUS_CHANGED',
          entityType: 'ORDER',
          entityId: 'ord-1001',
          description: 'Changed order status from PENDING to PROCESSING',
        },
      };

      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockEntry as any);

      const result = await auditService.fetchAuditLogById('order-audit-1', 'ORDER_AUDIT_LOG');

      expect(getSpy).toHaveBeenCalledWith('audit-logs/order-audit-1', {
        params: { source: 'ORDER_AUDIT_LOG' },
      });
      expect(result.id).toBe('order-audit-1');
      expect(result.action).toBe('ORDER_STATUS_CHANGED');
    });

    it('throws error when record is not found', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce(null as any);

      await expect(auditService.fetchAuditLogById('non-existent')).rejects.toThrow(
        'Audit log entry "non-existent" not found.'
      );
    });
  });
});
