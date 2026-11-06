import { apiClient } from '@/lib/api/apiClient';
import { UploadedListDocument, ExtractedStationeryItem } from '@/types/upload';

class UploadService {
  private cache: Map<string, UploadedListDocument> = new Map();
  private allList: UploadedListDocument[] = [];
  private listeners: Set<() => void> = new Set();

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  /**
   * Upload genuine image or PDF document to NestJS backend
   */
  public async uploadDocument(
    file: File,
    customerNotes?: string
  ): Promise<UploadedListDocument> {
    const formData = new FormData();
    formData.append('file', file);
    if (customerNotes) {
      formData.append('customerNotes', customerNotes);
    }

    const response = await apiClient.post<UploadedListDocument>(
      '/uploaded-documents',
      formData
    );

    this.cache.set(response.id, response);
    this.allList.unshift(response);
    this.notify();
    return response;
  }

  /**
   * Fetch full document analysis and items by ID
   */
  public async getByIdAsync(id: string): Promise<UploadedListDocument> {
    const doc = await apiClient.get<UploadedListDocument>(`/uploaded-documents/${id}`);
    this.cache.set(doc.id, doc);
    return doc;
  }

  /**
   * Cached synchronous accessor for backward compatibility
   */
  public getById(id: string): UploadedListDocument | undefined {
    return this.cache.get(id);
  }

  /**
   * Cached list accessor for backward compatibility
   */
  public getAll(): UploadedListDocument[] {
    return [...this.allList];
  }

  /**
   * Update an extracted item (quantity, candidate selection, isConfirmed toggle)
   */
  public async updateExtractedItem(
    documentId: string,
    itemId: string,
    updates: {
      quantity?: number;
      selectedProductId?: string;
      selectedVariantId?: string | null;
      isConfirmed?: boolean;
      isSubstituted?: boolean;
      itemDescription?: string;
      rematch?: boolean;
    }
  ): Promise<any> {
    const updated = await apiClient.patch(
      `/uploaded-documents/${documentId}/items/${itemId}`,
      updates
    );

    // Refresh cached document
    await this.getByIdAsync(documentId).catch(() => {});
    this.notify();
    return updated;
  }

  /**
   * Add confirmed items to cart via backend CartService
   */
  public async confirmToCart(
    documentId: string,
    itemIds?: string[]
  ): Promise<{ addedCount: number; message: string; cart: any }> {
    const result = await apiClient.post<{ addedCount: number; message: string; cart: any }>(
      `/uploaded-documents/${documentId}/confirm-cart`,
      { itemIds }
    );

    await this.getByIdAsync(documentId).catch(() => {});
    this.notify();
    return result;
  }

  /**
   * Admin queue listing
   */
  public async getAllAdmin(query?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: UploadedListDocument[]; meta: any }> {
    const params: any = {};
    if (query?.status) params.status = query.status;
    if (query?.page) params.page = query.page;
    if (query?.limit) params.limit = query.limit;

    return await apiClient.get('/admin/uploaded-documents', { params });
  }

  /**
   * Admin approve or update item match
   */
  public async adminUpdateItem(
    documentId: string,
    itemId: string,
    updates: any
  ): Promise<any> {
    return await apiClient.patch(
      `/admin/uploaded-documents/${documentId}/items/${itemId}`,
      updates
    );
  }

  /**
   * Update upload status helper
   */
  public updateUploadStatus(uploadId: string, status: any): boolean {
    const doc = this.cache.get(uploadId);
    if (doc) {
      doc.status = status;
      this.notify();
      return true;
    }
    return false;
  }
}

export const uploadService = new UploadService();
