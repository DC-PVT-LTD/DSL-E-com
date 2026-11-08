import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export const createCategorySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must consist of lowercase letters, numbers, and hyphens'),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  iconName: z.string().optional(),
  image: z.string().optional(),
  featured: z.boolean().optional().default(false),
  displayOrder: z.number().int().optional().default(0),
  parentId: z.string().nullable().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Category name',
    example: 'Pens & Writing Instruments',
    minLength: 2,
  })
  name: string;

  @ApiProperty({
    description: 'URL-friendly unique slug',
    example: 'pens-and-writing',
  })
  slug: string;

  @ApiProperty({
    description: 'Detailed category description',
    example: 'Ballpoint pens, gel pens, fountain pens, markers, and highlighters for students and professionals.',
    minLength: 5,
  })
  description: string;

  @ApiPropertyOptional({
    description: 'Lucide icon name identifier',
    example: 'PenTool',
  })
  iconName?: string;

  @ApiPropertyOptional({
    description: 'Cover / banner image URL',
    example: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=800',
  })
  image?: string;

  @ApiPropertyOptional({
    description: 'Whether category is featured on the homepage navigation',
    example: true,
    default: false,
  })
  featured?: boolean;

  @ApiPropertyOptional({
    description: 'Display order priority (ascending)',
    example: 1,
    default: 0,
  })
  displayOrder?: number;

  @ApiPropertyOptional({
    description: 'Parent category ID for subcategories (null for top-level categories)',
    example: 'cmw01abc10000pous00010001',
    nullable: true,
  })
  parentId?: string | null;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
