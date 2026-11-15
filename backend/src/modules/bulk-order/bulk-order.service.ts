import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ValidateBulkOrderDto,
  ValidatedBulkOrderRowResult,
  BulkOrderValidationSummary,
  BulkOrderSearchResultItem,
} from './dto/bulk-order.dto';

@Injectable()
export class BulkOrderService {
  private readonly logger = new Logger(BulkOrderService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Search catalog by SKU, name, or barcode for autocomplete and manual search.
   */
  async search(query: string, limit = 25): Promise<BulkOrderSearchResultItem[]> {
    const trimmed = (query || '').trim();
    if (!trimmed) {
      // Return top active in-stock products if no query specified
      const topProducts = await this.prisma.product.findMany({
        where: { isActive: true },
        take: limit,
        orderBy: { stockQuantity: 'desc' },
        include: {
          category: { select: { name: true } },
          brand: { select: { name: true } },
          variants: { where: { isActive: true } },
        },
      });

      return this.mapProductsToSearchItems(topProducts);
    }

    // 1. Search products by Name, SKU, or Barcode
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: trimmed, mode: 'insensitive' } },
          { sku: { contains: trimmed, mode: 'insensitive' } },
          { barcode: { contains: trimmed, mode: 'insensitive' } },
          {
            variants: {
              some: {
                isActive: true,
                OR: [
                  { name: { contains: trimmed, mode: 'insensitive' } },
                  { sku: { contains: trimmed, mode: 'insensitive' } },
                ],
              },
            },
          },
        ],
      },
      take: limit,
      include: {
        category: { select: { name: true } },
        brand: { select: { name: true } },
        variants: { where: { isActive: true } },
      },
    });

    return this.mapProductsToSearchItems(products);
  }

  private mapProductsToSearchItems(products: any[]): BulkOrderSearchResultItem[] {
    const results: BulkOrderSearchResultItem[] = [];

    for (const p of products) {
      if (p.variants && p.variants.length > 0) {
        for (const v of p.variants) {
          results.push({
            id: `${p.id}-${v.id}`,
            productId: p.id,
            variantId: v.id,
            name: `${p.name} (${v.name})`,
            sku: v.sku,
            barcode: p.barcode,
            priceCents: v.priceCents,
            compareAtPriceCents: v.compareAtPriceCents,
            stockQuantity: v.stockQuantity,
            images: p.images || [],
            categoryName: p.category?.name || '',
            brandName: p.brand?.name || '',
            isVariant: true,
            variantName: v.name,
            isActive: v.isActive && p.isActive,
          });
        }
      } else {
        results.push({
          id: p.id,
          productId: p.id,
          variantId: null,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          priceCents: p.priceCents,
          compareAtPriceCents: p.compareAtPriceCents,
          stockQuantity: p.stockQuantity,
          images: p.images || [],
          categoryName: p.category?.name || '',
          brandName: p.brand?.name || '',
          isVariant: false,
          isActive: p.isActive,
        });
      }
    }

    return results;
  }

  /**
   * Validate a batch of SKU & quantity rows (e.g. from manual entry or CSV upload).
   */
  async validateRows(dto: ValidateBulkOrderDto): Promise<BulkOrderValidationSummary> {
    const results: ValidatedBulkOrderRowResult[] = [];
    const seenSkus = new Set<string>();

    let validRows = 0;
    let invalidRows = 0;
    let totalQuantity = 0;
    let estimatedSubtotalCents = 0;

    for (let i = 0; i < dto.items.length; i++) {
      const item = dto.items[i];
      const rowNumber = item.rowNumber || i + 1;
      const sku = (item.sku || '').trim();
      const qty = item.quantity;

      // 1. Basic validation
      if (!sku) {
        results.push({
          rowNumber,
          sku: '',
          requestedQuantity: qty || 0,
          availableStock: 0,
          unitPriceCents: 0,
          totalPriceCents: 0,
          isValid: false,
          error: 'SKU cannot be empty',
        });
        invalidRows++;
        continue;
      }

      const normalizedSku = sku.toUpperCase();

      if (seenSkus.has(normalizedSku)) {
        results.push({
          rowNumber,
          sku,
          requestedQuantity: qty,
          availableStock: 0,
          unitPriceCents: 0,
          totalPriceCents: 0,
          isValid: false,
          error: `Duplicate SKU '${sku}' in submission. Please combine quantities into one row.`,
        });
        invalidRows++;
        continue;
      }
      seenSkus.add(normalizedSku);

      if (!qty || qty < 1) {
        results.push({
          rowNumber,
          sku,
          requestedQuantity: qty,
          availableStock: 0,
          unitPriceCents: 0,
          totalPriceCents: 0,
          isValid: false,
          error: 'Quantity must be at least 1',
        });
        invalidRows++;
        continue;
      }

      // 2. Lookup in Database: First check ProductVariant by SKU
      const variant = await this.prisma.productVariant.findFirst({
        where: {
          sku: { equals: sku, mode: 'insensitive' },
        },
        include: {
          product: {
            include: {
              category: { select: { name: true } },
              brand: { select: { name: true } },
            },
          },
        },
      });

      if (variant) {
        const product = variant.product;
        if (!product.isActive || !variant.isActive) {
          results.push({
            rowNumber,
            sku: variant.sku,
            name: `${product.name} - ${variant.name}`,
            productId: product.id,
            variantId: variant.id,
            requestedQuantity: qty,
            availableStock: variant.stockQuantity,
            unitPriceCents: variant.priceCents,
            totalPriceCents: variant.priceCents * qty,
            isValid: false,
            error: `Product is currently inactive/unavailable`,
            images: product.images,
          });
          invalidRows++;
          continue;
        }

        if (variant.stockQuantity <= 0) {
          results.push({
            rowNumber,
            sku: variant.sku,
            name: `${product.name} - ${variant.name}`,
            productId: product.id,
            variantId: variant.id,
            requestedQuantity: qty,
            availableStock: 0,
            unitPriceCents: variant.priceCents,
            totalPriceCents: 0,
            isValid: false,
            error: `Out of stock (0 available)`,
            images: product.images,
          });
          invalidRows++;
          continue;
        }

        if (qty > variant.stockQuantity) {
          results.push({
            rowNumber,
            sku: variant.sku,
            name: `${product.name} - ${variant.name}`,
            productId: product.id,
            variantId: variant.id,
            requestedQuantity: qty,
            availableStock: variant.stockQuantity,
            unitPriceCents: variant.priceCents,
            totalPriceCents: variant.priceCents * variant.stockQuantity,
            isValid: false,
            error: `Insufficient stock: requested ${qty}, but only ${variant.stockQuantity} available`,
            images: product.images,
          });
          invalidRows++;
          continue;
        }

        // Fully valid variant line
        const lineTotal = variant.priceCents * qty;
        results.push({
          rowNumber,
          sku: variant.sku,
          name: `${product.name} - ${variant.name}`,
          productId: product.id,
          variantId: variant.id,
          requestedQuantity: qty,
          availableStock: variant.stockQuantity,
          unitPriceCents: variant.priceCents,
          totalPriceCents: lineTotal,
          isValid: true,
          images: product.images,
          categoryName: product.category?.name,
          brandName: product.brand?.name,
        });

        validRows++;
        totalQuantity += qty;
        estimatedSubtotalCents += lineTotal;
        continue;
      }

      // 3. Lookup Product by SKU or Barcode
      const product = await this.prisma.product.findFirst({
        where: {
          OR: [
            { sku: { equals: sku, mode: 'insensitive' } },
            { barcode: { equals: sku, mode: 'insensitive' } },
          ],
        },
        include: {
          category: { select: { name: true } },
          brand: { select: { name: true } },
          variants: { where: { isActive: true } },
        },
      });

      if (!product) {
        results.push({
          rowNumber,
          sku,
          requestedQuantity: qty,
          availableStock: 0,
          unitPriceCents: 0,
          totalPriceCents: 0,
          isValid: false,
          error: `SKU '${sku}' not found in product catalogue`,
        });
        invalidRows++;
        continue;
      }

      if (!product.isActive) {
        results.push({
          rowNumber,
          sku: product.sku,
          name: product.name,
          productId: product.id,
          variantId: null,
          requestedQuantity: qty,
          availableStock: product.stockQuantity,
          unitPriceCents: product.priceCents,
          totalPriceCents: product.priceCents * qty,
          isValid: false,
          error: `Product '${product.name}' is currently unavailable`,
          images: product.images,
        });
        invalidRows++;
        continue;
      }

      // If product has multiple active variants, customer needs to specify variant SKU
      if (product.variants && product.variants.length > 1) {
        const variantSkus = product.variants.map((v) => v.sku).join(', ');
        results.push({
          rowNumber,
          sku: product.sku,
          name: product.name,
          productId: product.id,
          variantId: null,
          requestedQuantity: qty,
          availableStock: product.stockQuantity,
          unitPriceCents: product.priceCents,
          totalPriceCents: product.priceCents * qty,
          isValid: false,
          error: `Product has multiple options. Please use specific variant SKU (${variantSkus})`,
          images: product.images,
        });
        invalidRows++;
        continue;
      }

      const availableStock = product.stockQuantity;

      if (availableStock <= 0) {
        results.push({
          rowNumber,
          sku: product.sku,
          name: product.name,
          productId: product.id,
          variantId: null,
          requestedQuantity: qty,
          availableStock: 0,
          unitPriceCents: product.priceCents,
          totalPriceCents: 0,
          isValid: false,
          error: `Out of stock (0 available)`,
          images: product.images,
        });
        invalidRows++;
        continue;
      }

      if (qty > availableStock) {
        results.push({
          rowNumber,
          sku: product.sku,
          name: product.name,
          productId: product.id,
          variantId: null,
          requestedQuantity: qty,
          availableStock,
          unitPriceCents: product.priceCents,
          totalPriceCents: product.priceCents * availableStock,
          isValid: false,
          error: `Insufficient stock: requested ${qty}, but only ${availableStock} available`,
          images: product.images,
        });
        invalidRows++;
        continue;
      }

      // Fully valid product line
      const lineTotal = product.priceCents * qty;
      results.push({
        rowNumber,
        sku: product.sku,
        name: product.name,
        productId: product.id,
        variantId: null,
        requestedQuantity: qty,
        availableStock,
        unitPriceCents: product.priceCents,
        totalPriceCents: lineTotal,
        isValid: true,
        images: product.images,
        categoryName: product.category?.name,
        brandName: product.brand?.name,
      });

      validRows++;
      totalQuantity += qty;
      estimatedSubtotalCents += lineTotal;
    }

    return {
      items: results,
      totalRows: dto.items.length,
      validRows,
      invalidRows,
      totalQuantity,
      estimatedSubtotalCents,
    };
  }
}
