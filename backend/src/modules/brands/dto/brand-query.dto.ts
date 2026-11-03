import { z } from 'zod';
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

export type BrandQueryDto = z.infer<typeof brandQuerySchema>;
