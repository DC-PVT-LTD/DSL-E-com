import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePromotionDto,
  UpdatePromotionDto,
  CreatePromoCodeDto,
  ValidatePromoCodeDto,
  QueryPromotionsDto,
} from './dto/promotions.dto';
import {
  Promotion,
  PromotionCode,
  PromotionStatus,
  PromotionType,
  DiscountType,
  Prisma,
} from '../../generated/prisma';

export interface CalculatedPromotionResult {
  valid: boolean;
  code: string;
  promotionId: string;
  promotionCodeId?: string | null;
  promotionName: string;
  promotionType: PromotionType;
  discountType: DiscountType;
  discountValue: number;
  discountAmountCents: number;
  isFreeDelivery: boolean;
  isStackableWithSchoolPacks: boolean;
  eligibleBaseCents: number;
  bundleDiscountCents: number;
  message: string;
}

@Injectable()
export class PromotionsService {
  private readonly logger = new Logger(PromotionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Authoritative effective status calculation.
   * Does not rely solely on the database field to determine if a promotion is valid.
   */
  computeEffectiveStatus(promo: {
    status: PromotionStatus;
    isActive: boolean;
    startDate: Date;
    endDate: Date;
  }): PromotionStatus {
    if (!promo.isActive || promo.status === PromotionStatus.DISABLED) {
      return PromotionStatus.DISABLED;
    }
    const now = new Date();
    if (now < promo.startDate) {
      return PromotionStatus.SCHEDULED;
    }
    if (now > promo.endDate) {
      return PromotionStatus.EXPIRED;
    }
    if (promo.status === PromotionStatus.DRAFT) {
      return PromotionStatus.DRAFT;
    }
    return PromotionStatus.ACTIVE;
  }

  /**
   * Generates a collision-free unique random promotional code.
   */
  async generateUniquePromoCode(prefix: string = 'DSL'): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 10; attempt++) {
      let suffix = '';
      for (let i = 0; i < 6; i++) {
        suffix += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const candidate = `${prefix}-${suffix}`.toUpperCase();

      const existingInCodes = await this.prisma.promotionCode.findUnique({
        where: { code: candidate },
      });
      const existingInPromos = await this.prisma.promotion.findUnique({
        where: { code: candidate },
      });

      if (!existingInCodes && !existingInPromos) {
        return candidate;
      }
    }
    return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
  }

