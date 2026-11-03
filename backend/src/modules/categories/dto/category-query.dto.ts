import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { createPaginationSchema } from '../../../common/pagination/pagination.util';

export const categorySortFields = ['displayOrder', 'name', 'createdAt'] as const;

export const categoryQuerySchema = createPaginationSchema(categorySortFields, 'displayOrder').extend({
  featured: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      if (typeof val === 'boolean') return val;
      return val === 'true' || val === '1';
    }),
  search: z.string().optional(),
});

export class CategoryQueryDto {
  @ApiPropertyOptional({ description: 'Page number for pagination', example: 1, default: 1 })
  page!: number;

  @ApiPropertyOptional({ description: 'Items per page (max 100)', example: 20, default: 20 })
  limit!: number;

  @ApiPropertyOptional({
    description: 'Field to sort categories by',
    enum: categorySortFields,
    default: 'displayOrder',
  })
  sortBy?: (typeof categorySortFields)[number];

  @ApiPropertyOptional({ description: 'Sort direction', enum: ['asc', 'desc'], default: 'asc' })
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ description: 'Filter only featured categories', example: true })
  featured?: boolean;

  @ApiPropertyOptional({ description: 'Search keyword matching category name or description', example: 'writing' })
  search?: string;
}
