import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  basePaginationSchema,
  BasePaginationQueryDto,
} from '../../../common/pagination/pagination.util';

export const auditLogSortFields = ['createdAt', 'entityType', 'action'] as const;
export const auditSources = ['ALL', 'AUDIT_LOG', 'ORDER_AUDIT_LOG'] as const;

export const auditLogQuerySchema = basePaginationSchema.extend({
  search: z.string().trim().optional(),
  source: z.enum(auditSources).default('ALL').optional(),
  entityType: z.string().trim().min(1).optional(),
  entityId: z.string().trim().min(1).optional(),
  action: z.string().trim().min(1).optional(),
  actorId: z.string().trim().min(1).optional(),
  userId: z.string().trim().min(1).optional(), // Backward compatibility alias for actorId
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  sortBy: z.enum(auditLogSortFields).default('createdAt').optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
});

export class AuditLogQueryDto extends BasePaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Free-text search across action, description, reason, entityId, orderNumber, actor name or email',
    example: 'Atlas CR Book',
  })
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by audit source',
    enum: auditSources,
    default: 'ALL',
  })
  source?: (typeof auditSources)[number];

  @ApiPropertyOptional({
    description: 'Filter by entity type (e.g. product, category, brand, order, customer, settings)',
    example: 'product',
  })
  entityType?: string;

  @ApiPropertyOptional({
    description: 'Filter by specific entity ID or Order ID',
    example: 'cmw07gefq0000pousyxdsoal6',
  })
  entityId?: string;

  @ApiPropertyOptional({
    description: 'Filter by action name (e.g. PRODUCT_CREATE, STATUS_CHANGE, CUSTOMER_STATUS_UPDATE)',
    example: 'STATUS_CHANGE',
  })
  action?: string;

  @ApiPropertyOptional({
    description: 'Filter by the actor/user ID who performed the action',
    example: 'usr_123456',
  })
  actorId?: string;

  @ApiPropertyOptional({
    description: 'Alias for actorId (for backward compatibility)',
    example: 'usr_123456',
  })
  userId?: string;

  @ApiPropertyOptional({
    description: 'Inclusive start date filter (YYYY-MM-DD or ISO string in Asia/Colombo timezone)',
    example: '2026-01-01',
  })
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Inclusive end date filter (YYYY-MM-DD or ISO string in Asia/Colombo timezone)',
    example: '2026-01-31',
  })
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: auditLogSortFields,
    default: 'createdAt',
  })
  sortBy?: (typeof auditLogSortFields)[number];

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  sortOrder?: 'asc' | 'desc';
}
