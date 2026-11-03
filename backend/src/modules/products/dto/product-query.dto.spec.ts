import { describe, it, expect } from 'vitest';
import {
  productQuerySchema,
  strictBooleanQuery,
  priceQueryTransform,
  MAX_SUPPORTED_PRICE_CENTS,
} from './product-query.dto';

describe('ProductQueryDto Validation', () => {
  describe('Price Validation (priceQueryTransform & productQuerySchema)', () => {
    it('accepts valid integer prices', () => {
      const parsed = productQuerySchema.parse({ minPrice: '50000', maxPrice: '100000' });
      expect(parsed.minPrice).toBe(50000);
      expect(parsed.maxPrice).toBe(100000);
    });

    it('accepts and preserves decimal prices without truncation', () => {
      const parsed = productQuerySchema.parse({ minPrice: '42000.5' });
      expect(parsed.minPrice).toBe(42000.5);
    });

    it('rejects invalid strings for minPrice and maxPrice', () => {
      expect(() => productQuerySchema.parse({ minPrice: 'abc' })).toThrow();
      expect(() => productQuerySchema.parse({ maxPrice: 'xyz' })).toThrow();
    });

    it('rejects negative prices', () => {
      expect(() => productQuerySchema.parse({ minPrice: '-100' })).toThrow();
      expect(() => productQuerySchema.parse({ maxPrice: '-100' })).toThrow();
    });

    it('rejects empty supplied price values', () => {
      expect(() => productQuerySchema.parse({ minPrice: '' })).toThrow();
      expect(() => productQuerySchema.parse({ maxPrice: '' })).toThrow();
    });

    it('rejects when minPrice > maxPrice', () => {
      expect(() =>
        productQuerySchema.parse({ minPrice: '50000', maxPrice: '10000' })
      ).toThrow();
    });

    it('rejects extreme price exceeding PostgreSQL 32-bit INTEGER limit', () => {
      expect(() => productQuerySchema.parse({ minPrice: '999999999999999' })).toThrow();
      expect(() => productQuerySchema.parse({ minPrice: MAX_SUPPORTED_PRICE_CENTS + 1 })).toThrow();
    });

    it('accepts maximum supported price limit', () => {
      const parsed = productQuerySchema.parse({ minPrice: String(MAX_SUPPORTED_PRICE_CENTS) });
      expect(parsed.minPrice).toBe(MAX_SUPPORTED_PRICE_CENTS);
    });
  });

  describe('Boolean Query Validation (strictBooleanQuery)', () => {
    const fields = ['inStockOnly', 'isFeatured', 'isNewArrival', 'isBestSeller'] as const;

    fields.forEach((field) => {
      describe(field, () => {
        it('accepts "true" as true', () => {
          const parsed = productQuerySchema.parse({ [field]: 'true' });
          expect(parsed[field]).toBe(true);
        });

        it('accepts "false" as false', () => {
          const parsed = productQuerySchema.parse({ [field]: 'false' });
          expect(parsed[field]).toBe(false);
        });

        it('accepts "1" as true', () => {
          const parsed = productQuerySchema.parse({ [field]: '1' });
          expect(parsed[field]).toBe(true);
        });

        it('accepts "0" as false', () => {
          const parsed = productQuerySchema.parse({ [field]: '0' });
          expect(parsed[field]).toBe(false);
        });

        it('accepts boolean true and false', () => {
          expect(productQuerySchema.parse({ [field]: true })[field]).toBe(true);
          expect(productQuerySchema.parse({ [field]: false })[field]).toBe(false);
        });

        it('accepts numeric 1 and 0', () => {
          expect(productQuerySchema.parse({ [field]: 1 })[field]).toBe(true);
          expect(productQuerySchema.parse({ [field]: 0 })[field]).toBe(false);
        });

        it('rejects "maybe" with validation error', () => {
          expect(() => productQuerySchema.parse({ [field]: 'maybe' })).toThrow();
        });

        it('rejects empty supplied string with validation error', () => {
          expect(() => productQuerySchema.parse({ [field]: '' })).toThrow();
        });

        it('leaves field undefined when omitted', () => {
          const parsed = productQuerySchema.parse({});
          expect(parsed[field]).toBeUndefined();
        });
      });
    });
  });

  describe('Pagination Integration', () => {
    it('accepts valid page and limit', () => {
      const parsed = productQuerySchema.parse({ page: '1', limit: '5' });
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(5);
    });

    it('rejects decimal page and limit', () => {
      expect(() => productQuerySchema.parse({ page: '1.5', limit: '5' })).toThrow();
      expect(() => productQuerySchema.parse({ page: '1', limit: '2.5' })).toThrow();
    });

    it('rejects page 0 and negative page', () => {
      expect(() => productQuerySchema.parse({ page: '0', limit: '5' })).toThrow();
      expect(() => productQuerySchema.parse({ page: '-1', limit: '5' })).toThrow();
    });

    it('rejects limit exceeding 100', () => {
      expect(() => productQuerySchema.parse({ page: '1', limit: '101' })).toThrow();
    });
  });
});

