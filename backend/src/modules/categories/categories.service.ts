import {
  Injectable,
  Inject,
  Optional,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CategoryQueryDto } from './dto/category-query.dto';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/create-category.dto';
import {
  toPrismaPagination,
  createPaginationMeta,
} from '../../common/pagination/pagination.util';
import { PaginatedResponse, createPaginatedResponse } from '../../common/interfaces/api-response.interface';
import { excludeSensitiveFieldsMany } from '../../common/utils/serialization.util';

@Injectable()
export class CategoriesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(AuditService) private readonly auditService?: AuditService,
  ) {}

  private async executeTx<T>(cb: (tx: any) => Promise<T>): Promise<T> {
    if (typeof this.prisma.$transaction === 'function') {
      return this.prisma.$transaction(cb);
    }
    return cb(this.prisma);
  }

  async findAll(query: CategoryQueryDto): Promise<PaginatedResponse<any>> {
    const where: any = {};

    if (query.featured !== undefined) {
      where.featured = query.featured;
    }

    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { description: { contains: s, mode: 'insensitive' } },
      ];
    }

    const { skip, take, orderBy } = toPrismaPagination(query);

    const [totalItems, categories] = await Promise.all([
      this.prisma.category.count({ where }),
      this.prisma.category.findMany({
        where,
        skip,
        take,
        orderBy: orderBy || { displayOrder: 'asc' },
        include: {
          _count: {
            select: { products: true },
          },
        },
      }),
    ]);

    // Map _count.products to itemCount for convenient frontend consumption
    const items = categories.map((c) => ({
      ...c,
      itemCount: c._count.products,
    }));

    const meta = createPaginationMeta(totalItems, query.page, query.limit);
    return createPaginatedResponse(items, meta);
  }

  async findById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID "${id}" not found`);
    }

    return {
      ...category,
      itemCount: category._count?.products ?? 0,
    };
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with slug "${slug}" not found`);
    }

    return {
      ...category,
      itemCount: category._count?.products ?? 0,
    };
  }

  async findCategoryProducts(categoryId: string, query: any): Promise<PaginatedResponse<any>> {
    // Verify category exists
    const category = await this.findById(categoryId);

    const where: any = {
      categoryId: category.id,
      isActive: true, // Public storefront only lists active products
    };

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

    // Sanitize sensitive internal fields like costPriceCents
    const sanitizedProducts = excludeSensitiveFieldsMany(products, ['costPriceCents']);

    const items = sanitizedProducts.map((p) => ({
      ...p,
      categoryName: p.category?.name || category.name,
      brandName: p.brand?.name || '',
    }));

    const meta = createPaginationMeta(totalItems, query.page, query.limit);
    return createPaginatedResponse(items, meta);
  }

  async create(dto: CreateCategoryDto, actorId?: string | null) {
    const existing = await this.prisma.category.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException(`Category with slug "${dto.slug}" already exists`);
    }

    return this.executeTx(async (tx) => {
      const category = await tx.category.create({
        data: dto,
      });

      if (this.auditService) {
        await this.auditService.recordAuditLog(
          {
            action: 'CATEGORY_CREATE',
            entityType: 'category',
            entityId: category.id,
            userId: actorId,
            summary: `Created category "${category.name}" (Slug: ${category.slug})`,
            changes: {
              name: { new: category.name },
              slug: { new: category.slug },
            },
          },
          tx
        );
      }

      return category;
    });
  }

  async update(id: string, dto: UpdateCategoryDto, actorId?: string | null) {
    const existing = await this.findById(id);

    if (dto.slug) {
      const existingSlug = await this.prisma.category.findUnique({
        where: { slug: dto.slug },
      });
      if (existingSlug && existingSlug.id !== id) {
        throw new ConflictException(`Category with slug "${dto.slug}" already exists`);
      }
    }

    return this.executeTx(async (tx) => {
      const updated = await tx.category.update({
        where: { id },
        data: dto,
      });

      if (this.auditService) {
        const changes = this.auditService.computeDiff(existing, updated, [
          'name',
          'slug',
          'description',
          'image',
          'parentId',
          'isActive',
          'displayOrder',
        ]);
        await this.auditService.recordAuditLog(
          {
            action: 'CATEGORY_UPDATE',
            entityType: 'category',
            entityId: id,
            userId: actorId,
            summary: `Updated category "${updated.name}"`,
            changes,
          },
          tx
        );
      }

      return updated;
    });
  }

  async delete(id: string, actorId?: string | null) {
    const existing = await this.findById(id);

    // Guard: Prevent deletion of categories that have products attached
    const productCount = await this.prisma.product.count({
      where: { categoryId: id },
    });

    if (productCount > 0) {
      throw new ConflictException(
        `Cannot delete category "${id}" because it is referenced by ${productCount} existing product(s). Reassign or remove the products first.`
      );
    }

    return this.executeTx(async (tx) => {
      const deleted = await tx.category.delete({
        where: { id },
      });

      if (this.auditService) {
        await this.auditService.recordAuditLog(
          {
            action: 'CATEGORY_DELETE',
            entityType: 'category',
            entityId: id,
            userId: actorId,
            summary: `Deleted category "${existing.name}"`,
          },
          tx
        );
      }

      return deleted;
    });
  }
}
