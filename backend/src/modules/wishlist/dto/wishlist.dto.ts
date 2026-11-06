import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const addWishlistItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
});

export class AddWishlistItemDto {
  @ApiProperty({ description: 'ID of the product to add to wishlist', example: 'cuid_prod_123' })
  productId!: string;
}

export interface WishlistItemResponseDto {
  id: string;
  productId: string;
  createdAt: Date;
  product: {
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
    brandName?: string;
  };
}

export interface WishlistResponseDto {
  items: WishlistItemResponseDto[];
  itemCount: number;
}
