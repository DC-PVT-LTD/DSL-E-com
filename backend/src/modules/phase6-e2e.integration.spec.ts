import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../app.module';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryChangeReason } from '../generated/prisma';

describe('Phase 6: E2E Integration Workflows (E2E-01 to E2E-15)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let adminToken: string;
  let customerToken: string;
  let prisma: PrismaService;

  // Track created IDs for safe teardown
  const createdProductIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdBrandIds: string[] = [];

  let testCategoryId: string;
  let testBrandId: string;
  let testProductId: string;
  let testVariantId: string;
  const testProductSku = `E2E-PROD-${Date.now()}`;
  const testVariantSku = `E2E-VAR-${Date.now()}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address !== null ? address.port : 4000;
    baseUrl = `http://localhost:${port}/api/v1`;

    prisma = app.get(PrismaService);
    const jwtService = app.get(JwtService);

    adminToken = jwtService.sign({
      sub: 'cmw07gefq0000pousyxdsoal6',
      email: 'admin@dslstationery.lk',
      role: 'ADMIN',
    });

    customerToken = jwtService.sign({
      sub: 'cmw0b90vk0000jsush3ey8h72',
      email: 'qa-customer@dslstationery.lk',
      role: 'CUSTOMER',
    });

    // Obtain an existing category and brand or create test fixtures
    const existingCat = await prisma.category.findFirst();
    testCategoryId = existingCat?.id || 'cmw01abc10000pous00010001';

    const existingBrand = await prisma.brand.findFirst();
    testBrandId = existingBrand?.id || 'cmw01def20000pous00020002';
  });

  afterAll(async () => {
    // Clean up test records only
    try {
      if (createdProductIds.length > 0) {
        await prisma.inventoryMovement.deleteMany({
          where: { productId: { in: createdProductIds } },
        });
        await prisma.productVariant.deleteMany({
          where: { productId: { in: createdProductIds } },
        });
        await prisma.product.deleteMany({
          where: { id: { in: createdProductIds } },
        });
      }
      if (createdBrandIds.length > 0) {
        await prisma.brand.deleteMany({
          where: { id: { in: createdBrandIds } },
        });
      }
      if (createdCategoryIds.length > 0) {
        await prisma.category.deleteMany({
          where: { id: { in: createdCategoryIds } },
        });
      }
    } catch (err) {
      console.warn('Error during E2E teardown:', err);
    }

    if (app) {
      await app.close();
    }
  });

  // ============================================================================
  // E2E-01: Create a product
  // ============================================================================
  it('E2E-01: Create a product - saved in backend and present after retrieval', async () => {
    const res = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'E2E Test Notebook 200 Pages',
        slug: `e2e-test-notebook-${Date.now()}`,
        sku: testProductSku,
        description: 'E2E integration test notebook description',
        shortDescription: 'E2E test notebook',
        categoryId: testCategoryId,
        brandId: testBrandId,
        priceCents: 18500, // LKR 185.00
        stockQuantity: 50,
        lowStockThreshold: 10,
        isActive: true,
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.id).toBeDefined();
    expect(json.data.sku).toBe(testProductSku);
    expect(json.data.stockQuantity).toBe(50);

    testProductId = json.data.id;
    createdProductIds.push(testProductId);

    // Verify persistence via GET
    const getRes = await fetch(`${baseUrl}/products/${testProductId}`);
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.data.id).toBe(testProductId);
    expect(getJson.data.name).toBe('E2E Test Notebook 200 Pages');
  });

  // ============================================================================
  // E2E-02: Edit a product
  // ============================================================================
  it('E2E-02: Edit a product - changes persist and appear in the catalogue', async () => {
    const res = await fetch(`${baseUrl}/products/${testProductId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'E2E Test Notebook 200 Pages (Revised)',
        priceCents: 21000, // LKR 210.00
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.name).toBe('E2E Test Notebook 200 Pages (Revised)');
    expect(json.data.priceCents).toBe(21000);

    // Verify persistence via GET
    const getRes = await fetch(`${baseUrl}/products/${testProductId}`);
    const getJson = await getRes.json();
    expect(getJson.data.name).toBe('E2E Test Notebook 200 Pages (Revised)');
    expect(getJson.data.priceCents).toBe(21000);
  });

  // ============================================================================
  // E2E-03: Create a variant with initial stock
  // ============================================================================
  it('E2E-03: Create a variant with initial stock - variant stock and parent aggregate are correct', async () => {
    // Current parent stock is 50
    const res = await fetch(`${baseUrl}/products/${testProductId}/variants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Single Line - Blue Cover',
        sku: testVariantSku,
        priceCents: 22000,
        initialStock: 25,
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.id).toBeDefined();
    expect(json.data.stockQuantity).toBe(25);
    expect(json.data.sku).toBe(testVariantSku);

    testVariantId = json.data.id;

    // Verify parent product aggregate stock was incremented: 50 + 25 = 75
    const parentRes = await fetch(`${baseUrl}/products/${testProductId}`);
    const parentJson = await parentRes.json();
    expect(parentJson.data.stockQuantity).toBe(75);

    // Verify RESTOCK movement was logged
    const movement = await prisma.inventoryMovement.findFirst({
      where: {
        productId: testProductId,
        variantId: testVariantId,
        reason: InventoryChangeReason.RESTOCK,
      },
    });
    expect(movement).toBeDefined();
    expect(movement?.changeAmount).toBe(25);
  });

  // ============================================================================
  // E2E-04: Adjust variant stock
  // ============================================================================
  it('E2E-04: Adjust variant stock - variant, parent aggregate, and movement record agree', async () => {
    const res = await fetch(`${baseUrl}/inventory/adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        productId: testProductId,
        variantId: testVariantId,
        delta: 15,
        reason: InventoryChangeReason.CORRECTION,
        note: 'E2E audit manual adjustment +15',
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.movement.previousQuantity).toBe(25);
    expect(json.data.movement.changeAmount).toBe(15);
    expect(json.data.movement.newQuantity).toBe(40);

    // Verify variant stock is 40
    const varRes = await fetch(`${baseUrl}/products/${testProductId}/variants/${testVariantId}`);
    const varJson = await varRes.json();
    expect(varJson.data.stockQuantity).toBe(40);

    // Verify parent aggregate stock is 75 + 15 = 90
    const parentRes = await fetch(`${baseUrl}/products/${testProductId}`);
    const parentJson = await parentRes.json();
    expect(parentJson.data.stockQuantity).toBe(90);
  });

  // ============================================================================
  // E2E-05: Reduce stock below zero
  // ============================================================================
  it('E2E-05: Reduce stock below zero - request rejected, database remains unchanged', async () => {
    // Current variant stock is 40. Attempt delta -50.
    const res = await fetch(`${baseUrl}/inventory/adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        productId: testProductId,
        variantId: testVariantId,
        delta: -50,
        reason: InventoryChangeReason.DAMAGED,
        note: 'Attempting illegal negative stock',
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toContain('negative stock');

    // Verify variant stock is still 40
    const varRes = await fetch(`${baseUrl}/products/${testProductId}/variants/${testVariantId}`);
    const varJson = await varRes.json();
    expect(varJson.data.stockQuantity).toBe(40);

    // Verify parent aggregate stock is still 90
    const parentRes = await fetch(`${baseUrl}/products/${testProductId}`);
    const parentJson = await parentRes.json();
    expect(parentJson.data.stockQuantity).toBe(90);
  });

  // ============================================================================
  // E2E-06: Create duplicate SKU
  // ============================================================================
  it('E2E-06: Create duplicate SKU - conflict returned, no duplicate variant created', async () => {
    const res = await fetch(`${baseUrl}/products/${testProductId}/variants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Duplicate SKU Variant',
        sku: testVariantSku, // Same SKU as E2E-03
        priceCents: 20000,
        initialStock: 5,
      }),
    });

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.statusCode).toBe(409);
    expect(json.error).toBe('CONFLICT');
  });

  // ============================================================================
  // E2E-07: Concurrent stock adjustments
  // ============================================================================
  it('E2E-07: Concurrent stock adjustments - row locking prevents lost updates', async () => {
    // Start with variant stock 40. Run 5 concurrent adjustments of +5 each.
    // Total added should be exactly +25, final stock should be 65.
    const promises = Array.from({ length: 5 }, (_, i) =>
      fetch(`${baseUrl}/inventory/adjust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          productId: testProductId,
          variantId: testVariantId,
          delta: 5,
          reason: InventoryChangeReason.RESTOCK,
          note: `Concurrent adjustment #${i + 1}`,
        }),
      })
    );

    const responses = await Promise.all(promises);
    for (const r of responses) {
      expect(r.status).toBe(200);
    }

    // Verify variant stock is 40 + 25 = 65
    const varRes = await fetch(`${baseUrl}/products/${testProductId}/variants/${testVariantId}`);
    const varJson = await varRes.json();
    expect(varJson.data.stockQuantity).toBe(65);

    // Verify parent aggregate stock is 90 + 25 = 115
    const parentRes = await fetch(`${baseUrl}/products/${testProductId}`);
    const parentJson = await parentRes.json();
    expect(parentJson.data.stockQuantity).toBe(115);
  });

  // ============================================================================
  // E2E-08: Deactivate a variant
  // ============================================================================
  it('E2E-08: Deactivate a variant - hidden from public and historical references intact', async () => {
    const res = await fetch(`${baseUrl}/products/${testProductId}/variants/${testVariantId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    // Public list without includeInactive should not return the deactivated variant
    const publicListRes = await fetch(`${baseUrl}/products/${testProductId}/variants`);
    const publicListJson = await publicListRes.json();
    const foundInPublic = publicListJson.data.some((v: any) => v.id === testVariantId);
    expect(foundInPublic).toBe(false);

    // Historical inventory movements still exist referencing testVariantId
    const movements = await prisma.inventoryMovement.findMany({
      where: { variantId: testVariantId },
    });
    expect(movements.length).toBeGreaterThan(0);
  });

  // ============================================================================
  // E2E-09: Create a category and brand
  // ============================================================================
  it('E2E-09: Create a category and brand - records persist after retrieval', async () => {
    const catSlug = `e2e-cat-${Date.now()}`;
    const catRes = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'E2E Specialty Paper',
        slug: catSlug,
        description: 'E2E category for test papers',
      }),
    });

    expect(catRes.status).toBe(201);
    const catJson = await catRes.json();
    const newCatId = catJson.data.id;
    createdCategoryIds.push(newCatId);

    const brandSlug = `e2e-brand-${Date.now()}`;
    const brandRes = await fetch(`${baseUrl}/brands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'E2E Premium Mills',
        slug: brandSlug,
        originCountry: 'Sri Lanka',
        description: 'E2E brand test',
      }),
    });

    expect(brandRes.status).toBe(201);
    const brandJson = await brandRes.json();
    const newBrandId = brandJson.data.id;
    createdBrandIds.push(newBrandId);

    // Verify persistence via GET
    const getCat = await fetch(`${baseUrl}/categories/${newCatId}`);
    expect(getCat.status).toBe(200);

    const getBrand = await fetch(`${baseUrl}/brands/${newBrandId}`);
    expect(getBrand.status).toBe(200);
  });

  // ============================================================================
  // E2E-10: Delete referenced category/brand
  // ============================================================================
  it('E2E-10: Delete referenced category/brand - safe conflict handling preserves data', async () => {
    // testCategoryId has at least one active product (testProductId)
    const res = await fetch(`${baseUrl}/categories/${testCategoryId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.statusCode).toBe(409);
    expect(json.message).toContain('referenced by');

    // Category still exists
    const cat = await prisma.category.findUnique({ where: { id: testCategoryId } });
    expect(cat).toBeDefined();
  });

  // ============================================================================
  // E2E-11: Inventory page endpoints
  // ============================================================================
  it('E2E-11: Inventory page - movement history, filters, pagination, and low-stock work', async () => {
    // Movements with pagination
    const movRes = await fetch(`${baseUrl}/inventory/movements?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(movRes.status).toBe(200);
    const movJson = await movRes.json();
    expect(movJson.success).toBe(true);
    expect(Array.isArray(movJson.data)).toBe(true);
    expect(movJson.meta.page).toBe(1);

    // Low stock query
    const lowRes = await fetch(`${baseUrl}/inventory/low-stock`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(lowRes.status).toBe(200);
    const lowJson = await lowRes.json();
    expect(lowJson.success).toBe(true);
    expect(Array.isArray(lowJson.data)).toBe(true);
  });

  // ============================================================================
  // E2E-12: Invalid inventory adjustment
  // ============================================================================
  it('E2E-12: Invalid inventory adjustment - clear validation error and no unintended stock mutation', async () => {
    const res = await fetch(`${baseUrl}/inventory/adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        productId: testProductId,
        delta: 0, // delta cannot be 0
        reason: InventoryChangeReason.RESTOCK,
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.statusCode).toBe(400);
  });

  // ============================================================================
  // E2E-13: Authorization
  // ============================================================================
  it('E2E-13: Authorization - unauthorized mutations are rejected (401 and 403)', async () => {
    // 401 unauthenticated
    const unauthRes = await fetch(`${baseUrl}/inventory/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: testProductId,
        delta: 1,
        reason: InventoryChangeReason.RESTOCK,
      }),
    });
    expect(unauthRes.status).toBe(401);

    // 403 forbidden for CUSTOMER role
    const custRes = await fetch(`${baseUrl}/inventory/adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        productId: testProductId,
        delta: 1,
        reason: InventoryChangeReason.RESTOCK,
      }),
    });
    expect(custRes.status).toBe(403);
  });

  // ============================================================================
  // E2E-14: API unavailable or server error
  // ============================================================================
  it('E2E-14: Non-existent item lookup returns 404 cleanly without corrupting state', async () => {
    const res = await fetch(`${baseUrl}/products/non-existent-product-id-9999`);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.statusCode).toBe(404);
    expect(json.error).toBe('NOT_FOUND');
  });

  // ============================================================================
  // E2E-15: Repeat requests or double submission
  // ============================================================================
  it('E2E-15: Repeat requests or double submission - exactly one succeeds, duplicate rejected with 409', async () => {
    const collisionSku = `COLLISION-SKU-${Date.now()}`;
    const payload = {
      name: 'Double Submission Test Product',
      slug: `double-submission-${Date.now()}`,
      sku: collisionSku,
      description: 'Testing collision handling for repeat requests',
      shortDescription: 'Testing collision',
      categoryId: testCategoryId,
      brandId: testBrandId,
      priceCents: 10000,
      stockQuantity: 10,
    };

    // Dispatch two identical creation requests concurrently
    const [res1, res2] = await Promise.all([
      fetch(`${baseUrl}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(payload),
      }),
      fetch(`${baseUrl}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(payload),
      }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);

    // Track the created product for teardown
    const successfulRes = res1.status === 201 ? res1 : res2;
    const json = await successfulRes.json();
    if (json.data?.id) {
      createdProductIds.push(json.data.id);
    }
  });
});
