import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const validateBulkOrderRowSchema = z.object({
  sku: z.string().min(1, 'SKU is required').trim(),
  quantity: z
    .number({ invalid_type_error: 'Quantity must be a number' })
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1')
    .max(50000, 'Quantity cannot exceed 50000'),
  rowNumber: z.number().int().optional(),
});

export const validateBulkOrderSchema = z.object({
  items: z
    .array(validateBulkOrderRowSchema)
    .min(1, 'At least one item must be submitted for validation')
    .max(500, 'Cannot exceed 500 lines per validation request'),
});

export class ValidateBulkOrderRowDto {
  @ApiProperty({ description: 'Product or Variant SKU', example: 'DSL-SPEED-RIM-BLUE' })
  sku!: string;

  @ApiProperty({ description: 'Requested quantity', example: 50 })
  quantity!: number;

  @ApiPropertyOptional({ description: 'Optional row number from spreadsheet', example: 1 })
  rowNumber?: number;
}

export class ValidateBulkOrderDto {
  @ApiProperty({ description: 'Array of SKU & Quantity pairs to validate', type: [ValidateBulkOrderRowDto] })
  items!: ValidateBulkOrderRowDto[];
}

export interface ValidatedBulkOrderRowResult {
  rowNumber?: number;
  sku: string;
  name?: string;
  productId?: string;
  variantId?: string | null;
  requestedQuantity: number;
  availableStock: number;
  unitPriceCents: number;
  totalPriceCents: number;
  isValid: boolean;
  error?: string;
  images?: string[];
  categoryName?: string;
  brandName?: string;
}

export interface BulkOrderValidationSummary {
  items: ValidatedBulkOrderRowResult[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  totalQuantity: number;
  estimatedSubtotalCents: number;
}

export interface BulkOrderSearchResultItem {
  id: string;
  productId: string;
  variantId?: string | null;
  name: string;
  sku: string;
  barcode?: string | null;
  priceCents: number;
  compareAtPriceCents?: number | null;
  stockQuantity: number;
  images: string[];
  categoryName?: string;
  brandName?: string;
  isVariant: boolean;
  variantName?: string;
  isActive: boolean;
}
