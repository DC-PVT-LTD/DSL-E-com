import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const calculatePackItemSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  variantId: z.string().optional().nullable(),
  quantity: z.number().int().min(0, 'quantity must be non-negative'),
});

export const calculateSchoolPackSchema = z.object({
  items: z.array(calculatePackItemSchema).min(1, 'At least one item must be submitted'),
});

export class CalculatePackItemDto {
  @ApiProperty({ description: 'Product ID', example: 'prod-doms-colour-12' })
  productId: string;

  @ApiPropertyOptional({ description: 'Optional variant ID' })
  variantId?: string | null;

  @ApiProperty({ description: 'Customized quantity', example: 2 })
  quantity: number;
}

export class CalculateSchoolPackDto {
  @ApiProperty({ description: 'List of customized items', type: [CalculatePackItemDto] })
  items: CalculatePackItemDto[];
}

