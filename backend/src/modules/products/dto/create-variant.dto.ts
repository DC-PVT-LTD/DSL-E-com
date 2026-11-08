import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const baseVariantSchema = z.object({
  name: z.string().min(2, 'Variant name must be at least 2 characters').optional(),
  title: z.string().min(2).optional(),
  sku: z.string().min(2, 'SKU must be at least 2 characters').optional().or(z.literal('')),
  priceCents: z.number().int('priceCents must be an integer').min(0, 'priceCents must be non-negative'),
  compareAtPriceCents: z.number().int('compareAtPriceCents must be an integer').min(0).optional().nullable(),
  stockQuantity: z.number().int('stockQuantity must be an integer').min(0).optional(),
  initialStock: z.number().int().min(0).optional(),
  attributes: z.record(z.any()).default({}),
  isActive: z.boolean().default(true),
});

export const createVariantSchema = baseVariantSchema.transform((val) => ({
  ...val,
  name: val.name || val.title || 'Standard Variant',
  stockQuantity: val.stockQuantity ?? val.initialStock ?? 0,
}));

export const updateVariantSchema = baseVariantSchema.partial().transform((val) => ({
  ...val,
  name: val.name || val.title || undefined,
  stockQuantity: val.stockQuantity ?? val.initialStock ?? undefined,
}));

export class CreateVariantDto {
  @ApiProperty({
    description: 'Variant name (e.g. "Single Line / Blue Ink")',
    example: 'Single Line / Blue Ink',
    minLength: 2,
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Unique Stock Keeping Unit (SKU) for this variant - Auto-generated if omitted',
    example: 'DSL-PEN-SPD-00001-V01',
    minLength: 2,
  })
  sku?: string;

  @ApiProperty({
    description: 'Selling price in integer cents (e.g. 7500 = Rs. 75.00)',
    example: 7500,
    minimum: 0,
  })
  priceCents: number;

  @ApiPropertyOptional({
    description: 'Original comparison price in integer cents (e.g. 9000 = Rs. 90.00)',
    example: 9000,
    nullable: true,
  })
  compareAtPriceCents?: number | null;

  @ApiPropertyOptional({
    description: 'Initial stock quantity for this variant (defaults to 0)',
    example: 25,
    default: 0,
    minimum: 0,
  })
  stockQuantity?: number;

  @ApiProperty({
    description: 'Arbitrary variant attributes (e.g. { color: "Blue", ruling: "Single Line" })',
    example: { color: 'Blue', ruling: 'Single Line' },
    default: {},
  })
  attributes: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Whether the variant is active and available for purchase',
    example: true,
    default: true,
  })
  isActive?: boolean;
}

export class UpdateVariantDto {
  @ApiPropertyOptional({
    description: 'Variant name',
    example: 'Single Line / Blue Ink Updated',
  })
  name?: string;

  @ApiPropertyOptional({
    description: 'Unique Stock Keeping Unit (SKU)',
    example: 'ATL-CR-120-SL-BL-V2',
  })
  sku?: string;

  @ApiPropertyOptional({
    description: 'Selling price in integer cents',
    example: 8000,
  })
  priceCents?: number;

  @ApiPropertyOptional({
    description: 'Comparison price in integer cents',
    example: 9500,
  })
  compareAtPriceCents?: number | null;

  @ApiPropertyOptional({
    description: 'Arbitrary variant attributes',
    example: { color: 'Navy Blue', ruling: 'Single Line' },
  })
  attributes?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Whether the variant is active',
    example: true,
  })
  isActive?: boolean;
}

