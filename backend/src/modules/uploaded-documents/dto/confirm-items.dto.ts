import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const confirmItemsSchema = z.object({
  itemIds: z.array(z.string()).optional(),
  sessionId: z.string().optional(),
});

export class ConfirmItemsDto {
  @ApiPropertyOptional({
    description: 'Specific extracted item IDs to confirm and add to cart',
    example: ['item-1', 'item-2'],
  })
  itemIds?: string[];

  @ApiPropertyOptional({ description: 'Guest session ID if unauthenticated' })
  sessionId?: string;
}
