import { z } from 'zod';
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

export type CategoryQueryDto = z.infer<typeof categoryQuerySchema>;
