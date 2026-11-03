import {
  Injectable,
  Inject,
  Optional,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BrandQueryDto } from './dto/brand-query.dto';
import { CreateBrandDto, UpdateBrandDto } from './dto/create-brand.dto';
import {
  toPrismaPagination,
  createPaginationMeta,
} from '../../common/pagination/pagination.util';
import { PaginatedResponse, createPaginatedResponse } from '../../common/interfaces/api-response.interface';
import { excludeSensitiveFieldsMany } from '../../common/utils/serialization.util';

@Injectable()
export class BrandsService {
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

  async findAll(query: BrandQueryDto): Promise<PaginatedResponse<any>> {
    const where: any = {};

    if (query.featured !== undefined) {
      where.featured = query.featured;
    }

    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { description: { contains: s, mode: 'insensitive' } },
        { originCountry: { contains: s, mode: 'insensitive' } },
      ];
    }

    const { skip, take, orderBy } = toPrismaPagination(query);

    const [totalItems, brands] = await Promise.all([
      this.prisma.brand.count({ where }),
      this.prisma.brand.findMany({
        where,
        skip,
        take,
        orderBy: orderBy || { name: 'asc' },
        include: {
          _count: {
            select: { products: true },
          },
        },
      }),
    ]);

    const items = brands.map((b) => ({
      ...b,
      itemCount: b._count.products,
    }));

    const meta = createPaginationMeta(totalItems, query.page, query.limit);
    return createPaginatedResponse(items, meta);
  }

  async findById(id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID "${id}" not found`);
    }

    return {
      ...brand,
      itemCount: brand._count?.products ?? 0,
    };
  }

  async findBySlug(slug: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { slug },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with slug "${slug}" not found`);
    }

    return {
      ...brand,
      itemCount: brand._count?.products ?? 0,
    };
  }

  async findBrandProducts(brandId: string, query: any): Promise<PaginatedResponse<any>> {
    const brand = await this.findById(brandId);

    const where: any = {
      brandId: brand.id,
      isActive: true,
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

    const sanitizedProducts = excludeSensitiveFieldsMany(products, ['costPriceCents']);

    const items = sanitizedProducts.map((p) => ({
      ...p,
      categoryName: p.category?.name || '',
      brandName: p.brand?.name || brand.name,
    }));

    const meta = createPaginationMeta(totalItems, query.page, query.limit);
    return createPaginatedResponse(items, meta);
  }

  async create(dto: CreateBrandDto, actorId?: string | null) {
    const existing = await this.prisma.brand.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException(`Brand with slug "${dto.slug}" already exists`);
    }

    return this.executeTx(async (tx) => {
      const brand = await tx.brand.create({
        data: dto,
      });

      if (this.auditService) {
        await this.auditService.recordAuditLog(
          {
            action: 'BRAND_CREATE',
            entityType: 'brand',
            entityId: brand.id,
            userId: actorId,
            summary: `Created brand "${brand.name}" (Slug: ${brand.slug})`,
            changes: {
              name: { new: brand.name },
              slug: { new: brand.slug },
              originCountry: { new: brand.originCountry },
            },
          },
          tx
        );
      }

      return brand;
    });
  }

  async update(id: string, dto: UpdateBrandDto, actorId?: string | null) {
    const existing = await this.findById(id);

    if (dto.slug) {
      const existingSlug = await this.prisma.brand.findUnique({
        where: { slug: dto.slug },
      });
      if (existingSlug && existingSlug.id !== id) {
        throw new ConflictException(`Brand with slug "${dto.slug}" already exists`);
      }
    }

    return this.executeTx(async (tx) => {
      const updated = await tx.brand.update({
        where: { id },
        data: dto,
      });

      if (this.auditService) {
        const changes = this.auditService.computeDiff(existing, updated, [
          'name',
          'slug',
          'description',
          'logo',
          'originCountry',
          'featured',
        ]);
        await this.auditService.recordAuditLog(
          {
            action: 'BRAND_UPDATE',
            entityType: 'brand',
            entityId: id,
            userId: actorId,
            summary: `Updated brand "${updated.name}"`,
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

    const productCount = await this.prisma.product.count({
      where: { brandId: id },
    });

    if (productCount > 0) {
      throw new ConflictException(
        `Cannot delete brand "${id}" because it is referenced by ${productCount} existing product(s). Reassign or remove the products first.`
      );
    }

    return this.executeTx(async (tx) => {
      const deleted = await tx.brand.delete({
        where: { id },
      });

      if (this.auditService) {
        await this.auditService.recordAuditLog(
          {
            action: 'BRAND_DELETE',
            entityType: 'brand',
            entityId: id,
            userId: actorId,
            summary: `Deleted brand "${existing.name}"`,
          },
          tx
        );
      }

      return deleted;
    });
  }
}
