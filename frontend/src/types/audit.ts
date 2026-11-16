export type AuditSourceType = 'ALL' | 'AUDIT_LOG' | 'ORDER_AUDIT_LOG';

export interface UnifiedAuditActor {
  id: string | null;
  name: string;
  email?: string | null;
  role?: string | null;
}

export interface UnifiedAuditLogEntry {
  id: string;
  source: 'AUDIT_LOG' | 'ORDER_AUDIT_LOG';
  action: string;
  description: string;
  actor: UnifiedAuditActor;
  entityType: string;
  entityId: string;
  orderNumber?: string | null;
  fieldChanged?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  reason?: string | null;
  metadata?: Record<string, any> | null;
  timestamp: string;
  ipAddress: string;
}

export interface AuditSummaryResponse {
  totalEvents: number;
  generalAuditEvents: number;
  orderAuditEvents: number;
  todayEvents: number;
}

export interface AuditLogQueryFilters {
  page?: number;
  limit?: number;
  search?: string;
  source?: AuditSourceType;
  entityType?: string;
  entityId?: string;
  action?: string;
  actorId?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'createdAt' | 'action' | 'entityType';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedAuditResponse {
  items: UnifiedAuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
