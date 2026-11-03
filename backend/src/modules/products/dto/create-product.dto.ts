import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

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

export class CreateProductDto {
  @ApiProperty({
    description: 'Product name',
    example: 'Atlas Chooty Ballpoint Pen 0.5mm - Blue',
    minLength: 2,
  })
  name: string;

  @ApiProperty({
    description: 'URL-friendly unique product slug',
    example: 'atlas-chooty-ballpoint-pen-blue',
  })
  slug: string;

  @ApiProperty({
    description: 'Unique Stock Keeping Unit (SKU)',
    example: 'ATL-PEN-001',
    minLength: 2,
  })
  sku: string;

  @ApiPropertyOptional({
    description: 'Barcode (EAN/UPC)',
    example: '4792011001234',
  })
  barcode?: string;

  @ApiProperty({
    description: 'Detailed product description',
    example: 'Premium quality ballpoint pen with smooth ink flow for everyday writing.',
    minLength: 5,
  })
  description: string;

  @ApiProperty({
    description: 'Short summary for cards and search results',
    example: '0.5mm blue ballpoint pen with comfort grip.',
    minLength: 3,
  })
  shortDescription: string;

  @ApiProperty({
    description: 'Category ID foreign key',
    example: 'cmw01abc10000pous00010001',
  })
  categoryId: string;

  @ApiProperty({
    description: 'Brand ID foreign key',
    example: 'cmw01def20000pous00020002',
  })
  brandId: string;

  @ApiProperty({
    description: 'Retail price in Sri Lankan Rupee cents (e.g., LKR 120.00 = 12000 cents)',
    example: 12000,
    minimum: 0,
  })
  priceCents: number;

  @ApiPropertyOptional({
    description: 'Compare-at / MSRP price in cents',
    example: 15000,
    minimum: 0,
  })
  compareAtPriceCents?: number;

  @ApiPropertyOptional({
    description: 'Cost price in cents (admin only)',
    example: 8000,
    minimum: 0,
  })
  costPriceCents?: number;

  @ApiPropertyOptional({
    description: 'Initial available stock quantity',
    example: 250,
    default: 0,
    minimum: 0,
  })
  stockQuantity?: number;

  @ApiPropertyOptional({
    description: 'Threshold below which low-stock warning triggers',
    example: 15,
    default: 5,
    minimum: 0,
  })
  lowStockThreshold?: number;

  @ApiPropertyOptional({
    description: 'Whether product is active and visible in customer storefront',
    example: true,
    default: true,
  })
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Whether product is featured on homepage',
    example: false,
    default: false,
  })
  isFeatured?: boolean;

  @ApiPropertyOptional({
    description: 'Whether product is marked as new arrival',
    example: true,
    default: false,
  })
  isNewArrival?: boolean;

  @ApiPropertyOptional({
    description: 'Whether product is marked as best seller',
    example: false,
    default: false,
  })
  isBestSeller?: boolean;

  @ApiPropertyOptional({
    description: 'List of product image URLs',
    example: ['https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=800'],
  })
  images?: string[];

  @ApiPropertyOptional({
    description: 'Search and filter tags',
    example: ['pens', 'writing', 'atlas'],
  })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Key-value specifications dictionary',
    example: { 'Tip Size': '0.5mm', 'Ink Color': 'Blue' },
  })
  specifications?: Record<string, any>;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}
