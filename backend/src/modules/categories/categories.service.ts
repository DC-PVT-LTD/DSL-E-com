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
  ) { }

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

    if (query.parentId !== undefined) {
      where.parentId = query.parentId;
    } else if (query.rootOnly) {
      where.parentId = null;
    }

    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { description: { contains: s, mode: 'insensitive' } },
      ];
    }

    const { skip, take, orderBy } = toPrismaPagination(query);

    const include: any = {
      parent: {
        select: { id: true, name: true, slug: true },
      },
      _count: {
        select: { products: true, subProducts: true, children: true },
      },
    };

    if (query.includeChildren) {
      include.children = {
        orderBy: { displayOrder: 'asc' },
        include: {
          _count: {
            select: { products: true, subProducts: true },
          },
        },
      };
    }

    const [totalItems, categories] = await Promise.all([
      this.prisma.category.count({ where }),
      this.prisma.category.findMany({
        where,
        skip,
        take,
        orderBy: orderBy || { displayOrder: 'asc' },
        include,
      }),
    ]);

    // Map counts for convenient frontend consumption
    const items = categories.map((c: any) => ({
      ...c,
      itemCount: (c._count?.products ?? 0) + (c._count?.subProducts ?? 0),
      subcategoryCount: c._count?.children ?? 0,
      children: c.children
        ? c.children.map((ch: any) => ({
          ...ch,
          itemCount: (ch._count?.products ?? 0) + (ch._count?.subProducts ?? 0),
        }))
        : undefined,
    }));

    const meta = createPaginationMeta(totalItems, query.page, query.limit);
    return createPaginatedResponse(items, meta);
  }

  async getCategoryTree() {
    const rootCategories = await this.prisma.category.findMany({
      where: { parentId: null },
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: {
          select: { products: true, children: true },
        },
        children: {
          orderBy: { displayOrder: 'asc' },
          include: {
            _count: {
              select: { products: true, subProducts: true },
            },
          },
        },
      },
    });

    return rootCategories.map((c) => {
      const children = c.children.map((ch) => ({
        ...ch,
        itemCount: (ch._count?.products ?? 0) + (ch._count?.subProducts ?? 0),
      }));
      const totalChildProducts = children.reduce((sum, ch) => sum + ch.itemCount, 0);
      return {
        ...c,
        itemCount: (c._count?.products ?? 0) + totalChildProducts,
        directProductCount: c._count?.products ?? 0,
        subcategoryCount: c._count?.children ?? 0,
        children,
      };
    });
  }

  async findById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true, slug: true } },
        children: {
          orderBy: { displayOrder: 'asc' },
          include: {
            _count: { select: { products: true, subProducts: true } },
          },
        },
        _count: {
          select: { products: true, subProducts: true, children: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID "${id}" not found`);
    }

    const children = (category.children || []).map((ch) => ({
      ...ch,
      itemCount: (ch._count?.products ?? 0) + (ch._count?.subProducts ?? 0),
    }));

    return {
      ...category,
      itemCount: (category._count?.products ?? 0) + (category._count?.subProducts ?? 0),
      subcategoryCount: category._count?.children ?? 0,
      children,
    };
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        parent: { select: { id: true, name: true, slug: true } },
        children: {
          orderBy: { displayOrder: 'asc' },
          include: {
            _count: { select: { products: true, subProducts: true } },
          },
        },
        _count: {
          select: { products: true, subProducts: true, children: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with slug "${slug}" not found`);
    }

    const children = (category.children || []).map((ch) => ({
      ...ch,
      itemCount: (ch._count?.products ?? 0) + (ch._count?.subProducts ?? 0),
    }));

    return {
      ...category,
      itemCount: (category._count?.products ?? 0) + (category._count?.subProducts ?? 0),
      subcategoryCount: category._count?.children ?? 0,
      children,
    };
  }

  async findCategoryProducts(categoryId: string, query: any): Promise<PaginatedResponse<any>> {
    // Verify category exists
    const category = await this.findById(categoryId);

    // If the category is a root category, include products assigned directly or to any of its subcategories
    const subcategoryIds = ((category as any).children || []).map((ch: any) => ch.id);
    const where: any = {
      isActive: true, // Public storefront only lists active products
      OR: [
        { categoryId: category.id },
        ...(subcategoryIds.length > 0 ? [{ subcategoryId: { in: subcategoryIds } }] : []),
      ],
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
          subcategory: { select: { id: true, name: true, slug: true } },
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
      subcategoryName: p.subcategory?.name || null,
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

    // Validate parent category and hierarchy constraints
    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parentId },
      });

      if (!parent) {
        throw new NotFoundException(`Parent category with ID "${dto.parentId}" not found`);
      }

      if (parent.parentId !== null) {
        throw new BadRequestException(
          'DSL Stationery enforces a strictly two-level category hierarchy: Category -> Subcategory. Subcategories cannot have child categories.'
        );
      }
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
              parentId: { new: category.parentId },
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

    // Validate hierarchy constraints when parentId is updated
    if (dto.parentId !== undefined) {
      if (dto.parentId === id) {
        throw new BadRequestException('A category cannot be its own parent.');
      }

      if (dto.parentId !== null) {
        // Prevent converting a parent category that already has subcategories into a subcategory
        const childCount = await this.prisma.category.count({
          where: { parentId: id },
        });

        if (childCount > 0) {
          throw new BadRequestException(
            'A parent category with existing subcategories cannot be converted into a subcategory.'
          );
        }

        const parent = await this.prisma.category.findUnique({
          where: { id: dto.parentId },
        });

        if (!parent) {
          throw new NotFoundException(`Parent category with ID "${dto.parentId}" not found`);
        }

        if (parent.parentId !== null) {
          throw new BadRequestException(
            'DSL Stationery enforces a strictly two-level category hierarchy: Category -> Subcategory. Subcategories cannot have child categories.'
          );
        }
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

    // Guard: Prevent deletion of categories that have subcategories
    const subcategoryCount = await this.prisma.category.count({
      where: { parentId: id },
    });

    if (subcategoryCount > 0) {
      throw new ConflictException(
        `Cannot delete category "${id}" because it contains ${subcategoryCount} subcategory/subcategories. Reassign or remove subcategories first.`
      );
    }

    // Guard: Prevent deletion of categories that have products attached (as parent category or as subcategory)
    const [productCount, subProductCount] = await Promise.all([
      this.prisma.product.count({ where: { categoryId: id } }),
      this.prisma.product.count({ where: { subcategoryId: id } }),
    ]);

    const totalProducts = productCount + subProductCount;

    if (totalProducts > 0) {
      throw new ConflictException(
        `Cannot delete category "${id}" because it is referenced by ${totalProducts} existing product(s). Reassign or remove the products first.`
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