  /**
   * Authoritative discount calculation.
   * Evaluates promo validity, status, dates, customer eligibility, usage limits,
   * minimum spend, category/product eligibility, and school pack stacking rules.
   */
  async calculateAuthoritativeDiscount(
    codeStr: string,
    items: Array<{ productId: string; variantId?: string | null; quantity: number }>,
    packSelections?: Array<{ productId: string; variantId?: string | null; packId: string }> | null,
    userId?: string | null,
    customerEmail?: string | null
  ): Promise<CalculatedPromotionResult> {
    const cleanCode = codeStr.trim().toUpperCase();

    // 1. Fetch promo code with promotion and eligibility configuration
    let promoCodeRecord = await this.prisma.promotionCode.findUnique({
      where: { code: cleanCode },
      include: {
        promotion: {
          include: {
            eligibleProducts: true,
            eligibleCategories: true,
          },
        },
      },
    });

    let promo: (Promotion & {
      eligibleProducts: Array<{ productId: string }>;
      eligibleCategories: Array<{ categoryId: string }>;
    }) | null = promoCodeRecord?.promotion || null;

    // Fallback: Check Promotion.code column for legacy/direct single-code records
    if (!promo) {
      const fallbackPromo = await this.prisma.promotion.findUnique({
        where: { code: cleanCode },
        include: {
          eligibleProducts: true,
          eligibleCategories: true,
        },
      });
      if (fallbackPromo) {
        promo = fallbackPromo;
      }
    }

    if (!promo) {
      throw new BadRequestException('Invalid promo code');
    }

    // 2. Validate Code and Promotion Active State
    if (promoCodeRecord && !promoCodeRecord.isActive) {
      throw new BadRequestException('This promo code is currently inactive');
    }

    if (!promo.isActive) {
      throw new BadRequestException('This promotion is currently inactive');
    }

    // 3. Validate Effective Status & Server-side Dates
    const effectiveStatus = this.computeEffectiveStatus(promo);
    if (effectiveStatus === PromotionStatus.DISABLED) {
      throw new BadRequestException('Promotion is not active');
    }
    if (effectiveStatus === PromotionStatus.SCHEDULED) {
      throw new BadRequestException('This promotion has not started yet');
    }
    if (effectiveStatus === PromotionStatus.EXPIRED) {
      throw new BadRequestException('Promotion has expired');
    }
    if (effectiveStatus === PromotionStatus.DRAFT) {
      throw new BadRequestException('Promotion is currently in draft mode');
    }

    // 4. Validate Usage Limits
    if (promoCodeRecord?.maximumTotalUsage && promoCodeRecord.totalUsage >= promoCodeRecord.maximumTotalUsage) {
      throw new BadRequestException('Usage limit reached for this promo code');
    }
    if (promo.usageLimit && promo.usageCount >= promo.usageLimit) {
      throw new BadRequestException('Usage limit reached for this promotion');
    }

    // Per-customer usage limit
    if (promoCodeRecord?.maximumUsagePerCustomer && (userId || customerEmail)) {
      const customerConditions: Prisma.PromotionRedemptionWhereInput[] = [];
      if (userId) {
        customerConditions.push({ customerId: userId });
      }
      if (customerEmail) {
        customerConditions.push({ customerEmail: customerEmail.trim().toLowerCase() });
      }

      const customerUsageCount = await this.prisma.promotionRedemption.count({
        where: {
          promotionId: promo.id,
          promotionCodeId: promoCodeRecord.id,
          OR: customerConditions,
        },
      });

      if (customerUsageCount >= promoCodeRecord.maximumUsagePerCustomer) {
        throw new BadRequestException('You have already reached the maximum usage limit for this promo code');
      }
    }

    // 5. Fetch live products from database to calculate line totals & verify school packs
    const productIds = Array.from(new Set(items.map((i) => i.productId)));
    const dbProducts = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        priceCents: true,
        categoryId: true,
      },
    });

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    let rawSubtotalCents = 0;
    const itemDetails: Array<{
      productId: string;
      variantId: string | null;
      categoryId: string;
      unitPriceCents: number;
      quantity: number;
      lineTotalCents: number;
    }> = [];

    for (const item of items) {
      const prod = productMap.get(item.productId);
      if (!prod) continue;
      const unitPriceCents = prod.priceCents;
      const lineTotalCents = unitPriceCents * item.quantity;
      rawSubtotalCents += lineTotalCents;
      itemDetails.push({
        productId: item.productId,
        variantId: item.variantId || null,
        categoryId: prod.categoryId,
        unitPriceCents,
        quantity: item.quantity,
        lineTotalCents,
      });
    }

    // 6. Calculate School Pack Savings if applicable
    let totalBundleDiscountCents = 0;
    const packIdSet = new Set(packSelections?.map((ps) => ps.packId) || []);

    if (packIdSet.size > 0) {
      const verifiedPacks = await this.prisma.schoolPack.findMany({
        where: { id: { in: Array.from(packIdSet) }, isActive: true },
        include: { items: true },
      });

      for (const pack of verifiedPacks) {
        const claimedProductIds = new Set(
          (packSelections || [])
            .filter((ps) => ps.packId === pack.id)
            .map((ps) => ps.productId)
        );

        const packItems = itemDetails.filter((id) => claimedProductIds.has(id.productId));
        if (packItems.length === 0) continue;

        const packSubtotal = packItems.reduce((acc, pi) => acc + pi.lineTotalCents, 0);
        const packDiscount = Math.round((packSubtotal * pack.savingsPercentage) / 100);
        totalBundleDiscountCents += packDiscount;
      }
    }

    // 7. CRITICAL BUSINESS RULE: School Pack Stacking Check
    const hasSchoolPackDiscount = totalBundleDiscountCents > 0;
    if (hasSchoolPackDiscount && !promo.isStackableWithSchoolPacks) {
      throw new BadRequestException('This promotion cannot be combined with School Pack discounts.');
    }

    // 8. Determine Eligible Items & Eligible Base for Promotion
    let eligibleItems = itemDetails;

    if (promo.promotionType === PromotionType.PRODUCT_SPECIFIC) {
      const eligibleProdIds = new Set(promo.eligibleProducts.map((ep) => ep.productId));
      eligibleItems = itemDetails.filter((id) => eligibleProdIds.has(id.productId));
      if (eligibleItems.length === 0) {
        throw new BadRequestException('Your cart does not contain eligible products for this promotion.');
      }
    } else if (promo.promotionType === PromotionType.CATEGORY_SPECIFIC) {
      const eligibleCatIds = new Set(promo.eligibleCategories.map((ec) => ec.categoryId));
      eligibleItems = itemDetails.filter((id) => eligibleCatIds.has(id.categoryId));
      if (eligibleItems.length === 0) {
        throw new BadRequestException('Your cart does not contain products from eligible categories for this promotion.');
      }
    }

    const eligibleItemsSubtotal = eligibleItems.reduce((acc, i) => acc + i.lineTotalCents, 0);
    // If stacking is allowed, base is reduced by proportionate bundle discount or overall bundle discount
    const eligibleBaseCents = Math.max(0, eligibleItemsSubtotal - (hasSchoolPackDiscount ? totalBundleDiscountCents : 0));

    // 9. Minimum Order Value Validation
    const minOrderCents = promo.minimumOrderAmount ?? promo.minOrderAmountCents ?? 0;
    if (minOrderCents > 0 && rawSubtotalCents < minOrderCents) {
      const minLkr = (minOrderCents / 100).toLocaleString('en-LK');
      throw new BadRequestException(`Minimum order value of Rs. ${minLkr} required for this promotion.`);
    }

    // 10. Authoritative Discount Amount Calculation
    let discountAmountCents = 0;
    let isFreeDelivery = false;

    if (promo.promotionType === PromotionType.FREE_DELIVERY) {
      isFreeDelivery = true;
      discountAmountCents = 0; // Free delivery is applied via delivery-fee calculation
    } else if (
      promo.promotionType === PromotionType.PERCENTAGE ||
      promo.discountType === DiscountType.PERCENTAGE
    ) {
      // Percentage discount
      discountAmountCents = Math.round((eligibleBaseCents * promo.discountValue) / 100);
    } else {
      // Fixed amount discount (LKR to Cents conversion if needed: e.g. 500 => 50000 cents)
      const fixedCents = promo.discountValue > 10000 ? promo.discountValue : promo.discountValue * 100;
      discountAmountCents = Math.min(eligibleBaseCents, fixedCents);
    }

    // Apply Maximum Discount Amount Cap if configured
    const maxDiscountCents = promo.maximumDiscountAmount ?? promo.maxDiscountCents;
    if (maxDiscountCents && maxDiscountCents > 0 && discountAmountCents > maxDiscountCents) {
      discountAmountCents = maxDiscountCents;
    }

    // Ensure discount never exceeds eligible purchase value and never produces negative totals
    discountAmountCents = Math.max(0, Math.min(discountAmountCents, eligibleBaseCents));

    return {
      valid: true,
      code: cleanCode,
      promotionId: promo.id,
      promotionCodeId: promoCodeRecord?.id || null,
      promotionName: promo.name || promo.title || 'Promotional Discount',
      promotionType: promo.promotionType,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      discountAmountCents,
      isFreeDelivery,
      isStackableWithSchoolPacks: promo.isStackableWithSchoolPacks,
      eligibleBaseCents,
      bundleDiscountCents: totalBundleDiscountCents,
      message: isFreeDelivery
        ? 'Free delivery promotion applied successfully!'
        : `Promo code ${cleanCode} applied successfully!`,
    };
  }

  /**
   * Concurrency-safe, idempotent promotion redemption recording inside transaction.
   * Pessimistically locks PromotionCode to guarantee total usage limits under high concurrency.
   */
  async recordRedemptionInsideTx(
    tx: Prisma.TransactionClient,
    params: {
      promotionId: string;
      promotionCodeId?: string | null;
      orderId: string;
      customerId?: string | null;
      customerEmail: string;
      discountAmountCents: number;
    }
  ): Promise<void> {
    const { promotionId, promotionCodeId, orderId, customerId, customerEmail, discountAmountCents } = params;

    // 1. Idempotency check: if already redeemed for this order and promotion, do nothing
    const existingRedemption = await tx.promotionRedemption.findUnique({
      where: {
        orderId_promotionId: {
          orderId,
          promotionId,
        },
      },
    });

    if (existingRedemption) {
      this.logger.log(`Promotion redemption already recorded for order ${orderId} and promotion ${promotionId}. Skipping.`);
      return;
    }

    // 2. Pessimistically lock PromotionCode if provided to enforce concurrent limit safety
    if (promotionCodeId) {
      const lockedCodes = await tx.$queryRaw<Array<{ id: string; totalUsage: number; maximumTotalUsage: number | null }>>`
        SELECT "id", "totalUsage", "maximumTotalUsage"
        FROM "PromotionCode"
        WHERE "id" = ${promotionCodeId}
        FOR UPDATE;
      `;

      if (lockedCodes.length > 0) {
        const lockedCode = lockedCodes[0];
        if (lockedCode.maximumTotalUsage && lockedCode.totalUsage >= lockedCode.maximumTotalUsage) {
          throw new BadRequestException('Maximum usage limit reached for this promo code');
        }

        // Increment PromotionCode usage count
        await tx.promotionCode.update({
          where: { id: promotionCodeId },
          data: { totalUsage: { increment: 1 } },
        });
      }
    }

    // 3. Atomically increment Promotion overall usage count
    await tx.promotion.update({
      where: { id: promotionId },
      data: { usageCount: { increment: 1 } },
    });

    // 4. Create PromotionRedemption record
    await tx.promotionRedemption.create({
      data: {
        promotionId,
        promotionCodeId: promotionCodeId || null,
        orderId,
        customerId: customerId || null,
        customerEmail: customerEmail.trim().toLowerCase(),
        discountAmount: discountAmountCents,
      },
    });

    this.logger.log(`Recorded promotion redemption: promo ${promotionId}, code ${promotionCodeId}, order ${orderId}, amount ${discountAmountCents} cents`);
  }

  // ============================================================================
  // ADMIN CRUD OPERATIONS
  // ============================================================================

  async listPromotions(query: QueryPromotionsDto) {
    const { page = 1, limit = 20, search, status, promotionType, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.PromotionWhereInput = {};

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
        { codes: { some: { code: { contains: q, mode: 'insensitive' } } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (promotionType) {
      where.promotionType = promotionType;
    }

    const [total, items] = await Promise.all([
      this.prisma.promotion.count({ where }),
      this.prisma.promotion.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          codes: {
            select: {
              id: true,
              code: true,
              isActive: true,
              maximumTotalUsage: true,
              maximumUsagePerCustomer: true,
              totalUsage: true,
            },
          },
          eligibleProducts: {
            select: {
              productId: true,
              product: { select: { id: true, name: true, sku: true } },
            },
          },
          eligibleCategories: {
            select: {
              categoryId: true,
              category: { select: { id: true, name: true, slug: true } },
            },
          },
          _count: {
            select: { redemptions: true, orders: true },
          },
        },
      }),
    ]);

    const enrichedItems = items.map((p) => ({
      ...p,
      effectiveStatus: this.computeEffectiveStatus(p),
    }));

    return {
      items: enrichedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getPromotionById(id: string) {
    const promo = await this.prisma.promotion.findUnique({
      where: { id },
      include: {
        codes: {
          orderBy: { createdAt: 'desc' },
          include: {
            _count: { select: { redemptions: true } },
          },
        },
        eligibleProducts: {
          include: {
            product: { select: { id: true, name: true, sku: true, priceCents: true } },
          },
        },
        eligibleCategories: {
          include: {
            category: { select: { id: true, name: true, slug: true } },
          },
        },
        _count: {
          select: { redemptions: true, orders: true },
        },
      },
    });

    if (!promo) {
      throw new NotFoundException(`Promotion with ID ${id} not found`);
    }

    return {
      ...promo,
      effectiveStatus: this.computeEffectiveStatus(promo),
    };
  }

  async createPromotion(dto: CreatePromotionDto, adminUserId?: string) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    const discountType = dto.discountType || (dto.promotionType === 'FREE_DELIVERY' ? DiscountType.FREE_DELIVERY : (dto.promotionType === 'FIXED_AMOUNT' ? DiscountType.FIXED_AMOUNT : DiscountType.PERCENTAGE));

    // Handle initial promo codes
    const codesToCreate: Array<{
      code: string;
      maximumTotalUsage?: number | null;
      maximumUsagePerCustomer?: number | null;
      isActive?: boolean;
    }> = [];

    if (dto.code && dto.code.trim()) {
      codesToCreate.push({
        code: dto.code.trim().toUpperCase(),
        maximumTotalUsage: dto.maximumDiscountAmount ? null : null,
        maximumUsagePerCustomer: null,
        isActive: true,
      });
    }

    if (dto.promoCodes && dto.promoCodes.length > 0) {
      for (const pc of dto.promoCodes) {
        const clean = pc.code.trim().toUpperCase();
        if (!codesToCreate.some((c) => c.code === clean)) {
          codesToCreate.push({
            code: clean,
            maximumTotalUsage: pc.maximumTotalUsage || null,
            maximumUsagePerCustomer: pc.maximumUsagePerCustomer || null,
            isActive: pc.isActive !== false,
          });
        }
      }
    }

    // Verify code uniqueness before saving
    for (const c of codesToCreate) {
      const existing = await this.prisma.promotionCode.findUnique({
        where: { code: c.code },
      });
      if (existing) {
        throw new ConflictException(`Promo code ${c.code} already exists`);
      }
    }

    const primaryCode = codesToCreate.length > 0 ? codesToCreate[0].code : await this.generateUniquePromoCode('DSL');

    if (codesToCreate.length === 0) {
      codesToCreate.push({
        code: primaryCode,
        maximumTotalUsage: null,
        maximumUsagePerCustomer: null,
        isActive: true,
      });
    }

    const promotion = await this.prisma.promotion.create({
      data: {
        name: dto.name,
        title: dto.name,
        code: primaryCode,
        description: dto.description || '',
        promotionType: dto.promotionType,
        discountType,
        discountValue: dto.discountValue,
        maximumDiscountAmount: dto.maximumDiscountAmount || null,
        maxDiscountCents: dto.maximumDiscountAmount || null,
        minimumOrderAmount: dto.minimumOrderAmount || null,
        minOrderAmountCents: dto.minimumOrderAmount || null,
        status: dto.status || PromotionStatus.ACTIVE,
        startDate,
        endDate,
        priority: dto.priority || 0,
        isStackableWithSchoolPacks: dto.isStackableWithSchoolPacks || false,
        isActive: dto.isActive !== false,
        createdBy: adminUserId || null,
        updatedBy: adminUserId || null,
        codes: {
          create: codesToCreate.map((c) => ({
            code: c.code,
            maximumTotalUsage: c.maximumTotalUsage,
            maximumUsagePerCustomer: c.maximumUsagePerCustomer,
            isActive: c.isActive,
          })),
        },
        eligibleProducts: dto.eligibleProductIds && dto.eligibleProductIds.length > 0
          ? {
              create: dto.eligibleProductIds.map((productId) => ({
                product: { connect: { id: productId } },
              })),
            }
          : undefined,
        eligibleCategories: dto.eligibleCategoryIds && dto.eligibleCategoryIds.length > 0
          ? {
              create: dto.eligibleCategoryIds.map((categoryId) => ({
                category: { connect: { id: categoryId } },
              })),
            }
          : undefined,
      },
      include: {
        codes: true,
        eligibleProducts: true,
        eligibleCategories: true,
      },
    });

    return {
      ...promotion,
      effectiveStatus: this.computeEffectiveStatus(promotion),
    };
  }

  async updatePromotion(id: string, dto: UpdatePromotionDto, adminUserId?: string) {
    const existing = await this.prisma.promotion.findUnique({
      where: { id },
      include: { eligibleProducts: true, eligibleCategories: true },
    });

    if (!existing) {
      throw new NotFoundException(`Promotion with ID ${id} not found`);
    }

    const data: Prisma.PromotionUpdateInput = {
      updatedBy: adminUserId || null,
    };

    if (dto.name !== undefined) {
      data.name = dto.name;
      data.title = dto.name;
    }
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.promotionType !== undefined) data.promotionType = dto.promotionType;
    if (dto.discountType !== undefined) data.discountType = dto.discountType;
    if (dto.discountValue !== undefined) data.discountValue = dto.discountValue;
    if (dto.maximumDiscountAmount !== undefined) {
      data.maximumDiscountAmount = dto.maximumDiscountAmount;
      data.maxDiscountCents = dto.maximumDiscountAmount;
    }
    if (dto.minimumOrderAmount !== undefined) {
      data.minimumOrderAmount = dto.minimumOrderAmount;
      data.minOrderAmountCents = dto.minimumOrderAmount;
    }
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) data.endDate = new Date(dto.endDate);
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.isStackableWithSchoolPacks !== undefined) data.isStackableWithSchoolPacks = dto.isStackableWithSchoolPacks;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    // Handle eligible products replacement
    if (dto.eligibleProductIds !== undefined) {
      await this.prisma.promotionProduct.deleteMany({ where: { promotionId: id } });
      if (dto.eligibleProductIds.length > 0) {
        data.eligibleProducts = {
          create: dto.eligibleProductIds.map((productId) => ({
            product: { connect: { id: productId } },
          })),
        };
      }
    }

    // Handle eligible categories replacement
    if (dto.eligibleCategoryIds !== undefined) {
      await this.prisma.promotionCategory.deleteMany({ where: { promotionId: id } });
      if (dto.eligibleCategoryIds.length > 0) {
        data.eligibleCategories = {
          create: dto.eligibleCategoryIds.map((categoryId) => ({
            category: { connect: { id: categoryId } },
          })),
        };
      }
    }

    const updated = await this.prisma.promotion.update({
      where: { id },
      data,
      include: {
        codes: true,
        eligibleProducts: true,
        eligibleCategories: true,
      },
    });

    return {
      ...updated,
      effectiveStatus: this.computeEffectiveStatus(updated),
    };
  }

  async deletePromotion(id: string, adminUserId?: string) {
    const existing = await this.prisma.promotion.findUnique({
      where: { id },
      include: { _count: { select: { redemptions: true, orders: true } } },
    });

    if (!existing) {
      throw new NotFoundException(`Promotion with ID ${id} not found`);
    }

    // If redemptions or orders exist, safe soft delete (disable) to preserve history
    if (existing._count.redemptions > 0 || existing._count.orders > 0) {
      const disabled = await this.prisma.promotion.update({
        where: { id },
        data: {
          status: PromotionStatus.DISABLED,
          isActive: false,
          updatedBy: adminUserId || null,
        },
      });
      return {
        success: true,
        deleted: false,
        disabled: true,
        message: 'Promotion has historical orders/redemptions and was safely disabled rather than permanently purged.',
        promotion: disabled,
      };
    }

    // Draft or unredeemed promotions can be deleted cleanly
    await this.prisma.promotion.delete({ where: { id } });
    return {
      success: true,
      deleted: true,
      message: 'Promotion and associated codes successfully deleted.',
    };
  }

  async activatePromotion(id: string) {
    const updated = await this.prisma.promotion.update({
      where: { id },
      data: {
        status: PromotionStatus.ACTIVE,
        isActive: true,
      },
      include: { codes: true },
    });
    return {
      ...updated,
      effectiveStatus: this.computeEffectiveStatus(updated),
    };
  }

  async deactivatePromotion(id: string) {
    const updated = await this.prisma.promotion.update({
      where: { id },
      data: {
        status: PromotionStatus.DISABLED,
        isActive: false,
      },
      include: { codes: true },
    });
    return {
      ...updated,
      effectiveStatus: this.computeEffectiveStatus(updated),
    };
  }

  async addPromoCode(promotionId: string, dto: CreatePromoCodeDto) {
    const promo = await this.prisma.promotion.findUnique({
      where: { id: promotionId },
    });
    if (!promo) {
      throw new NotFoundException(`Promotion with ID ${promotionId} not found`);
    }

    let codeToUse = dto.code ? dto.code.trim().toUpperCase() : await this.generateUniquePromoCode('DSL');

    const existingInCodes = await this.prisma.promotionCode.findUnique({
      where: { code: codeToUse },
    });
    const existingInPromos = await this.prisma.promotion.findUnique({
      where: { code: codeToUse },
    });

    if (existingInCodes || (existingInPromos && existingInPromos.id !== promotionId)) {
      throw new ConflictException(`Promo code ${codeToUse} already exists`);
    }

    const created = await this.prisma.promotionCode.create({
      data: {
        promotionId,
        code: codeToUse,
        maximumTotalUsage: dto.maximumTotalUsage || null,
        maximumUsagePerCustomer: dto.maximumUsagePerCustomer || null,
        isActive: dto.isActive !== false,
      },
    });

    return created;
  }

  async getPromotionRedemptions(promotionId: string, page: number = 1, limit: number = 20) {
    const promo = await this.prisma.promotion.findUnique({
      where: { id: promotionId },
    });
    if (!promo) {
      throw new NotFoundException(`Promotion with ID ${promotionId} not found`);
    }

    const skip = (page - 1) * limit;

    const [total, redemptions] = await Promise.all([
      this.prisma.promotionRedemption.count({ where: { promotionId } }),
      this.prisma.promotionRedemption.findMany({
        where: { promotionId },
        skip,
        take: limit,
        orderBy: { redeemedAt: 'desc' },
        include: {
          customer: { select: { id: true, name: true, email: true } },
          promotionCode: { select: { id: true, code: true } },
          order: {
            select: {
              id: true,
              orderNumber: true,
              totalCents: true,
              discountCents: true,
              orderStatus: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    return {
      redemptions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getReportingSummary() {
    const now = new Date();

    const [allPromos, totalRedemptionsCount, totalDiscountSum] = await Promise.all([
      this.prisma.promotion.findMany({
        select: {
          id: true,
          status: true,
          isActive: true,
          startDate: true,
          endDate: true,
          usageCount: true,
          promotionType: true,
        },
      }),
      this.prisma.promotionRedemption.count(),
      this.prisma.promotionRedemption.aggregate({
        _sum: { discountAmount: true },
      }),
    ]);

    let activeCount = 0;
    let expiredCount = 0;
    let scheduledCount = 0;
    let disabledCount = 0;
    let draftCount = 0;

    for (const p of allPromos) {
      const eff = this.computeEffectiveStatus(p);
      if (eff === PromotionStatus.ACTIVE) activeCount++;
      else if (eff === PromotionStatus.EXPIRED) expiredCount++;
      else if (eff === PromotionStatus.SCHEDULED) scheduledCount++;
      else if (eff === PromotionStatus.DISABLED) disabledCount++;
      else if (eff === PromotionStatus.DRAFT) draftCount++;
    }

    return {
      totalPromotions: allPromos.length,
      activePromotions: activeCount,
      expiredPromotions: expiredCount,
      scheduledPromotions: scheduledCount,
      disabledPromotions: disabledCount,
      draftPromotions: draftCount,
      totalRedemptions: totalRedemptionsCount,
      totalDiscountValueCents: totalDiscountSum._sum.discountAmount || 0,
    };
  }
}

