import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryChangeReason } from '../../../generated/prisma';
import {
  basePaginationSchema,
  BasePaginationQueryDto,
} from '../../../common/pagination/pagination.util';

export const inventoryMovementQuerySchema = basePaginationSchema.extend({
  productId: z.string().optional(),
  variantId: z.string().optional(),
  reason: z.nativeEnum(InventoryChangeReason).optional(),
  startDate: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'startDate must be a valid ISO date string',
    }),
  endDate: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'endDate must be a valid ISO date string',
    }),
  sortBy: z
    .enum(['createdAt', 'changeAmount', 'newQuantity'])
    .optional()
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export class InventoryMovementQueryDto extends BasePaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter movements by product ID',
    example: 'cmw07gefq0000pousyxdsoal6',
  })
  productId?: string;

  @ApiPropertyOptional({
    description: 'Filter movements by variant ID',
    example: 'cmw07gefq0001pousyxdsoal7',
  })
  variantId?: string;

  @ApiPropertyOptional({
    description: 'Filter movements by change reason',
    enum: InventoryChangeReason,
  })
  reason?: InventoryChangeReason;

  @ApiPropertyOptional({
    description: 'Filter movements created on or after this ISO date (e.g. 2026-01-01 or 2026-01-01T00:00:00.000Z)',
    example: '2026-01-01',
  })
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter movements created on or before this ISO date',
    example: '2026-12-31',
  })
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Field to sort movements by',
    enum: ['createdAt', 'changeAmount', 'newQuantity'],
    default: 'createdAt',
  })
  sortBy?: 'createdAt' | 'changeAmount' | 'newQuantity';
}

export const lowStockQuerySchema = basePaginationSchema.extend({
  threshold: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => (val === undefined ? undefined : typeof val === 'string' ? parseInt(val, 10) : val))
    .refine((val) => val === undefined || (!isNaN(val) && val >= 0), {
      message: 'threshold must be a non-negative integer',
    }),
  categoryId: z.string().optional(),
  sortBy: z
    .enum(['stockQuantity', 'name', 'createdAt'])
    .optional()
    .default('stockQuantity'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

export class LowStockQueryDto extends BasePaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Custom stock threshold cutoff. If omitted, uses each product configured lowStockThreshold',
    example: 10,
    minimum: 0,
  })
  threshold?: number;

  @ApiPropertyOptional({
    description: 'Filter low-stock products by category ID',
    example: 'cmw07gefq0000pousyxdsoal0',
  })
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Field to sort low-stock products by',
    enum: ['stockQuantity', 'name', 'createdAt'],
    default: 'stockQuantity',
  })
  sortBy?: 'stockQuantity' | 'name' | 'createdAt';
}

