import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMeta } from '../interfaces/api-response.interface';

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export class BasePaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (minimum 1)',
    example: 1,
    default: DEFAULT_PAGE,
    minimum: 1,
  })
  page!: number;

  @ApiPropertyOptional({
    description: `Number of items per page (maximum ${MAX_LIMIT})`,
    example: 20,
    default: DEFAULT_LIMIT,
    minimum: 1,
    maximum: MAX_LIMIT,
  })
  limit!: number;

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: ['asc', 'desc'],
    default: 'desc',
    example: 'desc',
  })
  sortOrder?: 'asc' | 'desc';
}

/**
 * Calculates pagination metadata safely.
 */
export function createPaginationMeta(
  totalItems: number,
  page: number,
  limit: number
): PaginationMeta {
  const safeTotal = Math.max(0, totalItems);
  const safeLimit = Math.max(1, limit);
  const totalPages = Math.ceil(safeTotal / safeLimit) || 1;
  const safePage = Math.max(1, page);

  return {
    page: safePage,
    limit: safeLimit,
    totalItems: safeTotal,
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPreviousPage: safePage > 1,
  };
}

/**
 * Computes Prisma skip value.
 */
export function calculatePaginationSkip(page: number, limit: number): number {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, limit);
  return (safePage - 1) * safeLimit;
}

/**
 * Helper to validate and transform integer query parameters safely without truncating decimals.
 */
function createSafeIntegerParam(
  defaultValue: number,
  min: number,
  max: number,
  paramName: string
) {
  return z
    .union([z.string(), z.number()])
    .optional()
    .default(defaultValue)
    .superRefine((val, ctx) => {
      if (typeof val === 'number') {
        if (!Number.isSafeInteger(val)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${paramName} must be a safe integer`,
          });
          return;
        }
        if (val < min || val > max) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${paramName} must be an integer between ${min} and ${max}`,
          });
          return;
        }
      } else if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed === '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${paramName} cannot be empty`,
          });
          return;
        }
        // Strict integer check: digits only (no decimals, signs, or alphabets)
        if (!/^\d+$/.test(trimmed)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${paramName} must be a valid integer`,
          });
          return;
        }
        const num = Number(trimmed);
        if (!Number.isSafeInteger(num)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${paramName} must be a safe integer`,
          });
          return;
        }
        if (num < min || num > max) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${paramName} must be an integer between ${min} and ${max}`,
          });
          return;
        }
      }
    })
    .transform((val) => (typeof val === 'number' ? val : Number(val.trim())));
}

/**
 * Base pagination query schema with validation for page, limit, and sortOrder.
 */
export const basePaginationSchema = z.object({
  page: createSafeIntegerParam(DEFAULT_PAGE, 1, Number.MAX_SAFE_INTEGER, 'page'),
  limit: createSafeIntegerParam(DEFAULT_LIMIT, 1, MAX_LIMIT, 'limit'),
  sortOrder: z
    .enum(['asc', 'desc'])
    .optional()
    .default('desc'),
});

export type BasePaginationQuery = z.infer<typeof basePaginationSchema>;

/**
 * Creates a module-specific pagination schema with whitelist validation for allowed sorting fields.
 * Prevents clients from requesting sorting on arbitrary database columns.
 */
export function createPaginationSchema<T extends readonly [string, ...string[]]>(
  allowedSortFields: T,
  defaultSortField?: T[number]
) {
  return basePaginationSchema.extend({
    sortBy: z
      .enum(allowedSortFields as unknown as [string, ...string[]])
      .optional()
      .default(defaultSortField || allowedSortFields[0]),
  });
}

/**
 * Converts validated pagination and sorting parameters to Prisma query options.
 */
export function toPrismaPagination<T extends { page: number; limit: number; sortBy?: string; sortOrder?: 'asc' | 'desc' }>(
  params: T
): { skip: number; take: number; orderBy?: Record<string, 'asc' | 'desc'> } {
  const skip = calculatePaginationSkip(params.page, params.limit);
  const take = params.limit;
  const orderBy = params.sortBy && params.sortOrder
    ? { [params.sortBy]: params.sortOrder }
    : undefined;

  return { skip, take, ...(orderBy ? { orderBy } : {}) };
}
