import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

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

export class CreateBrandDto {
  @ApiProperty({
    description: 'Brand name',
    example: 'Atlas',
    minLength: 2,
  })
  name: string;

  @ApiProperty({
    description: 'URL-friendly unique slug',
    example: 'atlas',
  })
  slug: string;

  @ApiProperty({
    description: 'Brand description and heritage',
    example: 'Leading stationery and school supplies manufacturer in Sri Lanka with over 60 years of heritage.',
    minLength: 5,
  })
  description: string;

  @ApiPropertyOptional({
    description: 'Brand logo image URL',
    example: 'https://images.unsplash.com/photo-1585336261026-c4391e3e7f41',
  })
  logo?: string;

  @ApiProperty({
    description: 'Country of brand origin',
    example: 'Sri Lanka',
    minLength: 2,
  })
  originCountry: string;

  @ApiPropertyOptional({
    description: 'Whether brand is featured on storefront navigation',
    example: true,
    default: false,
  })
  featured?: boolean;
}

export class UpdateBrandDto extends PartialType(CreateBrandDto) {}
