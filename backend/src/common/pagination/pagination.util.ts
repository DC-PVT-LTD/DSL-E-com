import { z } from 'zod';
import { PaginationMeta } from '../interfaces/api-response.interface';

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

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
 * Base pagination query schema with validation for page, limit, and sortOrder.
 */
export const basePaginationSchema = z.object({
  page: z
    .union([z.string(), z.number()])
    .optional()
    .default(DEFAULT_PAGE)
    .transform((val) => (typeof val === 'string' ? parseInt(val, 10) : val))
    .refine((val) => !isNaN(val) && val >= 1, {
      message: 'page must be a positive integer >= 1',
    }),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .default(DEFAULT_LIMIT)
    .transform((val) => (typeof val === 'string' ? parseInt(val, 10) : val))
    .refine((val) => !isNaN(val) && val >= 1 && val <= MAX_LIMIT, {
      message: `limit must be an integer between 1 and ${MAX_LIMIT}`,
    }),
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
