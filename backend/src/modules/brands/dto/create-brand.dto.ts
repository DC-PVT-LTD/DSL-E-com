import { z } from 'zod';

export const createBrandSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must consist of lowercase letters, numbers, and hyphens'),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  logo: z.string().optional(),
  originCountry: z.string().min(2, 'Origin country must be at least 2 characters'),
  featured: z.boolean().optional().default(false),
});

export const updateBrandSchema = createBrandSchema.partial();

export type CreateBrandDto = z.infer<typeof createBrandSchema>;
export type UpdateBrandDto = z.infer<typeof updateBrandSchema>;
