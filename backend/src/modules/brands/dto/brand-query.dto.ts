import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { createPaginationSchema } from '../../../common/pagination/pagination.util';

export const brandSortFields = ['name', 'createdAt', 'originCountry'] as const;

export const brandQuerySchema = createPaginationSchema(brandSortFields, 'name').extend({
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

export class BrandQueryDto {
  @ApiPropertyOptional({ description: 'Page number for pagination', example: 1, default: 1 })
  page!: number;

  @ApiPropertyOptional({ description: 'Items per page (max 100)', example: 20, default: 20 })
  limit!: number;

  @ApiPropertyOptional({
    description: 'Field to sort brands by',
    enum: brandSortFields,
    default: 'name',
  })
  sortBy?: (typeof brandSortFields)[number];

  @ApiPropertyOptional({ description: 'Sort direction', enum: ['asc', 'desc'], default: 'asc' })
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ description: 'Filter only featured brands', example: true })
  featured?: boolean;

  @ApiPropertyOptional({ description: 'Search keyword matching brand name, description, or country', example: 'atlas' })
  search?: string;
}
