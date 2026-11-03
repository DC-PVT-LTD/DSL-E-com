import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductQueryDto } from './dto/product-query.dto';
import { CreateProductDto, UpdateProductDto } from './dto/create-product.dto';
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
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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
      where.priceCents = {};
      if (query.minPrice !== undefined) {
        where.priceCents.gte = query.minPrice;
      }
      if (query.maxPrice !== undefined) {
        where.priceCents.lte = query.maxPrice;
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

  async create(dto: CreateProductDto) {
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

    const created = await this.prisma.product.create({
      data: dto as any,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        brand: { select: { id: true, name: true, slug: true } },
        variants: true,
      },
    });

    return excludeSensitiveFields(created, ['costPriceCents']);
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findById(id, true);

    if (dto.slug) {
      const existing = await this.prisma.product.findUnique({ where: { slug: dto.slug } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Product slug "${dto.slug}" already exists`);
      }
    }

    if (dto.sku) {
      const existing = await this.prisma.product.findUnique({ where: { sku: dto.sku } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Product SKU "${dto.sku}" already exists`);
      }
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: dto as any,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        brand: { select: { id: true, name: true, slug: true } },
        variants: true,
      },
    });

    return excludeSensitiveFields(updated, ['costPriceCents']);
  }

  async toggleStatus(id: string) {
    const product = await this.findById(id, true);
    const updated = await this.prisma.product.update({
      where: { id },
      data: { isActive: !product.isActive },
    });
    return excludeSensitiveFields(updated, ['costPriceCents']);
  }

  async delete(id: string) {
    await this.findById(id, true);

    // Soft deactivation or hard delete
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
