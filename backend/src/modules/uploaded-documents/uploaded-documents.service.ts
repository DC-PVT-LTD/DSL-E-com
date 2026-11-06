import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PrivateStorageService } from './private-storage.service';
import { OcrVisionService } from './ocr/ocr-vision.service';
import { CatalogueMatcherService } from './catalogue-matcher.service';
import { CartService } from '../cart/cart.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { UpdateExtractedItemDto } from './dto/update-extracted-item.dto';
import { ConfirmItemsDto } from './dto/confirm-items.dto';
import { DocumentStatus, MatchStatus, ItemConfidence } from '../../generated/prisma';

@Injectable()
export class UploadedDocumentsService {
  private readonly logger = new Logger(UploadedDocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: PrivateStorageService,
    private readonly ocrService: OcrVisionService,
    private readonly catalogueMatcher: CatalogueMatcherService,
    private readonly cartService: CartService
  ) {}

  /**
   * Scrub sensitive API keys and secrets from error messages
   */
  private sanitizeErrorMessage(msg: string): string {
    if (!msg) return 'An error occurred during processing';
    return msg
      .replace(/key=[A-Za-z0-9_\-\.]+/gi, 'key=[REDACTED]')
      .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]')
      .substring(0, 300);
  }

  /**
   * Check access permissions on an uploaded document
   */
  private checkAccess(doc: any, user?: any, sessionId?: string | null): void {
    if (!doc) {
      throw new NotFoundException('Uploaded document not found');
    }

    // Admins and staff have universal read/review access
    if (user && ['ADMIN', 'MANAGER', 'STAFF'].includes(user.role)) {
      return;
    }

    // Authenticated user ownership check
    if (doc.userId && user && doc.userId === user.id) {
      return;
    }

    // Guest session ownership check
    if (doc.sessionId && sessionId && doc.sessionId === sessionId) {
      return;
    }

    // If document is anonymous and matches neither
    throw new ForbiddenException('You do not have authorization to access this document');
  }

  /**
   * Securely upload a file, run OCR extraction, and match against the product catalogue
   */
  async uploadDocument(
    file: Express.Multer.File,
    dto: UploadDocumentDto,
    user?: any,
    sessionId?: string | null
  ) {
    // 1. Save file in private storage with magic-byte verification
    const saved = await this.storageService.saveDocumentFile(file);

    const activeSessionId = sessionId || dto.sessionId || null;
    const activeUserId = user?.id || null;

    // 2. Create the document record
    const document = await this.prisma.uploadedDocument.create({
      data: {
        userId: activeUserId,
        sessionId: activeSessionId,
        fileName: saved.originalFileName,
        fileUrl: `/api/v1/uploaded-documents/files/${saved.storagePath}`,
        storagePath: saved.storagePath,
        fileSizeBytes: saved.fileSizeBytes,
        fileType: saved.mimeType,
        pageCount: saved.pageCount,
        status: DocumentStatus.PROCESSING,
        customerNotes: dto.customerNotes || null,
        isSimulatedOCR: false,
      },
    });

    try {
      // 3. Process document with OCR
      const ocrResult = await this.ocrService.processDocument(
        file.buffer,
        saved.mimeType,
        { customerNotes: dto.customerNotes }
      );

      let hasReviewRequired = false;

      // 4. Match extracted items against catalogue and insert ExtractedStationeryItem records
      for (const item of ocrResult.items) {
        const match = await this.catalogueMatcher.matchItem(item.cleanDescription);

        if (match.status !== MatchStatus.MATCHED || match.isSubstituted || match.matchConfidence < 0.85) {
          hasReviewRequired = true;
        }

        await this.prisma.extractedStationeryItem.create({
          data: {
            documentId: document.id,
            rawText: item.rawText,
            itemDescription: item.cleanDescription,
            quantity: item.quantity,
            unit: item.unit || 'nos',
            confidence: match.confidenceTier,
            confidenceScore: match.matchConfidence,
            extractionConfidence: item.extractionConfidence,
            matchConfidence: match.matchConfidence,
            matchReason: match.matchReason,
            matchedProductId: match.matchedProductId,
            matchedVariantId: match.matchedVariantId,
            candidateProductIds: match.candidateProductIds,
            status: match.status,
            isSubstituted: match.isSubstituted,
            isConfirmed: false, // DEFAULT ALWAYS UNCONFIRMED
          },
        });
      }

      // 5. Update document status
      const updatedDoc = await this.prisma.uploadedDocument.update({
        where: { id: document.id },
        data: {
          status: hasReviewRequired
            ? DocumentStatus.REVIEW_REQUIRED
            : DocumentStatus.READY_FOR_CONFIRMATION,
          ocrProvider: ocrResult.providerName,
          isSimulatedOCR: ocrResult.isSimulated,
          processedAt: new Date(),
          attempts: 1,
        },
      });

      return this.getDocument(updatedDoc.id, user, activeSessionId);
    } catch (error) {
      this.logger.error(`Error processing document ${document.id}: ${error.message}`, error.stack);
      // Purge any partially inserted items on failure
      await this.prisma.extractedStationeryItem.deleteMany({
        where: { documentId: document.id },
      });
      const safeError = this.sanitizeErrorMessage(error.message || 'Failed to process document');
      await this.prisma.uploadedDocument.update({
        where: { id: document.id },
        data: {
          status: DocumentStatus.FAILED,
          processingError: safeError,
          attempts: 1,
        },
      });
      throw new BadRequestException('Failed to process uploaded document: ' + safeError);
    }
  }

  /**
   * Get document and its extracted items with rich candidate information
   */
  async getDocument(id: string, user?: any, sessionId?: string | null) {
    const doc = await this.prisma.uploadedDocument.findUnique({
      where: { id },
      include: {
        extractedItems: {
          include: {
            matchedProduct: {
              include: {
                brand: true,
                category: true,
                variants: { where: { isActive: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!doc) {
      throw new NotFoundException(`Document '${id}' not found`);
    }

    this.checkAccess(doc, user, sessionId);

    // Hydrate candidate product details for items that have candidateProductIds
    const rawIds: string[] = doc.extractedItems.flatMap((item: any) => item.candidateProductIds || []);
    const candidateIds: string[] = Array.from(new Set(rawIds));

    const candidates = await this.prisma.product.findMany({
      where: { id: { in: candidateIds }, isActive: true },
      include: {
        brand: true,
        category: true,
        variants: { where: { isActive: true } },
      },
    });

    const candidatesMap = new Map(candidates.map((c) => [c.id, c]));
    const activeCatalogue = await this.catalogueMatcher.getActiveCatalogue();

    const enrichedItems = doc.extractedItems.map((item: any) => {
      const suggestedCandidates = (item.candidateProductIds || [])
        .map((cid: string) => candidatesMap.get(cid))
        .filter(Boolean)
        .map((c: any) => ({
          id: c.id,
          name: c.name,
          sku: c.sku,
          slug: c.slug,
          priceCents: c.priceCents,
          stockQuantity: c.stockQuantity,
          primaryImage: c.images?.[0] || null,
          brandName: c.brand?.name || null,
          categoryName: c.category?.name || null,
          isAvailable: c.stockQuantity > 0 || (c.variants?.some((v: any) => v.stockQuantity > 0)),
          variants: c.variants.map((v: any) => ({
            id: v.id,
            name: v.name,
            sku: v.sku,
            priceCents: v.priceCents,
            stockQuantity: v.stockQuantity,
            isAvailable: v.stockQuantity > 0,
            attributes: v.attributes,
          })),
        }));

      // Calculate verified suitable alternatives using deterministic suitability rules
      const activeProd = item.matchedProduct || candidatesMap.get(item.matchedProductId);
      const queryAttrs = this.catalogueMatcher.extractAttributes(item.itemDescription);
      const suggestedAlternatives = activeProd
        ? this.catalogueMatcher.findSuitableAlternatives(
            activeProd,
            queryAttrs,
            activeCatalogue,
            item.itemDescription
          )
        : [];

      return {
        ...item,
        suggestedCandidates,
        suggestedAlternatives,
      };
    });

    return {
      ...doc,
      extractedItems: enrichedItems,
    };
  }

  /**
   * Update an extracted item (select replacement, change quantity, confirm/unconfirm)
   */
  async updateItem(
    documentId: string,
    itemId: string,
    dto: UpdateExtractedItemDto,
    user?: any,
    sessionId?: string | null
  ) {
    const doc = await this.prisma.uploadedDocument.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    this.checkAccess(doc, user, sessionId);

    const item = await this.prisma.extractedStationeryItem.findFirst({
      where: { id: itemId, documentId },
    });

    if (!item) {
      throw new NotFoundException('Extracted item not found');
    }

    const updateData: any = {};

    if (dto.quantity !== undefined) {
      if (dto.quantity <= 0) {
        throw new BadRequestException('Quantity must be at least 1.');
      }
      updateData.quantity = Math.max(1, Math.min(1000, dto.quantity));
      if (item.isConfirmed) {
        updateData.confirmedQuantity = updateData.quantity;
      }
    }

    if (dto.itemDescription !== undefined) {
      updateData.itemDescription = dto.itemDescription;
      // If rematch explicitly requested or user updated description without manually selecting a product
      if (dto.rematch || dto.selectedProductId === undefined) {
        const match = await this.catalogueMatcher.matchItem(dto.itemDescription);
        updateData.matchedProductId = match.matchedProductId;
        updateData.matchedVariantId = match.matchedVariantId;
        updateData.matchConfidence = match.matchConfidence;
        updateData.confidenceScore = match.matchConfidence;
        updateData.confidence = match.confidenceTier;
        updateData.matchReason = match.matchReason;
        updateData.status = match.status;
        updateData.isSubstituted = match.isSubstituted;
        updateData.candidateProductIds = match.candidateProductIds;
        updateData.isConfirmed = false;
        updateData.confirmedProductId = null;
        updateData.confirmedVariantId = null;
      }
    }

    if (dto.selectedProductId !== undefined) {
      const product = await this.prisma.product.findUnique({
        where: { id: dto.selectedProductId },
        include: { variants: true },
      });
      if (!product) {
        throw new BadRequestException('Selected product does not exist');
      }
      if (!product.isActive) {
        throw new BadRequestException(`Product '${product.name}' is inactive and cannot be selected`);
      }
      updateData.matchedProductId = product.id;
      updateData.confirmedProductId = product.id;
      updateData.status = MatchStatus.MATCHED;
      updateData.isSubstituted = dto.isSubstituted ?? (product.name.toLowerCase() !== (dto.itemDescription || item.itemDescription).toLowerCase());
      updateData.matchReason = 'Customer selected catalogue product';
    }

    if (dto.selectedVariantId !== undefined) {
      updateData.matchedVariantId = dto.selectedVariantId;
      updateData.confirmedVariantId = dto.selectedVariantId;
    }

    if (dto.isSubstituted !== undefined) {
      updateData.isSubstituted = dto.isSubstituted;
    }

    if (dto.isConfirmed !== undefined) {
      const targetProdId = updateData.confirmedProductId || updateData.matchedProductId || item.confirmedProductId || item.matchedProductId;
      const targetVarId = updateData.confirmedVariantId || updateData.matchedVariantId || item.confirmedVariantId || item.matchedVariantId;

      if (dto.isConfirmed) {
        if (!targetProdId) {
          throw new BadRequestException('Cannot confirm an unmatched item. Please select a product from the catalogue first.');
        }

        // Validate product and variant stock availability before confirming
        const prod = await this.prisma.product.findUnique({
          where: { id: targetProdId },
          include: { variants: true },
        });

        if (!prod || !prod.isActive) {
          throw new BadRequestException('Selected product is no longer active or available in the catalogue.');
        }

        let variantStock = prod.stockQuantity;
        if (targetVarId) {
          const v = prod.variants.find((v) => v.id === targetVarId);
          if (v) {
            if (!v.isActive) {
              throw new BadRequestException(`Selected variant '${v.name}' is inactive.`);
            }
            variantStock = v.stockQuantity;
          }
        }

        if (variantStock <= 0) {
          throw new BadRequestException(`Cannot confirm '${prod.name}' because it is currently out of stock.`);
        }

        const requestedQty = updateData.quantity || item.quantity;
        if (requestedQty > variantStock) {
          throw new BadRequestException(
            `Requested quantity (${requestedQty}) exceeds available stock (${variantStock}) for '${prod.name}'.`
          );
        }

        updateData.isConfirmed = true;
        updateData.confirmedProductId = targetProdId;
        updateData.confirmedVariantId = targetVarId || null;
        updateData.confirmedQuantity = requestedQty;
        updateData.status = MatchStatus.CONFIRMED;
      } else {
        updateData.isConfirmed = false;
        updateData.status = targetProdId ? MatchStatus.MATCHED : MatchStatus.UNMATCHED;
      }
    }

    const updated = await this.prisma.extractedStationeryItem.update({
      where: { id: itemId },
      data: updateData,
    });

    return updated;
  }

  /**
   * Confirm selected items and add them to the shopping cart.
   * STRICT SAFETY RULE:
   * Only items explicitly marked isConfirmed: true can be added to the cart!
   * No unconfirmed, unmatched, or zero-quantity item can be added.
   * No orders or payments are generated.
   */
  async confirmToCart(
    documentId: string,
    dto: ConfirmItemsDto,
    user?: any,
    sessionId?: string | null
  ) {
    const doc = await this.prisma.uploadedDocument.findUnique({
      where: { id: documentId },
      include: {
        extractedItems: {
          include: {
            matchedProduct: {
              include: { variants: true },
            },
          },
        },
      },
    });

    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    this.checkAccess(doc, user, sessionId);

    // Duplicate submission prevention (Req. 3 & Req. 5.16)
    if (doc.status === DocumentStatus.CONFIRMED) {
      throw new BadRequestException('This uploaded list has already been confirmed and transferred to your cart.');
    }

    // If specific item IDs are supplied in request, mark them as confirmed
    if (dto.itemIds && dto.itemIds.length > 0) {
      await this.prisma.extractedStationeryItem.updateMany({
        where: {
          documentId,
          id: { in: dto.itemIds },
        },
        data: {
          isConfirmed: true,
          status: MatchStatus.CONFIRMED,
        },
      });
    }

    // Refetch items to evaluate confirmed items strictly
    const items = await this.prisma.extractedStationeryItem.findMany({
      where: { documentId },
      include: {
        matchedProduct: {
          include: { variants: true },
        },
      },
    });

    // Filter strictly for confirmed items that have a product selected
    const eligibleConfirmedItems = items.filter(
      (item) => item.isConfirmed && (item.confirmedProductId || item.matchedProductId) && item.quantity > 0
    );

    if (eligibleConfirmedItems.length === 0) {
      throw new BadRequestException(
        'No confirmed items to add. Please confirm at least one matched stationery item.'
      );
    }

    const addedItems: Array<{
      itemId: string;
      productId: string;
      variantId?: string | null;
      quantity: number;
      productName: string;
    }> = [];

    const failedItems: Array<{
      itemId: string;
      description: string;
      reason: string;
    }> = [];

    const activeUserId = user?.id || doc.userId || null;
    const activeSessionId = sessionId || doc.sessionId || null;

    for (const item of eligibleConfirmedItems) {
      const targetProductId = item.confirmedProductId || item.matchedProductId!;
      const targetVariantId = item.confirmedVariantId || item.matchedVariantId || undefined;
      const targetQuantity = item.confirmedQuantity || item.quantity;

      // Real-time stock revalidation before adding to cart (Scenario 13)
      const prod = item.matchedProduct || (await this.prisma.product.findUnique({
        where: { id: targetProductId },
        include: { variants: true },
      }));

      if (!prod || prod.isActive === false) {
        failedItems.push({
          itemId: item.id,
          description: item.itemDescription,
          reason: `Product is no longer available in the catalogue`,
        });
        continue;
      }

      let availableStock = prod.stockQuantity ?? 100;
      if (targetVariantId) {
        const v = prod.variants?.find((v: any) => v.id === targetVariantId);
        if (v) {
          if (v.isActive === false) {
            failedItems.push({
              itemId: item.id,
              description: item.itemDescription,
              reason: `Variant '${v.name}' is inactive`,
            });
            continue;
          }
          availableStock = v.stockQuantity ?? 100;
        }
      }

      if (availableStock <= 0) {
        failedItems.push({
          itemId: item.id,
          description: item.itemDescription,
          reason: `'${prod.name}' is currently out of stock`,
        });
        continue;
      }

      if (targetQuantity > availableStock) {
        failedItems.push({
          itemId: item.id,
          description: item.itemDescription,
          reason: `Requested quantity (${targetQuantity}) exceeds available stock (${availableStock}) for '${prod.name}'`,
        });
        continue;
      }

      try {
        await this.cartService.addItem(
          {
            productId: targetProductId,
            variantId: targetVariantId || undefined,
            quantity: targetQuantity,
          },
          activeUserId,
          activeSessionId
        );

        addedItems.push({
          itemId: item.id,
          productId: targetProductId,
          variantId: targetVariantId,
          quantity: targetQuantity,
          productName: item.matchedProduct?.name || item.itemDescription,
        });
      } catch (err: any) {
        this.logger.warn(
          `Could not add item '${item.itemDescription}' to cart: ${err.message}`
        );
        failedItems.push({
          itemId: item.id,
          description: item.itemDescription,
          reason: err.message || 'Item could not be added to cart',
        });
      }
    }

    if (addedItems.length === 0) {
      throw new BadRequestException(
        `Could not add any items to your cart: ${failedItems.map((f) => f.reason).join(', ')}`
      );
    }

    // Update document status to CONFIRMED
    await this.prisma.uploadedDocument.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.CONFIRMED,
        confirmedAt: new Date(),
      },
    });

    const updatedCart = await this.cartService.getCart(activeUserId, activeSessionId);

    const message =
      failedItems.length > 0
        ? `Added ${addedItems.length} item(s) to cart. Note: ${failedItems.length} item(s) were unavailable and skipped.`
        : `Successfully added ${addedItems.length} confirmed item(s) to your cart`;

    return {
      message,
      addedCount: addedItems.length,
      items: addedItems,
      failedItems,
      cart: updatedCart,
    };
  }

  /**
   * Stream the stored private document file with authorization checks
   */
  async streamDocumentFile(
    documentId: string,
    user?: any,
    sessionId?: string | null
  ) {
    const doc = await this.prisma.uploadedDocument.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    this.checkAccess(doc, user, sessionId);

    if (!doc.storagePath || !this.storageService.fileExists(doc.storagePath)) {
      throw new NotFoundException('Document file not found on disk');
    }

    const stream = this.storageService.getFileStream(doc.storagePath);
    return {
      stream,
      fileName: doc.fileName,
      mimeType: doc.fileType,
      fileSizeBytes: doc.fileSizeBytes,
    };
  }

  /**
   * Retry processing for a document (bounded by max 3 attempts)
   * Purges previous stale items so failed retries leave no phantom records
   */
  async retryDocument(
    documentId: string,
    user?: any,
    sessionId?: string | null
  ) {
    const doc = await this.prisma.uploadedDocument.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    this.checkAccess(doc, user, sessionId);

    if (doc.attempts >= 3) {
      throw new BadRequestException('Maximum retry limit reached (3 attempts). Please re-upload your document.');
    }

    if (!doc.storagePath || !this.storageService.fileExists(doc.storagePath)) {
      throw new NotFoundException('Document file no longer exists in storage.');
    }

    const fileBuffer = await this.storageService.getDocumentBuffer(doc.storagePath);
    const nextAttempt = (doc.attempts || 0) + 1;

    // Purge any stale extracted items from previous attempts before retrying
    await this.prisma.extractedStationeryItem.deleteMany({
      where: { documentId: doc.id },
    });

    try {
      const ocrResult = await this.ocrService.processDocument(
        fileBuffer,
        doc.fileType,
        { customerNotes: doc.customerNotes || undefined }
      );

      let hasReviewRequired = false;

      for (const item of ocrResult.items) {
        const match = await this.catalogueMatcher.matchItem(item.cleanDescription);
        if (match.status !== MatchStatus.MATCHED || match.isSubstituted || match.matchConfidence < 0.85) {
          hasReviewRequired = true;
        }

        await this.prisma.extractedStationeryItem.create({
          data: {
            documentId: doc.id,
            rawText: item.rawText,
            itemDescription: item.cleanDescription,
            quantity: item.quantity,
            unit: item.unit || 'nos',
            confidence: match.confidenceTier,
            confidenceScore: match.matchConfidence,
            extractionConfidence: item.extractionConfidence,
            matchConfidence: match.matchConfidence,
            matchReason: match.matchReason,
            matchedProductId: match.matchedProductId,
            matchedVariantId: match.matchedVariantId,
            candidateProductIds: match.candidateProductIds,
            status: match.status,
            isSubstituted: match.isSubstituted,
            isConfirmed: false,
          },
        });
      }

      const updated = await this.prisma.uploadedDocument.update({
        where: { id: doc.id },
        data: {
          status: hasReviewRequired
            ? DocumentStatus.REVIEW_REQUIRED
            : DocumentStatus.READY_FOR_CONFIRMATION,
          ocrProvider: ocrResult.providerName,
          isSimulatedOCR: ocrResult.isSimulated,
          attempts: nextAttempt,
          processingError: null,
          processedAt: new Date(),
        },
      });

      return this.getDocument(updated.id, user, sessionId);
    } catch (error: any) {
      // Purge any partial items on failure so no stale or half-parsed items linger
      await this.prisma.extractedStationeryItem.deleteMany({
        where: { documentId: doc.id },
      });

      const safeError = this.sanitizeErrorMessage(error.message || 'Retry processing failed');
      await this.prisma.uploadedDocument.update({
        where: { id: doc.id },
        data: {
          status: DocumentStatus.FAILED,
          processingError: safeError,
          attempts: nextAttempt,
        },
      });

      throw new BadRequestException(`Document retry failed: ${safeError}`);
    }
  }

  /**
   * List documents for admin queue with status filters and pagination
   */
  async listDocumentsForAdmin(query: {
    status?: DocumentStatus;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) {
      where.status = query.status;
    }

    const [total, documents] = await Promise.all([
      this.prisma.uploadedDocument.count({ where }),
      this.prisma.uploadedDocument.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
          extractedItems: {
            select: {
              id: true,
              itemDescription: true,
              quantity: true,
              status: true,
              isConfirmed: true,
              isSubstituted: true,
              matchConfidence: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: documents,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
