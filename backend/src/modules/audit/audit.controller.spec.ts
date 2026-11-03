import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

describe('AuditController', () => {
  let controller: AuditController;
  let mockAuditService: any;

  beforeEach(() => {
    mockAuditService = {
      findAll: vi.fn(),
    };
    controller = new AuditController(mockAuditService as unknown as AuditService);
  });

  it('delegates query to auditService.findAll and returns paginated result', async () => {
    const mockResponse = {
      data: [
        {
          id: 'log-1',
          action: 'PRODUCT_CREATE',
          entityType: 'product',
          entityId: 'p-1',
          description: 'Created product "Test Item"',
          userId: 'admin-1',
          createdAt: new Date().toISOString(),
          user: { id: 'admin-1', name: 'Admin', email: 'admin@dsl.lk', role: 'ADMIN' },
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

    mockAuditService.findAll.mockResolvedValue(mockResponse);

    const query = { page: 1, limit: 20, entityType: 'product' };
    const result = await controller.getAuditLogs(query as any);

    expect(mockAuditService.findAll).toHaveBeenCalledWith(query);
    expect(result).toEqual(mockResponse);
  });
});

