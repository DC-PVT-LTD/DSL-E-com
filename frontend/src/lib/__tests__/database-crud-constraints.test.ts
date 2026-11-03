import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../prisma';
import { Prisma } from '@/generated/prisma';

describe('Database CRUD and Constraints Verification', () => {
  const TEST_CAT_ID = 'test-cat-notebooks';
  const TEST_CAT_SLUG = 'test-stationery-notebooks';
  const TEST_BRAND_ID = 'test-brand-apex';
  const TEST_BRAND_SLUG = 'test-apex-stationery';
  const TEST_PROD_ID = 'test-prod-apex-notebook';
  const TEST_PROD_SKU = 'TEST-APEX-NB-01';
  const TEST_PROD_SLUG = 'test-apex-ruled-notebook';
  const TEST_VAR_ID = 'test-var-apex-blue';
  const TEST_VAR_SKU = 'TEST-APEX-NB-01-BLU';

  // Safe cleanup helper that only targets test records with "test-" prefix
  async function cleanupTestData() {
    try {
      await prisma.productVariant.deleteMany({
        where: { id: { startsWith: 'test-' } },
      });
      await prisma.product.deleteMany({
        where: { id: { startsWith: 'test-' } },
      });
      await prisma.category.deleteMany({
        where: { id: { startsWith: 'test-' } },
      });
      await prisma.brand.deleteMany({
        where: { id: { startsWith: 'test-' } },
      });
    } catch {
      // Ignore cleanup errors during teardown
    }
  }

  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  // --------------------------------------------------------------------------
  // 1. Category CRUD
  // --------------------------------------------------------------------------
  describe('Category CRUD operations', () => {
    it('creates, reads, updates, and deletes an isolated test category', async () => {
      // CREATE
      const created = await prisma.category.create({
        data: {
          id: TEST_CAT_ID,
          name: 'Test Notebooks Category',
          slug: TEST_CAT_SLUG,
          description: 'Category for testing CRUD operations',
          displayOrder: 99,
          featured: false,
        },
      });
      expect(created.id).toBe(TEST_CAT_ID);
      expect(created.name).toBe('Test Notebooks Category');

      // READ (findUnique)
      const fetched = await prisma.category.findUnique({
        where: { slug: TEST_CAT_SLUG },
      });
      expect(fetched).not.toBeNull();
      expect(fetched?.id).toBe(TEST_CAT_ID);

      // UPDATE
      const updated = await prisma.category.update({
        where: { id: TEST_CAT_ID },
        data: {
          name: 'Updated Test Notebooks',
          displayOrder: 100,
        },
      });
      expect(updated.name).toBe('Updated Test Notebooks');
      expect(updated.displayOrder).toBe(100);

      // DELETE
      const deleted = await prisma.category.delete({
        where: { id: TEST_CAT_ID },
      });
      expect(deleted.id).toBe(TEST_CAT_ID);

      // Verify deletion
      const checkDeleted = await prisma.category.findUnique({
        where: { id: TEST_CAT_ID },
      });
      expect(checkDeleted).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 2. Brand CRUD
  // --------------------------------------------------------------------------
  describe('Brand CRUD operations', () => {
    it('creates, reads, updates, and deletes an isolated test brand', async () => {
      // CREATE
      const created = await prisma.brand.create({
        data: {
          id: TEST_BRAND_ID,
          name: 'Apex Test Brand',
          slug: TEST_BRAND_SLUG,
          originCountry: 'Sri Lanka',
          description: 'A test brand for CRUD validation',
          featured: false,
        },
      });
      expect(created.id).toBe(TEST_BRAND_ID);
      expect(created.originCountry).toBe('Sri Lanka');

      // READ
      const fetched = await prisma.brand.findUnique({
        where: { id: TEST_BRAND_ID },
      });
      expect(fetched?.slug).toBe(TEST_BRAND_SLUG);

      // UPDATE
      const updated = await prisma.brand.update({
        where: { id: TEST_BRAND_ID },
        data: {
          description: 'Updated brand description',
          featured: true,
        },
      });
      expect(updated.description).toBe('Updated brand description');
      expect(updated.featured).toBe(true);

      // DELETE
      const deleted = await prisma.brand.delete({
        where: { id: TEST_BRAND_ID },
      });
      expect(deleted.id).toBe(TEST_BRAND_ID);

      const checkDeleted = await prisma.brand.findUnique({
        where: { id: TEST_BRAND_ID },
      });
      expect(checkDeleted).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 3. Product & ProductVariant CRUD with Relations
  // --------------------------------------------------------------------------
  describe('Product and Variant CRUD with relations', () => {
    it('creates product with relations, adds variant, updates, and deletes cleanly', async () => {
      // Setup prerequisites
      const category = await prisma.category.create({
        data: {
          id: TEST_CAT_ID,
          name: 'Test Category Rel',
          slug: TEST_CAT_SLUG,
          description: 'Prerequisite category for product relation testing',
        },
      });

      const brand = await prisma.brand.create({
        data: {
          id: TEST_BRAND_ID,
          name: 'Test Brand Rel',
          slug: TEST_BRAND_SLUG,
          originCountry: 'India',
          description: 'Prerequisite brand for product relation testing',
        },
      });

      // CREATE Product
      const product = await prisma.product.create({
        data: {
          id: TEST_PROD_ID,
          name: 'Test Ruled Notebook 120P',
          slug: TEST_PROD_SLUG,
          sku: TEST_PROD_SKU,
          description: 'Test product for relationship verification',
          shortDescription: 'Test notebook',
          categoryId: category.id,
          brandId: brand.id,
          priceCents: 45000, // Rs. 450.00
          stockQuantity: 100,
          lowStockThreshold: 10,
          isActive: true,
          specifications: { pages: '120', ruling: 'Single Line' },
        },
      });
      expect(product.id).toBe(TEST_PROD_ID);
      expect(product.priceCents).toBe(45000);

      // CREATE Variant
      const variant = await prisma.productVariant.create({
        data: {
          id: TEST_VAR_ID,
          productId: product.id,
          name: 'Blue Cover / Single Line',
          sku: TEST_VAR_SKU,
          priceCents: 45000,
          stockQuantity: 50,
          attributes: { color: 'Blue', ruling: 'Single Line' },
        },
      });
      expect(variant.id).toBe(TEST_VAR_ID);

      // READ Product with includes
      const fetchedProduct = await prisma.product.findUnique({
        where: { id: TEST_PROD_ID },
        include: {
          category: true,
          brand: true,
          variants: true,
        },
      });
      expect(fetchedProduct).not.toBeNull();
      expect(fetchedProduct?.category.slug).toBe(TEST_CAT_SLUG);
      expect(fetchedProduct?.brand.slug).toBe(TEST_BRAND_SLUG);
      expect(fetchedProduct?.variants).toHaveLength(1);
      expect(fetchedProduct?.variants[0].sku).toBe(TEST_VAR_SKU);

      // UPDATE Product
      const updatedProduct = await prisma.product.update({
        where: { id: TEST_PROD_ID },
        data: {
          priceCents: 48000, // price change
          stockQuantity: 85,
        },
      });
      expect(updatedProduct.priceCents).toBe(48000);
      expect(updatedProduct.stockQuantity).toBe(85);

      // CASCADE DELETE: Deleting product should delete its variants
      await prisma.product.delete({
        where: { id: TEST_PROD_ID },
      });

      const checkVariant = await prisma.productVariant.findUnique({
        where: { id: TEST_VAR_ID },
      });
      expect(checkVariant).toBeNull();

      // Clean up parent category and brand
      await prisma.category.delete({ where: { id: TEST_CAT_ID } });
      await prisma.brand.delete({ where: { id: TEST_BRAND_ID } });
    });
  });

  // --------------------------------------------------------------------------
  // 4. Unique Constraints Enforcement
  // --------------------------------------------------------------------------
  describe('Unique constraint enforcement', () => {
    it('enforces unique constraint on Category slug', async () => {
      await prisma.category.create({
        data: {
          id: TEST_CAT_ID,
          name: 'Original Category',
          slug: TEST_CAT_SLUG,
          description: 'First category',
        },
      });

      // Attempt duplicate slug with different ID
      let duplicateError: Prisma.PrismaClientKnownRequestError | null = null;
      try {
        await prisma.category.create({
          data: {
            id: `${TEST_CAT_ID}-dup`,
            name: 'Duplicate Category',
            slug: TEST_CAT_SLUG, // duplicate slug
            description: 'Should fail with P2002',
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
          duplicateError = err;
        }
      }

      expect(duplicateError).not.toBeNull();
      expect(duplicateError?.code).toBe('P2002'); // Unique constraint violation

      await prisma.category.delete({ where: { id: TEST_CAT_ID } });
    });

    it('enforces unique constraint on Brand slug', async () => {
      await prisma.brand.create({
        data: {
          id: TEST_BRAND_ID,
          name: 'Original Brand',
          slug: TEST_BRAND_SLUG,
          originCountry: 'Sri Lanka',
          description: 'Original brand',
        },
      });

      let duplicateError: Prisma.PrismaClientKnownRequestError | null = null;
      try {
        await prisma.brand.create({
          data: {
            id: `${TEST_BRAND_ID}-dup`,
            name: 'Duplicate Brand',
            slug: TEST_BRAND_SLUG, // duplicate slug
            originCountry: 'India',
            description: 'Should fail with P2002',
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
          duplicateError = err;
        }
      }

      expect(duplicateError).not.toBeNull();
      expect(duplicateError?.code).toBe('P2002');

      await prisma.brand.delete({ where: { id: TEST_BRAND_ID } });
    });

    it('enforces unique constraint on Product SKU', async () => {
      // Setup parents
      await prisma.category.create({
        data: { id: TEST_CAT_ID, name: 'Cat', slug: TEST_CAT_SLUG, description: 'Cat' },
      });
      await prisma.brand.create({
        data: { id: TEST_BRAND_ID, name: 'Brand', slug: TEST_BRAND_SLUG, originCountry: 'LK', description: 'Brand' },
      });

      await prisma.product.create({
        data: {
          id: TEST_PROD_ID,
          name: 'Product 1',
          slug: TEST_PROD_SLUG,
          sku: TEST_PROD_SKU,
          description: 'First product',
          shortDescription: 'Product 1',
          categoryId: TEST_CAT_ID,
          brandId: TEST_BRAND_ID,
          priceCents: 1000,
        },
      });

      // Attempt duplicate SKU
      let duplicateSkuError: Prisma.PrismaClientKnownRequestError | null = null;
      try {
        await prisma.product.create({
          data: {
            id: `${TEST_PROD_ID}-dup`,
            name: 'Product 2',
            slug: `${TEST_PROD_SLUG}-different`,
            sku: TEST_PROD_SKU, // DUPLICATE SKU
            description: 'Second product with same SKU',
            shortDescription: 'Product 2',
            categoryId: TEST_CAT_ID,
            brandId: TEST_BRAND_ID,
            priceCents: 1200,
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
          duplicateSkuError = err;
        }
      }

      expect(duplicateSkuError).not.toBeNull();
      expect(duplicateSkuError?.code).toBe('P2002');

      // Cleanup
      await prisma.product.delete({ where: { id: TEST_PROD_ID } });
      await prisma.category.delete({ where: { id: TEST_CAT_ID } });
      await prisma.brand.delete({ where: { id: TEST_BRAND_ID } });
    });
  });

  // --------------------------------------------------------------------------
  // 5. Foreign Key & Restrict Constraints
  // --------------------------------------------------------------------------
  describe('Foreign key constraints and onDelete Restrict rules', () => {
    it('rejects product creation when categoryId does not exist', async () => {
      await prisma.brand.create({
        data: { id: TEST_BRAND_ID, name: 'Brand', slug: TEST_BRAND_SLUG, originCountry: 'LK', description: 'Brand' },
      });

      let fkError: Prisma.PrismaClientKnownRequestError | null = null;
      try {
        await prisma.product.create({
          data: {
            id: TEST_PROD_ID,
            name: 'Invalid Cat Product',
            slug: TEST_PROD_SLUG,
            sku: TEST_PROD_SKU,
            description: 'Product with invalid category ID',
            shortDescription: 'Invalid category',
            categoryId: 'non-existent-cat-id', // INVALID FK
            brandId: TEST_BRAND_ID,
            priceCents: 1500,
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
          fkError = err;
        }
      }

      expect(fkError).not.toBeNull();
      expect(fkError?.code).toBe('P2003'); // Foreign key constraint violation

      await prisma.brand.delete({ where: { id: TEST_BRAND_ID } });
    });

    it('rejects product creation when brandId does not exist', async () => {
      await prisma.category.create({
        data: { id: TEST_CAT_ID, name: 'Cat', slug: TEST_CAT_SLUG, description: 'Cat' },
      });

      let fkError: Prisma.PrismaClientKnownRequestError | null = null;
      try {
        await prisma.product.create({
          data: {
            id: TEST_PROD_ID,
            name: 'Invalid Brand Product',
            slug: TEST_PROD_SLUG,
            sku: TEST_PROD_SKU,
            description: 'Product with invalid brand ID',
            shortDescription: 'Invalid brand',
            categoryId: TEST_CAT_ID,
            brandId: 'non-existent-brand-id', // INVALID FK
            priceCents: 1500,
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
          fkError = err;
        }
      }

      expect(fkError).not.toBeNull();
      expect(fkError?.code).toBe('P2003');

      await prisma.category.delete({ where: { id: TEST_CAT_ID } });
    });

    it('prevents deletion of category while products reference it (onDelete: Restrict)', async () => {
      await prisma.category.create({
        data: { id: TEST_CAT_ID, name: 'Cat', slug: TEST_CAT_SLUG, description: 'Cat' },
      });
      await prisma.brand.create({
        data: { id: TEST_BRAND_ID, name: 'Brand', slug: TEST_BRAND_SLUG, originCountry: 'LK', description: 'Brand' },
      });
      await prisma.product.create({
        data: {
          id: TEST_PROD_ID,
          name: 'Linked Product',
          slug: TEST_PROD_SLUG,
          sku: TEST_PROD_SKU,
          description: 'Linked product',
          shortDescription: 'Linked',
          categoryId: TEST_CAT_ID,
          brandId: TEST_BRAND_ID,
          priceCents: 2000,
        },
      });

      // Attempt to delete category that has a product referencing it
      let restrictError: Prisma.PrismaClientKnownRequestError | null = null;
      try {
        await prisma.category.delete({
          where: { id: TEST_CAT_ID },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
          restrictError = err;
        }
      }

      expect(restrictError).not.toBeNull();
      expect(restrictError?.code).toBe('P2003'); // Foreign key constraint violation caused by Restrict

      // Clean up in proper order
      await prisma.product.delete({ where: { id: TEST_PROD_ID } });
      await prisma.category.delete({ where: { id: TEST_CAT_ID } });
      await prisma.brand.delete({ where: { id: TEST_BRAND_ID } });
    });
  });

  // --------------------------------------------------------------------------
  // 6. Seeded Catalogue Inviolability Check
  // --------------------------------------------------------------------------
  describe('Seeded catalogue integrity check', () => {
    it('confirms the 15 categories, 10 brands, and 8 products remain intact', async () => {
      const catCount = await prisma.category.count({
        where: { id: { not: { startsWith: 'test-' } } },
      });
      const brandCount = await prisma.brand.count({
        where: { id: { not: { startsWith: 'test-' } } },
      });
      const prodCount = await prisma.product.count({
        where: { id: { not: { startsWith: 'test-' } } },
      });

      expect(catCount).toBe(15);
      expect(brandCount).toBe(10);
      expect(prodCount).toBe(8);
    });
  });
});
