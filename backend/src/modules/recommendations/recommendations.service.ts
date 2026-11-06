import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import {
  RecommendationRule,
  RecommendedProductItem,
  RecommendationResponse,
  BasketValidationResult,
  StationeryPurpose,
} from './recommendations.types';
import { DEFAULT_RECOMMENDATION_RULES } from './default-rules';
import { GetRecommendationsDto } from './dto/get-recommendations.dto';
import { ValidateBasketDto } from './dto/validate-basket.dto';
import {
  CreateRecommendationRuleDto,
  UpdateRecommendationRuleDto,
} from './dto/recommendation-rule.dto';

const PROTECTED_TEST_PRODUCT_ID = 'cmw0j4cro00089kusmwsbv48t';

@Injectable()
export class RecommendationsService implements OnModuleInit {
  private readonly logger = new Logger(RecommendationsService.name);
  private rules: Map<string, RecommendationRule> = new Map();
  private readonly storageFilePath =
    process.env.NODE_ENV === 'test'
      ? path.resolve(process.cwd(), 'data', 'recommendation-rules.test.json')
      : path.resolve(process.cwd(), 'data', 'recommendation-rules.json');

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.loadRules();
  }

  /**
   * Load rules from persistent JSON file if present, or fallback to defaults.
   */
  private loadRules() {
    try {
      if (fs.existsSync(this.storageFilePath)) {
        const raw = fs.readFileSync(this.storageFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.rules.clear();
          for (const rule of parsed) {
            this.rules.set(rule.id, rule);
          }
          this.logger.log(`Loaded ${this.rules.size} recommendation rules from storage file.`);
          return;
        }
      }
    } catch (err: any) {
      this.logger.warn(`Could not load rules from storage file: ${err.message}. Using defaults.`);
    }

    // Default rules fallback
    this.rules.clear();
    for (const rule of DEFAULT_RECOMMENDATION_RULES) {
      this.rules.set(rule.id, { ...rule });
    }
    this.logger.log(`Initialized with ${this.rules.size} default recommendation rules.`);
  }

  /**
   * Persist current rules to JSON file.
   */
  private saveRulesToFile() {
    try {
      const dir = path.dirname(this.storageFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = Array.from(this.rules.values());
      fs.writeFileSync(this.storageFilePath, JSON.stringify(data, null, 2), 'utf-8');
      this.logger.log(`Saved ${data.length} recommendation rules to persistent file.`);
    } catch (err: any) {
      this.logger.error(`Failed to save recommendation rules to file: ${err.message}`);
    }
  }

  /**
   * Reset rules to defaults (useful for testing or admin restore).
   */
  public resetToDefaults(): void {
    this.rules.clear();
    for (const rule of DEFAULT_RECOMMENDATION_RULES) {
      this.rules.set(rule.id, { ...rule });
    }
    this.saveRulesToFile();
  }

  /**
   * Generates recommendations from the PostgreSQL catalogue based on customer criteria.
   */
  async getRecommendations(criteria: GetRecommendationsDto): Promise<RecommendationResponse> {
    const {
      purpose,
      grade,
      subjects,
      studyArea,
      officeScale,
      activityType,
      occasion,
      budgetLkr,
    } = criteria;

    // 1. Filter matching active rules
    const activeRules = Array.from(this.rules.values()).filter((r) => r.isActive && r.purpose === purpose);

    let matchingRules = activeRules.filter((r) => {
      if (purpose === 'school') {
        if (grade && r.gradeLevels && r.gradeLevels.length > 0) {
          if (!r.gradeLevels.includes(grade)) return false;
        }
        if (subjects && subjects.length > 0 && r.subjects && r.subjects.length > 0) {
          const hasCommonSubject = r.subjects.some((s) => subjects.includes(s));
          if (!hasCommonSubject) {
            // Keep as lower priority rather than strict drop if few items match
            return true;
          }
        }
      } else if (purpose === 'university') {
        if (studyArea && r.studyAreas && r.studyAreas.length > 0) {
          if (!r.studyAreas.includes(studyArea)) return false;
        }
      } else if (purpose === 'office') {
        if (officeScale && r.officeScale) {
          if (r.officeScale !== officeScale && r.officeScale !== 'individual') return false;
        }
      } else if (purpose === 'art_craft') {
        if (activityType && r.activityTypes && r.activityTypes.length > 0) {
          if (!r.activityTypes.includes(activityType)) return false;
        }
      } else if (purpose === 'gift') {
        if (occasion && r.occasions && r.occasions.length > 0) {
          if (!r.occasions.includes(occasion)) return false;
        }
      }
      return true;
    });

    // Fallback to all purpose rules if filters yielded empty list
    if (matchingRules.length === 0) {
      matchingRules = activeRules;
    }

    // Sort by priority ascending (1 = highest)
    matchingRules.sort((a, b) => a.priority - b.priority);

    // 2. Fetch all referenced product IDs from PostgreSQL
    const targetProductIds = matchingRules
      .map((r) => r.productId)
      .filter((id) => id !== PROTECTED_TEST_PRODUCT_ID);

    const substituteIdsToFetch = matchingRules
      .flatMap((r) => r.substituteProductIds || [])
      .filter((id) => id !== PROTECTED_TEST_PRODUCT_ID);

    const allProductIdsToFetch = Array.from(new Set([...targetProductIds, ...substituteIdsToFetch]));

    const dbProducts = await this.prisma.product.findMany({
      where: {
        id: { in: allProductIdsToFetch },
        isActive: true,
      },
      include: {
        category: true,
      },
    });

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    // 3. Assemble recommended items avoiding duplicates
    const recommendedItems: RecommendedProductItem[] = [];
    const seenProductIds = new Set<string>();

    for (const rule of matchingRules) {
      if (seenProductIds.has(rule.productId)) continue;

      const product = productMap.get(rule.productId);
      // Skip inactive or unavailable products (stock must be > 0)
      if (!product || !product.isActive || product.stockQuantity <= 0) {
        continue;
      }

      // Collect real substitutes from PostgreSQL
      const substitutes: RecommendedProductItem['substitutes'] = [];

      // 3a. Explicitly configured substitutes
      if (rule.substituteProductIds && rule.substituteProductIds.length > 0) {
        for (const subId of rule.substituteProductIds) {
          const subProduct = productMap.get(subId);
          if (
            subProduct &&
            subProduct.id !== product.id &&
            subProduct.id !== PROTECTED_TEST_PRODUCT_ID &&
            subProduct.isActive &&
            subProduct.stockQuantity > 0
          ) {
            substitutes.push({
              id: subProduct.id,
              name: subProduct.name,
              slug: subProduct.slug,
              sku: subProduct.sku,
              priceCents: subProduct.priceCents,
              stockQuantity: subProduct.stockQuantity,
            });
          }
        }
      }

      // 3b. Category-based fallback substitutes if fewer than 2 substitutes found
      if (substitutes.length < 2 && product.categoryId) {
        const categorySubs = (await this.prisma.product.findMany({
          where: {
            categoryId: product.categoryId,
            id: { notIn: [product.id, PROTECTED_TEST_PRODUCT_ID, ...substitutes.map((s) => s.id)] },
            isActive: true,
            stockQuantity: { gt: 0 },
          },
          take: 3,
        })) || [];

        if (Array.isArray(categorySubs)) {
          for (const catSub of categorySubs) {
            substitutes.push({
              id: catSub.id,
              name: catSub.name,
              slug: catSub.slug,
              sku: catSub.sku,
              priceCents: catSub.priceCents,
              stockQuantity: catSub.stockQuantity,
            });
          }
        }
      }

      const qty = Math.min(rule.defaultQuantity, product.stockQuantity);
      const subtotalCents = product.priceCents * qty;

      recommendedItems.push({
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        sku: product.sku,
        categoryId: product.categoryId,
        categoryName: product.category?.name || 'Stationery',
        unitPriceCents: product.priceCents,
        quantity: qty,
        subtotalCents,
        stockQuantity: product.stockQuantity,
        lowStock: product.stockQuantity <= product.lowStockThreshold,
        reason: rule.reason,
        priority: rule.priority,
        substitutes,
      });

      seenProductIds.add(product.id);
    }

    const totalEstimatedCents = recommendedItems.reduce((acc, it) => acc + it.subtotalCents, 0);
    const budgetCents = budgetLkr ? Math.round(budgetLkr * 100) : undefined;
    const isWithinBudget = budgetCents === undefined ? true : totalEstimatedCents <= budgetCents;

    return {
      purpose,
      criteriaSummary: {
        grade,
        subjects,
        studyArea,
        officeScale,
        activityType,
        occasion,
      },
      totalEstimatedCents,
      itemCount: recommendedItems.length,
      budgetLkr,
      budgetCents,
      isWithinBudget,
      items: recommendedItems,
    };
  }

  /**
   * Server-authoritative basket validation before adding items to cart.
   * Recalculates unit prices, line totals, and verifies active stock in PostgreSQL.
   */
  async validateBasket(dto: ValidateBasketDto): Promise<BasketValidationResult> {
    const { items, budgetLkr } = dto;
    const warnings: string[] = [];
    let isValid = true;
    let totalCents = 0;

    const productIds = items.map((i) => i.productId);
    const dbProducts = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
      },
      include: {
        category: true,
      },
    });

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));
    const validatedItems: BasketValidationResult['items'] = [];

    for (const item of items) {
      const product = productMap.get(item.productId);

      if (!product) {
        isValid = false;
        warnings.push(`Product with ID "${item.productId}" was not found in our catalogue.`);
        validatedItems.push({
          productId: item.productId,
          productName: 'Unknown Product',
          sku: 'UNKNOWN',
          priceCents: 0,
          quantity: item.quantity,
          subtotalCents: 0,
          stockQuantity: 0,
          isAvailable: false,
          priceChanged: false,
          submittedPriceCents: item.submittedPriceCents,
          warning: 'Product not found',
        });
        continue;
      }

      if (!product.isActive) {
        isValid = false;
        warnings.push(`"${product.name}" is no longer active for purchase.`);
        validatedItems.push({
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          priceCents: product.priceCents,
          quantity: item.quantity,
          subtotalCents: 0,
          stockQuantity: product.stockQuantity,
          isAvailable: false,
          priceChanged: false,
          submittedPriceCents: item.submittedPriceCents,
          warning: 'Product is currently inactive',
        });
        continue;
      }

      let priceChanged = false;
      let warningMessage: string | undefined;

      if (
        item.submittedPriceCents !== undefined &&
        item.submittedPriceCents !== product.priceCents
      ) {
        priceChanged = true;
        warningMessage = `Price updated from Rs. ${(item.submittedPriceCents / 100).toFixed(2)} to Rs. ${(product.priceCents / 100).toFixed(2)}`;
        warnings.push(`Price for "${product.name}" was refreshed from authoritative database catalogue.`);
      }

      const availableStock = product.stockQuantity;
      let finalQuantity = item.quantity;
      let isAvailable = true;

      if (availableStock <= 0) {
        isValid = false;
        isAvailable = false;
        finalQuantity = 0;
        warningMessage = 'Item is currently out of stock';
        warnings.push(`"${product.name}" is currently out of stock.`);
      } else if (item.quantity > availableStock) {
        isValid = false;
        finalQuantity = availableStock;
        warningMessage = `Only ${availableStock} units available in stock`;
        warnings.push(`Adjusted quantity for "${product.name}" to available stock (${availableStock} units).`);
      }

      const lineTotalCents = isAvailable ? product.priceCents * finalQuantity : 0;
      totalCents += lineTotalCents;

      validatedItems.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        priceCents: product.priceCents,
        quantity: finalQuantity,
        subtotalCents: lineTotalCents,
        stockQuantity: availableStock,
        isAvailable,
        priceChanged,
        submittedPriceCents: item.submittedPriceCents,
        warning: warningMessage,
      });
    }

    if (budgetLkr) {
      const budgetCents = Math.round(budgetLkr * 100);
      if (totalCents > budgetCents) {
        warnings.push(
          `Your basket total (Rs. ${(totalCents / 100).toFixed(2)}) exceeds your target budget of Rs. ${budgetLkr.toFixed(2)}.`
        );
      }
    }

    return {
      isValid,
      totalCents,
      itemCount: validatedItems.filter((i) => i.isAvailable && i.quantity > 0).length,
      items: validatedItems,
      warnings,
    };
  }

  /**
   * Fetches compatible substitute products for a given catalogue item.
   */
  async getSubstitutes(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    // Look for rules that reference this product to check explicit substitutes
    const matchingRule = Array.from(this.rules.values()).find(
      (r) => r.productId === productId && r.substituteProductIds && r.substituteProductIds.length > 0
    );

    const explicitSubIds = matchingRule?.substituteProductIds?.filter((id) => id !== PROTECTED_TEST_PRODUCT_ID) || [];

    const substitutes = await this.prisma.product.findMany({
      where: {
        OR: [
          { id: { in: explicitSubIds } },
          { categoryId: product.categoryId },
        ],
        AND: [
          { id: { not: product.id } },
          { id: { not: PROTECTED_TEST_PRODUCT_ID } },
          { isActive: true },
          { stockQuantity: { gt: 0 } },
        ],
      },
      take: 8,
    });

    return substitutes.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      priceCents: p.priceCents,
      stockQuantity: p.stockQuantity,
      categoryId: p.categoryId,
    }));
  }

  /**
   * Config metadata for public client wizard.
   */
  getConfig() {
    return {
      purposes: [
        {
          id: 'school',
          name: 'School Student',
          description: 'Curriculum-tailored stationery for primary, secondary, O/L and A/L classes',
        },
        {
          id: 'university',
          name: 'University & College',
          description: 'Lecture pads, high-performance pens, and scientific calculators for campus life',
        },
        {
          id: 'office',
          name: 'Office & Business',
          description: 'Administrative desk pens, packaging tapes, and commercial calculators',
        },
        {
          id: 'art_craft',
          name: 'Art & Craft Enthusiast',
          description: 'Fine art watercolours, sketching graphite, fabric paints, and modeling clay',
        },
        {
          id: 'gift',
          name: 'Stationery Gift Pack',
          description: 'Curated premium stationery sets for birthdays, achievements, and educators',
        },
      ],
      schoolGrades: [
        'Grade 1-2',
        'Grade 3-5',
        'Grade 6-9',
        'O/L (Grade 10-11)',
        'A/L Science',
        'A/L Commerce',
        'A/L Arts',
      ],
      subjects: [
        'General Writing',
        'Mathematics',
        'Science',
        'Art',
        'Commerce',
        'Accounting',
        'Handicraft',
      ],
      studyAreas: [
        'Engineering & STEM',
        'Medical & Life Sciences',
        'Business & Management',
        'Law & Humanities',
        'General Studies',
      ],
      officeScales: [
        { id: 'individual', label: 'Individual Desk' },
        { id: 'team', label: 'Small Team (2-5 members)' },
        { id: 'department', label: 'Department / Enterprise' },
      ],
      artActivities: [
        'Sketching & Drawing',
        'Water Colour Painting',
        'Fabric Painting',
        'Modelling Clay & Sculpting',
        'General Craft',
      ],
      giftOccasions: [
        'Birthday Gift',
        'Student Achievement',
        'Teacher Appreciation',
        'Executive Colleague',
        'Creative Gift',
      ],
    };
  }

  // ==========================================
  // ADMIN RULE MANAGEMENT (CRUD)
  // ==========================================

  getAllRules(purpose?: StationeryPurpose): RecommendationRule[] {
    const list = Array.from(this.rules.values());
    if (purpose) {
      return list.filter((r) => r.purpose === purpose);
    }
    return list.sort((a, b) => a.priority - b.priority);
  }

  getRuleById(id: string): RecommendationRule {
    const rule = this.rules.get(id);
    if (!rule) {
      throw new NotFoundException(`Recommendation rule "${id}" not found`);
    }
    return rule;
  }

  async createRule(dto: CreateRecommendationRuleDto): Promise<RecommendationRule> {
    if (dto.productId === PROTECTED_TEST_PRODUCT_ID) {
      throw new BadRequestException('Cannot use protected test product in recommendation rules');
    }

    // Verify product exists in catalogue
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) {
      throw new NotFoundException(`Product ${dto.productId} not found in database catalogue`);
    }

    const id = `rule-${dto.purpose}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const newRule: RecommendationRule = {
      id,
      purpose: dto.purpose,
      name: dto.name,
      description: dto.description,
      gradeLevels: dto.gradeLevels,
      subjects: dto.subjects,
      studyAreas: dto.studyAreas,
      officeScale: dto.officeScale,
      activityTypes: dto.activityTypes,
      skillLevels: dto.skillLevels,
      occasions: dto.occasions,
      productId: dto.productId,
      categoryId: dto.categoryId || product.categoryId,
      defaultQuantity: dto.defaultQuantity || 1,
      minQuantity: dto.minQuantity || 1,
      maxQuantity: dto.maxQuantity || 50,
      priority: dto.priority || 1,
      reason: dto.reason,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
      substituteProductIds: dto.substituteProductIds,
    };

    this.rules.set(id, newRule);
    this.saveRulesToFile();
    return newRule;
  }

  async updateRule(id: string, dto: UpdateRecommendationRuleDto): Promise<RecommendationRule> {
    const existing = this.getRuleById(id);

    if (dto.productId && dto.productId === PROTECTED_TEST_PRODUCT_ID) {
      throw new BadRequestException('Cannot use protected test product in recommendation rules');
    }

    if (dto.productId && dto.productId !== existing.productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: dto.productId },
      });
      if (!product) {
        throw new NotFoundException(`Product ${dto.productId} not found in database catalogue`);
      }
    }

    const updated: RecommendationRule = {
      ...existing,
      ...dto,
      id: existing.id, // preserve ID
    };

    this.rules.set(id, updated);
    this.saveRulesToFile();
    return updated;
  }

  deleteRule(id: string): { success: boolean; message: string } {
    if (!this.rules.has(id)) {
      throw new NotFoundException(`Recommendation rule "${id}" not found`);
    }
    this.rules.delete(id);
    this.saveRulesToFile();
    return { success: true, message: `Rule ${id} successfully deleted` };
  }

  toggleRuleStatus(id: string, isActive?: boolean): RecommendationRule {
    const rule = this.getRuleById(id);
    const updated: RecommendationRule = {
      ...rule,
      isActive: isActive !== undefined ? isActive : !rule.isActive,
    };
    this.rules.set(id, updated);
    this.saveRulesToFile();
    return updated;
  }
}
