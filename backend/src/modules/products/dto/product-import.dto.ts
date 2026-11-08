import { z } from 'zod';

export const importRowSchema = z.object({
  sku: z.string().trim().optional(),
  name: z.string().trim().min(1, 'Product name is required').max(255),
  slug: z.string().trim().optional(),
  category: z.string().trim().min(1, 'Category name or slug is required'),
  subcategory: z.string().trim().optional(),
  brand: z.string().trim().min(1, 'Brand name or slug is required'),
  description: z.string().trim().optional(),
  shortDescription: z.string().trim().optional(),
  costPrice: z.number().nonnegative('Cost price must be non-negative').optional().nullable(),
  sellingPrice: z.number().positive('Selling price must be greater than 0'),
  stockQuantity: z.number().int('Stock quantity must be an integer').nonnegative('Stock quantity must be non-negative'),
  lowStockThreshold: z.number().int().nonnegative().optional().default(5),
  barcode: z.string().trim().optional(),
  tags: z.string().trim().optional(),
  isFeatured: z.boolean().optional().default(false),
  variantName: z.string().trim().optional(),
  parentSku: z.string().trim().optional(),
  color: z.string().trim().optional(),
  variantPrice: z.number().positive().optional().nullable(),
  variantStock: z.number().int().nonnegative().optional().nullable(),
  variantAttributes: z.string().trim().optional(),
});

export type ImportRowInput = z.infer<typeof importRowSchema>;

export type ImportRowStatus = 'VALID' | 'INVALID' | 'WARNING' | 'DUPLICATE_IN_FILE' | 'EXISTS_IN_DB';

export interface ImportPreviewRow {
  rowNumber: number;
  sku: string | null;
  proposedSku: string;
  name: string;
  slug?: string;
  categoryName: string;
  categoryId?: string;
  subcategoryName?: string | null;
  subcategoryId?: string | null;
  brandName: string;
  brandId?: string;
  sellingPrice: number;
  costPrice?: number | null;
  stockQuantity: number;
  lowStockThreshold?: number;
  barcode?: string | null;
  tags?: string[];
  isFeatured?: boolean;
  isVariant: boolean;
  variantName?: string | null;
  parentSku?: string | null;
  color?: string | null;
  variantPrice?: number | null;
  variantStock?: number | null;
  status: ImportRowStatus;
  isExisting: boolean;
  errors: string[];
  warnings: string[];
  raw: Record<string, any>;
}

export interface ImportSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  warningRows: number;
  duplicateRows: number;
  existingRows: number;
  newProducts: number;
  newVariants: number;
}

export interface ImportPreviewResult {
  summary: ImportSummary;
  rows: ImportPreviewRow[];
  fileName: string;
  fileSizeBytes: number;
  parsedAt: string;
}

export const errorReportQuerySchema = z.object({
  format: z.enum(['csv', 'xlsx']).default('csv'),
});

export type ErrorReportQueryDto = z.infer<typeof errorReportQuerySchema>;

// ------------------------------------------------------------------------------
// Phase 4 – Stage 4: Import Execution & Recovery DTOs
// ------------------------------------------------------------------------------

export interface ProductConcurrencySnapshot {
  targetType: 'PRODUCT';
  id: string;
  updatedAt: string; // ISO-8601
  fields: {
    name: string;
    priceCents: number;
    costPriceCents: number | null;
    categoryId: string;
    subcategoryId: string | null;
    brandId: string | null;
  };
}

export interface VariantConcurrencySnapshot {
  targetType: 'VARIANT';
  id: string;
  productId: string;
  updatedAt: string; // ISO-8601
  fields: {
    name: string;
    priceCents: number;
    costPriceCents: number | null;
    attributes: Record<string, string>;
  };
}

export type ConcurrencySnapshot = ProductConcurrencySnapshot | VariantConcurrencySnapshot;

export interface NormalizedImportRow {
  rowNumber: number;
  sku: string | null;
  name: string;
  slug?: string;
  categoryName: string;
  categoryId?: string;
  subcategoryName?: string | null;
  subcategoryId?: string | null;
  brandName: string;
  brandId?: string;
  sellingPrice: number;
  costPrice?: number | null;
  stockQuantity: number;
  lowStockThreshold?: number;
  barcode?: string | null;
  tags?: string[];
  isFeatured?: boolean;
  isVariant: boolean;
  variantName?: string | null;
  parentSku?: string | null;
  color?: string | null;
  variantPrice?: number | null;
  variantStock?: number | null;
  variantAttributes?: string | null;
  isExisting: boolean;
  existingId?: string | null;
  snapshot?: ConcurrencySnapshot | null;
  raw: Record<string, any>;
}

export const executeImportSchema = z.object({
  previewId: z.string().min(1, 'previewId is required'),
  previewChecksum: z.string().min(1, 'previewChecksum is required'),
  stockMode: z.enum(['SET_STOCK', 'ADD_STOCK']).default('SET_STOCK'),
  allowUpdates: z.boolean().default(true),
  idempotencyKey: z.string().min(1, 'idempotencyKey is required').max(255),
});

export type ExecuteImportDto = z.infer<typeof executeImportSchema>;

export const ImportExecutionErrorCodes = {
  ERR_CONCURRENT_CATALOG_UPDATE: 'ERR_CONCURRENT_CATALOG_UPDATE',
  ERR_TARGET_ENTITY_DELETED: 'ERR_TARGET_ENTITY_DELETED',
  ERR_SKU_OWNERSHIP_MISMATCH: 'ERR_SKU_OWNERSHIP_MISMATCH',
  ERR_CATEGORY_INACTIVE_OR_DELETED: 'ERR_CATEGORY_INACTIVE_OR_DELETED',
  ERR_SUBCATEGORY_INACTIVE_OR_DELETED: 'ERR_SUBCATEGORY_INACTIVE_OR_DELETED',
  ERR_BRAND_INACTIVE_OR_DELETED: 'ERR_BRAND_INACTIVE_OR_DELETED',
  ERR_RESERVED_STOCK_BREACH: 'ERR_RESERVED_STOCK_BREACH',
  ERR_INVALID_ROW_DATA: 'ERR_INVALID_ROW_DATA',
  ERR_PREVIEW_CORRUPTED: 'ERR_PREVIEW_CORRUPTED',
  ERR_IDEMPOTENCY_MISMATCH: 'ERR_IDEMPOTENCY_MISMATCH',
  ERR_INSUFFICIENT_PERMISSIONS: 'ERR_INSUFFICIENT_PERMISSIONS',
  ERR_WORKER_HEARTBEAT_TIMEOUT: 'ERR_WORKER_HEARTBEAT_TIMEOUT',
  ERR_LEASE_ACQUISITION_FAILED: 'ERR_LEASE_ACQUISITION_FAILED',
} as const;

export type ImportExecutionErrorCode =
  (typeof ImportExecutionErrorCodes)[keyof typeof ImportExecutionErrorCodes];

