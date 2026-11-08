import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';

describe('Category & Subcategory Hierarchy Integration Tests (Stage 1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl: string;
  let adminToken: string;

  const testRootSlug = `test-cat-root-${Date.now()}`;
  const testSubSlug = `test-cat-sub-${Date.now()}`;
  const testSub2Slug = `test-cat-sub2-${Date.now()}`;
  const testDeepSlug = `test-cat-deep-${Date.now()}`;
  const testProductSku = `TEST-HIER-SKU-${Date.now().toString().slice(-6)}`;

  let createdRootId: string;
  let createdSubId: string;
  let createdSub2Id: string;
  let sampleBrandId: string;
  let createdProductId: string;

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

    const firstBrand = await prisma.brand.findFirst();
    if (firstBrand) {
      sampleBrandId = firstBrand.id;
    } else {
      const b = await prisma.brand.create({
        data: {
          name: 'Hierarchy Test Brand',
          slug: `hier-brand-${Date.now()}`,
          description: 'Brand for hierarchy tests',
          originCountry: 'Sri Lanka',
        },
      });
      sampleBrandId = b.id;
    }
  });

  afterAll(async () => {
    // Cleanup created test records
    if (createdProductId) {
      await prisma.product.deleteMany({ where: { id: createdProductId } });
    }
    await prisma.category.deleteMany({
      where: {
        slug: {
          in: [testRootSlug, testSubSlug, testSub2Slug, testDeepSlug],
        },
      },
    });

    if (app) {
      await app.close();
    }
  });

  it('1. Successfully creates a top-level root category (parentId: null)', async () => {
    const res = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Fine Writing Instruments',
        slug: testRootSlug,
        description: 'Premium fountain and gel writing instruments',
        parentId: null,
      }),
    });

    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data.slug).toBe(testRootSlug);
    expect(json.data.parentId).toBeNull();
    createdRootId = json.data.id;
  });

  it('2. Successfully creates a subcategory under the root category', async () => {
    const res = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Fountain Pens',
        slug: testSubSlug,
        description: 'Cartridge and converter fountain pens',
        parentId: createdRootId,
      }),
    });

    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data.slug).toBe(testSubSlug);
    expect(json.data.parentId).toBe(createdRootId);
    createdSubId = json.data.id;
  });

  it('3. Successfully creates a second subcategory under the same root category', async () => {
    const res = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Rollerball Pens',
        slug: testSub2Slug,
        description: 'Smooth liquid ink rollerball pens',
        parentId: createdRootId,
      }),
    });

    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data.parentId).toBe(createdRootId);
    createdSub2Id = json.data.id;
  });

  it('4. Rejects subcategory creation if parent category does not exist (HTTP 404)', async () => {
    const res = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Orphan Subcategory',
        slug: `orphan-sub-${Date.now()}`,
        description: 'Should fail',
        parentId: 'non-existent-parent-id-999',
      }),
    });

    expect(res.status).toBe(404);
  });

  it('5. Rejects hierarchy depth > 2: creating a child under a subcategory is rejected (HTTP 400)', async () => {
    const res = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Level 3 Category',
        slug: testDeepSlug,
        description: 'Illegal 3rd level hierarchy depth',
        parentId: createdSubId, // createdSubId is already a subcategory!
      }),
    });

    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.message).toContain('strictly two-level');
  });

  it('6. Rejects self-parenting on update: category cannot be its own parent (HTTP 400)', async () => {
    const res = await fetch(`${baseUrl}/categories/${createdRootId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        parentId: createdRootId,
      }),
    });

    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.message).toContain('cannot be its own parent');
  });

  it('7. Rejects converting a root category with existing subcategories into a subcategory (HTTP 400)', async () => {
    // Attempt to make createdRootId a child of another category
    const otherRoot = await prisma.category.findFirst({
      where: { parentId: null, id: { not: createdRootId } },
    });
    expect(otherRoot).toBeDefined();

    const res = await fetch(`${baseUrl}/categories/${createdRootId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        parentId: otherRoot!.id,
      }),
    });

    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.message).toContain('existing subcategories cannot be converted into a subcategory');
  });

  it('8. Successfully returns the hierarchical category tree with nested children via GET /categories/tree', async () => {
    const res = await fetch(`${baseUrl}/categories/tree`);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);

    const foundRoot = json.data.find((c: any) => c.id === createdRootId);
    expect(foundRoot).toBeDefined();
    expect(foundRoot.children).toBeDefined();
    expect(foundRoot.children.length).toBeGreaterThanOrEqual(2);
    expect(foundRoot.children.some((ch: any) => ch.id === createdSubId)).toBe(true);
  });

  it('9. Successfully creates a product linked to parent category AND matching subcategory', async () => {
    const res = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Pilot Custom 74 Fountain Pen',
        slug: `pilot-custom-74-${Date.now()}`,
        sku: testProductSku,
        description: 'Classic fountain pen with 14k gold nib',
        shortDescription: '14k gold nib fountain pen',
        categoryId: createdRootId,
        subcategoryId: createdSubId,
        brandId: sampleBrandId,
        priceCents: 4500000,
        stockQuantity: 25,
      }),
    });

    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data.categoryId).toBe(createdRootId);
    expect(json.data.subcategoryId).toBe(createdSubId);
    createdProductId = json.data.id;
  });

  it('10. Rejects product creation if subcategory does not belong to the selected parent category (HTTP 400)', async () => {
    // Pick another parent category
    const otherRoot = await prisma.category.findFirst({
      where: { parentId: null, id: { not: createdRootId } },
    });
    expect(otherRoot).toBeDefined();

    const res = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Mismatched Category Product',
        slug: `mismatched-${Date.now()}`,
        sku: `MISMATCH-SKU-${Date.now().toString().slice(-6)}`,
        description: 'Category mismatch test',
        shortDescription: 'Mismatch test',
        categoryId: otherRoot!.id, // Different root!
        subcategoryId: createdSubId, // Belongs to createdRootId!
        brandId: sampleBrandId,
        priceCents: 10000,
      }),
    });

    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.message).toContain('does not belong to the selected parent category');
  });

  it('11. Rejects deleting parent category while it has subcategories attached (HTTP 409 Conflict)', async () => {
    const res = await fetch(`${baseUrl}/categories/${createdRootId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.message).toContain('contains');
  });

  it('12. Rejects deleting subcategory while it has products attached (HTTP 409 Conflict)', async () => {
    const res = await fetch(`${baseUrl}/categories/${createdSubId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.message).toContain('referenced by');
  });

  it('13. Allows deleting an empty subcategory with 0 products attached', async () => {
    // createdSub2Id has 0 products
    const res = await fetch(`${baseUrl}/categories/${createdSub2Id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    const check = await prisma.category.findUnique({ where: { id: createdSub2Id } });
    expect(check).toBeNull();
  });

  it('14. Product UPDATE validation: rejects updating product with a subcategory from a different root category (HTTP 400) and preserves existing assignments', async () => {
    const timestamp = Date.now();
    const updateRoot1Slug = `test-update-root1-${timestamp}`;
    const updateRoot2Slug = `test-update-root2-${timestamp}`;
    const updateSub1Slug = `test-update-sub1-${timestamp}`;
    const updateProductSku = `UPD-VAL-SKU-${timestamp.toString().slice(-6)}`;

    let updateRoot1Id = '';
    let updateRoot2Id = '';
    let updateSub1Id = '';
    let updateProdId = '';

    try {
      // 1. Create two root categories
      const root1Res = await fetch(`${baseUrl}/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Update Validation Root 1',
          slug: updateRoot1Slug,
          description: 'First root category for update validation',
          parentId: null,
        }),
      });
      const root1Json = await root1Res.json();
      expect(root1Res.status).toBe(201);
      updateRoot1Id = root1Json.data.id;

      const root2Res = await fetch(`${baseUrl}/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Update Validation Root 2',
          slug: updateRoot2Slug,
          description: 'Second root category for update validation',
          parentId: null,
        }),
      });
      const root2Json = await root2Res.json();
      expect(root2Res.status).toBe(201);
      updateRoot2Id = root2Json.data.id;

      // 2. Create a subcategory under the first root category
      const sub1Res = await fetch(`${baseUrl}/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Update Validation Sub 1',
          slug: updateSub1Slug,
          description: 'Subcategory under Root 1',
          parentId: updateRoot1Id,
        }),
      });
      const sub1Json = await sub1Res.json();
      expect(sub1Res.status).toBe(201);
      updateSub1Id = sub1Json.data.id;

      // 3. Create a product under the second root category
      const prodRes = await fetch(`${baseUrl}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Product Under Root 2',
          slug: `prod-under-root2-${timestamp}`,
          sku: updateProductSku,
          description: 'Initial product assigned to Root 2 with no subcategory',
          shortDescription: 'Product under Root 2',
          categoryId: updateRoot2Id,
          brandId: sampleBrandId,
          priceCents: 15000,
          stockQuantity: 50,
        }),
      });
      const prodJson = await prodRes.json();
      expect(prodRes.status).toBe(201);
      updateProdId = prodJson.data.id;
      expect(prodJson.data.categoryId).toBe(updateRoot2Id);
      expect(prodJson.data.subcategoryId).toBeNull();

      // 4. Attempt to update the product using the subcategory from the first root category
      const patchRes = await fetch(`${baseUrl}/products/${updateProdId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          subcategoryId: updateSub1Id,
        }),
      });

      // 5. Verify that the API rejects the update with HTTP 400
      expect(patchRes.status).toBe(400);
      const patchJson = await patchRes.json();
      expect(patchJson.message).toContain('The selected subcategory does not belong to the selected parent category');

      // 6. Verify that the existing product category and subcategory assignments remain unchanged
      const verifyDbProd = await prisma.product.findUnique({
        where: { id: updateProdId },
        select: { id: true, categoryId: true, subcategoryId: true },
      });
      expect(verifyDbProd).toBeDefined();
      expect(verifyDbProd!.categoryId).toBe(updateRoot2Id);
      expect(verifyDbProd!.subcategoryId).toBeNull();

      // Also verify via GET endpoint
      const getProdRes = await fetch(`${baseUrl}/products/${updateProdId}`);
      const getProdJson = await getProdRes.json();
      expect(getProdRes.status).toBe(200);
      expect(getProdJson.data.categoryId).toBe(updateRoot2Id);
      expect(getProdJson.data.subcategoryId).toBeNull();
    } finally {
      // Cleanup created validation test records
      if (updateProdId) {
        await prisma.product.deleteMany({ where: { id: updateProdId } });
      }
      if (updateSub1Id) {
        await prisma.category.deleteMany({ where: { id: updateSub1Id } });
      }
      if (updateRoot1Id || updateRoot2Id) {
        await prisma.category.deleteMany({
          where: { id: { in: [updateRoot1Id, updateRoot2Id].filter(Boolean) } },
        });
      }
    }
  });
});

