import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateSchoolPackDto,
  UpdateSchoolPackDto,
} from './dto/create-school-pack.dto';
import { SchoolPackQueryDto } from './dto/school-pack-query.dto';
import {
  SchoolPackConfigDto,
  DEFAULT_GRADE_GROUPS,
  DEFAULT_TIERS,
} from './dto/school-pack-config.dto';
import { CalculateSchoolPackDto } from './dto/calculate-school-pack.dto';
import { createPaginationMeta } from '../../common/pagination/pagination.util';
import { createPaginatedResponse } from '../../common/interfaces/api-response.interface';

@Injectable()
export class SchoolPacksService {
  private readonly logger = new Logger(SchoolPacksService.name);

  // Runtime configurable grade groups and tiers
  private gradeGroups: string[] = [...DEFAULT_GRADE_GROUPS];
  private tiers: string[] = [...DEFAULT_TIERS];

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Get currently active grade groups and tiers configuration.
   */
  getConfig(): SchoolPackConfigDto {
    return {
      gradeGroups: [...this.gradeGroups],
      tiers: [...this.tiers],
    };
  }

  /**
   * Update active grade groups and tiers configuration.
   */
  updateConfig(dto: SchoolPackConfigDto): SchoolPackConfigDto {
    if (dto.gradeGroups && dto.gradeGroups.length > 0) {
      this.gradeGroups = [...new Set(dto.gradeGroups.map((g) => g.trim()))];
    }
    if (dto.tiers && dto.tiers.length > 0) {
      this.tiers = [...new Set(dto.tiers.map((t) => t.trim().toLowerCase()))];
    }
    this.logger.log(`Updated school pack configuration: ${this.gradeGroups.length} grades, ${this.tiers.length} tiers`);
    return this.getConfig();
  }

