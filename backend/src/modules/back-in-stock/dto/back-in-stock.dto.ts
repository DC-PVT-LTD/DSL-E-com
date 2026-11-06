import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';
import { BackInStockAlertStatus } from '../../../generated/prisma';

export const subscribeBackInStockSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
});

export class SubscribeBackInStockDto {
  @ApiProperty({ description: 'ID of the out-of-stock product to subscribe to', example: 'cuid_prod_123' })
  productId!: string;
}

export interface BackInStockAlertResponseDto {
  id: string;
  userId: string;
  productId: string;
  status: BackInStockAlertStatus;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  isAlreadySubscribed?: boolean;
  message?: string;
  product?: {
    id: string;
    name: string;
    slug: string;
    sku: string;
    priceCents: number;
    compareAtPriceCents?: number | null;
    stockQuantity: number;
    isActive: boolean;
    images: string[];
    categoryName?: string;
  };
}

