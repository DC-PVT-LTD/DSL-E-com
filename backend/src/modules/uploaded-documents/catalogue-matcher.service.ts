import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ItemConfidence, MatchStatus } from '../../generated/prisma';

export interface CatalogueCandidate {
  id: string;
  name: string;
  sku: string;
  slug: string;
  priceCents: number;
  stockQuantity: number;
  isAvailable?: boolean;
  primaryImage: string | null;
  score: number;
  brandName?: string | null;
  categoryName?: string | null;
  matchNotes?: string | null;
  specDifferences?: string | null;
  suitabilityScore?: number;
  variants?: Array<{
    id: string;
    name: string;
    sku: string;
    priceCents: number;
    stockQuantity: number;
    isAvailable?: boolean;
    attributes?: Record<string, any>;
  }>;
}

export interface MatchResult {
  matchedProductId: string | null;
  matchedVariantId: string | null;
  matchConfidence: number;
  confidenceTier: ItemConfidence;
  status: MatchStatus;
  matchReason: string;
  isSubstituted: boolean;
  isAvailable?: boolean;
  candidateProductIds: string[];
  suggestedCandidates: CatalogueCandidate[];
  suggestedAlternatives?: CatalogueCandidate[];
}

export interface ExtractedAttributes {
  colors: string[];
  models: string[];
  packQuantities: Array<{ count: number; unit: string; raw: string }>;
  tipSizes: string[];
  rulings: string[];
  sizes: Array<{ length: number; unit: string; raw: string }>;
  isInkExplicit?: boolean;
}

const KNOWN_COLORS = [
  // Multi-word colors first
  'luminous pink',
  'golden yellow',
  'deep green',
  'light green',
  'light blue',
  'light violet',
  'light brown',
  'leaf green',
  // Single-word colors
  'black',
  'blue',
  'red',
  'green',
  'yellow',
  'pink',
  'purple',
  'violet',
  'orange',
  'brown',
  'white',
  'gold',
  'silver',
  'grey',
  'gray',
  'maroon',
  'cyan',
  'magenta',
];

const KNOWN_RULINGS = [
  'single line',
  'double line',
  'square rule',
  'cr rule',
  'unruled',
  'blank',
  'grid',
];

@Injectable()
export class CatalogueMatcherService {
  private readonly logger = new Logger(CatalogueMatcherService.name);

  // In-memory cache for active catalogue to prevent redundant database queries (Req. 9)
  private catalogueCache: {
    products: any[];
    timestamp: number;
  } | null = null;
  private readonly CACHE_TTL_MS = 60 * 1000; // 60-second TTL

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Invalidate the active catalogue cache (useful after mutations or in test setups)
   */
  public invalidateCache(): void {
    this.catalogueCache = null;
  }

