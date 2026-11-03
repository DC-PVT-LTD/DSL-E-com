import { z } from 'zod';
import { createPaginationSchema } from '../../../common/pagination/pagination.util';

export const productSortFields = [
  'createdAt',
  'priceCents',
  'name',
  'rating',
  'stockQuantity',
] as const;

const booleanTransform = z
  .union([z.string(), z.boolean()])
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined;
    if (typeof val === 'boolean') return val;
    return val === 'true' || val === '1';
  });

const numberTransform = z
  .union([z.string(), z.number()])
  .optional()
  .transform((val) => {
    if (val === undefined || val === '') return undefined;
    const num = typeof val === 'number' ? val : parseInt(val, 10);
    return isNaN(num) ? undefined : num;
  });

export const productQuerySchema = createPaginationSchema(productSortFields, 'createdAt').extend({
  search: z.string().optional(),
  q: z.string().optional(),
  categoryId: z.string().optional(),
  categorySlug: z.string().optional(),
  brandId: z.string().optional(),
  brandSlug: z.string().optional(),
  minPrice: numberTransform,
  maxPrice: numberTransform,
  inStockOnly: booleanTransform,
  isFeatured: booleanTransform,
  isNewArrival: booleanTransform,
  isBestSeller: booleanTransform,
});

export type ProductQueryDto = z.infer<typeof productQuerySchema>;
