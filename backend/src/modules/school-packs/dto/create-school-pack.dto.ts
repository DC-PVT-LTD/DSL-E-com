import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const schoolPackItemInputSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  defaultQuantity: z.number().int().min(1, 'defaultQuantity must be at least 1'),
  substituteProductIds: z.array(z.string()).default([]),
});

export const createSchoolPackSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(120),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must consist of lowercase letters, numbers, and hyphens')
    .optional(),
  grade: z.string().min(1, 'Grade group is required'),
  tier: z.string().min(1, 'Tier is required'),
  description: z.string().min(5, 'Description must be at least 5 characters').max(2000),
  savingsPercentage: z
    .number()
    .int()
    .min(0, 'Savings percentage cannot be negative')
    .max(100, 'Savings percentage cannot exceed 100')
    .default(10),
  isActive: z.boolean().default(true),
  items: z
    .array(schoolPackItemInputSchema)
    .min(1, 'A school pack must include at least one product item'),
});

export const updateSchoolPackSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  grade: z.string().min(1).optional(),
  tier: z.string().min(1).optional(),
  description: z.string().min(5).max(2000).optional(),
  savingsPercentage: z.number().int().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  items: z.array(schoolPackItemInputSchema).min(1).optional(),
});

export class SchoolPackItemInputDto {
  @ApiProperty({ description: 'Real PostgreSQL product ID', example: 'prod-doms-colour-12' })
  productId: string;

  @ApiProperty({ description: 'Default quantity in pack', example: 1, minimum: 1 })
  defaultQuantity: number;

  @ApiPropertyOptional({
    description: 'Array of substitute product IDs',
    example: ['prod-camlin-water-colour-12'],
  })
  substituteProductIds?: string[];
}

export class CreateSchoolPackDto {
  @ApiProperty({ description: 'Pack title', example: 'Grade 1-2 Starter Stationery Pack' })
  name: string;

  @ApiPropertyOptional({ description: 'Unique slug', example: 'grade-1-2-starter-pack' })
  slug?: string;

  @ApiProperty({ description: 'Curriculum grade group', example: 'Grade 1-2' })
  grade: string;

  @ApiProperty({ description: 'Pack tier (essential, standard, premium)', example: 'essential' })
  tier: string;

  @ApiProperty({ description: 'Pack description', example: 'All required stationery for primary grades.' })
  description: string;

  @ApiPropertyOptional({ description: 'Discount percentage (0-100)', example: 10, default: 10 })
  savingsPercentage?: number;

  @ApiPropertyOptional({ description: 'Active visibility', example: true, default: true })
  isActive?: boolean;

  @ApiProperty({ description: 'Items included in the pack', type: [SchoolPackItemInputDto] })
  items: SchoolPackItemInputDto[];
}

export class UpdateSchoolPackDto {
  @ApiPropertyOptional({ description: 'Pack title' })
  name?: string;

  @ApiPropertyOptional({ description: 'Unique slug' })
  slug?: string;

  @ApiPropertyOptional({ description: 'Curriculum grade group' })
  grade?: string;

  @ApiPropertyOptional({ description: 'Pack tier' })
  tier?: string;

  @ApiPropertyOptional({ description: 'Pack description' })
  description?: string;

  @ApiPropertyOptional({ description: 'Discount percentage (0-100)' })
  savingsPercentage?: number;

  @ApiPropertyOptional({ description: 'Active visibility' })
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Items included in the pack', type: [SchoolPackItemInputDto] })
  items?: SchoolPackItemInputDto[];
}

