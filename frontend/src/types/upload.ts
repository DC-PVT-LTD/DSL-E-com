import { Product } from './product';

export interface ExtractedStationeryItem {
  id: string;
  documentId: string;
  rawText: string;
  itemDescription: string;
  quantity: number;
  unit?: string | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'high' | 'medium' | 'low';
  confidenceScore: number;
  extractionConfidence: number;
  matchConfidence: number;
  matchReason?: string | null;
  matchedProductId?: string | null;
  matchedVariantId?: string | null;
  matchedProduct?: Product;
  candidateProductIds: string[];
  suggestedCandidates?: Array<{
    id: string;
    name: string;
    sku: string;
    slug: string;
    priceCents: number;
    stockQuantity: number;
    primaryImage: string | null;
    score?: number;
    isAvailable?: boolean;
    brandName?: string | null;
    categoryName?: string | null;
    variants?: Array<{
      id: string;
      name: string;
      sku: string;
      priceCents: number;
      stockQuantity: number;
      isAvailable?: boolean;
      attributes?: Record<string, any>;
    }>;
  }>;
  suggestedAlternatives?: Array<{
    id: string;
    name: string;
    sku: string;
    slug: string;
    priceCents: number;
    stockQuantity: number;
    primaryImage: string | null;
    score?: number;
    suitabilityScore?: number;
    isAvailable?: boolean;
    brandName?: string | null;
    categoryName?: string | null;
    matchNotes?: string | null;
    specDifferences?: string | null;
    variants?: Array<{
      id: string;
      name: string;
      sku: string;
      priceCents: number;
      stockQuantity: number;
      isAvailable?: boolean;
      attributes?: Record<string, any>;
    }>;
  }>;
  status: 'MATCHED' | 'UNMATCHED' | 'CUSTOM_SELECTED' | 'SKIPPED' | 'CONFIRMED' | 'matched' | 'unmatched' | 'custom_selected' | 'skipped' | 'confirmed';
  isConfirmed: boolean;
  confirmedProductId?: string | null;
  confirmedVariantId?: string | null;
  confirmedQuantity?: number | null;
  isSubstituted: boolean;
}

export interface UploadedListDocument {
  id: string;
  userId?: string | null;
  sessionId?: string | null;
  fileName: string;
  fileUrl: string;
  storagePath?: string | null;
  fileSizeBytes: number;
  fileType: string;
  pageCount: number;
  uploadedAt?: string;
  createdAt: string;
  status:
    | 'UPLOADED'
    | 'PROCESSING'
    | 'REVIEW_REQUIRED'
    | 'READY_FOR_CONFIRMATION'
    | 'CONFIRMED'
    | 'FAILED'
    | 'uploaded'
    | 'processing'
    | 'processed'
    | 'reviewed'
    | 'converted_to_cart';
  isSimulatedOCR: boolean;
  customerNotes?: string | null;
  processingError?: string | null;
  attempts?: number;
  processedAt?: string | null;
  confirmedAt?: string | null;
  extractedItems: ExtractedStationeryItem[];
}

export type StationeryPersona = 'school' | 'university' | 'office' | 'art_craft' | 'gift';

export interface RecommendationPreferences {
  persona: StationeryPersona;
  grade?: string;
  budgetLkr?: number;
  preferences: string[];
}

export interface RecommendationResultItem {
  product: Product;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
  selected: boolean;
  reason: string;
}
