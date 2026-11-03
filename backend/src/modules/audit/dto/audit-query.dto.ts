import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  basePaginationSchema,
  BasePaginationQueryDto,
} from '../../../common/pagination/pagination.util';

export const auditLogSortFields = ['createdAt', 'entityType', 'action'] as const;

export const auditLogQuerySchema = basePaginationSchema.extend({
  entityType: z.string().trim().min(1).optional(),
  entityId: z.string().trim().min(1).optional(),
  action: z.string().trim().min(1).optional(),
  userId: z.string().trim().min(1).optional(),
  sortBy: z.enum(auditLogSortFields).default('createdAt'),
});

export class AuditLogQueryDto extends BasePaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by entity type (e.g. product, category, brand, variant)',
    example: 'product',
  })
  entityType?: string;

  @ApiPropertyOptional({
    description: 'Filter by specific entity ID',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  entityId?: string;

  @ApiPropertyOptional({
    description: 'Filter by action name (e.g. PRODUCT_CREATE, PRODUCT_UPDATE)',
    example: 'PRODUCT_UPDATE',
  })
  action?: string;

  @ApiPropertyOptional({
    description: 'Filter by the user ID who performed the action',
    example: 'usr_123456',
  })
  userId?: string;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: auditLogSortFields,
    default: 'createdAt',
  })
  sortBy?: (typeof auditLogSortFields)[number];
}

