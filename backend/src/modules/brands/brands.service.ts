import {
  Injectable,
  Inject,
  Optional,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as ExcelJS from 'exceljs';
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

  /**
   * Retrieves brand analytics directly from PostgreSQL database.
   */
  async getAdminAnalytics() {
    const [counts, usage, topBrands] = await Promise.all([
      this.prisma.$queryRaw<Array<{ total: number; featured: number }>>`
        SELECT
          COUNT(*)::int AS "total",
          COUNT(*) FILTER (WHERE "featured" = true)::int AS "featured"
        FROM "Brand"
      `,
      this.prisma.$queryRaw<Array<{ withProducts: number; empty: number }>>`
        SELECT
          COUNT(DISTINCT b.id) FILTER (WHERE p.id IS NOT NULL)::int AS "withProducts",
          COUNT(DISTINCT b.id) FILTER (WHERE p.id IS NULL)::int AS "empty"
        FROM "Brand" b
        LEFT JOIN "Product" p ON p."brandId" = b.id
      `,
      this.prisma.$queryRaw<Array<{ id: string; name: string; count: number }>>`
        SELECT b.id, b.name, COUNT(p.id)::int AS count
        FROM "Brand" b
        LEFT JOIN "Product" p ON p."brandId" = b.id
        GROUP BY b.id, b.name
        ORDER BY count DESC
        LIMIT 10
      `,
    ]);

    const c = counts[0] || { total: 0, featured: 0 };
    const u = usage[0] || { withProducts: 0, empty: 0 };

    return {
      totalBrands: Number(c.total),
      featuredBrands: Number(c.featured),
      brandsWithProducts: Number(u.withProducts),
      emptyBrands: Number(u.empty),
      topBrands: topBrands.map((b) => ({ id: b.id, name: b.name, count: Number(b.count) })),
    };
  }

  /**
   * Generates a streaming CSV or XLSX export of all brands.
   */
  async exportBrands(
    format: 'csv' | 'xlsx' = 'xlsx',
    selectedIds?: string[]
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const where: any = {};
    if (selectedIds && selectedIds.length > 0) {
      where.id = { in: selectedIds };
    }

    const brands = await this.prisma.brand.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { products: true } },
      },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'DSL Stationery Admin';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Brands');
    worksheet.columns = [
      { header: 'Brand ID', key: 'id', width: 28 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Slug', key: 'slug', width: 25 },
      { header: 'Origin Country', key: 'originCountry', width: 20 },
      { header: 'Product Count', key: 'productCount', width: 16 },
      { header: 'Featured', key: 'featured', width: 14 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Created Date', key: 'createdAt', width: 22 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' },
    };

    brands.forEach((b) => {
      worksheet.addRow({
        id: b.id,
        name: b.name,
        slug: b.slug,
        originCountry: b.originCountry,
        productCount: b._count.products,
        featured: b.featured ? 'Yes' : 'No',
        description: b.description,
        createdAt: b.createdAt ? b.createdAt.toISOString() : '',
      });
    });

    const timestamp = new Date().toISOString().split('T')[0];
    if (format === 'csv') {
      const csvBuffer = await workbook.csv.writeBuffer();
      return {
        buffer: Buffer.from(csvBuffer),
        filename: `dsl-brands-${timestamp}.csv`,
        mimeType: 'text/csv; charset=utf-8',
      };
    } else {
      const xlsxBuffer = await workbook.xlsx.writeBuffer();
      return {
        buffer: Buffer.from(xlsxBuffer),
        filename: `dsl-brands-${timestamp}.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }
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
