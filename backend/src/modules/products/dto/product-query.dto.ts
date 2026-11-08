import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { createPaginationSchema } from '../../../common/pagination/pagination.util';

export const productSortFields = [
  'createdAt',
  'priceCents',
  'name',
  'rating',
  'stockQuantity',
] as const;

/**
 * Maximum 32-bit signed integer supported by PostgreSQL INTEGER column.
 * Used to reject out-of-range prices before query execution.
 */
export const MAX_SUPPORTED_PRICE_CENTS = 2147483647;

export const strictBooleanQuery = z
  .union([z.boolean(), z.string(), z.number()])
  .optional()
  .superRefine((val, ctx) => {
    if (val === undefined) return;
    if (typeof val === 'boolean') return;
    if (typeof val === 'number') {
      if (val === 1 || val === 0) return;
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Must be a boolean value (true, false, 1, or 0)',
      });
      return;
    }
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed === 'true' || trimmed === 'false' || trimmed === '1' || trimmed === '0') {
        return;
      }
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Must be a boolean value (true, false, 1, or 0)',
      });
    }
  })
  .transform((val) => {
    if (val === undefined) return undefined;
    if (typeof val === 'boolean') return val;
    if (val === 1 || val === '1' || val === 'true') return true;
    if (val === 0 || val === '0' || val === 'false') return false;
    return undefined;
  });

export const priceQueryTransform = z
  .union([z.string(), z.number()])
  .optional()
  .superRefine((val, ctx) => {
    if (val === undefined) return;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Price cannot be empty',
        });
        return;
      }
      // Non-negative integer or decimal string
      if (!/^\d+(\.\d+)?$/.test(trimmed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Price must be a valid non-negative number',
        });
        return;
      }
      const num = Number(trimmed);
      if (!Number.isFinite(num) || num < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Price must be a finite, non-negative number',
        });
        return;
      }
      if (num > MAX_SUPPORTED_PRICE_CENTS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Price exceeds maximum supported database value (${MAX_SUPPORTED_PRICE_CENTS})`,
        });
        return;
      }
    } else if (typeof val === 'number') {
      if (!Number.isFinite(val) || val < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Price must be a finite, non-negative number',
        });
        return;
      }
      if (val > MAX_SUPPORTED_PRICE_CENTS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Price exceeds maximum supported database value (${MAX_SUPPORTED_PRICE_CENTS})`,
        });
        return;
      }
    }
  })
  .transform((val) => {
    if (val === undefined) return undefined;
    return typeof val === 'number' ? val : Number(val.trim());
  });

export const productQuerySchema = createPaginationSchema(productSortFields, 'createdAt')
  .extend({
    search: z.string().optional(),
    q: z.string().optional(),
    categoryId: z.string().optional(),
    categorySlug: z.string().optional(),
    subcategoryId: z.string().optional(),
    brandId: z.string().optional(),
    brandSlug: z.string().optional(),
    minPrice: priceQueryTransform,
    maxPrice: priceQueryTransform,
    inStockOnly: strictBooleanQuery,
    isFeatured: strictBooleanQuery,
    isNewArrival: strictBooleanQuery,
    isBestSeller: strictBooleanQuery,
  })
  .refine(
    (data) => {
      if (data.minPrice !== undefined && data.maxPrice !== undefined) {
        return data.minPrice <= data.maxPrice;
      }
      return true;
    },
    {
      message: 'minPrice cannot be greater than maxPrice',
      path: ['minPrice'],
    }
  );

export class ProductQueryDto {
  @ApiPropertyOptional({ description: 'Page number for pagination', example: 1, default: 1 })
  page!: number;

  @ApiPropertyOptional({ description: 'Number of items per page (max 100)', example: 20, default: 20 })
  limit!: number;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: productSortFields,
    default: 'createdAt',
  })
  sortBy?: (typeof productSortFields)[number];

  @ApiPropertyOptional({ description: 'Sort direction', enum: ['asc', 'desc'], default: 'desc' })
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ description: 'Full-text search query across name, description, tags, and SKU', example: 'ballpoint' })
  search?: string;

  @ApiPropertyOptional({ description: 'Alternative search query keyword', example: 'pen' })
  q?: string;

  @ApiPropertyOptional({ description: 'Filter by Category UUID', example: 'cmw01abc10000pous00010001' })
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Filter by Category slug', example: 'pens-and-writing' })
  categorySlug?: string;

  @ApiPropertyOptional({ description: 'Filter by Subcategory UUID', example: 'cmw01sub10000pous00010001' })
  subcategoryId?: string;

  @ApiPropertyOptional({ description: 'Filter by Brand UUID', example: 'cmw01def20000pous00020002' })
  brandId?: string;

  @ApiPropertyOptional({ description: 'Filter by Brand slug', example: 'atlas' })
  brandSlug?: string;

  @ApiPropertyOptional({ description: 'Minimum price in cents (e.g. 5000 = LKR 50)', example: 5000 })
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Maximum price in cents (e.g. 50000 = LKR 500)', example: 50000 })
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Filter to products with stock > 0', example: true })
  inStockOnly?: boolean;

  @ApiPropertyOptional({ description: 'Filter to featured products', example: true })
  isFeatured?: boolean;

  @ApiPropertyOptional({ description: 'Filter to new arrival products', example: true })
  isNewArrival?: boolean;

  @ApiPropertyOptional({ description: 'Filter to best seller products', example: true })
  isBestSeller?: boolean;
}