  /**
   * Helper to generate a URL slug from name.
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Ensure slug is unique in PostgreSQL.
   */
  private async ensureUniqueSlug(baseSlug: string, currentId?: string): Promise<string> {
    let candidate = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.schoolPack.findUnique({
        where: { slug: candidate },
      });

      if (!existing || existing.id === currentId) {
        return candidate;
      }

      candidate = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  /**
   * Validate grade and tier against enabled configuration.
   */
  private validateGradeAndTier(grade: string, tier: string): void {
    const isGradeValid = this.gradeGroups.some(
      (g) => g.toLowerCase() === grade.toLowerCase().trim()
    );
    if (!isGradeValid) {
      throw new BadRequestException(
        `Invalid grade group '${grade}'. Supported grade groups: ${this.gradeGroups.join(', ')}`
      );
    }

    const isTierValid = this.tiers.some(
      (t) => t.toLowerCase() === tier.toLowerCase().trim()
    );
    if (!isTierValid) {
      throw new BadRequestException(
        `Invalid tier '${tier}'. Supported tiers: ${this.tiers.join(', ')}`
      );
    }
  }

  /**
   * Create a new School Pack with server-authoritative pricing and real DB products.
   */
  async create(dto: CreateSchoolPackDto) {
    this.validateGradeAndTier(dto.grade, dto.tier);

    // 1. Validate items
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('A school pack must contain at least one item');
    }

    // Check for duplicate primary products in pack
    const itemProductIds = dto.items.map((i) => i.productId);
    if (new Set(itemProductIds).size !== itemProductIds.length) {
      throw new BadRequestException('Cannot include duplicate products in the same pack');
    }

    // 2. Collect all product IDs (primary + substitutes) to verify existence in DB
    const allSubstituteIds = dto.items.flatMap((i) => i.substituteProductIds || []);
    const allReferencedIds = [...new Set([...itemProductIds, ...allSubstituteIds])];

    const existingProducts = await this.prisma.product.findMany({
      where: { id: { in: allReferencedIds } },
      select: { id: true, name: true, priceCents: true, stockQuantity: true, isActive: true },
    });

    const productMap = new Map(existingProducts.map((p) => [p.id, p]));

    // Check that all primary products exist and are active
    for (const item of dto.items) {
      const p = productMap.get(item.productId);
      if (!p) {
        throw new NotFoundException(`Product with ID '${item.productId}' not found in database`);
      }
      if (!p.isActive) {
        throw new BadRequestException(`Product '${p.name}' (${p.id}) is inactive and cannot be added to a pack`);
      }
      if (item.defaultQuantity < 1) {
        throw new BadRequestException(`Default quantity for product '${p.name}' must be at least 1`);
      }

      // Check substitutes
      if (item.substituteProductIds && item.substituteProductIds.length > 0) {
        for (const subId of item.substituteProductIds) {
          const subProduct = productMap.get(subId);
          if (!subProduct) {
            throw new NotFoundException(`Substitute product with ID '${subId}' not found in database`);
          }
          if (!subProduct.isActive) {
            throw new BadRequestException(
              `Substitute product '${subProduct.name}' (${subProduct.id}) is inactive`
            );
          }
        }
      }
    }

    // 3. Compute server-authoritative totals
    const savingsPercentage = dto.savingsPercentage ?? 10;
    let subtotalCents = 0;

    for (const item of dto.items) {
      const p = productMap.get(item.productId)!;
      subtotalCents += p.priceCents * item.defaultQuantity;
    }

    const discountCents = Math.round((subtotalCents * savingsPercentage) / 100);
    const totalPriceCents = Math.max(0, subtotalCents - discountCents);

    // 4. Resolve slug
    const baseSlug = dto.slug ? this.generateSlug(dto.slug) : this.generateSlug(dto.name);
    const slug = await this.ensureUniqueSlug(baseSlug);

    // 5. Create in database with transaction
    return this.prisma.$transaction(async (tx) => {
      const pack = await tx.schoolPack.create({
        data: {
          name: dto.name.trim(),
          slug,
          grade: dto.grade.trim(),
          tier: dto.tier.trim().toLowerCase(),
          description: dto.description.trim(),
          savingsPercentage,
          totalPriceCents,
          isActive: dto.isActive ?? true,
          items: {
            create: dto.items.map((item) => {
              const prod = productMap.get(item.productId)!;
              return {
                productId: item.productId,
                defaultQuantity: item.defaultQuantity,
                unitPriceCents: prod.priceCents,
                substituteProductIds: item.substituteProductIds || [],
              };
            }),
          },
        },
        include: {
          items: {
            include: {
              product: {
                include: {
                  category: true,
                  brand: true,
                },
              },
            },
          },
        },
      });

      this.logger.log(`Created school pack '${pack.name}' (${pack.id}) - Total: Rs. ${(pack.totalPriceCents / 100).toFixed(2)}`);
      return this.enrichPackWithStockAndSubstitutes(pack);
    });
  }

  /**
   * Update an existing School Pack and recalculate server pricing.
   */
  async update(id: string, dto: UpdateSchoolPackDto) {
    const existing = await this.prisma.schoolPack.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existing) {
      throw new NotFoundException(`School Pack with ID '${id}' not found`);
    }

    if (dto.grade || dto.tier) {
      this.validateGradeAndTier(
        dto.grade || existing.grade,
        dto.tier || existing.tier
      );
    }

    let slug = existing.slug;
    if (dto.slug && dto.slug !== existing.slug) {
      slug = await this.ensureUniqueSlug(this.generateSlug(dto.slug), id);
    } else if (dto.name && !dto.slug && dto.name !== existing.name) {
      slug = await this.ensureUniqueSlug(this.generateSlug(dto.name), id);
    }

    const savingsPercentage =
      dto.savingsPercentage !== undefined ? dto.savingsPercentage : existing.savingsPercentage;

