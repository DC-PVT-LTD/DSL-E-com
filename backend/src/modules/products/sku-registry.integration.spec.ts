import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { SkuGeneratorService } from './sku-generator.service';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';

describe('Global SKU Registry & Auto-Generation Integration Tests (Stage 2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let skuGenerator: SkuGeneratorService;
  let baseUrl: string;
  let adminToken: string;

  let testCategoryId: string;
  let testBrandId: string;
  const testCategorySlug = `sku-test-cat-${Date.now()}`;
  const testBrandSlug = `sku-test-brd-${Date.now()}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    await app.listen(0);

    const server = app.getHttpServer();
    const address = server.address();
    baseUrl = typeof address === 'string' ? address : `http://127.0.0.1:${address.port}/api/v1`;

    prisma = app.get(PrismaService);
    skuGenerator = app.get(SkuGeneratorService);

    // Create test admin token
    const jwt = app.get(JwtService);
    adminToken = jwt.sign({
      sub: 'cmw07gefq0000pousyxdsoal6',
      email: 'admin@dslstationery.lk',
      role: 'ADMIN',
    });

    // Create test category and brand
    const cat = await prisma.category.create({
      data: {
        name: `Test Category ${Date.now()}`,
        slug: testCategorySlug,
        description: 'Test category description',
      },
    });
    testCategoryId = cat.id;

    const brd = await prisma.brand.create({
      data: {
        name: `Test Brand ${Date.now()}`,
        slug: testBrandSlug,
        description: 'Test brand description',
        originCountry: 'Sri Lanka',
      },
    });
    testBrandId = brd.id;
  });

  afterAll(async () => {
    // Cleanup created test records
    try {
      const prods = await prisma.product.findMany({
        where: { categoryId: testCategoryId },
        select: { id: true },
      });
      for (const p of prods) {
        await prisma.productVariant.deleteMany({ where: { productId: p.id } });
        await prisma.product.delete({ where: { id: p.id } });
      }
      if (testCategoryId) {
        await prisma.category.delete({ where: { id: testCategoryId } });
      }
      if (testBrandId) {
        await prisma.brand.delete({ where: { id: testBrandId } });
      }
    } catch (e) {
      // Ignore cleanup errors
    }
    await app.close();
  });

  describe('1. Global SKU Uniqueness Across Products & Variants', () => {
    const manualSku = `DSL-MANUAL-UNIQ-${Date.now()}`;

    it('should register product SKU in GlobalSku upon creation', async () => {
      const res = await fetch(`${baseUrl}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Manual SKU Product',
          slug: `prod-manual-${Date.now()}`,
          sku: manualSku,
          description: 'Test product with manual SKU',
          shortDescription: 'Short desc',
          categoryId: testCategoryId,
          brandId: testBrandId,
          priceCents: 50000,
          stockQuantity: 20,
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.sku).toBe(manualSku);

      // Verify in GlobalSku registry
      const inRegistry = await prisma.globalSku.findUnique({
        where: { sku: manualSku },
      });
      expect(inRegistry).toBeDefined();
      expect(inRegistry?.ownerType).toBe('PRODUCT');
      expect(inRegistry?.productId).toBe(json.data.id);
      expect(inRegistry?.variantId).toBeNull();
    });

    it('should reject a duplicate SKU on another product (HTTP 409)', async () => {
      const res = await fetch(`${baseUrl}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Duplicate SKU Product',
          slug: `prod-dup-${Date.now()}`,
          sku: manualSku,
          description: 'Should fail with duplicate SKU',
          shortDescription: 'Short desc',
          categoryId: testCategoryId,
          brandId: testBrandId,
          priceCents: 45000,
        }),
      });

      expect(res.status).toBe(409);
    });

    it('should reject a variant reusing an existing product SKU (HTTP 409)', async () => {
      // Create a second product
      const p2Res = await fetch(`${baseUrl}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Target Parent Product',
          slug: `prod-parent-${Date.now()}`,
          sku: `DSL-PARENT-${Date.now()}`,
          description: 'Parent product for variant test',
          shortDescription: 'Parent desc',
          categoryId: testCategoryId,
          brandId: testBrandId,
          priceCents: 60000,
        }),
      });
      const p2 = await p2Res.json();

      // Attempt to create variant with manualSku already taken by product 1
      const vRes = await fetch(`${baseUrl}/products/${p2.data.id}/variants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Conflicting Variant',
          sku: manualSku,
          priceCents: 65000,
        }),
      });

      expect(vRes.status).toBe(409);
    });
  });

  describe('2. Automatic SKU Generation & Sequential Allocation', () => {
    let autoProd1Id: string;
    let autoProd1Sku: string;
    let autoProd2Sku: string;

    it('should automatically allocate sequential SKU when SKU is omitted or blank', async () => {
      const res1 = await fetch(`${baseUrl}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Auto SKU Product 1',
          slug: `prod-auto-1-${Date.now()}`,
          description: 'Testing automatic SKU generation',
          shortDescription: 'Auto 1',
          categoryId: testCategoryId,
          brandId: testBrandId,
          priceCents: 35000,
        }),
      });

      expect(res1.status).toBe(201);
      const json1 = await res1.json();
      autoProd1Id = json1.data.id;
      autoProd1Sku = json1.data.sku;

      expect(autoProd1Sku).toMatch(/^DSL-[A-Z0-9]{3}-[A-Z0-9]{3}-\d{5}$/);

      // Verify second creation increments sequence
      const res2 = await fetch(`${baseUrl}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Auto SKU Product 2',
          slug: `prod-auto-2-${Date.now()}`,
          description: 'Testing automatic SKU generation second item',
          shortDescription: 'Auto 2',
          categoryId: testCategoryId,
          brandId: testBrandId,
          priceCents: 38000,
        }),
      });

      expect(res2.status).toBe(201);
      const json2 = await res2.json();
      autoProd2Sku = json2.data.sku;

      expect(autoProd2Sku).toMatch(/^DSL-[A-Z0-9]{3}-[A-Z0-9]{3}-\d{5}$/);

      // Extract sequence numbers
      const seq1 = parseInt(autoProd1Sku.slice(-5), 10);
      const seq2 = parseInt(autoProd2Sku.slice(-5), 10);
      expect(seq2).toBe(seq1 + 1);

      // Verify both are registered in GlobalSku
      const reg1 = await prisma.globalSku.findUnique({ where: { sku: autoProd1Sku } });
      const reg2 = await prisma.globalSku.findUnique({ where: { sku: autoProd2Sku } });
      expect(reg1?.productId).toBe(autoProd1Id);
      expect(reg2?.productId).toBe(json2.data.id);
    });

    it('should generate preview SKU via GET /api/v1/products/generate-sku without consuming sequence numbers or creating gaps', async () => {
      const catCode = skuGenerator.getCategoryCode(testCategorySlug);
      const brdCode = skuGenerator.getBrandCode(testBrandSlug);
      const prefix = `DSL-${catCode}-${brdCode}`;

      const beforeSeq = await prisma.skuSequence.findUnique({ where: { prefix } });
      const beforeLast = beforeSeq?.lastSequence || 0;

      const res1 = await fetch(
        `${baseUrl}/products/generate-sku?categoryId=${testCategoryId}&brandId=${testBrandId}`,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        }
      );
      expect(res1.status).toBe(200);
      const json1 = await res1.json();
      expect(json1.data.sku).toBe(`${prefix}-${String(beforeLast + 1).padStart(5, '0')}`);

      // Sequence in DB must NOT have advanced
      const afterSeq1 = await prisma.skuSequence.findUnique({ where: { prefix } });
      expect(afterSeq1?.lastSequence || 0).toBe(beforeLast);

      // Repeated preview must return the exact same candidate without burning sequence numbers
      const res2 = await fetch(
        `${baseUrl}/products/generate-sku?categoryId=${testCategoryId}&brandId=${testBrandId}`,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        }
      );
      expect(res2.status).toBe(200);
      const json2 = await res2.json();
      expect(json2.data.sku).toBe(json1.data.sku);

      // No ghost records in GlobalSku
      const reg = await prisma.globalSku.findUnique({ where: { sku: json1.data.sku } });
      expect(reg).toBeNull();
    });

    it('should automatically allocate variant SKU when variant SKU is omitted', async () => {
      const vRes1 = await fetch(`${baseUrl}/products/${autoProd1Id}/variants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Blue Ink Variant',
          attributes: { color: 'Blue' },
          priceCents: 37000,
        }),
      });

      expect(vRes1.status).toBe(201);
      const vJson1 = await vRes1.json();
      expect(vJson1.data.sku).toBe(`${autoProd1Sku}-BLU`);

      // Registry check
      const vReg1 = await prisma.globalSku.findUnique({ where: { sku: vJson1.data.sku } });
      expect(vReg1?.ownerType).toBe('VARIANT');
      expect(vReg1?.variantId).toBe(vJson1.data.id);
      expect(vReg1?.productId).toBeNull();

      // Second variant without color receives -V01 or -V02
      const vRes2 = await fetch(`${baseUrl}/products/${autoProd1Id}/variants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Special Pack Variant',
          attributes: { size: 'Pack of 5' },
          priceCents: 150000,
        }),
      });

      expect(vRes2.status).toBe(201);
      const vJson2 = await vRes2.json();
      expect(vJson2.data.sku).toBe(`${autoProd1Sku}-V01`);
    });
  });

  describe('3. Concurrency & Collision Retry Behavior', () => {
    it('should handle concurrent SKU allocations without collisions or deadlocks', async () => {
      const concurrentCount = 5;
      const promises = Array.from({ length: concurrentCount }, (_, i) =>
        fetch(`${baseUrl}/products`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            name: `Concurrent Product ${i}`,
            slug: `prod-concurrent-${i}-${Date.now()}`,
            description: 'Concurrent SKU generation test',
            shortDescription: 'Concurrent item',
            categoryId: testCategoryId,
            brandId: testBrandId,
            priceCents: 20000 + i * 1000,
          }),
        }).then((r) => r.json())
      );

      const results = await Promise.all(promises);
      const skus = results.map((r) => r.data.sku);

      // Verify all SKUs are unique
      const uniqueSkus = new Set(skus);
      expect(uniqueSkus.size).toBe(concurrentCount);
    });

    it('should retry and skip colliding SKU when a sequence candidate is already in GlobalSku', async () => {
      // Find current sequence prefix
      const cat = await prisma.category.findUnique({ where: { id: testCategoryId } });
      const brd = await prisma.brand.findUnique({ where: { id: testBrandId } });
      const catCode = skuGenerator.getCategoryCode(cat!.slug);
      const brdCode = skuGenerator.getBrandCode(brd!.slug);
      const prefix = `DSL-${catCode}-${brdCode}`;

      // Get current sequence
      const seqRecord = await prisma.skuSequence.findUnique({ where: { prefix } });
      const nextSeq = (seqRecord?.lastSequence || 0) + 1;
      const collisionCandidate = `${prefix}-${String(nextSeq).padStart(5, '0')}`;

      // Simulate a legacy product already holding this SKU
      const legacyProd = await prisma.product.create({
        data: {
          name: 'Legacy Colliding Product',
          slug: `legacy-prod-${Date.now()}`,
          sku: collisionCandidate,
          description: 'Simulated collision row',
          shortDescription: 'Collision test',
          categoryId: testCategoryId,
          brandId: testBrandId,
          priceCents: 10000,
        },
      });

      // Now create a product with auto-generation:
      // It should encounter collisionCandidate, loop to nextSeq + 1, and allocate next candidate!
      const res = await fetch(`${baseUrl}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Bypass Collision Product',
          slug: `prod-bypass-${Date.now()}`,
          description: 'Testing collision bypass loop',
          shortDescription: 'Bypass',
          categoryId: testCategoryId,
          brandId: testBrandId,
          priceCents: 25000,
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.sku).not.toBe(collisionCandidate);

      const allocatedSeq = parseInt(json.data.sku.slice(-5), 10);
      expect(allocatedSeq).toBeGreaterThan(nextSeq);
    });
  });

  describe('4. Direct Deletion Protection & Cascade Synchronization', () => {
    it('should prohibit direct deletion of an active GlobalSku row', async () => {
      // Create a test product
      const testSku = `PROT-DIRECT-DEL-${Date.now()}`;
      const prod = await prisma.product.create({
        data: {
          name: 'Deletion Protection Test',
          slug: `del-prot-${Date.now()}`,
          sku: testSku,
          description: 'Direct deletion test',
          shortDescription: 'Direct deletion test',
          categoryId: testCategoryId,
          brandId: testBrandId,
          priceCents: 15000,
        },
      });

      // Attempt direct DELETE on GlobalSku
      let directDeleteError: any = null;
      try {
        await prisma.$executeRawUnsafe(`DELETE FROM "GlobalSku" WHERE sku = '${testSku}'`);
      } catch (err) {
        directDeleteError = err;
      }

      expect(directDeleteError).toBeDefined();
      expect(String(directDeleteError)).toContain('Direct Deletion Prohibited');

      // Verify row is still intact
      const stillActive = await prisma.globalSku.findUnique({ where: { sku: testSku } });
      expect(stillActive).toBeDefined();
    });

    it('should update GlobalSku when product SKU is modified', async () => {
      const origSku = `ORIG-SKU-${Date.now()}`;
      const newSku = `UPDATED-SKU-${Date.now()}`;

      const prod = await prisma.product.create({
        data: {
          name: 'SKU Update Test',
          slug: `sku-upd-${Date.now()}`,
          sku: origSku,
          description: 'SKU Update Test',
          shortDescription: 'SKU Update',
          categoryId: testCategoryId,
          brandId: testBrandId,
          priceCents: 12000,
        },
      });

      // Update product SKU via API
      const patchRes = await fetch(`${baseUrl}/products/${prod.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ sku: newSku }),
      });

      expect(patchRes.status).toBe(200);

      // Verify old SKU is removed from GlobalSku and new SKU is present
      const oldReg = await prisma.globalSku.findUnique({ where: { sku: origSku } });
      const newReg = await prisma.globalSku.findUnique({ where: { sku: newSku } });
      expect(oldReg).toBeNull();
      expect(newReg).toBeDefined();
      expect(newReg?.productId).toBe(prod.id);
    });

    it('should cascade delete GlobalSku cleanly when parent product with variants is deleted', async () => {
      const parentSku = `CASCADE-PARENT-${Date.now()}`;
      const var1Sku = `${parentSku}-V01`;
      const var2Sku = `${parentSku}-V02`;

      const parent = await prisma.product.create({
        data: {
          name: 'Cascade Parent',
          slug: `casc-p-${Date.now()}`,
          sku: parentSku,
          description: 'Testing multi-variant cascade deletion',
          shortDescription: 'Cascade Parent',
          categoryId: testCategoryId,
          brandId: testBrandId,
          priceCents: 50000,
        },
      });

      const var1 = await prisma.productVariant.create({
        data: {
          productId: parent.id,
          name: 'Var 1',
          sku: var1Sku,
          priceCents: 52000,
          attributes: {},
        },
      });

      const var2 = await prisma.productVariant.create({
        data: {
          productId: parent.id,
          name: 'Var 2',
          sku: var2Sku,
          priceCents: 54000,
          attributes: {},
        },
      });

      // Verify all 3 are in GlobalSku
      const regParent = await prisma.globalSku.findUnique({ where: { sku: parentSku } });
      const regV1 = await prisma.globalSku.findUnique({ where: { sku: var1Sku } });
      const regV2 = await prisma.globalSku.findUnique({ where: { sku: var2Sku } });
      expect(regParent).toBeDefined();
      expect(regV1).toBeDefined();
      expect(regV2).toBeDefined();

      // Delete the parent product via hard delete
      await prisma.product.delete({ where: { id: parent.id } });

      // Verify all 3 GlobalSku entries were cascaded and removed cleanly
      const afterParent = await prisma.globalSku.findUnique({ where: { sku: parentSku } });
      const afterV1 = await prisma.globalSku.findUnique({ where: { sku: var1Sku } });
      const afterV2 = await prisma.globalSku.findUnique({ where: { sku: var2Sku } });
      expect(afterParent).toBeNull();
      expect(afterV1).toBeNull();
      expect(afterV2).toBeNull();
    });

    it('should update GlobalSku when ProductVariant SKU is modified', async () => {
      const parentSku = `VAR-PARENT-${Date.now()}`;
      const origVarSku = `VAR-ORIG-${Date.now()}`;
      const newVarSku = `VAR-NEW-${Date.now()}`;

      const parent = await prisma.product.create({
        data: {
          name: 'Variant Update Parent',
          slug: `var-upd-p-${Date.now()}`,
          sku: parentSku,
          description: 'Parent for variant SKU update test',
          shortDescription: 'Desc',
          categoryId: testCategoryId,
          brandId: testBrandId,
          priceCents: 40000,
        },
      });

      const variant = await prisma.productVariant.create({
        data: {
          productId: parent.id,
          name: 'Initial Variant',
          sku: origVarSku,
          priceCents: 42000,
          attributes: { color: 'Blue' },
        },
      });

      // Verify initial registration
      const initialReg = await prisma.globalSku.findUnique({ where: { sku: origVarSku } });
      expect(initialReg).toBeDefined();
      expect(initialReg?.ownerType).toBe('VARIANT');
      expect(initialReg?.variantId).toBe(variant.id);

      // Update variant SKU via API
      const patchRes = await fetch(`${baseUrl}/products/${parent.id}/variants/${variant.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ sku: newVarSku }),
      });

      expect(patchRes.status).toBe(200);

      // Verify old SKU removed, new SKU registered
      const oldReg = await prisma.globalSku.findUnique({ where: { sku: origVarSku } });
      const newReg = await prisma.globalSku.findUnique({ where: { sku: newVarSku } });
      expect(oldReg).toBeNull();
      expect(newReg).toBeDefined();
      expect(newReg?.variantId).toBe(variant.id);
      expect(newReg?.ownerType).toBe('VARIANT');

      // Parent product SKU remains untouched
      const parentReg = await prisma.globalSku.findUnique({ where: { sku: parentSku } });
      expect(parentReg).toBeDefined();
      expect(parentReg?.productId).toBe(parent.id);
    });

    it('should delete an individual ProductVariant and verify registry cleanup while parent remains', async () => {
      const parentSku = `INDIV-PARENT-${Date.now()}`;
      const varSku = `INDIV-VAR-${Date.now()}`;

      const parent = await prisma.product.create({
        data: {
          name: 'Indiv Parent',
          slug: `indiv-p-${Date.now()}`,
          sku: parentSku,
          description: 'Parent for individual variant deletion',
          shortDescription: 'Desc',
          categoryId: testCategoryId,
          brandId: testBrandId,
          priceCents: 30000,
        },
      });

      const variant = await prisma.productVariant.create({
        data: {
          productId: parent.id,
          name: 'Delete Target Variant',
          sku: varSku,
          priceCents: 32000,
          attributes: {},
        },
      });

      expect(await prisma.globalSku.findUnique({ where: { sku: varSku } })).toBeDefined();
      expect(await prisma.globalSku.findUnique({ where: { sku: parentSku } })).toBeDefined();

      // Hard delete only the variant
      await prisma.productVariant.delete({ where: { id: variant.id } });

      // Variant registry entry is deleted
      expect(await prisma.globalSku.findUnique({ where: { sku: varSku } })).toBeNull();

      // Parent product and its registry entry remain completely intact
      const activeParent = await prisma.globalSku.findUnique({ where: { sku: parentSku } });
      expect(activeParent).toBeDefined();
      expect(activeParent?.productId).toBe(parent.id);
    });

    it('should prohibit direct deletion of an active variant GlobalSku', async () => {
      const parentSku = `DIR-VAR-P-${Date.now()}`;
      const varSku = `DIR-VAR-${Date.now()}`;

      const parent = await prisma.product.create({
        data: {
          name: 'Dir Var Parent',
          slug: `dir-var-p-${Date.now()}`,
          sku: parentSku,
          description: 'Desc',
          shortDescription: 'Desc',
          categoryId: testCategoryId,
          brandId: testBrandId,
          priceCents: 20000,
        },
      });

      const variant = await prisma.productVariant.create({
        data: {
          productId: parent.id,
          name: 'Protected Variant',
          sku: varSku,
          priceCents: 22000,
          attributes: {},
        },
      });

      // Attempt direct DELETE on variant GlobalSku
      let directDeleteError: any = null;
      try {
        await prisma.$executeRawUnsafe(`DELETE FROM "GlobalSku" WHERE sku = '${varSku}'`);
      } catch (err) {
        directDeleteError = err;
      }

      expect(directDeleteError).toBeDefined();
      expect(String(directDeleteError)).toContain('Direct Deletion Prohibited');
      expect(String(directDeleteError)).toContain('ProductVariant');

      // Verify row is still intact
      const stillActive = await prisma.globalSku.findUnique({ where: { sku: varSku } });
      expect(stillActive).toBeDefined();
    });

    it('should reject direct GlobalSku mutations creating SKU or ownership mismatches', async () => {
      const prodSku = `MUT-PROD-${Date.now()}`;
      const prod = await prisma.product.create({
        data: {
          name: 'Mutation Test Prod',
          slug: `mut-prod-${Date.now()}`,
          sku: prodSku,
          description: 'Desc',
          shortDescription: 'Desc',
          categoryId: testCategoryId,
          brandId: testBrandId,
          priceCents: 20000,
        },
      });

      // 1. Direct UPDATE creating SKU mismatch with source Product
      let skuMismatchErr: any = null;
      try {
        await prisma.$executeRawUnsafe(`UPDATE "GlobalSku" SET sku = 'ROGUE-MISMATCH-SKU' WHERE sku = '${prodSku}'`);
      } catch (err) {
        skuMismatchErr = err;
      }
      expect(skuMismatchErr).toBeDefined();
      expect(String(skuMismatchErr)).toContain('GlobalSku Integrity Violation');

      // 2. Direct INSERT referencing non-existent product ID
      let fakeFkErr: any = null;
      try {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "GlobalSku" (sku, "ownerType", "productId", "variantId", "createdAt")
          VALUES ('FAKE-SKU-999', 'PRODUCT', 'non-existent-product-id', NULL, NOW())
        `);
      } catch (err) {
        fakeFkErr = err;
      }
      expect(fakeFkErr).toBeDefined();
      expect(String(fakeFkErr)).toContain('does not exist');

      // 3. Direct INSERT violating structural CHECK constraint (PRODUCT with variantId)
      let structViolationErr: any = null;
      try {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "GlobalSku" (sku, "ownerType", "productId", "variantId", "createdAt")
          VALUES ('STRUCT-FAIL-SKU', 'PRODUCT', '${prod.id}', 'some-fake-variant-id', NOW())
        `);
      } catch (err) {
        structViolationErr = err;
      }
      expect(structViolationErr).toBeDefined();
    });
  });

  describe('5. Invariant Stock Protection', () => {
    it('should verify protected product stock remains strictly 10', async () => {
      const protectedProduct = await prisma.product.findUnique({
        where: { id: 'cmw0j4cro00089kusmwsbv48t' },
        select: { id: true, name: true, sku: true, stockQuantity: true },
      });

      expect(protectedProduct).toBeDefined();
      expect(protectedProduct?.stockQuantity).toBe(10);
    });
  });
});
