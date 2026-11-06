export interface SavedListProductSummary {
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
}

export interface SavedListItem {
  id: string;
  savedListId: string;
  productId: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
  product: SavedListProductSummary;
}

export interface SavedListSummary {
  id: string;
  name: string;
  itemCount: number;
  estimatedTotalCents: number;
  createdAt: string;
  updatedAt: string;
  previewImages: string[];
}

export interface SavedListDetail {
  id: string;
  name: string;
  itemCount: number;
  estimatedTotalCents: number;
  createdAt: string;
  updatedAt: string;
  items: SavedListItem[];
}

export interface ItemAvailability {
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

export interface ListAvailabilityReport {
  listId: string;
  listName: string;
  totalItems: number;
  availableCount: number;
  outOfStockCount: number;
  partialCount: number;
  canAddAny: boolean;
  items: ItemAvailability[];
}

