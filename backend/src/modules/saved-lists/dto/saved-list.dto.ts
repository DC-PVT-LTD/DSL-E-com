import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const createSavedListSchema = z.object({
  name: z.string().trim().min(1, 'List name is required').max(100, 'List name cannot exceed 100 characters'),
});

export class CreateSavedListDto {
  @ApiProperty({ description: 'Name of the saved stationery list', example: 'Grade 5 Booklist 2026' })
  name!: string;
}

export const updateSavedListSchema = z.object({
  name: z.string().trim().min(1, 'List name is required').max(100, 'List name cannot exceed 100 characters'),
});

export class UpdateSavedListDto {
  @ApiProperty({ description: 'Updated name of the saved stationery list', example: 'Grade 6 Booklist 2026' })
  name!: string;
}

export const addSavedListItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.coerce.number().int().positive('Quantity must be a positive integer').default(1),
});

export class AddSavedListItemDto {
  @ApiProperty({ description: 'Product ID to add to list', example: 'cuid_prod_123' })
  productId!: string;

  @ApiPropertyOptional({ description: 'Desired quantity', example: 2, default: 1 })
  quantity?: number;
}

export const updateSavedListItemSchema = z.object({
  quantity: z.coerce.number().int().positive('Quantity must be a positive integer'),
});

export class UpdateSavedListItemDto {
  @ApiProperty({ description: 'New quantity for list item', example: 3 })
  quantity!: number;
}

export interface SavedListItemResponseDto {
  id: string;
  savedListId: string;
  productId: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
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

export interface SavedListSummaryResponseDto {
  id: string;
  name: string;
  itemCount: number;
  estimatedTotalCents: number;
  createdAt: Date;
  updatedAt: Date;
  previewImages: string[];
}

export interface SavedListDetailResponseDto {
  id: string;
  name: string;
  itemCount: number;
  estimatedTotalCents: number;
  createdAt: Date;
  updatedAt: Date;
  items: SavedListItemResponseDto[];
}

export interface ItemAvailabilityDto {
  itemId: string;
  productId: string;
  productName: string;
  requestedQuantity: number;
  availableStock: number;
  isActive: boolean;
  isAvailable: boolean;
  isPartial: boolean;
  priceCents: number;
  lineTotalCents: number;
}

export interface ListAvailabilityResponseDto {
  listId: string;
  listName: string;
  totalItems: number;
  availableCount: number;
  outOfStockCount: number;
  partialCount: number;
  canAddAny: boolean;
  items: ItemAvailabilityDto[];
}

