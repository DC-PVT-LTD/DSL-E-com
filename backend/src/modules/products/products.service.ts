import {
  Injectable,
  Inject,
  Optional,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ProductQueryDto } from './dto/product-query.dto';
import { CreateProductDto, UpdateProductDto } from './dto/create-product.dto';
import { CreateVariantDto, UpdateVariantDto } from './dto/create-variant.dto';
import { InventoryChangeReason } from '../../generated/prisma';
import {
  toPrismaPagination,
  createPaginationMeta,
} from '../../common/pagination/pagination.util';
import { PaginatedResponse, createPaginatedResponse } from '../../common/interfaces/api-response.interface';
import {
  excludeSensitiveFields,
  excludeSensitiveFieldsMany,
  normalizePrismaValues,
} from '../../common/utils/serialization.util';

@Injectable()
export class ProductsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(AuditService) private readonly auditService?: AuditService,
  ) {}

  async findAll(query: ProductQueryDto): Promise<PaginatedResponse<any>> {
    const where: any = {
      isActive: true, // Public storefront rule: published/active products only
    };

    // Text search in name, description, shortDescription, SKU, or tags
    const search = (query.search || query.q)?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { shortDescription: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { tags: { has: search.toLowerCase() } },
      ];
    }

    // Category filter by ID or Slug
    if (query.categoryId) {
      where.categoryId = query.categoryId;
    } else if (query.categorySlug) {
      where.category = { slug: query.categorySlug };
    }

    // Brand filter by ID or Slug
    if (query.brandId) {
      where.brandId = query.brandId;
    } else if (query.brandSlug) {
      where.brand = { slug: query.brandSlug };
    }

    // Price range filters (in cents)
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      if (query.minPrice !== undefined && query.minPrice > 2147483647) {
        throw new BadRequestException('minPrice exceeds maximum supported database value');
      }
      if (query.maxPrice !== undefined && query.maxPrice > 2147483647) {
        throw new BadRequestException('maxPrice exceeds maximum supported database value');
      }
      if (query.minPrice !== undefined && query.maxPrice !== undefined && query.minPrice > query.maxPrice) {
        throw new BadRequestException('minPrice cannot be greater than maxPrice');
      }

      where.priceCents = {};
      if (query.minPrice !== undefined) {
        where.priceCents.gte = Math.ceil(query.minPrice);
      }
      if (query.maxPrice !== undefined) {
        where.priceCents.lte = Math.floor(query.maxPrice);
      }
    }

    // Stock availability filter
    if (query.inStockOnly) {
      where.stockQuantity = { gt: 0 };
    }

    // Merchandising flags
    if (query.isFeatured !== undefined) {
      where.isFeatured = query.isFeatured;
    }
    if (query.isNewArrival !== undefined) {
      where.isNewArrival = query.isNewArrival;
    }
    if (query.isBestSeller !== undefined) {
      where.isBestSeller = query.isBestSeller;
    }

    const { skip, take, orderBy } = toPrismaPagination(query);

    const [totalItems, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: orderBy || { createdAt: 'desc' },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          brand: { select: { id: true, name: true, slug: true } },
          variants: true,
        },
      }),
    ]);

    // Sanitize internal confidential fields (e.g. costPriceCents)
    const sanitized = excludeSensitiveFieldsMany(products, ['costPriceCents']);

    const items = sanitized.map((p) => ({
      ...normalizePrismaValues(p),
      categoryName: p.category?.name || '',
      brandName: p.brand?.name || '',
    }));

    const meta = createPaginationMeta(totalItems, query.page, query.limit);
    return createPaginatedResponse(items, meta);
  }

  async findById(id: string, includeInactive = false) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        brand: { select: { id: true, name: true, slug: true } },
        variants: true,
      },
    });

    if (!product || (!product.isActive && !includeInactive)) {
      throw new NotFoundException(`Product with ID "${id}" not found`);
    }

    const sanitized = excludeSensitiveFields(product, ['costPriceCents']);
    return {
      ...normalizePrismaValues(sanitized),
      categoryName: product.category?.name || '',
      brandName: product.brand?.name || '',
    };
  }

  async findBySlug(slug: string, includeInactive = false) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        brand: { select: { id: true, name: true, slug: true } },
        variants: true,
      },
    });

    if (!product || (!product.isActive && !includeInactive)) {
      throw new NotFoundException(`Product with slug "${slug}" not found`);
    }

    const sanitized = excludeSensitiveFields(product, ['costPriceCents']);
    return {
      ...normalizePrismaValues(sanitized),
      categoryName: product.category?.name || '',
      brandName: product.brand?.name || '',
    };
  }

  async create(dto: CreateProductDto, actorId?: string | null) {
    // Uniqueness checks
    const [existingSlug, existingSku] = await Promise.all([
      this.prisma.product.findUnique({ where: { slug: dto.slug } }),
      this.prisma.product.findUnique({ where: { sku: dto.sku } }),
    ]);

    if (existingSlug) {
      throw new ConflictException(`Product slug "${dto.slug}" already exists`);
    }
    if (existingSku) {
      throw new ConflictException(`Product SKU "${dto.sku}" already exists`);
    }

    // Verify foreign keys
    const [category, brand] = await Promise.all([
      this.prisma.category.findUnique({ where: { id: dto.categoryId } }),
      this.prisma.brand.findUnique({ where: { id: dto.brandId } }),
    ]);

    if (!category) {
      throw new NotFoundException(`Category "${dto.categoryId}" not found`);
    }
    if (!brand) {
      throw new NotFoundException(`Brand "${dto.brandId}" not found`);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: dto as any,
          include: {
            category: { select: { id: true, name: true, slug: true } },
            brand: { select: { id: true, name: true, slug: true } },
            variants: true,
          },
        });

        if (this.auditService) {
          await this.auditService.recordAuditLog(
            {
              action: 'PRODUCT_CREATE',
              entityType: 'product',
              entityId: created.id,
              userId: actorId,
              summary: `Created product "${created.name}" (SKU: ${created.sku})`,
              changes: {
                name: { new: created.name },
                sku: { new: created.sku },
                priceCents: { new: created.priceCents },
                stockQuantity: { new: created.stockQuantity },
                categoryId: { new: created.categoryId },
                brandId: { new: created.brandId },
              },
            },
            tx
          );
        }

        return excludeSensitiveFields(created, ['costPriceCents']);
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException(`A product with this SKU or slug already exists`);
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateProductDto, actorId?: string | null) {
    const existing = await this.findById(id, true);

    if (dto.slug) {
      const existingSlug = await this.prisma.product.findUnique({ where: { slug: dto.slug } });
      if (existingSlug && existingSlug.id !== id) {
        throw new ConflictException(`Product slug "${dto.slug}" already exists`);
      }
    }

    if (dto.sku) {
      const existingSku = await this.prisma.product.findUnique({ where: { sku: dto.sku } });
      if (existingSku && existingSku.id !== id) {
        throw new ConflictException(`Product SKU "${dto.sku}" already exists`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: dto as any,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          brand: { select: { id: true, name: true, slug: true } },
          variants: true,
        },
      });

      if (this.auditService) {
        const changes = this.auditService.computeDiff(existing, updated, [
          'name',
          'slug',
          'sku',
          'barcode',
          'description',
          'shortDescription',
          'categoryId',
          'brandId',
          'priceCents',
          'compareAtPriceCents',
          'stockQuantity',
          'lowStockThreshold',
          'isActive',
          'tags',
          'specifications',
        ]);
        await this.auditService.recordAuditLog(
          {
            action: 'PRODUCT_UPDATE',
            entityType: 'product',
            entityId: id,
            userId: actorId,
            summary: `Updated product "${updated.name}"`,
            changes,
          },
          tx
        );
      }

      return excludeSensitiveFields(updated, ['costPriceCents']);
    });
  }

  async toggleStatus(id: string, actorId?: string | null) {
    const product = await this.findById(id, true);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: { isActive: !product.isActive },
      });

      if (this.auditService) {
        await this.auditService.recordAuditLog(
          {
            action: 'PRODUCT_STATUS_UPDATE',
            entityType: 'product',
            entityId: id,
            userId: actorId,
            summary: `Toggled status for product "${product.name}" to ${updated.isActive ? 'ACTIVE' : 'INACTIVE'}`,
            changes: {
              isActive: { old: product.isActive, new: updated.isActive },
            },
          },
          tx
        );
      }

      return excludeSensitiveFields(updated, ['costPriceCents']);
    });
  }

  async delete(id: string, actorId?: string | null) {
    const product = await this.findById(id, true);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: { isActive: false },
      });

      if (this.auditService) {
        await this.auditService.recordAuditLog(
          {
            action: 'PRODUCT_DEACTIVATE',
            entityType: 'product',
            entityId: id,
            userId: actorId,
            summary: `Deactivated product "${product.name}"`,
            changes: {
              isActive: { old: product.isActive, new: false },
            },
          },
          tx
        );
      }

      return excludeSensitiveFields(updated, ['costPriceCents']);
    });
  }

  // ============================================================================
  // PRODUCT VARIANT MANAGEMENT
  // ============================================================================

  /**
   * Retrieves all variants for a given product.
   */
  async findVariants(productId: string, includeInactive = false) {
    await this.findById(productId, true);

    return this.prisma.productVariant.findMany({
      where: {
        productId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Retrieves a specific variant by ID and validates that it belongs to the parent product.
   */
  async findVariantById(productId: string, variantId: string, includeInactive = false) {
    await this.findById(productId, true);

    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
    });

    if (!variant || variant.productId !== productId || (!variant.isActive && !includeInactive)) {
      throw new NotFoundException(`Variant with ID "${variantId}" not found for product "${productId}"`);
    }

    return variant;
  }

  /**
   * Creates a new variant for an existing product.
   * Atomically increments parent product aggregate stock if initial variant stockQuantity > 0.
   */
  async createVariant(productId: string, dto: CreateVariantDto, actorId?: string | null) {
    const product = await this.findById(productId, true);

    // Enforce SKU uniqueness across products and variants
    const [existingProductSku, existingVariantSku] = await Promise.all([
      this.prisma.product.findUnique({ where: { sku: dto.sku } }),
      this.prisma.productVariant.findUnique({ where: { sku: dto.sku } }),
    ]);

    if (existingProductSku || existingVariantSku) {
      throw new ConflictException(`SKU "${dto.sku}" is already in use`);
    }

    const initialStock = dto.stockQuantity || 0;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const variant = await tx.productVariant.create({
          data: {
            productId,
            name: dto.name,
            sku: dto.sku,
            priceCents: dto.priceCents,
            compareAtPriceCents: dto.compareAtPriceCents ?? null,
            stockQuantity: initialStock,
            attributes: dto.attributes || {},
            isActive: dto.isActive !== undefined ? dto.isActive : true,
          },
        });

        // Maintain parent product aggregate stock
        if (initialStock > 0) {
          await tx.product.update({
            where: { id: productId },
            data: { stockQuantity: { increment: initialStock } },
          });

          await tx.inventoryMovement.create({
            data: {
              productId,
              variantId: variant.id,
              previousQuantity: 0,
              newQuantity: initialStock,
              changeAmount: initialStock,
              reason: InventoryChangeReason.RESTOCK,
              note: 'Initial stock on variant creation',
              performedById: actorId || null,
            },
          });
        }

        if (this.auditService) {
          await this.auditService.recordAuditLog(
            {
              action: 'VARIANT_CREATE',
              entityType: 'variant',
              entityId: variant.id,
              userId: actorId,
              summary: `Created variant "${variant.name}" (SKU: ${variant.sku}) for product "${product.name}"`,
              changes: {
                name: { new: variant.name },
                sku: { new: variant.sku },
                priceCents: { new: variant.priceCents },
                stockQuantity: { new: variant.stockQuantity },
              },
            },
            tx
          );
        }

        return variant;
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException(`SKU "${dto.sku}" is already in use`);
      }
      throw err;
    }
  }

  /**
   * Updates an existing product variant.
   */
  async updateVariant(
    productId: string,
    variantId: string,
    dto: UpdateVariantDto,
    actorId?: string | null
  ) {
    const variant = await this.findVariantById(productId, variantId, true);

    if (dto.sku && dto.sku !== variant.sku) {
      const [existingProductSku, existingVariantSku] = await Promise.all([
        this.prisma.product.findUnique({ where: { sku: dto.sku } }),
        this.prisma.productVariant.findUnique({ where: { sku: dto.sku } }),
      ]);

      if (existingProductSku || existingVariantSku) {
        throw new ConflictException(`SKU "${dto.sku}" is already in use`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.productVariant.update({
        where: { id: variantId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.sku !== undefined ? { sku: dto.sku } : {}),
          ...(dto.priceCents !== undefined ? { priceCents: dto.priceCents } : {}),
          ...(dto.compareAtPriceCents !== undefined ? { compareAtPriceCents: dto.compareAtPriceCents } : {}),
          ...(dto.attributes !== undefined ? { attributes: dto.attributes } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });

      if (this.auditService) {
        const changes = this.auditService.computeDiff(variant, updated, [
          'name',
          'sku',
          'priceCents',
          'compareAtPriceCents',
          'attributes',
          'isActive',
        ]);
        await this.auditService.recordAuditLog(
          {
            action: 'VARIANT_UPDATE',
            entityType: 'variant',
            entityId: variantId,
            userId: actorId,
            summary: `Updated variant "${updated.name}" of product "${productId}"`,
            changes,
          },
          tx
        );
      }

      return updated;
    });
  }

  /**
   * Toggles variant active status without deleting records.
   */
  async toggleVariantStatus(productId: string, variantId: string, actorId?: string | null) {
    const variant = await this.findVariantById(productId, variantId, true);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.productVariant.update({
        where: { id: variantId },
        data: { isActive: !variant.isActive },
      });

      if (this.auditService) {
        await this.auditService.recordAuditLog(
          {
            action: 'VARIANT_STATUS_UPDATE',
            entityType: 'variant',
            entityId: variantId,
            userId: actorId,
            summary: `Toggled status for variant "${variant.name}" to ${updated.isActive ? 'ACTIVE' : 'INACTIVE'}`,
            changes: {
              isActive: { old: variant.isActive, new: updated.isActive },
            },
          },
          tx
        );
      }

      return updated;
    });
  }

  /**
   * Soft-deactivates a variant to prevent data loss.
   */
  async deleteVariant(productId: string, variantId: string, actorId?: string | null) {
    const variant = await this.findVariantById(productId, variantId, true);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.productVariant.update({
        where: { id: variantId },
        data: { isActive: false },
      });

      if (this.auditService) {
        await this.auditService.recordAuditLog(
          {
            action: 'VARIANT_DEACTIVATE',
            entityType: 'variant',
            entityId: variantId,
            userId: actorId,
            summary: `Deactivated variant "${variant.name}"`,
            changes: {
              isActive: { old: variant.isActive, new: false },
            },
          },
          tx
        );
      }

      return updated;
    });
  }
}
