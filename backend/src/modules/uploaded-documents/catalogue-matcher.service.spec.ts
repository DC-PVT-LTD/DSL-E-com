import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CatalogueMatcherService, MatchResult } from './catalogue-matcher.service';
import { ItemConfidence, MatchStatus } from '../../generated/prisma';

describe('CatalogueMatcherService - Regression Suite', () => {
  let service: CatalogueMatcherService;
  let mockPrisma: any;

  // Real catalogue fixtures matching DSL Stationery products
  const mockCatalogue = [
    {
      id: 'prod-speed-rim-blue',
      name: 'SPEED RIM Ball Pen Blue',
      sku: 'DSL-SPEED-RIM-BLUE',
      slug: 'speed-rim-ball-pen-blue',
      priceCents: 2500,
      stockQuantity: 210,
      isActive: true,
      images: ['https://www.dsl.lk/media/img/1747715974.jpg'],
      tags: ['pens', 'speed', 'rim', 'ball', 'pen', 'blue'],
      brand: { id: 'brand-speed', name: 'Speed', slug: 'speed' },
      category: { id: 'cat-pens', name: 'Pens', slug: 'pens' },
      variants: [
        {
          id: 'var-speed-rim-blue',
          productId: 'prod-speed-rim-blue',
          name: 'Blue',
          sku: 'DSL-SPEED-RIM-VAR-BLUE',
          priceCents: 2500,
          stockQuantity: 610,
          attributes: { color: 'Blue' },
          isActive: true,
        },
        {
          id: 'var-speed-rim-black',
          productId: 'prod-speed-rim-blue',
          name: 'Black',
          sku: 'DSL-SPEED-RIM-VAR-BLACK',
          priceCents: 2500,
          stockQuantity: 450,
          attributes: { color: 'Black' },
          isActive: true,
        },
      ],
    },
    {
      id: 'prod-speed-rim-blue-only',
      name: 'SPEED RIM Ball Pen Blue Only',
      sku: 'DSL-SPEED-RIM-BLUE-ONLY',
      slug: 'speed-rim-ball-pen-blue-only',
      priceCents: 2500,
      stockQuantity: 50,
      isActive: true,
      images: [],
      tags: ['pens', 'speed', 'rim', 'ball', 'pen', 'blue'],
      brand: { id: 'brand-speed', name: 'Speed', slug: 'speed' },
      category: { id: 'cat-pens', name: 'Pens', slug: 'pens' },
      variants: [
        {
          id: 'var-speed-rim-only-blue',
          productId: 'prod-speed-rim-blue-only',
          name: 'Blue',
          sku: 'DSL-SPEED-RIM-VAR-ONLY-BLUE',
          priceCents: 2500,
          stockQuantity: 50,
          attributes: { color: 'Blue' },
          isActive: true,
        },
      ],
    },
    {
      id: 'prod-dsl-101',
      name: 'MI GOLD 556N - CALCULATOR',
      sku: 'DSL-PROD-101-189',
      slug: 'mi-gold-556n-calculator',
      priceCents: 185000,
      stockQuantity: 45,
      isActive: true,
      images: [],
      tags: ['calculator', 'mi', 'gold', '556n'],
      brand: { id: 'brand-mi', name: 'MI', slug: 'mi' },
      category: { id: 'cat-calculators', name: 'Calculators', slug: 'calculators' },
      variants: [],
    },
    {
      id: 'prod-dsl-103',
      name: 'MI GOLD 888N - CALCULATOR',
      sku: 'DSL-PROD-103-167',
      slug: 'mi-gold-888n-calculator',
      priceCents: 220000,
      stockQuantity: 30,
      isActive: true,
      images: [],
      tags: ['calculator', 'mi', 'gold', '888n'],
      brand: { id: 'brand-mi', name: 'MI', slug: 'mi' },
      category: { id: 'cat-calculators', name: 'Calculators', slug: 'calculators' },
      variants: [],
    },
    {
      id: 'prod-camlin-water-colour-12',
      name: 'Kokuyo Camlin Artist Water Colour 12 Cakes',
      sku: 'DSL-CAMLIN-WC-12',
      slug: 'kokuyo-camlin-artist-water-colour-12-cakes',
      priceCents: 145000,
      stockQuantity: 25,
      isActive: true,
      images: [],
      tags: ['camlin', 'water', 'colour', 'cakes', '12'],
      brand: { id: 'brand-camlin', name: 'Kokuyo Camlin', slug: 'kokuyo-camlin' },
      category: { id: 'cat-art', name: 'Art Supplies', slug: 'art-supplies' },
      variants: [],
    },
    {
      id: 'prod-out-of-stock',
      name: 'DOMS NEON PENCILS 10PCS',
      sku: 'DSL-DOMS-NEON-OOS',
      slug: 'doms-neon-pencils-10pcs',
      priceCents: 35000,
      stockQuantity: 0,
      isActive: true,
      images: [],
      tags: ['doms', 'neon', 'pencils'],
      brand: { id: 'brand-doms', name: 'Doms', slug: 'doms' },
      category: { id: 'cat-pencils', name: 'Pencils', slug: 'pencils' },
      variants: [],
    },
    {
      id: 'prod-variant-out-of-stock',
      name: 'ATLAS GEL PEN 0.7MM',
      sku: 'DSL-ATLAS-GEL-07',
      slug: 'atlas-gel-pen-07mm',
      priceCents: 4500,
      stockQuantity: 10,
      isActive: true,
      images: [],
      tags: ['atlas', 'gel', 'pen'],
      brand: { id: 'brand-atlas', name: 'Atlas', slug: 'atlas' },
      category: { id: 'cat-pens', name: 'Pens', slug: 'pens' },
      variants: [
        {
          id: 'var-atlas-red-oos',
          productId: 'prod-variant-out-of-stock',
          name: 'Red',
          sku: 'DSL-ATLAS-GEL-RED',
          priceCents: 4500,
          stockQuantity: 0,
          attributes: { color: 'Red' },
          isActive: true,
        },
        {
          id: 'var-atlas-blue-instock',
          productId: 'prod-variant-out-of-stock',
          name: 'Blue',
          sku: 'DSL-ATLAS-GEL-BLUE',
          priceCents: 4500,
          stockQuantity: 50,
          attributes: { color: 'Blue' },
          isActive: true,
        },
      ],
    },
    {
      id: 'prod-inactive',
      name: 'DISCONTINUED RETRO PEN',
      sku: 'DSL-DISC-RETRO',
      slug: 'discontinued-retro-pen',
      priceCents: 5000,
      stockQuantity: 100,
      isActive: false, // Inactive product!
      images: [],
      tags: ['pen'],
      brand: null,
      category: null,
      variants: [],
    },
    {
      id: 'prod-ruler-30',
      name: 'ATLAS WOODEN RULER 30CM',
      sku: 'DSL-RULER-30CM',
      slug: 'atlas-wooden-ruler-30cm',
      priceCents: 12000,
      stockQuantity: 100,
      isActive: true,
      images: [],
      tags: ['ruler', 'atlas', 'wooden', '30cm'],
      brand: { id: 'brand-atlas', name: 'Atlas', slug: 'atlas' },
      category: { id: 'cat-rulers', name: 'Rulers', slug: 'rulers' },
      variants: [],
    },
    {
      id: 'prod-ruler-50',
      name: 'ATLAS WOODEN RULER 50CM',
      sku: 'DSL-RULER-50CM',
      slug: 'atlas-wooden-ruler-50cm',
      priceCents: 22000,
      stockQuantity: 40,
      isActive: true,
      images: [],
      tags: ['ruler', 'atlas', 'wooden', '50cm'],
      brand: { id: 'brand-atlas', name: 'Atlas', slug: 'atlas' },
      category: { id: 'cat-rulers', name: 'Rulers', slug: 'rulers' },
      variants: [],
    },
    {
      id: 'prod-dual-tone-pen',
      name: 'SPEED DUAL TONE PEN',
      sku: 'DSL-SPEED-DUAL',
      slug: 'speed-dual-tone-pen',
      priceCents: 6000,
      stockQuantity: 80,
      isActive: true,
      images: [],
      tags: ['speed', 'pen'],
      brand: { id: 'brand-speed', name: 'Speed', slug: 'speed' },
      category: { id: 'cat-pens', name: 'Pens', slug: 'pens' },
      variants: [
        {
          id: 'var-red-body-blue-ink',
          productId: 'prod-dual-tone-pen',
          name: 'Red Body / Blue Ink',
          sku: 'DSL-VAR-RB-BI',
          priceCents: 6000,
          stockQuantity: 50,
          attributes: { bodyColor: 'Red', inkColor: 'Blue' },
          isActive: true,
        },
        {
          id: 'var-white-body-red-ink',
          productId: 'prod-dual-tone-pen',
          name: 'White Body / Red Ink',
          sku: 'DSL-VAR-WB-RI',
          priceCents: 6000,
          stockQuantity: 30,
          attributes: { bodyColor: 'White', inkColor: 'Red' },
          isActive: true,
        },
      ],
    },
    {
      id: 'prod-binder-gum',
      name: 'DSL ALL PURPOSE BINDER GUM 100ML',
      sku: 'DSL-GUM-100',
      slug: 'dsl-all-purpose-binder-gum-100ml',
      priceCents: 15000,
      stockQuantity: 60,
      isActive: true,
      images: [],
      tags: ['binder', 'gum', 'glue', 'dsl'],
      brand: null,
      category: { id: 'cat-glues', name: 'Adhesives', slug: 'adhesives' },
      variants: [],
    },
    {
      id: 'prod-fx82ms',
      name: 'MI FX82MS - SCIENTIFIC CALCULATOR',
      sku: 'DSL-FX82MS',
      slug: 'mi-fx82ms-scientific-calculator',
      priceCents: 450000,
      stockQuantity: 15,
      isActive: true,
      images: [],
      tags: ['calculator', 'scientific', 'mi', 'fx82ms'],
      brand: { id: 'brand-mi', name: 'MI', slug: 'mi' },
      category: { id: 'cat-calculators', name: 'Calculators', slug: 'calculators' },
      variants: [],
    },
    {
      id: 'prod-casio-scientific',
      name: 'Casio fx-82MS Scientific Calculator 240 Functions',
      sku: 'DSL-CASIO-FX82',
      slug: 'casio-fx82ms-scientific-calculator',
      priceCents: 480000,
      stockQuantity: 40,
      isActive: true,
      images: [],
      tags: ['calculator', 'scientific', 'casio', 'fx82ms', 'functions'],
      brand: { id: 'brand-casio', name: 'Casio', slug: 'casio' },
      category: { id: 'cat-calculators', name: 'Calculators', slug: 'calculators' },
      variants: [],
    },
    {
      id: 'prod-desk-calc-amigo',
      name: 'Amigo 201N Standard Desktop Calculator 8-Digit',
      sku: 'DSL-AMIGO-201N',
      slug: 'amigo-201n-standard-desktop-calculator',
      priceCents: 95000,
      stockQuantity: 50,
      isActive: true,
      images: [],
      tags: ['calculator', 'amigo', '201n', 'desktop', 'standard', 'basic'],
      brand: { id: 'brand-amigo', name: 'Amigo', slug: 'amigo' },
      category: { id: 'cat-calculators', name: 'Calculators', slug: 'calculators' },
      variants: [],
    },
    {
      id: 'prod-speed-red-oos',
      name: 'Speed Fine Red Ballpoint Pen',
      sku: 'DSL-SPEED-RED-OOS',
      slug: 'speed-fine-red-ballpoint-pen',
      priceCents: 3000,
      stockQuantity: 0, // OUT OF STOCK
      isActive: true,
      images: [],
      tags: ['pen', 'speed', 'ballpoint', 'red'],
      brand: { id: 'brand-speed', name: 'Speed', slug: 'speed' },
      category: { id: 'cat-pens', name: 'Pens', slug: 'pens' },
      variants: [],
    },
    {
      id: 'prod-atlas-red-instock',
      name: 'Atlas Chooty Red Ballpoint Pen',
      sku: 'DSL-ATLAS-CHOOTY-RED',
      slug: 'atlas-chooty-red-ballpoint-pen',
      priceCents: 3000,
      stockQuantity: 60,
      isActive: true,
      images: [],
      tags: ['pen', 'atlas', 'ballpoint', 'red'],
      brand: { id: 'brand-atlas', name: 'Atlas', slug: 'atlas' },
      category: { id: 'cat-pens', name: 'Pens', slug: 'pens' },
      variants: [],
    },
    {
      id: 'prod-doms-ruler-50-instock',
      name: 'Doms Clear Metric Ruler 50cm',
      sku: 'DSL-DOMS-RULER-50CM',
      slug: 'doms-clear-metric-ruler-50cm',
      priceCents: 20000,
      stockQuantity: 35,
      isActive: true,
      images: [],
      tags: ['ruler', 'doms', '50cm'],
      brand: { id: 'brand-doms', name: 'Doms', slug: 'doms' },
      category: { id: 'cat-rulers', name: 'Rulers', slug: 'rulers' },
      variants: [],
    },
  ];

  beforeEach(() => {
    mockPrisma = {
      product: {
        findMany: vi.fn().mockImplementation(async (query: any) => {
          // If query specifies isActive: true, filter out inactive
          let filtered = mockCatalogue;
          if (query?.where?.isActive !== undefined) {
            filtered = filtered.filter((p) => p.isActive === query.where.isActive);
          }
          return filtered;
        }),
      },
    };

    service = new CatalogueMatcherService(mockPrisma);
    service.invalidateCache();
  });

  describe('1. Speed Rim Ball Pen Black vs Blue attribute matching', () => {
    it('selects the Black variant when Black is requested', async () => {
      const result = await service.matchItem('Speed Rim Ball Pen Black');

      expect(result.status).toBe(MatchStatus.MATCHED);
      expect(result.matchedProductId).toBe('prod-speed-rim-blue');
      expect(result.matchedVariantId).toBe('var-speed-rim-black');
      expect(result.isSubstituted).toBe(false);
      expect(result.matchConfidence).toBeGreaterThanOrEqual(0.85);
    });

    it('selects the Blue variant when Blue is requested', async () => {
      const result = await service.matchItem('Speed Rim Ball Pen Blue');

      expect(result.status).toBe(MatchStatus.MATCHED);
      expect(result.matchedProductId).toBe('prod-speed-rim-blue');
      expect(result.matchedVariantId).toBe('var-speed-rim-blue');
      expect(result.isSubstituted).toBe(false);
    });

    it('never chooses the first available variant without comparing requested attributes', async () => {
      // Even if var-speed-rim-blue is first in array, requested Black must pick var-speed-rim-black
      const result = await service.matchItem('SPEED RIM Black Pen');
      expect(result.matchedVariantId).toBe('var-speed-rim-black');
    });

    it('flags critical colour mismatch if candidate only has conflicting colour', async () => {
      // prod-speed-rim-blue-only only has Blue variant. Requesting Red or Black should not be exact match
      const result = await service.matchItem('SPEED RIM Ball Pen Red');
      // If matched as alternative, must be isSubstituted: true and not exact
      if (result.matchedProductId === 'prod-speed-rim-blue-only') {
        expect(result.isSubstituted).toBe(true);
        expect(result.matchConfidence).toBeLessThan(0.85);
      }
    });
  });

  describe('2. Calculator model 556N vs 888N', () => {
    it('matches 556N to prod-dsl-101 as exact match and rejects 888N as exact match', async () => {
      const result556 = await service.matchItem('MI GOLD 556N Calculator');

      expect(result556.status).toBe(MatchStatus.MATCHED);
      expect(result556.matchedProductId).toBe('prod-dsl-101');
      expect(result556.isSubstituted).toBe(false);
      expect(result556.matchConfidence).toBeGreaterThanOrEqual(0.85);
      expect(result556.matchedProductId).not.toBe('prod-dsl-103');
    });

    it('matches 888N to prod-dsl-103 and never labels 556N candidate an exact match', async () => {
      const result888 = await service.matchItem('MI GOLD 888N Calculator');

      expect(result888.status).toBe(MatchStatus.MATCHED);
      expect(result888.matchedProductId).toBe('prod-dsl-103');
      expect(result888.isSubstituted).toBe(false);
      expect(result888.matchConfidence).toBeGreaterThanOrEqual(0.85);
    });

    it('treats conflicting model numbers as a critical mismatch with penalized score', async () => {
      // Query specifically asking for 556N against 888N candidate in suggested list
      const result = await service.matchItem('MI GOLD 556N Calculator');
      const candidate888 = result.suggestedCandidates.find((c) => c.id === 'prod-dsl-103');
      if (candidate888) {
        expect(candidate888.score).toBeLessThan(0.50);
      }
    });
  });

  describe('3. Requested 24-cake set vs available 12-cake set', () => {
    it('marks conflicting pack size as a substitute with clear reason', async () => {
      const result = await service.matchItem('Kokuyo Camlin Artist Water Colour 24 Cakes');

      expect(result.status).toBe(MatchStatus.MATCHED);
      expect(result.matchedProductId).toBe('prod-camlin-water-colour-12');
      // Must NOT be labeled exact match!
      expect(result.isSubstituted).toBe(true);
      expect(result.matchConfidence).toBeLessThan(0.85);
      expect(result.matchReason.toLowerCase()).toContain('pack size');
    });
  });

  describe('4. Minor OCR spelling mistakes', () => {
    it('fuzzy matches "Speed Rlm Ball Pen Blue" to SPEED RIM Ball Pen Blue', async () => {
      const result = await service.matchItem('Speed Rlm Ball Pen Blue');

      expect(result.status).toBe(MatchStatus.MATCHED);
      expect(result.matchedProductId).toBe('prod-speed-rim-blue');
      expect(result.matchConfidence).toBeGreaterThanOrEqual(0.80);
    });

    it('fuzzy matches "MI 556N Calclator" to MI GOLD 556N - CALCULATOR', async () => {
      const result = await service.matchItem('MI 556N Calclator');

      expect(result.status).toBe(MatchStatus.MATCHED);
      expect(result.matchedProductId).toBe('prod-dsl-101');
      expect(result.matchConfidence).toBeGreaterThanOrEqual(0.80);
    });

    it('fuzzy matches "Kokuyo Camiln Water Colour" to Kokuyo Camlin', async () => {
      const result = await service.matchItem('Kokuyo Camiln Water Colour 12 Cakes');

      expect(result.status).toBe(MatchStatus.MATCHED);
      expect(result.matchedProductId).toBe('prod-camlin-water-colour-12');
      expect(result.matchConfidence).toBeGreaterThanOrEqual(0.80);
    });
  });

  describe('5. Ambiguous calculator descriptions', () => {
    it('detects ambiguous generic descriptions and provides multiple candidates', async () => {
      const result = await service.matchItem('Calculator');

      expect(result.status).toBe(MatchStatus.MATCHED);
      expect(result.isSubstituted).toBe(true);
      expect(result.confidenceTier).not.toBe(ItemConfidence.HIGH);
      expect(result.candidateProductIds.length).toBeGreaterThanOrEqual(2);
      expect(result.matchReason.toLowerCase()).toContain('multiple');
      expect(result.suggestedCandidates.length).toBeGreaterThanOrEqual(2);
    });

    it('Scenario 2: scientific calculator with multiple candidate models requires customer review', async () => {
      const result = await service.matchItem('Scientific calculator');

      expect(result.status).toBe(MatchStatus.MATCHED);
      expect(result.isSubstituted).toBe(true);
      expect(result.suggestedCandidates.length).toBeGreaterThanOrEqual(2);
      expect(result.matchReason.toLowerCase()).toContain('multiple');
    });
  });

  describe('Scenario 3: Red ink pen vs red-bodied pen with different ink', () => {
    it('selects variant with Red Ink even if another variant has Red Body with Blue Ink', async () => {
      const result = await service.matchItem('SPEED DUAL TONE Red Ink Pen');

      expect(result.status).toBe(MatchStatus.MATCHED);
      expect(result.matchedProductId).toBe('prod-dual-tone-pen');
      // Must pick the variant with Red Ink ('var-white-body-red-ink'), NOT 'var-red-body-blue-ink'
      expect(result.matchedVariantId).toBe('var-white-body-red-ink');
    });

    it('selects variant with Blue Ink when Blue Ink is explicitly requested', async () => {
      const result = await service.matchItem('SPEED DUAL TONE Blue Ink Pen');

      expect(result.status).toBe(MatchStatus.MATCHED);
      expect(result.matchedProductId).toBe('prod-dual-tone-pen');
      expect(result.matchedVariantId).toBe('var-red-body-blue-ink');
    });
  });

  describe('Scenario 4: Exact 50 cm ruler vs different length', () => {
    it('matches 50 cm ruler as exact match and penalizes 30 cm ruler as size mismatch', async () => {
      const result50 = await service.matchItem('Atlas wooden ruler 50cm');

      expect(result50.status).toBe(MatchStatus.MATCHED);
      expect(result50.matchedProductId).toBe('prod-ruler-50');
      expect(result50.isSubstituted).toBe(false);
      expect(result50.matchConfidence).toBeGreaterThanOrEqual(0.85);

      // 30cm candidate in suggestedCandidates must have size mismatch
      const cand30 = result50.suggestedCandidates.find((c) => c.id === 'prod-ruler-30');
      if (cand30) {
        expect(cand30.score).toBeLessThan(0.60);
      }
    });

    it('matches 30 cm ruler when 30 cm is requested', async () => {
      const result30 = await service.matchItem('Atlas wooden ruler 30cm');

      expect(result30.status).toBe(MatchStatus.MATCHED);
      expect(result30.matchedProductId).toBe('prod-ruler-30');
      expect(result30.isSubstituted).toBe(false);
      expect(result30.matchConfidence).toBeGreaterThanOrEqual(0.85);
    });
  });

  describe('Scenario 5: Ambiguous blue binder gum description', () => {
    it('provides clear explanation that blue may refer to packaging while matching binder gum', async () => {
      const result = await service.matchItem('Blue binder gum');

      expect(result.status).toBe(MatchStatus.MATCHED);
      expect(result.matchedProductId).toBe('prod-binder-gum');
      expect(result.isSubstituted).toBe(true);
      expect(result.matchReason.toLowerCase()).toContain('packaging');
    });
  });

  describe('6. Out-of-stock parent products and variants', () => {
    it('separates product identity confidence from stock availability for out-of-stock parent', async () => {
      const result = await service.matchItem('DOMS NEON PENCILS 10PCS');

      // Product identity confidence remains high because the description matches 1:1
      expect(result.matchConfidence).toBeGreaterThanOrEqual(0.85);
      expect(result.isAvailable).toBe(false);
      expect(result.isSubstituted).toBe(true);
      expect(result.matchReason.toLowerCase()).toContain('out of stock');
    });

    it('accurately represents unavailable variant when requested variant is out of stock', async () => {
      // Requested Red variant has stock: 0
      const result = await service.matchItem('ATLAS GEL PEN 0.7MM Red');

      expect(result.matchedProductId).toBe('prod-variant-out-of-stock');
      expect(result.matchedVariantId).toBe('var-atlas-red-oos');
      expect(result.isAvailable).toBe(false);
      expect(result.isSubstituted).toBe(true);
    });

    it('recommends in-stock variant as available when requested variant has stock', async () => {
      // Requested Blue variant has stock: 50
      const result = await service.matchItem('ATLAS GEL PEN 0.7MM Blue');

      expect(result.matchedProductId).toBe('prod-variant-out-of-stock');
      expect(result.matchedVariantId).toBe('var-atlas-blue-instock');
      expect(result.isAvailable).toBe(true);
    });
  });

  describe('7. Inactive products and variants', () => {
    it('excludes inactive products from catalogue matching', async () => {
      const result = await service.matchItem('DISCONTINUED RETRO PEN');

      expect(result.matchedProductId).not.toBe('prod-inactive');
      expect(result.status).toBe(MatchStatus.UNMATCHED);
    });
  });

  describe('8. Empty or unmatched descriptions', () => {
    it('handles empty string safely', async () => {
      const result = await service.matchItem('');

      expect(result.status).toBe(MatchStatus.UNMATCHED);
      expect(result.matchedProductId).toBeNull();
      expect(result.matchConfidence).toBe(0);
    });

    it('handles whitespace string safely', async () => {
      const result = await service.matchItem('   ');

      expect(result.status).toBe(MatchStatus.UNMATCHED);
      expect(result.matchedProductId).toBeNull();
    });

    it('handles completely unrecognized product safely', async () => {
      const result = await service.matchItem('xyzabc999unknownitem123');

      expect(result.status).toBe(MatchStatus.UNMATCHED);
      expect(result.matchedProductId).toBeNull();
      expect(result.matchConfidence).toBeLessThan(0.40);
    });
  });

  describe('9. Query efficiency and caching', () => {
    it('caches the active catalogue to prevent redundant database fetches across items', async () => {
      await service.matchItem('Speed Rim Ball Pen Blue');
      await service.matchItem('MI GOLD 556N - CALCULATOR');
      await service.matchItem('Kokuyo Camlin Artist Water Colour 12 Cakes');

      // findMany should have been called only ONCE due to caching
      expect(mockPrisma.product.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('10. Explicit customer confirmation workflow', () => {
    it('never confirms items or adds to cart automatically regardless of match score', async () => {
      const exactMatch = await service.matchItem('SPEED RIM Ball Pen Blue');
      expect(exactMatch.matchConfidence).toBeGreaterThanOrEqual(0.85);

      // Match result must never contain confirmed state (isConfirmed belongs strictly to ExtractedStationeryItem)
      expect((exactMatch as any).isConfirmed).toBeUndefined();

      // Confirms match result preserves real IDs for customer review
      expect(exactMatch.matchedProductId).toBe('prod-speed-rim-blue');
      expect(exactMatch.suggestedCandidates[0].priceCents).toBe(2500);
    });
  });

  describe('11. Deterministic alternative product suitability rules', () => {
    it('Scenario 5: Red ballpoint pen cannot be substituted with a blue or black pen', () => {
      const queryAttrs = service.extractAttributes('Speed Fine Red Ballpoint Pen');
      const targetProd = mockCatalogue.find((p) => p.id === 'prod-speed-red-oos');

      const alternatives = service.findSuitableAlternatives(
        targetProd,
        queryAttrs,
        mockCatalogue,
        'Speed Fine Red Ballpoint Pen'
      );

      // Must find an in-stock red ballpoint pen (Atlas Chooty Red or dual-tone red ink variant)
      expect(alternatives.length).toBeGreaterThan(0);
      for (const alt of alternatives) {
        // Must NOT suggest Blue-only pen
        expect(alt.id).not.toBe('prod-speed-rim-blue-only');
        expect(alt.name.toLowerCase()).not.toContain('blue only');
      }

      const atlasRed = alternatives.find((a) => a.id === 'prod-atlas-red-instock');
      expect(atlasRed).toBeDefined();
      expect(atlasRed?.brandName).toBe('Atlas');
    });

    it('Scenario 6: 50 cm ruler cannot be substituted with a 30 cm ruler', () => {
      const queryAttrs = service.extractAttributes('Atlas Wooden Ruler 50cm');
      const targetProd = mockCatalogue.find((p) => p.id === 'prod-ruler-50');

      const alternatives = service.findSuitableAlternatives(
        targetProd,
        queryAttrs,
        mockCatalogue,
        'Atlas Wooden Ruler 50cm'
      );

      expect(alternatives.length).toBeGreaterThan(0);
      // Doms 50cm ruler should be recommended
      const doms50 = alternatives.find((a) => a.id === 'prod-doms-ruler-50-instock');
      expect(doms50).toBeDefined();

      // Atlas 30cm ruler MUST be disqualified despite being a ruler!
      const atlas30 = alternatives.find((a) => a.id === 'prod-ruler-30');
      expect(atlas30).toBeUndefined();
    });

    it('Scenario 7: Scientific calculator cannot be substituted with an ordinary desk calculator', () => {
      const queryAttrs = service.extractAttributes('MI FX82MS Scientific Calculator');
      const targetProd = mockCatalogue.find((p) => p.id === 'prod-fx82ms');

      const alternatives = service.findSuitableAlternatives(
        targetProd,
        queryAttrs,
        mockCatalogue,
        'MI FX82MS Scientific Calculator'
      );

      expect(alternatives.length).toBeGreaterThan(0);
      // Casio fx-82MS scientific calculator must be recommended
      const casioScientific = alternatives.find((a) => a.id === 'prod-casio-scientific');
      expect(casioScientific).toBeDefined();

      // Ordinary desk calculator (Amigo 201N) MUST be disqualified!
      const deskCalc = alternatives.find((a) => a.id === 'prod-desk-calc-amigo');
      expect(deskCalc).toBeUndefined();
    });

    it('Scenario 8: Alternative products with 0 stock are never suggested as available alternatives', () => {
      const queryAttrs = service.extractAttributes('Atlas Chooty Red Ballpoint Pen');
      const targetProd = mockCatalogue.find((p) => p.id === 'prod-atlas-red-instock');

      const alternatives = service.findSuitableAlternatives(
        targetProd,
        queryAttrs,
        mockCatalogue,
        'Atlas Chooty Red Ballpoint Pen'
      );

      // Out-of-stock Speed Red pen must NEVER be suggested
      const speedRedOos = alternatives.find((a) => a.id === 'prod-speed-red-oos');
      expect(speedRedOos).toBeUndefined();

      for (const alt of alternatives) {
        expect(alt.stockQuantity).toBeGreaterThan(0);
        expect(alt.isAvailable).toBe(true);
      }
    });

    it('Scenario 9: Suitable alternative from another brand is offered when original brand is unavailable', async () => {
      const result = await service.matchItem('Speed Fine Red Ballpoint Pen');

      // The requested product is matched but out of stock
      expect(result.matchedProductId).toBe('prod-speed-red-oos');
      expect(result.isAvailable).toBe(false);

      // Alternatives should feature Atlas Red Ballpoint Pen from a different brand
      expect(result.suggestedAlternatives).toBeDefined();
      expect(result.suggestedAlternatives!.length).toBeGreaterThan(0);
      const crossBrandAlt = result.suggestedAlternatives!.find(
        (a) => a.brandName === 'Atlas' && a.id === 'prod-atlas-red-instock'
      );
      expect(crossBrandAlt).toBeDefined();
      expect(crossBrandAlt?.specDifferences).toContain('Alternative brand: Atlas');
      expect(crossBrandAlt?.specDifferences).toContain('Red ink');
    });
  });
});
