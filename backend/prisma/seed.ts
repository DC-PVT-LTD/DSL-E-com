import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ==============================================================================
// DSL Stationery — Phase 3 Seed Script (dsl.lk Verified Catalog)
// ==============================================================================

async function main() {
  console.log('🌱 Starting DSL Stationery database seed...\n');

  // ----------------------------------------------------------------------------
  // 1. Seed StoreSettings Singleton
  // ----------------------------------------------------------------------------
  console.log('📦 Seeding StoreSettings...');
  await prisma.storeSettings.upsert({
    where: { id: 'default' },
    update: {
      flatDeliveryFeeCents: 35000,       // Rs. 350.00
      freeDeliveryThresholdCents: 500000, // Rs. 5,000.00
      hotlinePhone: '+94 114 963 069',
      whatsappNumber: '+94 772 355 530',
      contactEmail: 'info@dsltrading.com',
      codEnabled: true,
      bankTransferEnabled: true,
      onlineCardEnabled: false,
    },
    create: {
      id: 'default',
      flatDeliveryFeeCents: 35000,
      freeDeliveryThresholdCents: 500000,
      hotlinePhone: '+94 114 963 069',
      whatsappNumber: '+94 772 355 530',
      contactEmail: 'info@dsltrading.com',
      codEnabled: true,
      bankTransferEnabled: true,
      onlineCardEnabled: false,
    },
  });

  // ----------------------------------------------------------------------------
  // 2. Seed 15 Verified Categories from https://www.dsl.lk/
  // ----------------------------------------------------------------------------
  console.log('📦 Seeding Categories (15 categories)...');
  const categories = [
    {
      id: 'cat-pens',
      name: 'Pens',
      slug: 'pens',
      description: 'Ballpoint pens, gel pens, signature pens, and pen gift packs.',
      iconName: 'PenTool',
      featured: true,
      displayOrder: 1,
    },
    {
      id: 'cat-pencils',
      name: 'Pencils',
      slug: 'pencils',
      description: 'Graphite writing pencils, Little Hearts pencils, colour pencils, and oil pastels.',
      iconName: 'Edit3',
      featured: true,
      displayOrder: 2,
    },
    {
      id: 'cat-markers',
      name: 'Markers',
      slug: 'markers',
      description: 'Whiteboard markers, permanent markers, CD/OHP markers, and refill inks.',
      iconName: 'Highlighter',
      featured: true,
      displayOrder: 3,
    },
    {
      id: 'cat-highlighters',
      name: 'Highlighters',
      slug: 'highlighters',
      description: 'Vibrant and soft pastel textliners for office, university, and school study.',
      iconName: 'Sparkles',
      featured: true,
      displayOrder: 4,
    },
    {
      id: 'cat-fabric-paint',
      name: 'Fabric Paint',
      slug: 'fabric-paint',
      description: 'Creative textile paints for apparel, craft, and school art assignments.',
      iconName: 'Palette',
      featured: false,
      displayOrder: 5,
    },
    {
      id: 'cat-banner-paint',
      name: 'Banner Paint',
      slug: 'banner-paint',
      description: 'Large format poster and banner paints for events, notices, and commercial display.',
      iconName: 'Layers',
      featured: false,
      displayOrder: 6,
    },
    {
      id: 'cat-water-colour',
      name: 'Water Colour',
      slug: 'water-colour',
      description: 'Artist cake watercolours and concentrated tube colour sets.',
      iconName: 'Droplet',
      featured: true,
      displayOrder: 7,
    },
    {
      id: 'cat-erasers',
      name: 'Erasers',
      slug: 'erasers',
      description: 'Dust-free, non-toxic vinyl and latex-free erasers for neat corrections.',
      iconName: 'Eraser',
      featured: false,
      displayOrder: 8,
    },
    {
      id: 'cat-sharpeners',
      name: 'Sharpeners',
      slug: 'sharpeners',
      description: 'Precision single and dual-hole pencil sharpeners with anti-mess containers.',
      iconName: 'Scissors',
      featured: false,
      displayOrder: 9,
    },
    {
      id: 'cat-rulers',
      name: 'Rulers',
      slug: 'rulers',
      description: '15cm and 30cm transparent acrylic, steel, and flexible measuring rulers.',
      iconName: 'Ruler',
      featured: false,
      displayOrder: 10,
    },
    {
      id: 'cat-correction-pens',
      name: 'Correction Pens',
      slug: 'correction-pens',
      description: 'Fine metal-tip fluid correction pens for instant, opaque white coverage.',
      iconName: 'CheckCircle',
      featured: false,
      displayOrder: 11,
    },
    {
      id: 'cat-tapes',
      name: 'Tapes & Adhesives',
      slug: 'tapes-and-adhesives',
      description: 'Clear stationery tapes, masking tapes, craft glue, and double-sided tapes.',
      iconName: 'Paperclip',
      featured: false,
      displayOrder: 12,
    },
    {
      id: 'cat-clay',
      name: 'Clay & Modelling',
      slug: 'clay-and-modelling',
      description: 'Non-toxic modelling clay and natural creative clay for young learners.',
      iconName: 'Box',
      featured: true,
      displayOrder: 13,
    },
    {
      id: 'cat-calculators',
      name: 'Calculators',
      slug: 'calculators',
      description: 'Desktop commercial calculators and multi-function scientific calculators.',
      iconName: 'Calculator',
      featured: true,
      displayOrder: 14,
    },
    {
      id: 'cat-diapers',
      name: 'Diapers',
      slug: 'diapers',
      description: 'Comfortable, absorbent baby diapers under the Wetex brand distributed by DSL.',
      iconName: 'Package',
      featured: false,
      displayOrder: 15,
    },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: cat,
      create: cat,
    });
  }

  // ----------------------------------------------------------------------------
  // 3. Seed 10 Approved Brands from https://www.dsl.lk/
  // ----------------------------------------------------------------------------
  console.log('📦 Seeding Brands (10 brands)...');
  const brands = [
    {
      id: 'brand-speed',
      name: 'Speed',
      slug: 'speed',
      originCountry: 'Sri Lanka',
      description: "DSL's proprietary brand, creators of the Speed RIM ball pen and partners of the Lady Ridgeway Hospital Little Hearts project.",
      featured: true,
    },
    {
      id: 'brand-linc',
      name: 'Linc',
      slug: 'linc',
      originCountry: 'India',
      description: 'Renowned low-viscosity ink pens including Linc Pentonic, Ocean Slim, and Shine Glitter.',
      featured: true,
    },
    {
      id: 'brand-luxor',
      name: 'Luxor',
      slug: 'luxor',
      originCountry: 'India',
      description: 'Highlighters, whiteboard markers, permanent markers, and marker refill inks.',
      featured: true,
    },
    {
      id: 'brand-doms',
      name: 'Doms',
      slug: 'doms',
      originCountry: 'India',
      description: 'Premier colour pencils, erasers, sharpeners, and vibrant art supplies for students.',
      featured: true,
    },
    {
      id: 'brand-camlin',
      name: 'Kokuyo Camlin',
      slug: 'kokuyo-camlin',
      originCountry: 'India',
      description: 'Artist water colours, poster paints, geometry instrument boxes, and Little Hearts pencils.',
      featured: true,
    },
    {
      id: 'brand-fine',
      name: 'Fine',
      slug: 'fine',
      originCountry: 'India',
      description: 'Precision fine-tip pens, gel pens, and school writing stationery.',
      featured: false,
    },
    {
      id: 'brand-wetex',
      name: 'Wetex',
      slug: 'wetex',
      originCountry: 'Sri Lanka',
      description: 'Essential tapes, adhesives, fabric paints, and baby diapers.',
      featured: false,
    },
    {
      id: 'brand-lido',
      name: 'Lido',
      slug: 'lido',
      originCountry: 'South Korea',
      description: 'Non-toxic modelling clay and natural creative educational materials.',
      featured: true,
    },
    {
      id: 'brand-hp',
      name: 'HP',
      slug: 'hp',
      originCountry: 'Global',
      description: 'High performance printing paper and office copier reams.',
      featured: false,
    },
    {
      id: 'brand-amigo',
      name: 'Amigo',
      slug: 'amigo',
      originCountry: 'Sri Lanka',
      description: 'Precision electronic desktop and scientific calculators distributed across Sri Lanka by DSL.',
      featured: true,
    },
  ];

  for (const b of brands) {
    await prisma.brand.upsert({
      where: { id: b.id },
      update: b,
      create: b,
    });
  }

  // ----------------------------------------------------------------------------
  // 4. Seed Representative Demo Products (Verified from https://www.dsl.lk/)
  // ----------------------------------------------------------------------------
  console.log('📦 Seeding Products (8 verified representative products)...');
  const products = [
    {
      id: 'prod-speed-rim-blue',
      name: 'SPEED RIM Ball Pen Blue',
      slug: 'speed-rim-ball-pen-blue',
      sku: 'DSL-SPEED-RIM-BLUE',
      barcode: '4792026001018', // [Placeholder: Needs Approval]
      description: 'The iconic Speed RIM ballpoint pen with smooth low-friction ink, secure clip cap, and comfortable grip for daily school and office writing.',
      shortDescription: 'Classic 0.7mm smooth writing blue ballpoint pen from Speed.',
      categoryId: 'cat-pens',
      brandId: 'brand-speed',
      priceCents: 2500, // Verified Rs. 25.00 on dsl.lk
      compareAtPriceCents: 3000,
      costPriceCents: 1600,
      stockQuantity: 500,
      lowStockThreshold: 50,
      isActive: true,
      isFeatured: true,
      isBestSeller: true,
      images: ['/products/speed-rim-blue.png'],
      tags: ['pen', 'ballpoint', 'speed', 'blue', 'dsl', 'school', 'office'],
      rating: 5.0,
      reviewCount: 34,
      specifications: {
        'Tip Size': '0.7mm',
        'Ink Color': 'Blue',
        'Origin': 'Sri Lanka',
      },
    },
    {
      id: 'prod-speed-rim-black',
      name: 'SPEED RIM Ball Pen Black',
      slug: 'speed-rim-ball-pen-black',
      sku: 'DSL-SPEED-RIM-BLACK',
      barcode: '4792026001025', // [Placeholder: Needs Approval]
      description: 'Speed RIM black ball pen providing dark, smudge-resistant lines for contracts, examinations, and official record keeping.',
      shortDescription: 'Classic 0.7mm smooth writing black ballpoint pen from Speed.',
      categoryId: 'cat-pens',
      brandId: 'brand-speed',
      priceCents: 2500, // Verified Rs. 25.00 on dsl.lk
      compareAtPriceCents: 3000,
      costPriceCents: 1600,
      stockQuantity: 450,
      lowStockThreshold: 50,
      isActive: true,
      isFeatured: false,
      isBestSeller: true,
      images: ['/products/speed-rim-black.png'],
      tags: ['pen', 'ballpoint', 'speed', 'black', 'dsl', 'exam'],
      rating: 4.9,
      reviewCount: 28,
      specifications: {
        'Tip Size': '0.7mm',
        'Ink Color': 'Black',
        'Origin': 'Sri Lanka',
      },
    },
    {
      id: 'prod-linc-shine-glitter-5',
      name: 'Linc Shine Glitter Pen (5 Pcs Pack)',
      slug: 'linc-shine-glitter-pen-5-pcs-pack',
      sku: 'DSL-LINC-SHINE-GLIT-5P',
      barcode: '8904106821051', // [Placeholder: Needs Approval]
      description: 'Linc Shine Glitter Gel Pens offer shimmering ink flows with smooth tips, ideal for scrapbooking, project titles, bullet journals, and party decor.',
      shortDescription: 'Sparkling assorted glitter gel pens pack of 5 for craft, greeting cards, and creative art.',
      categoryId: 'cat-pens',
      brandId: 'brand-linc',
      priceCents: 55000, // Verified Rs. 550.00 on dsl.lk
      compareAtPriceCents: 60000,
      costPriceCents: 38000,
      stockQuantity: 120,
      lowStockThreshold: 20,
      isActive: true,
      isFeatured: true,
      isNewArrival: true,
      images: ['/products/linc-shine-glitter.png'],
      tags: ['glitter pen', 'linc', 'gel pen', 'craft', 'art', 'colours'],
      rating: 4.8,
      reviewCount: 19,
      specifications: {
        'Pack Size': '5 Pens',
        'Ink Finish': 'Glitter Metallic',
        'Brand': 'Linc',
      },
    },
    {
      id: 'prod-amigo-mi-201n',
      name: 'AMIGO MI 201N Basic Calculator',
      slug: 'amigo-mi-201n-basic-calculator',
      sku: 'DSL-AMIGO-MI-201N',
      barcode: '4792026002015', // [Placeholder: Needs Approval]
      description: 'The Amigo MI 201N provides clear angled LCD display, dual solar/battery power, comfortable plastic keys, and basic arithmetic functions.',
      shortDescription: 'Compact 8-digit desktop electronic calculator for daily retail and office math.',
      categoryId: 'cat-calculators',
      brandId: 'brand-amigo',
      priceCents: 59000, // Verified Rs. 590.00 on dsl.lk
      compareAtPriceCents: 65000,
      costPriceCents: 41000,
      stockQuantity: 75,
      lowStockThreshold: 10,
      isActive: true,
      isFeatured: false,
      isBestSeller: true,
      images: ['/products/amigo-mi-201n.png'],
      tags: ['calculator', 'amigo', 'electronic', 'office', 'desktop', 'dsl'],
      rating: 4.7,
      reviewCount: 15,
      specifications: {
        'Display Digits': '8 Digits',
        'Power Source': 'Dual Solar & Battery',
        'Model': 'MI 201N',
      },
    },
    {
      id: 'prod-amigo-fx82ms',
      name: 'AMIGO FX82MS Scientific Calculator',
      slug: 'amigo-fx82ms-scientific-calculator',
      sku: 'DSL-AMIGO-FX82MS',
      barcode: '4792026002022', // [Placeholder: Needs Approval]
      description: 'Amigo FX82MS features 240 scientific functions, 10+2 digit display, statistical calculations, permutations, combinations, and fractions.',
      shortDescription: '2-line display scientific calculator for secondary school and engineering students.',
      categoryId: 'cat-calculators',
      brandId: 'brand-amigo',
      priceCents: 290000, // Verified Rs. 2,900.00 on dsl.lk
      compareAtPriceCents: 320000,
      costPriceCents: 210000,
      stockQuantity: 60,
      lowStockThreshold: 10,
      isActive: true,
      isFeatured: true,
      isBestSeller: true,
      images: ['/products/amigo-fx82ms.png'],
      tags: ['calculator', 'scientific', 'amigo', 'ol', 'al', 'engineering', 'maths'],
      rating: 5.0,
      reviewCount: 42,
      specifications: {
        'Functions': '240 Functions',
        'Display': '2-line LCD',
        'Model': 'FX82MS',
      },
    },
    {
      id: 'prod-lido-clay-6',
      name: 'Lido Modeling Clay 6 Colours',
      slug: 'lido-modeling-clay-6-colours',
      sku: 'DSL-LIDO-CLAY-6C',
      barcode: '8809123450062', // [Placeholder: Needs Approval]
      description: 'Lido soft modeling clay imported from South Korea. Safe, non-hardening, non-toxic, and reusable formula for early childhood sensory development.',
      shortDescription: 'Non-toxic vibrant South Korean modeling clay 6-color set for children and creative crafts.',
      categoryId: 'cat-clay',
      brandId: 'brand-lido',
      priceCents: 38000, // Verified Rs. 380.00 on dsl.lk
      compareAtPriceCents: 42000,
      costPriceCents: 26000,
      stockQuantity: 90,
      lowStockThreshold: 15,
      isActive: true,
      isFeatured: true,
      isNewArrival: false,
      images: ['/products/lido-clay-6.png'],
      tags: ['clay', 'modelling clay', 'lido', 'kids', 'craft', 'korea', 'preschool'],
      rating: 4.9,
      reviewCount: 22,
      specifications: {
        'Colors': '6 Assorted Shades',
        'Safety': 'Non-Toxic Child Safe',
        'Origin': 'South Korea',
      },
    },
    {
      id: 'prod-doms-colour-12',
      name: 'Doms 12 Colour Pencils Set',
      slug: 'doms-12-colour-pencils-set',
      sku: 'DSL-DOMS-CP-12',
      barcode: '8908001001124', // [Placeholder: Needs Approval]
      description: 'Doms colour pencils crafted with superior soft-treated wood for effortless sharpening and rich pigment laydown for school art assignments.',
      shortDescription: 'High-pigment bright 12-shade half-length wooden colour pencils with sharpener.',
      categoryId: 'cat-pencils',
      brandId: 'brand-doms',
      priceCents: 42000, // Verified Rs. 420.00 on dsl.lk
      compareAtPriceCents: 46000,
      costPriceCents: 29000,
      stockQuantity: 150,
      lowStockThreshold: 25,
      isActive: true,
      isFeatured: true,
      isBestSeller: true,
      images: ['/products/doms-colour-12.png'],
      tags: ['colour pencils', 'doms', 'art', 'drawing', 'school', 'kids'],
      rating: 4.9,
      reviewCount: 56,
      specifications: {
        'Shades': '12 Colours',
        'Lead Type': 'Soft Pigment',
        'Brand': 'Doms',
      },
    },
    {
      id: 'prod-camlin-water-colour-12',
      name: 'Kokuyo Camlin Artist Water Colour 12 Cakes',
      slug: 'kokuyo-camlin-artist-water-colour-12-cakes',
      sku: 'DSL-CAMLIN-WC-12',
      barcode: '8901425001218', // [Placeholder: Needs Approval]
      description: 'Kokuyo Camlin student water colour set featuring smooth flow, lightfast transparent pigments, and an integrated mixing palette.',
      shortDescription: '12 vibrant cake watercolours with a quality round painting brush in sturdy palette.',
      categoryId: 'cat-water-colour',
      brandId: 'brand-camlin',
      priceCents: 65000, // Verified Rs. 650.00 on dsl.lk
      compareAtPriceCents: 72000,
      costPriceCents: 45000,
      stockQuantity: 85,
      lowStockThreshold: 15,
      isActive: true,
      isFeatured: true,
      isBestSeller: true,
      images: ['/products/camlin-water-colour-12.png'],
      tags: ['water colour', 'camlin', 'paint', 'art', 'palette', 'school'],
      rating: 4.8,
      reviewCount: 31,
      specifications: {
        'Cake Count': '12 Cakes',
        'Accessories': '1 Brush included',
        'Brand': 'Kokuyo Camlin',
      },
    },
  ];

  for (const prod of products) {
    await prisma.product.upsert({
      where: { id: prod.id },
      update: prod,
      create: prod,
    });
  }

  console.log('\n✅ Database seed completed successfully!');
  console.log(`- Categories seeded: ${categories.length}`);
  console.log(`- Brands seeded: ${brands.length}`);
  console.log(`- Products seeded: ${products.length}`);
  console.log('- StoreSettings initialized');
}

main()
  .catch((e) => {
    console.error('❌ Error executing database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