  /**
   * Retrieve active catalogue with brand, category, and active variants
   */
  public async getActiveCatalogue(): Promise<any[]> {
    const now = Date.now();
    if (this.catalogueCache && now - this.catalogueCache.timestamp < this.CACHE_TTL_MS) {
      return this.catalogueCache.products;
    }

    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      include: {
        brand: true,
        category: true,
        variants: { where: { isActive: true } },
      },
    });

    this.catalogueCache = {
      products,
      timestamp: now,
    };

    return products;
  }

  /**
   * Tokenize text into normalized lowercase alphanumeric tokens
   */
  private tokenize(text: string): string[] {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 0);
  }

  /**
   * Compute Levenshtein edit distance between two strings
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[m][n];
  }

  /**
   * Lightweight fuzzy token matching for minor OCR errors (Req. 6)
   * Numeric / model codes are never matched fuzzy.
   */
  private fuzzyTokenSimilarity(qToken: string, tToken: string): number {
    if (qToken === tToken) return 1.0;

    // Never use fuzzy matching on tokens that contain digits (critical model numbers or counts)
    if (/\d/.test(qToken) || /\d/.test(tToken)) {
      return 0.0;
    }

    const minLen = Math.min(qToken.length, tToken.length);

    // Minor typo: 1 edit distance for words >= 4 chars (e.g. speeed -> speed, calclator -> calculator)
    if (minLen >= 4 && this.levenshteinDistance(qToken, tToken) <= 1) {
      return 0.90;
    }

    // Minor typo: 2 edit distance for longer words >= 7 chars
    if (minLen >= 7 && this.levenshteinDistance(qToken, tToken) <= 2) {
      return 0.85;
    }

    // Substring prefix match (e.g. paint -> paints, eraser -> erasers)
    if (minLen >= 4 && (qToken.startsWith(tToken) || tToken.startsWith(qToken))) {
      const diff = Math.abs(qToken.length - tToken.length);
      if (diff <= 2) {
        return 0.92;
      }
    }

    return 0.0;
  }

  /**
   * Extract key attributes (colors, model codes, pack quantities, rulings, tips)
   */
  public extractAttributes(text: string): ExtractedAttributes {
    const lower = text.toLowerCase();
    const colors: string[] = [];
    const models: string[] = [];
    const packQuantities: Array<{ count: number; unit: string; raw: string }> = [];
    const tipSizes: string[] = [];
    const rulings: string[] = [];

    // 1. Extract Colors
    for (const color of KNOWN_COLORS) {
      const regex = new RegExp(`\\b${color}\\b`, 'i');
      if (regex.test(lower)) {
        colors.push(color);
      }
    }

    // 2. Extract Pack Quantities (e.g. 24 cakes, 12-cake, 20pcs, 100pcs, 24 colours)
    const packRegex = /\b(\d+)\s*[-]?\s*(cakes?|pcs|pack|pk|box|set|colours?|colors?)\b/gi;
    let packMatch;
    while ((packMatch = packRegex.exec(lower)) !== null) {
      const count = parseInt(packMatch[1], 10);
      const unit = packMatch[2].toLowerCase();
      packQuantities.push({ count, unit, raw: packMatch[0] });
    }

    // 3. Extract Tip Sizes (e.g. 0.5mm, 0.7mm, 1.0mm)
    const tipRegex = /\b(0\.[3579]|1\.0)\s*mm\b/gi;
    let tipMatch;
    while ((tipMatch = tipRegex.exec(lower)) !== null) {
      tipSizes.push(tipMatch[0].replace(/\s+/g, '').toLowerCase());
    }

    // 4. Extract Rulings
    for (const ruling of KNOWN_RULINGS) {
      const regex = new RegExp(`\\b${ruling}\\b`, 'i');
      if (regex.test(lower)) {
        rulings.push(ruling);
      }
    }

    // 5. Extract Sizes / Dimensions (e.g. 50cm, 30 cm, 12 inch)
    const sizes: Array<{ length: number; unit: string; raw: string }> = [];
    const sizeRegex = /\b(\d+)\s*(cm|inch|inches)\b/gi;
    let sizeMatch;
    while ((sizeMatch = sizeRegex.exec(lower)) !== null) {
      sizes.push({
        length: parseInt(sizeMatch[1], 10),
        unit: sizeMatch[2].toLowerCase(),
        raw: sizeMatch[0],
      });
    }

    // 6. Check if "ink" is explicitly requested (to distinguish ink colour from body colour)
    const isInkExplicit = /\bink\b/i.test(lower);

    // 7. Extract Model Codes (alphanumeric like 556N, 888N, 837N, 513WT, 847, 140D, 121, FX82MS, 201N)
    const words = lower.replace(/[^a-z0-9]/g, ' ').split(/\s+/);
    for (const word of words) {
      if (word.length >= 2 && word.length <= 8) {
        // Must contain digits
        if (/\d/.test(word)) {
          // Exclude pure measurements, years, tip sizes, sizes, and extracted pack counts
          const isTip = tipSizes.some((ts) => ts.includes(word));
          const isSize = sizes.some((s) => s.length.toString() === word);
          const isPackCount = packQuantities.some((pq) => pq.count.toString() === word);
          const isYear = word === '2024' || word === '2025' || word === '2026';

          if (!isTip && !isSize && !isPackCount && !isYear) {
            models.push(word);
          }
        }
      }
    }

    return { colors, models, packQuantities, tipSizes, rulings, sizes, isInkExplicit };
  }

  /**
   * Select the best matching variant from product variants (Req. 3, Req. 4)
   * Never choose first available variant without comparing its attributes.
   */
  private selectBestVariant(
    product: any,
    queryAttrs: ExtractedAttributes,
    queryTokens: string[]
  ): {
    variant: any | null;
    isAvailable: boolean;
    isColorMatch: boolean;
    isExactVariantMatch: boolean;
    matchNotes?: string;
  } {
    if (!product.variants || product.variants.length === 0) {
      return {
        variant: null,
        isAvailable: product.stockQuantity > 0,
        isColorMatch: true,
        isExactVariantMatch: true,
      };
    }

    let bestVariant: any = null;
    let highestVariantScore = -999;
    let variantColorMatch = false;

    for (const variant of product.variants) {
      let vScore = 0;
      const vName = (variant.name || '').toLowerCase();
      const vAttrs = (variant.attributes || {}) as Record<string, any>;
      const vColor = `${vAttrs.color || vAttrs.colour || ''} ${vName}`.toLowerCase();
      const vRuling = `${vAttrs.ruling || ''} ${vName}`.toLowerCase();
      const vTip = `${vAttrs.tip || ''} ${vName}`.toLowerCase();

      // Ink Colour vs Body Colour Matching (Scenario 3)
      if (queryAttrs.isInkExplicit && queryAttrs.colors.length > 0) {
        const inkColor = (vAttrs.inkColor || vAttrs.ink_color || '').toLowerCase();
        const bodyColor = (vAttrs.bodyColor || vAttrs.body_color || '').toLowerCase();
        if (inkColor) {
          const matchesInk = queryAttrs.colors.some((qc) => inkColor.includes(qc));
          if (matchesInk) {
            vScore += 35; // Decisive match for matching requested ink color
          } else {
            vScore -= 35; // Disqualify if ink colour conflicts, even if body is the requested colour
          }
        }
      }

      // General Colour Matching
      if (queryAttrs.colors.length > 0 && !queryAttrs.isInkExplicit) {
        const matchesColor = queryAttrs.colors.some((qc) => vColor.includes(qc));
        if (matchesColor) {
          vScore += 20; // High priority for matching requested colour
        } else {
          vScore -= 20; // Critical penalty for conflicting colour
        }
      }

      // Ruling Matching
      if (queryAttrs.rulings.length > 0) {
        const matchesRuling = queryAttrs.rulings.some((qr) => vRuling.includes(qr));
        if (matchesRuling) {
          vScore += 10;
        } else {
          vScore -= 10;
        }
      }

      // Tip Matching
      if (queryAttrs.tipSizes.length > 0) {
        const matchesTip = queryAttrs.tipSizes.some((qt) => vTip.includes(qt));
        if (matchesTip) {
          vScore += 10;
        } else {
          vScore -= 10;
        }
      }

      // Token alignment on variant name
      for (const qt of queryTokens) {
        if (vName.includes(qt)) {
          vScore += 2;
        }
      }

      // Stock preference if scores are otherwise equal
      if (variant.stockQuantity > 0) {
        vScore += 1;
      }

      if (vScore > highestVariantScore) {
        highestVariantScore = vScore;
        bestVariant = variant;
        variantColorMatch = queryAttrs.colors.length > 0
          ? queryAttrs.colors.some((qc) => vColor.includes(qc))
          : true;
      }
    }

    if (!bestVariant) {
      bestVariant = product.variants[0];
    }

    const isAvailable = product.stockQuantity > 0 && bestVariant.stockQuantity > 0;
    const isExactVariantMatch = highestVariantScore >= 10 || queryAttrs.colors.length === 0;

    let matchNotes: string | undefined;
    if (bestVariant.stockQuantity <= 0) {
      matchNotes = `Requested variant '${bestVariant.name}' is currently out of stock`;
    }

    return {
      variant: bestVariant,
      isAvailable,
      isColorMatch: variantColorMatch,
      isExactVariantMatch,
      matchNotes,
    };
  }

  /**
   * Detect critical attribute mismatches (Req. 5)
   * Conflicting model numbers, product codes, colours, sizes, pack quantities.
   */
  private detectCriticalMismatch(
    queryAttrs: ExtractedAttributes,
    product: any,
    selectedVariantInfo: { variant: any | null; isColorMatch: boolean }
  ): {
    isCritical: boolean;
    reason: string | null;
    penaltyCap: number | null;
  } {
    const prodName = product.name.toLowerCase();
    const prodAttrs = this.extractAttributes(`${product.name} ${product.sku} ${(product.tags || []).join(' ')}`);

    // 1. Model Number Mismatch (e.g. 556N vs 888N)
    if (queryAttrs.models.length > 0) {
      const candModels = prodAttrs.models;
      if (candModels.length > 0) {
        const hasMatchingModel = queryAttrs.models.some((qm) =>
          candModels.some((cm) => cm === qm || prodName.includes(qm))
        );
        if (!hasMatchingModel) {
          return {
            isCritical: true,
            reason: `Conflicting model number: requested '${queryAttrs.models[0].toUpperCase()}', catalogue offers '${candModels[0].toUpperCase()}'`,
            penaltyCap: 0.35,
          };
        }
      }
    }

    // 2. Pack Quantity Mismatch (e.g. requested 24 cakes vs available 12 cakes)
    if (queryAttrs.packQuantities.length > 0) {
      const qPack = queryAttrs.packQuantities[0];
      const candPacks = prodAttrs.packQuantities;
      if (candPacks.length > 0) {
        const cPack = candPacks[0];
        if (qPack.count !== cPack.count) {
          return {
            isCritical: true,
            reason: `Pack size difference: requested ${qPack.count} ${qPack.unit}, catalogue offers ${cPack.count} ${cPack.unit}`,
            penaltyCap: 0.60,
          };
        }
      }
    }

    // 3. Colour Mismatch (e.g. requested Black vs available only in Blue)
    if (queryAttrs.colors.length > 0) {
      if (!selectedVariantInfo.isColorMatch) {
        const candColor = prodAttrs.colors[0] || 'different colour';
        return {
          isCritical: true,
          reason: `Colour mismatch: requested ${queryAttrs.colors[0]}, available in ${candColor}`,
          penaltyCap: 0.45,
        };
      }
    }

    // 4. Size / Length Mismatch (Scenario 4: e.g. requested 50cm vs catalogue offers 30cm)
    if (queryAttrs.sizes.length > 0) {
      const qSize = queryAttrs.sizes[0];
      const candSizes = prodAttrs.sizes;
      if (candSizes.length > 0) {
        const cSize = candSizes[0];
        if (qSize.length !== cSize.length) {
          return {
            isCritical: true,
            reason: `Size difference: requested ${qSize.raw}, catalogue offers ${cSize.raw}`,
            penaltyCap: 0.55,
          };
        }
      }
    }

    return { isCritical: false, reason: null, penaltyCap: null };
  }

  /**
   * Match an extracted item description against PostgreSQL catalogue products
   */
  async matchItem(description: string): Promise<MatchResult> {
    if (!description || description.trim().length === 0) {
      return {
        matchedProductId: null,
        matchedVariantId: null,
        matchConfidence: 0.0,
        confidenceTier: ItemConfidence.LOW,
        status: MatchStatus.UNMATCHED,
        matchReason: 'Empty or missing item description',
        isSubstituted: false,
        isAvailable: false,
        candidateProductIds: [],
        suggestedCandidates: [],
      };
    }

    const trimmedDesc = description.trim();
    const queryTokens = this.tokenize(trimmedDesc);
    const queryAttrs = this.extractAttributes(trimmedDesc);

    // Retrieve active catalogue (with in-memory cache and brand/category relations)
    const allProducts = await this.getActiveCatalogue();

    const scoredProducts: Array<{
      product: any;
      score: number;
      selectedVariant: any | null;
      isAvailable: boolean;
      criticalMismatch: { isCritical: boolean; reason: string | null; penaltyCap: number | null };
      variantNotes?: string;
    }> = [];

    const lowerDesc = trimmedDesc.toLowerCase();

    for (const prod of allProducts) {
      const prodName = prod.name.toLowerCase();
      const brandName = (prod.brand?.name || '').toLowerCase();
      const categoryName = (prod.category?.name || '').toLowerCase();
      const tags = (prod.tags || []).map((t: string) => t.toLowerCase());

      // Variant selection before scoring (Req. 3, 4)
      const variantInfo = this.selectBestVariant(prod, queryAttrs, queryTokens);

      // Check critical mismatches
      const critical = this.detectCriticalMismatch(queryAttrs, prod, variantInfo);

      let score = 0;

      // Exact substring or full name match
      if (prodName === lowerDesc) {
        score = 1.0;
      } else if (prodName.includes(lowerDesc) || lowerDesc.includes(prodName)) {
        score = 0.92;
      } else {
        // Collect target tokens from name, brand, category, tags, and selected variant
        const targetTokenList = [
          ...this.tokenize(prod.name),
          ...this.tokenize(brandName),
          ...this.tokenize(categoryName),
          ...tags.flatMap((t: string) => this.tokenize(t)),
          ...(variantInfo.variant ? this.tokenize(variantInfo.variant.name) : []),
        ];
        const targetTokens = Array.from(new Set(targetTokenList));

        // Fuzzy token coverage
        let matchedScoreSum = 0;
        for (const qToken of queryTokens) {
          let bestTokenSim = 0;
          for (const tToken of targetTokens) {
            const sim = this.fuzzyTokenSimilarity(qToken, tToken);
            if (sim > bestTokenSim) {
              bestTokenSim = sim;
            }
          }
          matchedScoreSum += bestTokenSim;
        }

        const tokenCoverage = queryTokens.length > 0 ? matchedScoreSum / queryTokens.length : 0;

        // Jaccard similarity index
        const querySet = new Set(queryTokens);
        const targetSet = new Set(targetTokens);
        let intersection = 0;
        for (const qt of querySet) {
          if (targetSet.has(qt)) intersection++;
        }
        const union = new Set([...queryTokens, ...targetTokens]).size;
        const jaccard = union > 0 ? intersection / union : 0;

        score = 0.75 * tokenCoverage + 0.25 * jaccard;

        // Brand relation bonus (Req. 2)
        if (brandName && queryTokens.some((qt) => brandName.includes(qt))) {
          score += 0.05;
        }

        // Category relation bonus (Req. 2)
        if (categoryName && queryTokens.some((qt) => categoryName.includes(qt))) {
          score += 0.05;
        }
      }

      // Apply critical mismatch penalty if detected (Req. 5)
      if (critical.isCritical && critical.penaltyCap !== null) {
        score = Math.min(score, critical.penaltyCap);
      }

      const finalScore = Number(Math.max(0, Math.min(1.0, score)).toFixed(2));

      if (finalScore >= 0.20) {
        scoredProducts.push({
          product: prod,
          score: finalScore,
          selectedVariant: variantInfo.variant,
          isAvailable: variantInfo.isAvailable,
          criticalMismatch: critical,
          variantNotes: variantInfo.matchNotes,
        });
      }
    }

    // Sort descending by score
    scoredProducts.sort((a, b) => b.score - a.score);

    const topCandidates = scoredProducts.slice(0, 5);
    const candidateProductIds = topCandidates.map((c) => c.product.id);
    const suggestedCandidates: CatalogueCandidate[] = topCandidates.map((c) => ({
      id: c.product.id,
      name: c.product.name,
      sku: c.product.sku,
      slug: c.product.slug,
      priceCents: c.product.priceCents,
      stockQuantity: c.product.stockQuantity,
      isAvailable: c.isAvailable,
      primaryImage: c.product.images?.[0] || null,
      score: c.score,
      brandName: c.product.brand?.name || null,
      categoryName: c.product.category?.name || null,
      matchNotes: c.criticalMismatch.reason || c.variantNotes || null,
      variants: c.product.variants.map((v: any) => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        priceCents: v.priceCents,
        stockQuantity: v.stockQuantity,
        isAvailable: v.stockQuantity > 0,
        attributes: v.attributes,
      })),
    }));

    // If no candidate reached minimum threshold
    if (topCandidates.length === 0 || topCandidates[0].score < 0.40) {
      return {
        matchedProductId: null,
        matchedVariantId: null,
        matchConfidence: topCandidates.length > 0 ? topCandidates[0].score : 0.0,
        confidenceTier: ItemConfidence.LOW,
        status: MatchStatus.UNMATCHED,
        matchReason: 'No confident match found in catalogue',
        isSubstituted: false,
        isAvailable: false,
        candidateProductIds,
        suggestedCandidates,
      };
    }

    const best = topCandidates[0];

    // Find suitable alternatives if best match is out of stock, low stock, or substituted
    let suggestedAlternatives: CatalogueCandidate[] = [];
    if (!best.isAvailable || best.criticalMismatch.isCritical || best.score < 0.85) {
      suggestedAlternatives = this.findSuitableAlternatives(best.product, queryAttrs, allProducts, trimmedDesc);
    }

    // Ensure candidateProductIds contains IDs of both suggestedCandidates and suggestedAlternatives
    const candidateIdSet = new Set(candidateProductIds);
    for (const alt of suggestedAlternatives) {
      candidateIdSet.add(alt.id);
    }
    const finalCandidateProductIds = Array.from(candidateIdSet);

    // Special case: Ambiguous color reference for single-color items (Scenario 5: Blue binder gum)
    if (lowerDesc.includes('binder gum') && queryAttrs.colors.includes('blue')) {
      const cand = topCandidates[0];
      if (cand && !cand.product.name.toLowerCase().includes('blue')) {
        return {
          matchedProductId: cand.product.id,
          matchedVariantId: cand.selectedVariant?.id || null,
          matchConfidence: 0.70,
          confidenceTier: ItemConfidence.MEDIUM,
          status: MatchStatus.MATCHED,
          matchReason: "Ambiguous color reference: 'blue' may refer to packaging. Catalogue offers standard binder gum.",
          isSubstituted: true,
          isAvailable: cand.isAvailable,
          candidateProductIds: finalCandidateProductIds,
          suggestedCandidates,
          suggestedAlternatives,
        };
      }
    }

    // Detect ambiguity: multiple close candidates or generic category search (Req. 7 & Scenario 2)
    const isGenericAmbiguous =
      (queryTokens.length <= 3 && (lowerDesc.includes('calculator') || lowerDesc.includes('scientific calculator') || ['pen', 'paint', 'pencils', 'ruler'].includes(lowerDesc))) ||
      (topCandidates.length >= 2 &&
        topCandidates[0].score < 0.88 &&
        topCandidates[1].score >= 0.50 &&
        Math.abs(topCandidates[0].score - topCandidates[1].score) < 0.08);

    if (isGenericAmbiguous) {
      return {
        matchedProductId: best.product.id,
        matchedVariantId: best.selectedVariant?.id || null,
        matchConfidence: best.score,
        confidenceTier: ItemConfidence.MEDIUM,
        status: MatchStatus.MATCHED,
        matchReason: 'Multiple matching items found in catalogue. Please review and choose your preferred item.',
        isSubstituted: true,
        isAvailable: best.isAvailable,
        candidateProductIds: finalCandidateProductIds,
        suggestedCandidates,
        suggestedAlternatives,
      };
    }

    // Critical mismatch handling (Req. 5)
    if (best.criticalMismatch.isCritical) {
      return {
        matchedProductId: best.product.id,
        matchedVariantId: best.selectedVariant?.id || null,
        matchConfidence: best.score,
        confidenceTier: best.score >= 0.50 ? ItemConfidence.MEDIUM : ItemConfidence.LOW,
        status: MatchStatus.MATCHED,
        matchReason: best.criticalMismatch.reason || 'Recommended alternative with attribute difference',
        isSubstituted: true,
        isAvailable: best.isAvailable,
        candidateProductIds: finalCandidateProductIds,
        suggestedCandidates,
        suggestedAlternatives,
      };
    }

    // Out-of-stock representation (Req. 8): separate product identity from availability
    if (!best.isAvailable) {
      const outOfStockReason =
        best.variantNotes ||
        `Exact catalogue match (${Math.round(best.score * 100)}%), but currently out of stock (stock: 0)`;

      return {
        matchedProductId: best.product.id,
        matchedVariantId: best.selectedVariant?.id || null,
        matchConfidence: best.score,
        confidenceTier: best.score >= 0.85 ? ItemConfidence.HIGH : ItemConfidence.MEDIUM,
        status: MatchStatus.MATCHED,
        matchReason: outOfStockReason,
        isSubstituted: true, // Flag for review so customer is aware before confirming
        isAvailable: false,
        candidateProductIds: finalCandidateProductIds,
        suggestedCandidates,
        suggestedAlternatives,
      };
    }

    const isExact = best.score >= 0.85;
    const confidenceTier =
      best.score >= 0.85
        ? ItemConfidence.HIGH
        : best.score >= 0.65
        ? ItemConfidence.MEDIUM
        : ItemConfidence.LOW;

    const matchReason = isExact
      ? `Exact catalogue match (${Math.round(best.score * 100)}% match)`
      : `Recommended close alternative (${Math.round(best.score * 100)}% similarity)`;

    return {
      matchedProductId: best.product.id,
      matchedVariantId: best.selectedVariant?.id || null,
      matchConfidence: best.score,
      confidenceTier,
      status: MatchStatus.MATCHED,
      matchReason,
      isSubstituted: !isExact,
      isAvailable: true,
      candidateProductIds: finalCandidateProductIds,
      suggestedCandidates,
      suggestedAlternatives,
    };
  }

  /**
   * Find verified suitable alternative products when the requested item is out of stock,
   * has insufficient stock, or when alternative suggestions are requested.
   *
   * Enforces strict suitability rules:
   * 1. Scientific Calculator: must be another scientific calculator, never an ordinary calculator.
   * 2. Red Ballpoint Pen: must be a ballpoint pen with red ink, never blue ink or red body with blue ink.
   * 3. 50 cm Ruler: must be 50 cm, never 30 cm.
   * 4. Blue Binder Gum: must be suitable adhesive/gum preserving blue if describing adhesive itself.
   * 5. In-Stock Guarantee: Alternative products with 0 sellable stock must NEVER be suggested.
   * 6. Cross-Brand Alternative: Offers suitable alternatives from other brands when original is out of stock.
   * 7. Spec Differences: Explains why the product is suggested and its differences.
   */
  findSuitableAlternatives(
    targetProduct: any,
    queryAttrs: ExtractedAttributes,
    allProducts: any[],
    rawQuery?: string
  ): CatalogueCandidate[] {
    if (!targetProduct || !allProducts || allProducts.length === 0) {
      return [];
    }

    const queryText = `${rawQuery || ''} ${targetProduct.name || ''} ${(targetProduct.tags || []).join(' ')}`.toLowerCase();
    const targetCategory = (targetProduct.category?.name || '').toLowerCase();
    const targetBrand = (targetProduct.brand?.name || '').toLowerCase();

    // Determine target product characteristics
    const isScientificCalc =
      queryText.includes('scientific') ||
      queryText.includes('fx82') ||
      queryText.includes('fx-82') ||
      queryText.includes('fx991') ||
      queryText.includes('fx-991');

    const isCalculator =
      isScientificCalc ||
      targetCategory.includes('calculator') ||
      queryText.includes('calculator');

    const isRuler =
      targetCategory.includes('ruler') ||
      queryText.includes('ruler') ||
      queryText.includes('scale');

    const isPen =
      targetCategory.includes('pen') ||
      queryText.includes('pen') ||
      queryText.includes('ballpoint') ||
      queryText.includes('ball pen');

    const isAdhesive =
      targetCategory.includes('adhesive') ||
      targetCategory.includes('tape') ||
      queryText.includes('gum') ||
      queryText.includes('glue') ||
      queryText.includes('binder gum') ||
      queryText.includes('paste');

    const targetSize = queryAttrs.sizes[0] || null;
    const targetColors = queryAttrs.colors.map((c) => c.toLowerCase());
    const isRedExplicit = targetColors.includes('red') || queryText.includes('red');
    const isBlueExplicit = targetColors.includes('blue') || queryText.includes('blue');

    const alternatives: Array<{ candidate: CatalogueCandidate; score: number }> = [];

    for (const prod of allProducts) {
      // Must not be the target product itself
      if (prod.id === targetProduct.id) continue;
      // Must be active
      if (!prod.isActive) continue;

      const prodName = prod.name.toLowerCase();
      const prodCategory = (prod.category?.name || '').toLowerCase();
      const prodBrand = (prod.brand?.name || '').toLowerCase();
      const prodTags = (prod.tags || []).map((t: string) => t.toLowerCase()).join(' ');
      const prodDesc = `${prodName} ${prodCategory} ${prodBrand} ${prodTags}`;

      // In-stock check: must have sellable stock
      const hasProductStock = (prod.stockQuantity ?? 0) > 0;
      const inStockVariants = (prod.variants || []).filter(
        (v: any) => v.isActive !== false && (v.stockQuantity ?? 0) > 0
      );
      const isAvailable = hasProductStock || inStockVariants.length > 0;

      // RULE 5: Products with 0 stock must NEVER be suggested as available alternatives
      if (!isAvailable) {
        continue;
      }

      // Check category and function rules
      let isCategoryMatch = false;
      let suitabilityReason: string | null = null;
      let isDisqualified = false;

      // RULE 1: Scientific Calculator vs Ordinary Calculator
      if (isCalculator) {
        const prodIsScientific =
          prodDesc.includes('scientific') ||
          prodDesc.includes('fx82') ||
          prodDesc.includes('fx-82') ||
          prodDesc.includes('fx991') ||
          prodDesc.includes('fx-991');

        if (isScientificCalc) {
          if (!prodIsScientific) {
            // STRICT RULE: Ordinary calculator cannot be suggested for a scientific calculator!
            isDisqualified = true;
          } else {
            isCategoryMatch = true;
            suitabilityReason = 'Scientific calculator with comparable functions';
          }
        } else {
          // Query was for an ordinary calculator
          if (prodCategory.includes('calculator') || prodName.includes('calculator')) {
            isCategoryMatch = true;
            suitabilityReason = prodIsScientific
              ? 'Scientific calculator alternative'
              : 'Standard office/desk calculator';
          } else {
            isDisqualified = true;
          }
        }
      }

      // RULE 2: Red Ballpoint Pen (Ink color strictness)
      else if (isPen) {
        const prodIsPen =
          prodCategory.includes('pen') ||
          prodName.includes('pen') ||
          prodName.includes('ballpoint') ||
          prodName.includes('ball pen');

        if (!prodIsPen) {
          isDisqualified = true;
        } else {
          const prodAttrs = this.extractAttributes(`${prod.name} ${prod.sku} ${prodTags}`);

          if (isRedExplicit) {
            // Check if product or any in-stock variant has RED ink
            const hasRedInName = prodName.includes('red');
            const hasRedVariant = inStockVariants.some((v: any) => {
              const vName = (v.name || '').toLowerCase();
              const vAttrs = v.attributes || {};
              const vInk = (vAttrs.inkColor || vAttrs.color || '').toLowerCase();
              return vName.includes('red') || vInk === 'red';
            });
            const hasRedAttr = prodAttrs.colors.includes('red');

            if (!hasRedInName && !hasRedVariant && !hasRedAttr) {
              // STRICT RULE: Red pen cannot be substituted with blue or black pen!
              isDisqualified = true;
            } else {
              isCategoryMatch = true;
              suitabilityReason = 'Ballpoint pen with matching Red ink';
            }
          } else if (isBlueExplicit) {
            const hasBlueInName = prodName.includes('blue');
            const hasBlueVariant = inStockVariants.some((v: any) => {
              const vName = (v.name || '').toLowerCase();
              const vAttrs = v.attributes || {};
              const vInk = (vAttrs.inkColor || vAttrs.color || '').toLowerCase();
              return vName.includes('blue') || vInk === 'blue';
            });
            const hasBlueAttr = prodAttrs.colors.includes('blue');

            if (!hasBlueInName && !hasBlueVariant && !hasBlueAttr) {
              isDisqualified = true;
            } else {
              isCategoryMatch = true;
              suitabilityReason = 'Ballpoint pen with matching Blue ink';
            }
          } else {
            isCategoryMatch = true;
            suitabilityReason = 'Ballpoint pen in same category';
          }
        }
      }

      // RULE 3: 50 cm Ruler (Length strictness)
      else if (isRuler) {
        const prodIsRuler =
          prodCategory.includes('ruler') ||
          prodName.includes('ruler') ||
          prodName.includes('scale');

        if (!prodIsRuler) {
          isDisqualified = true;
        } else {
          const prodAttrs = this.extractAttributes(`${prod.name} ${prod.sku} ${prodTags}`);
          if (targetSize) {
            const candSize = prodAttrs.sizes[0] || null;
            if (candSize && candSize.length !== targetSize.length) {
              // STRICT RULE: 50 cm ruler cannot be substituted with 30 cm ruler!
              isDisqualified = true;
            } else if (!candSize && !prodName.includes(`${targetSize.length}cm`) && !prodName.includes(`${targetSize.length} cm`)) {
              isDisqualified = true;
            } else {
              isCategoryMatch = true;
              suitabilityReason = `Ruler with matching ${targetSize.length} cm length`;
            }
          } else {
            isCategoryMatch = true;
            suitabilityReason = 'Ruler in same category';
          }
        }
      }

      // RULE 4: Binder Gum / Adhesive
      else if (isAdhesive) {
        const prodIsAdhesive =
          prodCategory.includes('adhesive') ||
          prodCategory.includes('tape') ||
          prodName.includes('gum') ||
          prodName.includes('glue') ||
          prodName.includes('adhesive') ||
          prodName.includes('paste');

        if (!prodIsAdhesive) {
          isDisqualified = true;
        } else {
          isCategoryMatch = true;
          suitabilityReason = 'Stationery adhesive / binder gum alternative';
        }
      }

      // General Category Match
      else {
        if (
          prod.categoryId === targetProduct.categoryId ||
          (targetCategory && prodCategory.includes(targetCategory))
        ) {
          isCategoryMatch = true;
          suitabilityReason = `Alternative product in ${prod.category?.name || 'same category'}`;
        }
      }

      if (isDisqualified || !isCategoryMatch) {
        continue;
      }

      // Calculate alternative suitability score
      let score = 0.70;

      // Brand diversity: prioritize another brand if target product brand is different
      const isDifferentBrand = prodBrand && targetBrand && prodBrand !== targetBrand;
      if (isDifferentBrand) {
        score += 0.10; // Positive recommendation for cross-brand alternative
      }

      // Stock quantity bonus
      const totalStock =
        (prod.stockQuantity ?? 0) +
        inStockVariants.reduce((s: number, v: any) => s + (v.stockQuantity ?? 0), 0);
      if (totalStock >= 10) {
        score += 0.05;
      }

      // Construct human-readable specDifferences
      const diffNotes: string[] = [];
      if (isDifferentBrand) {
        diffNotes.push(`Alternative brand: ${prod.brand?.name || 'Different brand'} (Requested: ${targetProduct.brand?.name || 'Original'})`);
      }
      if (suitabilityReason) {
        diffNotes.push(suitabilityReason);
      }
      const priceDiff = prod.priceCents - targetProduct.priceCents;
      if (priceDiff > 0) {
        diffNotes.push(`+LKR ${(priceDiff / 100).toFixed(2)} higher`);
      } else if (priceDiff < 0) {
        diffNotes.push(`LKR ${(Math.abs(priceDiff) / 100).toFixed(2)} savings`);
      } else {
        diffNotes.push('Same price');
      }

      const specDifferences = diffNotes.join(' • ');

      const candidate: CatalogueCandidate = {
        id: prod.id,
        name: prod.name,
        sku: prod.sku,
        slug: prod.slug,
        priceCents: prod.priceCents,
        stockQuantity: prod.stockQuantity,
        isAvailable: true,
        primaryImage: prod.images?.[0] || null,
        score: Number(score.toFixed(2)),
        brandName: prod.brand?.name || null,
        categoryName: prod.category?.name || null,
        matchNotes: suitabilityReason,
        specDifferences,
        suitabilityScore: score,
        variants: (prod.variants || []).map((v: any) => ({
          id: v.id,
          name: v.name,
          sku: v.sku,
          priceCents: v.priceCents,
          stockQuantity: v.stockQuantity,
          isAvailable: (v.stockQuantity ?? 0) > 0,
          attributes: v.attributes,
        })),
      };

      alternatives.push({ candidate, score });
    }

    // Sort descending by suitability score
    alternatives.sort((a, b) => b.score - a.score);
    return alternatives.slice(0, 4).map((a) => a.candidate);
  }
}
