import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryChangeReason } from '../../../generated/prisma';

export const adjustInventorySchema = z
  .object({
    productId: z.string().min(1, 'productId is required'),
    variantId: z.string().min(1, 'variantId cannot be empty').optional().nullable(),
    delta: z.number().int('delta must be an integer').optional(),
    targetQuantity: z.number().int('targetQuantity must be an integer').min(0, 'targetQuantity cannot be negative').optional(),
    reason: z.nativeEnum(InventoryChangeReason, {
      errorMap: () => ({
        message: `reason must be one of: ${Object.values(InventoryChangeReason).join(', ')}`,
      }),
    }),
    note: z.string().max(500, 'note cannot exceed 500 characters').optional().nullable(),
  })
  .refine(
    (data) => data.delta !== undefined || data.targetQuantity !== undefined,
    {
      message: 'Either delta or targetQuantity must be provided',
      path: ['delta'],
    }
  )
  .refine(
    (data) => data.delta === undefined || data.delta !== 0,
    {
      message: 'Adjustment delta cannot be 0',
      path: ['delta'],
    }
  );

export class AdjustInventoryDto {
  @ApiProperty({
    description: 'Target product ID',
    example: 'cmw07gefq0000pousyxdsoal6',
  })
  productId: string;

  @ApiPropertyOptional({
    description: 'Target variant ID (if adjusting a specific product variant)',
    example: 'cmw07gefq0001pousyxdsoal7',
    nullable: true,
  })
  variantId?: string | null;

  @ApiPropertyOptional({
    description: 'Signed stock delta (positive for restock/returns, negative for fulfillments/damages; cannot be 0)',
    example: 25,
  })
  delta?: number;

  @ApiPropertyOptional({
    description: 'Target total stock quantity (alternative to delta; must be >= 0)',
    example: 150,
  })
  targetQuantity?: number;

  @ApiProperty({
    description: 'Reason for the inventory change',
    enum: InventoryChangeReason,
    example: InventoryChangeReason.RESTOCK,
  })
  reason: InventoryChangeReason;

  @ApiPropertyOptional({
    description: 'Optional operational note or explanation',
    example: 'Received container delivery from Atlas warehouse',
    maxLength: 500,
    nullable: true,
  })
  note?: string | null;
}

