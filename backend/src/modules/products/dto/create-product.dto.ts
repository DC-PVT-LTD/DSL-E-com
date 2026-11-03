import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must consist of lowercase letters, numbers, and hyphens'),
  sku: z.string().min(2, 'SKU must be at least 2 characters'),
  barcode: z.string().optional(),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  shortDescription: z.string().min(3, 'Short description must be at least 3 characters'),
  categoryId: z.string().min(1, 'categoryId is required'),
  brandId: z.string().min(1, 'brandId is required'),
  priceCents: z.number().int().min(0, 'priceCents must be a non-negative integer'),
  compareAtPriceCents: z.number().int().min(0).optional(),
  costPriceCents: z.number().int().min(0).optional(),
  stockQuantity: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isNewArrival: z.boolean().default(false),
  isBestSeller: z.boolean().default(false),
  images: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  specifications: z.record(z.any()).default({}),
});

export const updateProductSchema = createProductSchema.partial();

export type CreateProductDto = z.infer<typeof createProductSchema>;
export type UpdateProductDto = z.infer<typeof updateProductSchema>;
