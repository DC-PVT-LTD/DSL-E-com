import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

describe('AuditController', () => {
  let controller: AuditController;
  let mockAuditService: any;

  beforeEach(() => {
    mockAuditService = {
      findAll: vi.fn(),
      getSummary: vi.fn(),
      findById: vi.fn(),
    };
    controller = new AuditController(mockAuditService as unknown as AuditService);
  });

  it('delegates query to auditService.findAll and returns paginated result', async () => {
    const mockResponse = {
      data: [
        {
          id: 'log-1',
          source: 'AUDIT_LOG',
          action: 'PRODUCT_CREATE',
          entityType: 'PRODUCT',
          entityId: 'p-1',
          description: 'Created product "Test Item"',
          actor: { id: 'admin-1', name: 'Admin', email: 'admin@dsl.lk', role: 'ADMIN' },
          timestamp: new Date().toISOString(),
          ipAddress: 'Not available',
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

  it('delegates summary retrieval to auditService.getSummary', async () => {
    const mockSummary = {
      totalEvents: 120,
      generalAuditEvents: 90,
      orderAuditEvents: 30,
      todayEvents: 8,
    };
    mockAuditService.getSummary.mockResolvedValue(mockSummary);

    const res = await controller.getSummary();
    expect(mockAuditService.getSummary).toHaveBeenCalled();
    expect(res).toEqual({
      success: true,
      data: mockSummary,
      message: 'Audit log summary metrics retrieved successfully',
    });
  });

  it('delegates single audit entry retrieval to auditService.findById', async () => {
    const mockEntry = {
      id: 'log-123',
      source: 'ORDER_AUDIT_LOG',
      action: 'STATUS_CHANGE',
      actor: { id: 'staff-1', name: 'Staff User' },
    };
    mockAuditService.findById.mockResolvedValue(mockEntry);

    const res = await controller.getAuditLogById('log-123', 'ORDER_AUDIT_LOG');
    expect(mockAuditService.findById).toHaveBeenCalledWith('log-123', 'ORDER_AUDIT_LOG');
    expect(res).toEqual({
      success: true,
      data: mockEntry,
      message: 'Audit log details retrieved successfully',
    });
  });
});