    return this.prisma.$transaction(async (tx) => {
      let updatedItems = existing.items;

      // If items are being replaced:
      if (dto.items && dto.items.length > 0) {
        // Duplicate check
        const itemProductIds = dto.items.map((i) => i.productId);
        if (new Set(itemProductIds).size !== itemProductIds.length) {
          throw new BadRequestException('Cannot include duplicate products in the same pack');
        }

        const allSubstituteIds = dto.items.flatMap((i) => i.substituteProductIds || []);
        const allReferencedIds = [...new Set([...itemProductIds, ...allSubstituteIds])];

        const existingProducts = await tx.product.findMany({
          where: { id: { in: allReferencedIds } },
          select: { id: true, name: true, priceCents: true, stockQuantity: true, isActive: true },
        });

        const productMap = new Map(existingProducts.map((p) => [p.id, p]));

        for (const item of dto.items) {
          const p = productMap.get(item.productId);
          if (!p) {
            throw new NotFoundException(`Product with ID '${item.productId}' not found`);
          }
          if (!p.isActive) {
            throw new BadRequestException(`Product '${p.name}' is inactive`);
          }
          if (item.substituteProductIds) {
            for (const subId of item.substituteProductIds) {
              const subP = productMap.get(subId);
              if (!subP || !subP.isActive) {
                throw new BadRequestException(`Substitute product '${subId}' is not found or inactive`);
              }
            }
          }
        }

        // Delete existing items
        await tx.schoolPackItem.deleteMany({
          where: { packId: id },
        });

        // Recreate items
        await tx.schoolPackItem.createMany({
          data: dto.items.map((item) => {
            const p = productMap.get(item.productId)!;
            return {
              packId: id,
              productId: item.productId,
              defaultQuantity: item.defaultQuantity,
              unitPriceCents: p.priceCents,
              substituteProductIds: item.substituteProductIds || [],
            };
          }),
        });
      }

      // Re-fetch all items to recalculate total
      const currentItems = await tx.schoolPackItem.findMany({
        where: { packId: id },
        include: { product: true },
      });

      let subtotalCents = 0;
      for (const item of currentItems) {
        subtotalCents += item.product.priceCents * item.defaultQuantity;
      }
      const discountCents = Math.round((subtotalCents * savingsPercentage) / 100);
      const totalPriceCents = Math.max(0, subtotalCents - discountCents);

      const updated = await tx.schoolPack.update({
        where: { id },
        data: {
          name: dto.name?.trim() ?? existing.name,
          slug,
          grade: dto.grade?.trim() ?? existing.grade,
          tier: dto.tier?.trim().toLowerCase() ?? existing.tier,
          description: dto.description?.trim() ?? existing.description,
          savingsPercentage,
          totalPriceCents,
          isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
        },
        include: {
          items: {
            include: {
              product: {
                include: {
                  category: true,
                  brand: true,
                },
              },
            },
          },
        },
      });

      return this.enrichPackWithStockAndSubstitutes(updated);
    });
  }

  /**
   * Toggle pack active state.
   */
  async toggleStatus(id: string, isActive?: boolean) {
    const pack = await this.prisma.schoolPack.findUnique({
      where: { id },
    });

    if (!pack) {
      throw new NotFoundException(`School Pack with ID '${id}' not found`);
    }

    const nextState = isActive !== undefined ? isActive : !pack.isActive;
    return this.prisma.schoolPack.update({
      where: { id },
      data: { isActive: nextState },
    });
  }

  /**
   * Find all packs with filtering, live stock calculation, and pagination.
   */
  async findAll(query: SchoolPackQueryDto, isAdmin = false) {
    const where: any = {};

    if (!isAdmin) {
      where.isActive = true;
    } else if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.grade) {
      where.grade = { equals: query.grade, mode: 'insensitive' };
    }

    if (query.tier) {
      where.tier = { equals: query.tier, mode: 'insensitive' };
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { grade: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [total, packs] = await Promise.all([
      this.prisma.schoolPack.count({ where }),
      this.prisma.schoolPack.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ grade: 'asc' }, { tier: 'asc' }],
        include: {
          items: {
            include: {
              product: {
                include: {
                  category: true,
                  brand: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const enrichedPacks = await Promise.all(
      packs.map((p) => this.enrichPackWithStockAndSubstitutes(p))
    );

    const meta = createPaginationMeta(total, page, limit);
    return createPaginatedResponse(enrichedPacks, meta);
  }

  /**
   * Find a single pack by ID or slug.
   */
  async findOne(idOrSlug: string, isAdmin = false) {
    const pack = await this.prisma.schoolPack.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true,
                brand: true,
                variants: true,
              },
            },
          },
        },
      },
    });

    if (!pack) {
      throw new NotFoundException(`School Pack '${idOrSlug}' not found`);
    }

    if (!isAdmin && !pack.isActive) {
      throw new NotFoundException(`School Pack '${idOrSlug}' is currently not available`);
    }

    return this.enrichPackWithStockAndSubstitutes(pack);
  }

  /**
   * Calculate live customized pricing and stock for customer-adjusted pack components.
   */
  async calculateCustomized(idOrSlug: string, dto: CalculateSchoolPackDto) {
    const pack = await this.prisma.schoolPack.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!pack || !pack.isActive) {
      throw new NotFoundException(`School Pack '${idOrSlug}' is not available`);
    }

    // Allowed product IDs are primary items or their substitutes
    const allowedMap = new Map<string, { packItemId: string; defaultQty: number }>();
    for (const item of pack.items) {
      allowedMap.set(item.productId, { packItemId: item.id, defaultQty: item.defaultQuantity });
      for (const subId of item.substituteProductIds) {
        allowedMap.set(subId, { packItemId: item.id, defaultQty: item.defaultQuantity });
      }
    }

    const requestedProductIds = dto.items.map((i) => i.productId);
    const dbProducts = await this.prisma.product.findMany({
      where: { id: { in: requestedProductIds } },
      include: { variants: true },
    });
    const dbProductMap = new Map(dbProducts.map((p) => [p.id, p]));

    let calculatedOriginalSubtotalCents = 0;
    let outOfStockCount = 0;
    const itemBreakdown = [];

    for (const reqItem of dto.items) {
      const dbProd = dbProductMap.get(reqItem.productId);
      if (!dbProd) {
        throw new NotFoundException(`Product '${reqItem.productId}' not found`);
      }

      let variant = null;
      if (reqItem.variantId) {
        variant = dbProd.variants.find((v) => v.id === reqItem.variantId);
      }

      const unitPriceCents = variant ? variant.priceCents : dbProd.priceCents;
      const stockQuantity = variant ? variant.stockQuantity : dbProd.stockQuantity;
      const lineSubtotalCents = unitPriceCents * reqItem.quantity;
      const isAvailable = dbProd.isActive && (variant ? variant.isActive : true) && stockQuantity >= reqItem.quantity;

      if (!isAvailable) {
        outOfStockCount++;
      }

      calculatedOriginalSubtotalCents += lineSubtotalCents;

      itemBreakdown.push({
        productId: dbProd.id,
        productName: dbProd.name,
        variantId: variant?.id || null,
        variantName: variant?.name || null,
        quantity: reqItem.quantity,
        unitPriceCents,
        lineSubtotalCents,
        stockQuantity,
        isAvailable,
      });
    }

    const savingsPercentage = pack.savingsPercentage;
    const calculatedSavingsCents = Math.round(
      (calculatedOriginalSubtotalCents * savingsPercentage) / 100
    );
    const calculatedTotalCents = Math.max(
      0,
      calculatedOriginalSubtotalCents - calculatedSavingsCents
    );

    // Prorate discount across items
    let allocatedDiscount = 0;
    const proratedItems = itemBreakdown.map((item, index) => {
      let itemDiscountCents = 0;
      if (calculatedOriginalSubtotalCents > 0) {
        if (index === itemBreakdown.length - 1) {
          // Remainder on last item to guarantee exact integer penny match
          itemDiscountCents = calculatedSavingsCents - allocatedDiscount;
        } else {
          itemDiscountCents = Math.round(
            (item.lineSubtotalCents / calculatedOriginalSubtotalCents) * calculatedSavingsCents
          );
          allocatedDiscount += itemDiscountCents;
        }
      }

      const discountedLineTotalCents = Math.max(0, item.lineSubtotalCents - itemDiscountCents);
      const discountedUnitPriceCents =
        item.quantity > 0 ? Math.round(discountedLineTotalCents / item.quantity) : item.unitPriceCents;

      return {
        ...item,
        discountCents: itemDiscountCents,
        discountedLineTotalCents,
        discountedUnitPriceCents,
      };
    });

    return {
      packId: pack.id,
      packName: pack.name,
      savingsPercentage,
      calculatedOriginalSubtotalCents,
      calculatedSavingsCents,
      calculatedTotalCents,
      allInStock: outOfStockCount === 0,
      outOfStockCount,
      items: proratedItems,
    };
  }

  /**
   * Helper to enrich a SchoolPack entity with substitute product objects and stock indicators.
   */
  private async enrichPackWithStockAndSubstitutes(pack: any) {
    // Collect all substitute product IDs across items
    const allSubstituteIds = pack.items.flatMap((item: any) => item.substituteProductIds || []);

    let substituteProductsMap = new Map<string, any>();
    if (allSubstituteIds.length > 0) {
      const subs = await this.prisma.product.findMany({
        where: { id: { in: allSubstituteIds } },
        select: {
          id: true,
          name: true,
          slug: true,
          sku: true,
          priceCents: true,
          stockQuantity: true,
          isActive: true,
          images: true,
        },
      });
      substituteProductsMap = new Map(subs.map((s) => [s.id, s]));
    }

    let calculatedOriginalSubtotalCents = 0;
    let outOfStockItemsCount = 0;

    const enrichedItems = pack.items.map((item: any) => {
      const p = item.product;
      const unitPriceCents = p ? p.priceCents : item.unitPriceCents;
      const availableStock = p ? p.stockQuantity : 0;
      const isAvailable = (p ? p.isActive : false) && availableStock >= item.defaultQuantity;

      if (!isAvailable) {
        outOfStockItemsCount++;
      }

      const lineTotalCents = unitPriceCents * item.defaultQuantity;
      calculatedOriginalSubtotalCents += lineTotalCents;

      const substitutes = (item.substituteProductIds || [])
        .map((subId: string) => substituteProductsMap.get(subId))
        .filter(Boolean);

      return {
        id: item.id,
        productId: item.productId,
        productName: p?.name || 'Unknown Product',
        defaultQuantity: item.defaultQuantity,
        unitPriceCents,
        lineTotalCents,
        stockQuantity: availableStock,
        isAvailable,
        product: p,
        substituteProductIds: item.substituteProductIds || [],
        substitutes,
      };
    });

    const calculatedSavingsCents = Math.round(
      (calculatedOriginalSubtotalCents * pack.savingsPercentage) / 100
    );
    const calculatedTotalCents = Math.max(
      0,
      calculatedOriginalSubtotalCents - calculatedSavingsCents
    );

    return {
      id: pack.id,
      name: pack.name,
      slug: pack.slug,
      grade: pack.grade,
      tier: pack.tier,
      description: pack.description,
      savingsPercentage: pack.savingsPercentage,
      totalPriceCents: pack.totalPriceCents,
      calculatedOriginalSubtotalCents,
      calculatedSavingsCents,
      calculatedTotalCents,
      allInStock: outOfStockItemsCount === 0,
      outOfStockItemsCount,
      isActive: pack.isActive,
      createdAt: pack.createdAt,
      updatedAt: pack.updatedAt,
      items: enrichedItems,
    };
  }

  /**
   * Delete a School Pack.
   */
  async delete(id: string) {
    const existing = await this.prisma.schoolPack.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`School Pack with ID '${id}' not found`);
    }

    await this.prisma.schoolPack.delete({
      where: { id },
    });

    return { success: true, message: `School Pack '${existing.name}' was deleted successfully` };
  }
}
