import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { UploadedDocumentsService } from './uploaded-documents.service';
import { DocumentStatus, MatchStatus, ItemConfidence } from '../../generated/prisma';

describe('UploadedDocumentsService', () => {
  let service: UploadedDocumentsService;
  let mockPrisma: any;
  let mockStorage: any;
  let mockOcr: any;
  let mockCatalogueMatcher: any;
  let mockCartService: any;

  beforeEach(() => {
    mockPrisma = {
      uploadedDocument: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      extractedStationeryItem: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      product: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
    };

    mockStorage = {
      saveDocumentFile: vi.fn(),
      fileExists: vi.fn(),
      getFileStream: vi.fn(),
    };

    mockOcr = {
      processDocument: vi.fn(),
    };

    mockCatalogueMatcher = {
      matchItem: vi.fn(),
      getActiveCatalogue: vi.fn().mockResolvedValue([]),
      extractAttributes: vi.fn().mockReturnValue({
        colors: [],
        models: [],
        packQuantities: [],
        tipSizes: [],
        rulings: [],
        sizes: [],
      }),
      findSuitableAlternatives: vi.fn().mockReturnValue([]),
    };

    mockCartService = {
      addItem: vi.fn(),
      getCart: vi.fn(),
    };

    service = new UploadedDocumentsService(
      mockPrisma,
      mockStorage,
      mockOcr,
      mockCatalogueMatcher,
      mockCartService
    );
  });

  describe('getDocument', () => {
    it('throws NotFoundException if document does not exist', async () => {
      mockPrisma.uploadedDocument.findUnique.mockResolvedValue(null);
      await expect(service.getDocument('doc-999', { id: 'user-1', role: 'CUSTOMER' })).rejects.toThrow(
        NotFoundException
      );
    });

    it('throws ForbiddenException if customer attempts to access another user document', async () => {
      mockPrisma.uploadedDocument.findUnique.mockResolvedValue({
        id: 'doc-1',
        userId: 'user-victim',
        sessionId: null,
        extractedItems: [],
      });

      await expect(
        service.getDocument('doc-1', { id: 'user-attacker', role: 'CUSTOMER' }, 'different-session')
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows admin or manager to view any customer document', async () => {
      mockPrisma.uploadedDocument.findUnique.mockResolvedValue({
        id: 'doc-1',
        userId: 'user-customer',
        sessionId: null,
        extractedItems: [],
      });
      mockPrisma.product.findMany.mockResolvedValue([]);

      const result = await service.getDocument('doc-1', { id: 'admin-1', role: 'ADMIN' });
      expect(result.id).toBe('doc-1');
    });
  });

  describe('confirmToCart - Safety Invariant Verification', () => {
    it('CRITICAL: strictly rejects when zero items are confirmed', async () => {
      mockPrisma.uploadedDocument.findUnique.mockResolvedValue({
        id: 'doc-1',
        userId: 'user-1',
        sessionId: null,
        extractedItems: [
          {
            id: 'item-1',
            isConfirmed: false,
            matchedProductId: 'prod-1',
            quantity: 2,
          },
        ],
      });

      mockPrisma.extractedStationeryItem.findMany.mockResolvedValue([
        {
          id: 'item-1',
          isConfirmed: false,
          matchedProductId: 'prod-1',
          quantity: 2,
        },
      ]);

      await expect(
        service.confirmToCart('doc-1', { itemIds: [] }, { id: 'user-1', role: 'CUSTOMER' })
      ).rejects.toThrow(BadRequestException);

      // Verify CartService.addItem was NEVER called
      expect(mockCartService.addItem).not.toHaveBeenCalled();
    });

    it('adds ONLY confirmed items to cart and updates document status', async () => {
      const mockDoc = {
        id: 'doc-1',
        userId: 'user-1',
        sessionId: 'sess-1',
      };
      mockPrisma.uploadedDocument.findUnique.mockResolvedValue(mockDoc);

      const itemsInDb = [
        {
          id: 'item-confirmed',
          documentId: 'doc-1',
          isConfirmed: true,
          matchedProductId: 'prod-atlas-cr',
          matchedVariantId: null,
          quantity: 3,
          matchedProduct: { id: 'prod-atlas-cr', name: 'Atlas CR Book' },
        },
        {
          id: 'item-unconfirmed',
          documentId: 'doc-1',
          isConfirmed: false,
          matchedProductId: 'prod-uncertain',
          matchedVariantId: null,
          quantity: 1,
          matchedProduct: { id: 'prod-uncertain', name: 'Uncertain Item' },
        },
      ];

      mockPrisma.extractedStationeryItem.findMany.mockResolvedValue(itemsInDb);
      mockCartService.addItem.mockResolvedValue({ items: [] });
      mockCartService.getCart.mockResolvedValue({ items: [], subtotalCents: 150000 });
      mockPrisma.uploadedDocument.update.mockResolvedValue({ id: 'doc-1', status: DocumentStatus.CONFIRMED });

      const result = await service.confirmToCart(
        'doc-1',
        {},
        { id: 'user-1', role: 'CUSTOMER' },
        'sess-1'
      );

      // Verify CartService.addItem was called EXACTLY once for the confirmed item
      expect(mockCartService.addItem).toHaveBeenCalledTimes(1);
      expect(mockCartService.addItem).toHaveBeenCalledWith(
        {
          productId: 'prod-atlas-cr',
          variantId: undefined,
          quantity: 3,
        },
        'user-1',
        'sess-1'
      );

      // Verify unconfirmed item was ignored
      expect(result.addedCount).toBe(1);
      expect(result.items[0].productId).toBe('prod-atlas-cr');

      // Verify document status updated to CONFIRMED
      expect(mockPrisma.uploadedDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'doc-1' },
          data: expect.objectContaining({
            status: DocumentStatus.CONFIRMED,
          }),
        })
      );
    });

    it('Scenario 16: prevents duplicate confirmation submissions', async () => {
      mockPrisma.uploadedDocument.findUnique.mockResolvedValue({
        id: 'doc-already-confirmed',
        status: DocumentStatus.CONFIRMED,
        userId: 'user-1',
        sessionId: null,
      });

      await expect(
        service.confirmToCart('doc-already-confirmed', {}, { id: 'user-1', role: 'CUSTOMER' })
      ).rejects.toThrow(BadRequestException);

      expect(mockCartService.addItem).not.toHaveBeenCalled();
    });

    it('Scenario 17: safely handles one unavailable item alongside other valid selected items', async () => {
      mockPrisma.uploadedDocument.findUnique.mockResolvedValue({
        id: 'doc-2',
        status: DocumentStatus.READY_FOR_CONFIRMATION,
        userId: 'user-1',
        sessionId: 'sess-1',
      });

      mockPrisma.extractedStationeryItem.findMany.mockResolvedValue([
        {
          id: 'item-valid',
          documentId: 'doc-2',
          isConfirmed: true,
          matchedProductId: 'prod-valid',
          quantity: 2,
          matchedProduct: { id: 'prod-valid', name: 'Valid Notebook' },
        },
        {
          id: 'item-oos',
          documentId: 'doc-2',
          isConfirmed: true,
          matchedProductId: 'prod-oos',
          quantity: 1,
          matchedProduct: { id: 'prod-oos', name: 'OOS Pen' },
        },
      ]);

      mockCartService.addItem
        .mockResolvedValueOnce({ items: [] })
        .mockRejectedValueOnce(new BadRequestException("'OOS Pen' is currently out of stock"));
      mockCartService.getCart.mockResolvedValue({ items: [], subtotalCents: 50000 });
      mockPrisma.uploadedDocument.update.mockResolvedValue({ id: 'doc-2', status: DocumentStatus.CONFIRMED });

      const result = await service.confirmToCart('doc-2', {}, { id: 'user-1', role: 'CUSTOMER' }, 'sess-1');

      expect(result.addedCount).toBe(1);
      expect(result.failedItems).toHaveLength(1);
      expect(result.failedItems[0].itemId).toBe('item-oos');
      expect(mockPrisma.uploadedDocument.update).toHaveBeenCalled();
    });

    it('Scenario 18: API failure during confirmation does not falsely report success', async () => {
      mockPrisma.uploadedDocument.findUnique.mockResolvedValue({
        id: 'doc-3',
        status: DocumentStatus.READY_FOR_CONFIRMATION,
        userId: 'user-1',
        sessionId: 'sess-1',
      });

      mockPrisma.extractedStationeryItem.findMany.mockResolvedValue([
        {
          id: 'item-fail',
          documentId: 'doc-3',
          isConfirmed: true,
          matchedProductId: 'prod-fail',
          quantity: 1,
          matchedProduct: { id: 'prod-fail', name: 'Failing Item' },
        },
      ]);

      mockCartService.addItem.mockRejectedValue(new BadRequestException('Database connectivity error'));

      await expect(
        service.confirmToCart('doc-3', {}, { id: 'user-1', role: 'CUSTOMER' }, 'sess-1')
      ).rejects.toThrow(BadRequestException);

      // Verify document was NOT marked CONFIRMED
      expect(mockPrisma.uploadedDocument.update).not.toHaveBeenCalled();
    });
  });

  describe('updateItem - Customer Review Workflow & Validations', () => {
    it('Scenario 11: customer edits description and retries matching', async () => {
      mockPrisma.uploadedDocument.findUnique.mockResolvedValue({
        id: 'doc-edit',
        userId: 'user-1',
      });
      mockPrisma.extractedStationeryItem.findFirst.mockResolvedValue({
        id: 'item-edit',
        documentId: 'doc-edit',
        itemDescription: 'Speed Rlm Pen',
        isConfirmed: false,
      });

      mockCatalogueMatcher.matchItem.mockResolvedValue({
        matchedProductId: 'prod-speed-rim',
        matchedVariantId: 'var-speed-black',
        matchConfidence: 0.95,
        confidenceTier: ItemConfidence.HIGH,
        status: MatchStatus.MATCHED,
        matchReason: 'Exact catalogue match',
        isSubstituted: false,
        candidateProductIds: ['prod-speed-rim'],
      });

      mockPrisma.extractedStationeryItem.update.mockImplementation(({ data }: any) => ({
        id: 'item-edit',
        ...data,
      }));

      const updated = await service.updateItem(
        'doc-edit',
        'item-edit',
        {
          itemDescription: 'Speed Rim Ball Pen Black',
          rematch: true,
        },
        { id: 'user-1', role: 'CUSTOMER' }
      );

      expect(mockCatalogueMatcher.matchItem).toHaveBeenCalledWith('Speed Rim Ball Pen Black');
      expect(updated.matchedProductId).toBe('prod-speed-rim');
      expect(updated.matchedVariantId).toBe('var-speed-black');
      expect(updated.isConfirmed).toBe(false); // Reset to unconfirmed for customer review
    });

    it('Scenario 6 & 7: prevents confirming an out-of-stock product or variant', async () => {
      mockPrisma.uploadedDocument.findUnique.mockResolvedValue({
        id: 'doc-oos',
        userId: 'user-1',
      });
      mockPrisma.extractedStationeryItem.findFirst.mockResolvedValue({
        id: 'item-oos-check',
        documentId: 'doc-oos',
        matchedProductId: 'prod-oos',
        matchedVariantId: null,
        quantity: 1,
        isConfirmed: false,
      });

      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'prod-oos',
        name: 'DOMS NEON PENCILS',
        stockQuantity: 0, // OUT OF STOCK
        isActive: true,
        variants: [],
      });

      await expect(
        service.updateItem(
          'doc-oos',
          'item-oos-check',
          { isConfirmed: true },
          { id: 'user-1', role: 'CUSTOMER' }
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('Scenario 12: updates quantity and clamps to valid range', async () => {
      mockPrisma.uploadedDocument.findUnique.mockResolvedValue({
        id: 'doc-qty',
        userId: 'user-1',
      });
      mockPrisma.extractedStationeryItem.findFirst.mockResolvedValue({
        id: 'item-qty',
        documentId: 'doc-qty',
        quantity: 2,
        isConfirmed: false,
      });

      mockPrisma.extractedStationeryItem.update.mockImplementation(({ data }: any) => data);

      const res = await service.updateItem(
        'doc-qty',
        'item-qty',
        { quantity: 5 },
        { id: 'user-1', role: 'CUSTOMER' }
      );

      expect(res.quantity).toBe(5);
    });

    it('Scenario 8 & 9: supports customer accepting or rejecting substitution', async () => {
      mockPrisma.uploadedDocument.findUnique.mockResolvedValue({
        id: 'doc-sub',
        userId: 'user-1',
      });
      mockPrisma.extractedStationeryItem.findFirst.mockResolvedValue({
        id: 'item-sub',
        documentId: 'doc-sub',
        matchedProductId: 'prod-sub',
        matchedVariantId: null,
        isConfirmed: false,
      });
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'prod-sub',
        name: 'Alternative Product',
        stockQuantity: 20,
        isActive: true,
        variants: [],
      });

      mockPrisma.extractedStationeryItem.update.mockImplementation(({ data }: any) => data);

      // Customer approves substitution
      const approved = await service.updateItem(
        'doc-sub',
        'item-sub',
        { isConfirmed: true, isSubstituted: true },
        { id: 'user-1', role: 'CUSTOMER' }
      );
      expect(approved.isConfirmed).toBe(true);
      expect(approved.isSubstituted).toBe(true);

      // Customer rejects substitution (sets isConfirmed: false)
      const rejected = await service.updateItem(
        'doc-sub',
        'item-sub',
        { isConfirmed: false },
        { id: 'user-1', role: 'CUSTOMER' }
      );
      expect(rejected.isConfirmed).toBe(false);
    });

    it('Scenario 3 & 12: rejects confirmation when requested quantity exceeds available stock', async () => {
      mockPrisma.uploadedDocument.findUnique.mockResolvedValue({
        id: 'doc-stock-limit',
        userId: 'user-1',
      });
      mockPrisma.extractedStationeryItem.findFirst.mockResolvedValue({
        id: 'item-stock-limit',
        documentId: 'doc-stock-limit',
        matchedProductId: 'prod-limited-stock',
        matchedVariantId: null,
        quantity: 20, // Requested 20
        isConfirmed: false,
      });
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'prod-limited-stock',
        name: 'Limited Stock Notebook',
        stockQuantity: 10, // Only 10 available
        isActive: true,
        variants: [],
      });

      // Customer attempts to confirm 20 units when only 10 exist
      await expect(
        service.updateItem(
          'doc-stock-limit',
          'item-stock-limit',
          { isConfirmed: true, quantity: 20 },
          { id: 'user-1', role: 'CUSTOMER' }
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('Scenario 4: allows confirmation after reducing quantity to available stock', async () => {
      mockPrisma.uploadedDocument.findUnique.mockResolvedValue({
        id: 'doc-stock-ok',
        userId: 'user-1',
      });
      mockPrisma.extractedStationeryItem.findFirst.mockResolvedValue({
        id: 'item-stock-ok',
        documentId: 'doc-stock-ok',
        matchedProductId: 'prod-limited-stock',
        matchedVariantId: null,
        quantity: 20,
        isConfirmed: false,
      });
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'prod-limited-stock',
        name: 'Limited Stock Notebook',
        stockQuantity: 10,
        isActive: true,
        variants: [],
      });

      mockPrisma.extractedStationeryItem.update.mockImplementation(({ data }: any) => data);

      // Customer reduces quantity to 10 and confirms
      const confirmed = await service.updateItem(
        'doc-stock-ok',
        'item-stock-ok',
        { isConfirmed: true, quantity: 10 },
        { id: 'user-1', role: 'CUSTOMER' }
      );

      expect(confirmed.isConfirmed).toBe(true);
      expect(confirmed.confirmedQuantity).toBe(10);
    });

    it('Scenario 12: rejects invalid quantity <= 0 with BadRequestException', async () => {
      mockPrisma.uploadedDocument.findUnique.mockResolvedValue({
        id: 'doc-invalid-qty',
        userId: 'user-1',
      });
      mockPrisma.extractedStationeryItem.findFirst.mockResolvedValue({
        id: 'item-invalid-qty',
        documentId: 'doc-invalid-qty',
        quantity: 1,
        isConfirmed: false,
      });

      await expect(
        service.updateItem(
          'doc-invalid-qty',
          'item-invalid-qty',
          { quantity: 0 },
          { id: 'user-1', role: 'CUSTOMER' }
        )
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateItem(
          'doc-invalid-qty',
          'item-invalid-qty',
          { quantity: -5 },
          { id: 'user-1', role: 'CUSTOMER' }
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('Scenario 10: alternative is not applied or confirmed until customer explicitly selects it', async () => {
      mockPrisma.uploadedDocument.findUnique.mockResolvedValue({
        id: 'doc-alt-select',
        userId: 'user-1',
      });
      mockPrisma.extractedStationeryItem.findFirst.mockResolvedValue({
        id: 'item-alt-select',
        documentId: 'doc-alt-select',
        matchedProductId: 'prod-original',
        matchedVariantId: null,
        isConfirmed: false,
        isSubstituted: false,
      });
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'prod-alternative-atlas',
        name: 'Atlas Chooty Red Ballpoint Pen',
        stockQuantity: 50,
        isActive: true,
        variants: [],
      });

      mockPrisma.extractedStationeryItem.update.mockImplementation(({ data }: any) => data);

      // Customer explicitly selects alternative
      const updated = await service.updateItem(
        'doc-alt-select',
        'item-alt-select',
        {
          selectedProductId: 'prod-alternative-atlas',
          isSubstituted: true,
        },
        { id: 'user-1', role: 'CUSTOMER' }
      );

      expect(updated.matchedProductId).toBe('prod-alternative-atlas');
      expect(updated.confirmedProductId).toBe('prod-alternative-atlas');
      expect(updated.isSubstituted).toBe(true);
      // Explicit customer confirmation rule: does not automatically set isConfirmed to true
      expect(updated.isConfirmed).toBeUndefined();
    });

    it('Scenario 13: catches stock changes occurring between review and confirmation at cart addition', async () => {
      mockPrisma.uploadedDocument.findUnique.mockResolvedValue({
        id: 'doc-stock-drift',
        status: DocumentStatus.READY_FOR_CONFIRMATION,
        userId: 'user-1',
        sessionId: 'sess-1',
        extractedItems: [],
      });

      // During review, item was confirmed for 5 units.
      // But now product stock has dropped to 2 in PostgreSQL!
      mockPrisma.extractedStationeryItem.findMany.mockResolvedValue([
        {
          id: 'item-drift',
          documentId: 'doc-stock-drift',
          isConfirmed: true,
          matchedProductId: 'prod-drift',
          quantity: 5,
          confirmedQuantity: 5,
          matchedProduct: {
            id: 'prod-drift',
            name: 'Speed Eraser',
            stockQuantity: 2, // Stock dropped to 2!
            isActive: true,
            variants: [],
          },
        },
      ]);

      // Cart confirmation must reject because requested 5 > available 2
      await expect(
        service.confirmToCart('doc-stock-drift', {}, { id: 'user-1', role: 'CUSTOMER' }, 'sess-1')
      ).rejects.toThrow(BadRequestException);

      // Cart service should NOT be called with invalid oversold quantity
      expect(mockCartService.addItem).not.toHaveBeenCalled();
    });
  });
});

