export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  iconName?: string;
  image?: string;
  itemCount?: number;
  directProductCount?: number;
  subcategoryCount?: number;
  featured?: boolean;
  displayOrder?: number;
  parentId?: string | null;
  parent?: { id: string; name: string; slug: string } | null;
  children?: ProductCategory[];
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  description: string;
  originCountry: string;
  featured?: boolean;
  itemCount?: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  priceCents: number;
  compareAtPriceCents?: number;
  stockQuantity: number;
  reservedStock?: number;
  availableStock?: number;
  attributes: Record<string, string>; // e.g. { color: "Blue", ruling: "Single Line" }
  isActive?: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string;
  barcode?: string;
  description: string;
  shortDescription: string;
  categoryId: string;
  categoryName: string;
  subcategoryId?: string | null;
  subcategoryName?: string | null;
  brandId: string;
  brandName: string;
  priceCents: number;
  compareAtPriceCents?: number | null;
  costPriceCents?: number | null;
  stockQuantity: number;
  reservedStock?: number;
  availableStock?: number;
  lowStockThreshold: number;
  isActive: boolean;
  isFeatured?: boolean;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  images: string[];
  tags: string[];
  rating: number;
  reviewCount: number;
  variants?: ProductVariant[];
  specifications: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

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
  raw?: Record<string, any>;
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
  previewId?: string | null;
  previewChecksum?: string;
  expiresAt?: string | null;
  summary: ImportSummary;
  rows: ImportPreviewRow[];
  fileName: string;
  fileSizeBytes: number;
  parsedAt: string;
}

export interface ExecuteImportPayload {
  previewId: string;
  previewChecksum: string;
  stockMode?: 'SET_STOCK' | 'ADD_STOCK';
  allowUpdates?: boolean;
  idempotencyKey?: string;
}

export interface ImportBatchResponse {
  batchId: string;
  status: string;
  progressPercent?: number;
  totalRows?: number;
  processedRows?: number;
  successRows?: number;
  failedRows?: number;
  errors?: Array<{ rowNumber?: number; sku?: string; error?: string; message?: string }>;
  [key: string]: any;
}

export interface ImportHistoryResponse {
  items: any[];
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
}

