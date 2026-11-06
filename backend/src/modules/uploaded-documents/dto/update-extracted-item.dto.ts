import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const updateExtractedItemSchema = z.object({
  quantity: z.number().int().min(1).max(1000).optional(),
  selectedProductId: z.string().optional(),
  selectedVariantId: z.string().optional().nullable(),
  isConfirmed: z.boolean().optional(),
  isSubstituted: z.boolean().optional(),
  itemDescription: z.string().optional(),
  rematch: z.boolean().optional(),
});

export class UpdateExtractedItemDto {
  @ApiPropertyOptional({ description: 'Confirmed quantity', example: 2 })
  quantity?: number;

  @ApiPropertyOptional({ description: 'Catalog product ID matched or substituted' })
  selectedProductId?: string;

  @ApiPropertyOptional({ description: 'Variant ID if applicable' })
  selectedVariantId?: string | null;

  @ApiPropertyOptional({ description: 'Whether the item is confirmed by the customer' })
  isConfirmed?: boolean;

  @ApiPropertyOptional({ description: 'Whether this item is an alternative/substitute' })
  isSubstituted?: boolean;

  @ApiPropertyOptional({ description: 'Updated item description' })
  itemDescription?: string;

  @ApiPropertyOptional({ description: 'Whether to trigger catalogue rematch with updated description' })
  rematch?: boolean;
}
