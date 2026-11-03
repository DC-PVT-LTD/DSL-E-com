import { Product } from './product';

export interface ExtractedStationeryItem {
  id: string;
  rawText: string;
  itemDescription: string;
  quantity: number;
  confidence: 'high' | 'medium' | 'low';
  confidenceScore: number; // e.g. 0.95
  matchedProductId?: string;
  matchedProduct?: Product;
  candidateProductIds: string[];
  status: 'matched' | 'unmatched' | 'custom_selected' | 'skipped';
}

export interface UploadedListDocument {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  fileType: 'image/jpeg' | 'image/png' | 'application/pdf';
  uploadedAt: string;
  status: 'uploaded' | 'processing' | 'processed' | 'reviewed' | 'converted_to_cart';
  isSimulatedOCR: boolean;
  extractedItems: ExtractedStationeryItem[];
  customerNotes?: string;
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
