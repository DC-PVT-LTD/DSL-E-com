import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// -----------------------------------------------------------------------------
// Zod Validation Schemas
// -----------------------------------------------------------------------------

export const addToCartSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().min(1).optional().nullable(),
  quantity: z
    .number({ invalid_type_error: 'Quantity must be a number' })
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1')
    .max(1000, 'Quantity cannot exceed 1000')
    .default(1),
});

export const updateCartItemSchema = z.object({
  quantity: z
    .number({ invalid_type_error: 'Quantity must be a number' })
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1')
    .max(1000, 'Quantity cannot exceed 1000'),
});

export const mergeCartSchema = z.object({
  guestSessionId: z.string().min(1, 'Guest session ID is required'),
});

export const schoolPackItemCustomizationSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional().nullable(),
  quantity: z
    .number({ invalid_type_error: 'Quantity must be a number' })
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1')
    .max(100, 'Quantity cannot exceed 100'),
});

export const addSchoolPackToCartSchema = z.object({
  packId: z.string().min(1, 'Pack ID is required'),
  items: z
    .array(schoolPackItemCustomizationSchema)
    .min(1, 'At least one item must be included from the school pack'),
});

// -----------------------------------------------------------------------------
// TypeScript DTO Types & Swagger Decorators
// -----------------------------------------------------------------------------

export class AddToCartDto {
  @ApiProperty({ description: 'ID of the product to add', example: 'cuid_prod_123' })
  productId!: string;

  @ApiPropertyOptional({ description: 'Optional variant ID', example: 'cuid_var_456', nullable: true })
  variantId?: string | null;

  @ApiPropertyOptional({ description: 'Quantity to add (integer >= 1)', default: 1, example: 2 })
  quantity!: number;
}

export class UpdateCartItemDto {
  @ApiProperty({ description: 'New quantity for the cart item (integer >= 1)', example: 3 })
  quantity!: number;
}

export class MergeCartDto {
  @ApiProperty({ description: 'Guest session token to merge into authenticated user cart', example: 'guest-session-uuid-123' })
  guestSessionId!: string;
}

export class SchoolPackItemCustomizationDto {
  @ApiProperty({ description: 'Product ID', example: 'prod-123' })
  productId!: string;

  @ApiPropertyOptional({ description: 'Optional variant ID', example: 'var-456', nullable: true })
  variantId?: string | null;

  @ApiProperty({ description: 'Customized quantity (1-100)', example: 2 })
  quantity!: number;
}

export class AddSchoolPackToCartDto {
  @ApiProperty({ description: 'School Pack ID', example: 'pack-abc' })
  packId!: string;

  @ApiProperty({ description: 'Customized items from the pack', type: [SchoolPackItemCustomizationDto] })
  items!: SchoolPackItemCustomizationDto[];
}

// -----------------------------------------------------------------------------
// Response Types
// -----------------------------------------------------------------------------

export interface CartItemResponse {
  id: string;
  productId: string;
  variantId?: string | null;
  product: {
    id: string;
    name: string;
    slug: string;
    sku: string;
    images: string[];
    priceCents: number;
    stockQuantity: number;
    isActive: boolean;
    categoryName?: string;
  };
  variant?: {
    id: string;
    name: string;
    sku: string;
    priceCents: number;
    stockQuantity: number;
    isActive: boolean;
  } | null;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
  isAvailable: boolean;
  isOutOfStock: boolean;
  exceedsStock: boolean;
}

export interface CartResponse {
  id: string;
  userId?: string | null;
  sessionId?: string | null;
  items: CartItemResponse[];
  itemCount: number;
  subtotalCents: number;
  discountCents: number;
  deliveryCents: number;
  totalCents: number;
  isFreeDeliveryEligible: boolean;
  freeDeliveryThresholdCents: number;
  priceNotice?: string | null;
  warnings?: string[];
  updatedAt: Date;
}

