import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadService } from '../uploadService';
import { apiClient } from '@/lib/api/apiClient';

describe('uploadService - Upload Your List Review Workflow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches document analysis with extracted items and candidates', async () => {
    const mockDoc = {
      id: 'doc-123',
      fileName: 'stationery_list.jpg',
      fileSizeBytes: 204800,
      fileType: 'image/jpeg',
      pageCount: 1,
      status: 'READY_FOR_CONFIRMATION',
      isSimulatedOCR: false,
      extractedItems: [
        {
          id: 'item-1',
          documentId: 'doc-123',
          rawText: 'Speed Rlm Ball Pen Blue',
          itemDescription: 'SPEED RIM Ball Pen Blue',
          quantity: 2,
          confidence: 'HIGH',
          confidenceScore: 0.95,
          extractionConfidence: 0.95,
          matchConfidence: 0.95,
          matchedProductId: 'prod-speed-rim-blue',
          matchedProduct: {
            id: 'prod-speed-rim-blue',
            name: 'SPEED RIM Ball Pen Blue',
            priceCents: 2500,
            stockQuantity: 210,
          },
          status: 'MATCHED',
          isConfirmed: false,
          isSubstituted: false,
          candidateProductIds: ['prod-speed-rim-blue'],
          suggestedCandidates: [],
        },
      ],
      createdAt: new Date().toISOString(),
    };

    vi.spyOn(apiClient, 'get').mockResolvedValue(mockDoc);

    const doc = await uploadService.getByIdAsync('doc-123');

    expect(apiClient.get).toHaveBeenCalledWith('/uploaded-documents/doc-123');
    expect(doc.id).toBe('doc-123');
    expect(doc.extractedItems).toHaveLength(1);
    expect(doc.extractedItems[0].isConfirmed).toBe(false); // Preserves unconfirmed default
  });

  it('updates extracted item and triggers catalogue rematch', async () => {
    vi.spyOn(apiClient, 'patch').mockResolvedValue({ success: true });
    vi.spyOn(apiClient, 'get').mockResolvedValue({ id: 'doc-123', extractedItems: [] });

    await uploadService.updateExtractedItem('doc-123', 'item-1', {
      itemDescription: 'Speed Rim Ball Pen Black',
      rematch: true,
    });

    expect(apiClient.patch).toHaveBeenCalledWith(
      '/uploaded-documents/doc-123/items/item-1',
      {
        itemDescription: 'Speed Rim Ball Pen Black',
        rematch: true,
      }
    );
  });

  it('updates quantity and variant selection', async () => {
    vi.spyOn(apiClient, 'patch').mockResolvedValue({ success: true });
    vi.spyOn(apiClient, 'get').mockResolvedValue({ id: 'doc-123', extractedItems: [] });

    await uploadService.updateExtractedItem('doc-123', 'item-1', {
      quantity: 5,
      selectedVariantId: 'var-speed-rim-black',
    });

    expect(apiClient.patch).toHaveBeenCalledWith(
      '/uploaded-documents/doc-123/items/item-1',
      {
        quantity: 5,
        selectedVariantId: 'var-speed-rim-black',
      }
    );
  });

  it('confirms approved items and transfers to cart', async () => {
    const mockResponse = {
      message: 'Successfully added 2 confirmed item(s) to your cart',
      addedCount: 2,
      cart: { id: 'cart-1', items: [] },
    };

    vi.spyOn(apiClient, 'post').mockResolvedValue(mockResponse);
    vi.spyOn(apiClient, 'get').mockResolvedValue({ id: 'doc-123', status: 'CONFIRMED' });

    const res = await uploadService.confirmToCart('doc-123', ['item-1', 'item-2']);

    expect(apiClient.post).toHaveBeenCalledWith(
      '/uploaded-documents/doc-123/confirm-cart',
      { itemIds: ['item-1', 'item-2'] }
    );
    expect(res.addedCount).toBe(2);
  });
});

