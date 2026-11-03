import { Product } from '@/types/product';
import { RecommendationPreferences, RecommendationResultItem, StationeryPersona } from '@/types/upload';
import { productService } from './productService';

export interface PersonaRule {
  persona: StationeryPersona;
  gradeLevels?: string[];
  rules: {
    productSlug: string;
    recommendedQty: number;
    reason: string;
    priority: number;
  }[];
}

export const STATIONERY_RULES: PersonaRule[] = [
  {
    persona: 'school',
    gradeLevels: ['Grade 1-2', 'Grade 3-5'],
    rules: [
      { productSlug: 'nataraj-621-ruby-pencils-pack-10', recommendedQty: 2, reason: 'Primary essential dark writing pencils with erasers', priority: 1 },
      { productSlug: 'atlas-cr-book-120-pages-single-line', recommendedQty: 4, reason: 'Standard exercise books for daily classroom notes', priority: 2 },
      { productSlug: 'staedtler-mars-plastic-latex-free-eraser-3', recommendedQty: 1, reason: 'Clean non-smudge erasing for young learners', priority: 3 },
      { productSlug: 'faber-castell-tri-grip-colour-pencils-24', recommendedQty: 1, reason: 'Art and colouring activity lessons', priority: 4 },
    ],
  },
  {
    persona: 'school',
    gradeLevels: ['Grade 6-9', 'O/L (Grade 10-11)', 'A/L Science', 'A/L Commerce'],
    rules: [
      { productSlug: 'atlas-cr-book-120-pages-single-line', recommendedQty: 6, reason: 'Essential 120-page ruled notebooks for each subject', priority: 1 },
      { productSlug: 'atlas-cr-book-120-pages-square-rule', recommendedQty: 2, reason: 'Quad grid notebook for Mathematics & Science graphs', priority: 2 },
      { productSlug: 'atlas-chooty-ballpoint-pen-pack-10', recommendedQty: 2, reason: 'Reliable smooth-flow blue pens for note taking & tests', priority: 3 },
      { productSlug: 'atlas-premier-mathematical-instrument-box', recommendedQty: 1, reason: 'Geometric construction tools & protractor', priority: 4 },
      { productSlug: 'faber-castell-pastel-textliner-set-6', recommendedQty: 1, reason: 'Non-bleed text highlighting for exam summaries', priority: 5 },
    ],
  },
  {
    persona: 'university',
    rules: [
      { productSlug: 'promate-executive-spiral-notebook-160p', recommendedQty: 3, reason: 'Durable twin-wire notebook for lecture notes', priority: 1 },
      { productSlug: 'atlas-chooty-ballpoint-pen-pack-10', recommendedQty: 1, reason: 'Long-life pens for writing fast tutorial notes', priority: 2 },
      { productSlug: 'faber-castell-pastel-textliner-set-6', recommendedQty: 1, reason: 'Soft pastels for reviewing research papers', priority: 3 },
      { productSlug: 'dsl-signature-multi-pocket-canvas-pencil-case', recommendedQty: 1, reason: 'Compact organizer for campus bag', priority: 4 },
    ],
  },
  {
    persona: 'office',
    rules: [
      { productSlug: 'double-a-a4-80gsm-copier-paper-500-sheets', recommendedQty: 2, reason: 'High-speed jam-free documentation printing', priority: 1 },
      { productSlug: 'kangaro-stapler-10-with-pins-box', recommendedQty: 1, reason: 'Sturdy document binding for invoices and reports', priority: 2 },
      { productSlug: 'promate-executive-spiral-notebook-160p', recommendedQty: 2, reason: 'Professional executive meeting journal', priority: 3 },
      { productSlug: 'atlas-chooty-ballpoint-pen-pack-10', recommendedQty: 2, reason: 'Everyday office ballpoint pens', priority: 4 },
    ],
  },
  {
    persona: 'art_craft',
    rules: [
      { productSlug: 'faber-castell-tri-grip-colour-pencils-24', recommendedQty: 1, reason: '24 rich vivid shades with break-resistant leads', priority: 1 },
      { productSlug: 'staedtler-mars-plastic-latex-free-eraser-3', recommendedQty: 1, reason: 'Residue-free art eraser for sketching', priority: 2 },
      { productSlug: 'nataraj-621-ruby-pencils-pack-10', recommendedQty: 1, reason: 'HB sketching pencils', priority: 3 },
      { productSlug: 'faber-castell-pastel-textliner-set-6', recommendedQty: 1, reason: 'Pastel accent highlighting', priority: 4 },
    ],
  },
  {
    persona: 'gift',
    rules: [
      { productSlug: 'dsl-signature-multi-pocket-canvas-pencil-case', recommendedQty: 1, reason: 'Aesthetic premium canvas organizer', priority: 1 },
      { productSlug: 'promate-executive-spiral-notebook-160p', recommendedQty: 1, reason: 'Luxury twin-wire executive journal', priority: 2 },
      { productSlug: 'faber-castell-pastel-textliner-set-6', recommendedQty: 1, reason: 'Aesthetic pastel 6-piece highlighter set', priority: 3 },
      { productSlug: 'atlas-premier-mathematical-instrument-box', recommendedQty: 1, reason: 'Premier boxed stationery kit', priority: 4 },
    ],
  },
];

class RecommendationService {
  public getRecommendations(preferences: RecommendationPreferences): RecommendationResultItem[] {
    const allProducts = productService.getAll();
    let matchingRules = STATIONERY_RULES.filter((r) => r.persona === preferences.persona);

    if (preferences.persona === 'school' && preferences.grade) {
      const gradeSpecific = matchingRules.find((r) => r.gradeLevels?.includes(preferences.grade!));
      if (gradeSpecific) {
        matchingRules = [gradeSpecific];
      }
    }

    const items: RecommendationResultItem[] = [];

    matchingRules.forEach((ruleGroup) => {
      ruleGroup.rules.forEach((rule) => {
        const product = allProducts.find((p) => p.slug === rule.productSlug);
        if (product && product.stockQuantity > 0) {
          const qty = rule.recommendedQty;
          const subtotalCents = product.priceCents * qty;

          items.push({
            product,
            quantity: qty,
            unitPriceCents: product.priceCents,
            subtotalCents,
            selected: true,
            reason: rule.reason,
          });
        }
      });
    });

    return items;
  }
}

export const recommendationService = new RecommendationService();
