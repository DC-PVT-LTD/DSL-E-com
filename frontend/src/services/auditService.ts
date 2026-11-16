import {
  UnifiedAuditLogEntry,
  AuditSummaryResponse,
  AuditLogQueryFilters,
  PaginatedAuditResponse,
} from '@/types/audit';
import { apiClient } from '@/lib/api/apiClient';

interface BackendPaginatedAuditResponse {
  data: UnifiedAuditLogEntry[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

class AuditService {
  /**
   * Fetches paginated unified audit logs from the backend with server-side filters and sorting.
   */
  public async fetchAuditLogs(
    filters: AuditLogQueryFilters = {}
  ): Promise<PaginatedAuditResponse> {
    const params: Record<string, string | number | undefined> = {
      page: filters.page || 1,
      limit: filters.limit || 20,
      search: filters.search?.trim() || undefined,
      source: filters.source && filters.source !== 'ALL' ? filters.source : undefined,
      action: filters.action || undefined,
      entityType: filters.entityType || undefined,
      entityId: filters.entityId || undefined,
      actorId: filters.actorId || filters.userId || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      sortBy: filters.sortBy || 'createdAt',
      sortOrder: filters.sortOrder || 'desc',
    };

    const res = await apiClient.get<BackendPaginatedAuditResponse>('audit-logs', {
      params,
    });

    if (res && Array.isArray(res.data)) {
      return {
        items: res.data,
        total: res.meta?.totalItems ?? res.data.length,
        page: res.meta?.page ?? Number(filters.page || 1),
        limit: res.meta?.limit ?? Number(filters.limit || 20),
        totalPages: res.meta?.totalPages ?? 1,
        hasNextPage: res.meta?.hasNextPage ?? false,
        hasPreviousPage: res.meta?.hasPreviousPage ?? false,
      };
    }

    return {
      items: [],
      total: 0,
      page: Number(filters.page || 1),
      limit: Number(filters.limit || 20),
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    };
  }

  /**
   * Fetches audit volume metrics (all-time total, general, order, today in Asia/Colombo).
   */
  public async fetchAuditSummary(): Promise<AuditSummaryResponse> {
    const res = await apiClient.get<{
      success: boolean;
      data: AuditSummaryResponse;
    }>('audit-logs/summary');

    if (res && res.data) {
      return res.data;
    }

    return {
      totalEvents: 0,
      generalAuditEvents: 0,
      orderAuditEvents: 0,
      todayEvents: 0,
    };
  }

  /**
   * Fetches full audit log details for a single record by ID.
   */
  public async fetchAuditLogById(
    id: string,
    source?: string
  ): Promise<UnifiedAuditLogEntry> {
    const res = await apiClient.get<{
      success: boolean;
      data: UnifiedAuditLogEntry;
    }>(`audit-logs/${encodeURIComponent(id)}`, {
      params: source ? { source } : undefined,
    });

    if (res && res.data) {
      return res.data;
    }

    throw new Error(`Audit log entry "${id}" not found.`);
  }
}

export const auditService = new AuditService();
