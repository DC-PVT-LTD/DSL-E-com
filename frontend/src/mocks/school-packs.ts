import { SchoolPack } from '@/types/school-pack';

export const INITIAL_SCHOOL_PACKS: SchoolPack[] = [
  {
    id: 'pack-g1-essential',
    name: 'Grade 1-2 Junior Essential Pack',
    slug: 'grade-1-2-junior-essential-pack',
    grade: 'Grade 1-2',
    tier: 'essential',
    description: 'Basic essential starter kit for Grade 1 and 2 students containing primary writing pencils, non-toxic erasers, beginner exercise books, and safety scissors.',
    savingsPercentage: 12,
    totalPriceCents: 185000, // LKR 1,850.00
    isActive: true,
    items: [
      {
        id: 'pi-1',
        productId: 'prod-nataraj-621-pencils',
        productName: 'Nataraj 621 Ruby Pencils Pack (10 Pencils + Eraser)',
        defaultQuantity: 1,
        unitPriceCents: 32000,
      },
      {
        id: 'pi-2',
        productId: 'prod-cr-120-single',
        productName: 'Atlas Single Line Books (80 Pages)',
        defaultQuantity: 3,
        unitPriceCents: 35000,
        substitutes: [
          {
            productId: 'prod-cr-120-single',
            productName: 'Promate Single Line Books (80 Pages)',
            unitPriceCents: 38000,
          },
        ],
      },
      {
        id: 'pi-3',
        productId: 'prod-staedtler-mars-eraser',
        productName: 'Staedtler Mars Plastic Latex-Free Eraser',
        defaultQuantity: 1,
        unitPriceCents: 49000,
      },
    ],
  },
  {
    id: 'pack-g6-standard',
    name: 'Grade 6-9 Middle School Standard Pack',
    slug: 'grade-6-9-middle-school-standard-pack',
    grade: 'Grade 6-9',
    tier: 'standard',
    description: 'Comprehensive annual stationery bundle for secondary school students including CR books, geometry kit, ballpoint pen sets, and highlighters.',
    savingsPercentage: 15,
    totalPriceCents: 465000, // LKR 4,650.00
    isActive: true,
    items: [
      {
        id: 'pi-4',
        productId: 'prod-cr-120-single',
        productName: 'Atlas CR Book 120 Pages - Single Line',
        defaultQuantity: 6,
        unitPriceCents: 42000,
      },
      {
        id: 'pi-5',
        productId: 'prod-cr-120-square',
        productName: 'Atlas CR Book 120 Pages - Square Rule',
        defaultQuantity: 2,
        unitPriceCents: 43000,
      },
      {
        id: 'pi-6',
        productId: 'prod-atlas-chooty-pen',
        productName: 'Atlas Chooty Ballpoint Pen Pack of 10 (Blue)',
        defaultQuantity: 1,
        unitPriceCents: 35000,
      },
      {
        id: 'pi-7',
        productId: 'prod-atlas-geometry-box',
        productName: 'Atlas Premier Mathematical Instrument Box',
        defaultQuantity: 1,
        unitPriceCents: 85000,
      },
    ],
  },
  {
    id: 'pack-ol-premium',
    name: 'G.C.E. O/L Scholar Premium Pack',
    slug: 'gce-ol-scholar-premium-pack',
    grade: 'O/L (Grade 10-11)',
    tier: 'premium',
    description: 'All-inclusive exam revision and school year kit for O/L candidates. Comes with CR books, high-capacity pen bundles, pastel textliners, and canvas organizer.',
    savingsPercentage: 18,
    totalPriceCents: 745000, // LKR 7,450.00
    isActive: true,
    items: [
      {
        id: 'pi-8',
        productId: 'prod-cr-120-single',
        productName: 'Atlas CR Book 120 Pages - Single Line',
        defaultQuantity: 8,
        unitPriceCents: 42000,
      },
      {
        id: 'pi-9',
        productId: 'prod-atlas-chooty-pen',
        productName: 'Atlas Chooty Ballpoint Pen Pack of 10',
        defaultQuantity: 2,
        unitPriceCents: 35000,
      },
      {
        id: 'pi-10',
        productId: 'prod-faber-textliner-pastel',
        productName: 'Faber-Castell Pastel Textliner Highlighter Set of 6',
        defaultQuantity: 1,
        unitPriceCents: 165000,
      },
      {
        id: 'pi-11',
        productId: 'prod-atlas-geometry-box',
        productName: 'Atlas Premier Mathematical Instrument Box',
        defaultQuantity: 1,
        unitPriceCents: 85000,
      },
      {
        id: 'pi-12',
        productId: 'prod-dsl-aesthetic-pouch',
        productName: 'DSL Signature Multi-Pocket Canvas Pencil Case',
        defaultQuantity: 1,
        unitPriceCents: 125000,
      },
    ],
  },
  {
    id: 'pack-al-science',
    name: 'G.C.E. A/L Science & Maths Intensive Pack',
    slug: 'gce-al-science-maths-intensive-pack',
    grade: 'A/L Science',
    tier: 'standard',
    description: 'Designed specifically for Biology, Chemistry, Physics, and Combined Maths students with hardbound CR books, graph sheets, fineliners, and highlighters.',
    savingsPercentage: 16,
    totalPriceCents: 680000, // LKR 6,800.00
    isActive: true,
    items: [
      {
        id: 'pi-13',
        productId: 'prod-cr-120-single',
        productName: 'Atlas CR Book 120 Pages - Single Line',
        defaultQuantity: 8,
        unitPriceCents: 42000,
      },
      {
        id: 'pi-14',
        productId: 'prod-cr-120-square',
        productName: 'Atlas CR Book 120 Pages - Square Rule',
        defaultQuantity: 4,
        unitPriceCents: 43000,
      },
      {
        id: 'pi-15',
        productId: 'prod-faber-textliner-pastel',
        productName: 'Faber-Castell Pastel Textliner Highlighter Set of 6',
        defaultQuantity: 1,
        unitPriceCents: 165000,
      },
    ],
  },
];
