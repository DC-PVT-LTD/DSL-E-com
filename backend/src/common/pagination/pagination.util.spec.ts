import { describe, it, expect } from 'vitest';
import {
  createPaginationMeta,
  calculatePaginationSkip,
  basePaginationSchema,
  createPaginationSchema,
  toPrismaPagination,
} from './pagination.util';

describe('Pagination Utilities', () => {
  describe('createPaginationMeta', () => {
    it('computes correct metadata for first page', () => {
      const meta = createPaginationMeta(45, 1, 20);
      expect(meta).toEqual({
        page: 1,
        limit: 20,
        totalItems: 45,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: false,
      });
    });

    it('computes correct metadata for middle page', () => {
      const meta = createPaginationMeta(45, 2, 20);
      expect(meta).toEqual({
        page: 2,
        limit: 20,
        totalItems: 45,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true,
      });
    });

    it('computes correct metadata for last page', () => {
      const meta = createPaginationMeta(45, 3, 20);
      expect(meta).toEqual({
        page: 3,
        limit: 20,
        totalItems: 45,
        totalPages: 3,
        hasNextPage: false,
        hasPreviousPage: true,
      });
    });

    it('handles empty collections safely', () => {
      const meta = createPaginationMeta(0, 1, 20);
      expect(meta).toEqual({
        page: 1,
        limit: 20,
        totalItems: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });
  });

  describe('calculatePaginationSkip', () => {
    it('calculates correct offset for page 1', () => {
      expect(calculatePaginationSkip(1, 20)).toBe(0);
    });

    it('calculates correct offset for page 2', () => {
      expect(calculatePaginationSkip(2, 20)).toBe(20);
    });

    it('calculates correct offset for arbitrary page and limit', () => {
      expect(calculatePaginationSkip(4, 25)).toBe(75);
    });
  });

  describe('basePaginationSchema', () => {
    it('applies defaults when parameters are omitted', () => {
      const parsed = basePaginationSchema.parse({});
      expect(parsed).toEqual({
        page: 1,
        limit: 20,
        sortOrder: 'desc',
      });
    });

    it('parses valid string numbers into integers', () => {
      const parsed = basePaginationSchema.parse({
        page: '3',
        limit: '50',
        sortOrder: 'asc',
      });
      expect(parsed).toEqual({
        page: 3,
        limit: 50,
        sortOrder: 'asc',
      });
    });

    it('fails when page is less than 1', () => {
      expect(() => basePaginationSchema.parse({ page: '0' })).toThrow();
      expect(() => basePaginationSchema.parse({ page: '-5' })).toThrow();
    });

    it('fails on decimal string or number for page', () => {
      expect(() => basePaginationSchema.parse({ page: '1.5' })).toThrow();
      expect(() => basePaginationSchema.parse({ page: 1.5 })).toThrow();
    });

    it('fails on decimal string or number for limit', () => {
      expect(() => basePaginationSchema.parse({ limit: '2.5' })).toThrow();
      expect(() => basePaginationSchema.parse({ limit: 2.5 })).toThrow();
    });

    it('fails on empty string for page or limit', () => {
      expect(() => basePaginationSchema.parse({ page: '' })).toThrow();
      expect(() => basePaginationSchema.parse({ limit: '' })).toThrow();
    });

    it('fails on alphabetic string for page or limit', () => {
      expect(() => basePaginationSchema.parse({ page: 'abc' })).toThrow();
      expect(() => basePaginationSchema.parse({ limit: 'xyz' })).toThrow();
    });

    it('fails when limit exceeds maximum limit (100)', () => {
      expect(() => basePaginationSchema.parse({ limit: '101' })).toThrow();
    });

    it('fails on unsafe integers', () => {
      expect(() => basePaginationSchema.parse({ page: '9999999999999999999999' })).toThrow();
    });

    it('fails on invalid sortOrder', () => {
      expect(() => basePaginationSchema.parse({ sortOrder: 'sideways' })).toThrow();
    });
  });

  describe('createPaginationSchema with sort field whitelisting', () => {
    const productSortFields = ['createdAt', 'price', 'name'] as const;
    const productQuerySchema = createPaginationSchema(productSortFields, 'createdAt');

    it('accepts whitelisted sorting fields', () => {
      const parsed = productQuerySchema.parse({
        sortBy: 'price',
        sortOrder: 'asc',
      });
      expect(parsed.sortBy).toBe('price');
      expect(parsed.sortOrder).toBe('asc');
    });

    it('rejects arbitrary database columns not in the whitelist', () => {
      expect(() =>
        productQuerySchema.parse({
          sortBy: 'passwordHash',
        })
      ).toThrow();
    });

    it('maps correctly to Prisma pagination parameters', () => {
      const parsed = productQuerySchema.parse({
        page: 2,
        limit: 15,
        sortBy: 'price',
        sortOrder: 'asc',
      });

      const prismaParams = toPrismaPagination(parsed);
      expect(prismaParams).toEqual({
        skip: 15,
        take: 15,
        orderBy: { price: 'asc' },
      });
    });
  });
});
