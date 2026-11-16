import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import * as crypto from 'crypto';

describe('Product Import Execution Engine Integration Tests (Stage 4)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl: string;

  let superAdminToken: string;
  const superAdminId = 'cmw07gefq0000pousyxdsoal6';

  let secondaryAdminId: string;
  let secondaryAdminToken: string;

  let testCategoryId: string;
  let testSubcategoryId: string;
  let testBrandId: string;

  let createdProductIds: string[] = [];
  let createdBatchIds: string[] = [];
  let createdPreviewIds: string[] = [];

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
    baseUrl = `http://127.0.0.1:${port}/api/v1`;

    prisma = app.get(PrismaService);
    const jwt = app.get(JwtService);

    superAdminToken = jwt.sign({
      sub: superAdminId,
      email: 'admin@dslstationery.lk',
      role: 'ADMIN',
    });

    const superAdminRole = await prisma.role.findUnique({ where: { slug: 'super_admin' } });
    if (superAdminRole) {
      await prisma.user.update({
        where: { id: superAdminId },
        data: { roleId: superAdminRole.id },
      });
    }

    const orderRole = await prisma.role.findUnique({ where: { slug: 'order_manager' } });
    // Create a secondary admin for ownership & cross-admin tests
    const secAdmin = await prisma.user.create({
      data: {
        email: `sec-admin-${Date.now()}@dslstationery.lk`,
        name: 'Secondary Admin',
        role: 'ADMIN',
        roleId: orderRole?.id,
        isActive: true,
      },
    });
    secondaryAdminId = secAdmin.id;
    secondaryAdminToken = jwt.sign({
      sub: secAdmin.id,
      email: secAdmin.email,
      role: 'ADMIN',
    });

    // Create test category, subcategory, brand
    const cat = await prisma.category.create({
      data: {
        name: `Stage4 Cat ${Date.now()}`,
        slug: `stage4-cat-${Date.now()}`,
        description: 'Stage4 test category',
      },
    });
    testCategoryId = cat.id;

    const subcat = await prisma.category.create({
      data: {
        name: `Stage4 Subcat ${Date.now()}`,
        slug: `stage4-subcat-${Date.now()}`,
        description: 'Stage4 test subcategory',
        parentId: cat.id,
      },
    });
    testSubcategoryId = subcat.id;

    const brand = await prisma.brand.create({
      data: {
        name: `Stage4 Brand ${Date.now()}`,
        slug: `stage4-brand-${Date.now()}`,
        originCountry: 'Sri Lanka',
        description: 'Stage4 test brand',
      },
    });
    testBrandId = brand.id;

    // Reset global lease to IDLE before tests
    await prisma.importExecutionLease.upsert({
      where: { id: 'GLOBAL_IMPORT_LEASE' },
      create: {
        id: 'GLOBAL_IMPORT_LEASE',
        status: 'IDLE',
        currentChunk: 0,
        expiresAt: new Date(Date.now() - 1000),
      },
      update: {
        status: 'IDLE',
        batchId: null,
        ownerId: null,
        currentChunk: 0,
        expiresAt: new Date(Date.now() - 1000),
      },
    });
  }, 45000);

  afterAll(async () => {
    // Clean up created entities
    if (createdPreviewIds.length > 0 || createdBatchIds.length > 0) {
      await prisma.productImportRowResult.deleteMany({
        where: {
          OR: [
            { batchId: { in: createdBatchIds } },
            { batch: { previewId: { in: createdPreviewIds } } },
          ],
        },
      }).catch(() => { });
      await prisma.productImportBatch.deleteMany({
        where: {
          OR: [
            { id: { in: createdBatchIds } },
            { previewId: { in: createdPreviewIds } },
          ],
        },
      }).catch(() => { });
      await prisma.productImportPreview.deleteMany({
        where: { id: { in: createdPreviewIds } },
      }).catch(() => { });
    }

    if (testCategoryId || testBrandId) {
      const leftoverProds = await prisma.product.findMany({
        where: {
          OR: [
            ...(testCategoryId ? [{ categoryId: testCategoryId }] : []),
            ...(testSubcategoryId ? [{ subcategoryId: testSubcategoryId }] : []),
            ...(testBrandId ? [{ brandId: testBrandId }] : []),
          ],
        },
        select: { id: true },
      }).catch(() => []);
      const pIds = [...new Set([...createdProductIds, ...leftoverProds.map((p) => p.id)])];
      if (pIds.length > 0) {
        await prisma.inventoryMovement.deleteMany({
          where: { productId: { in: pIds } },
        }).catch(() => { });
        await prisma.productVariant.deleteMany({
          where: { productId: { in: pIds } },
        }).catch(() => { });
        await prisma.product.deleteMany({
          where: { id: { in: pIds } },
        }).catch(() => { });
        await prisma.globalSku.deleteMany({
          where: { productId: { in: pIds } },
        }).catch(() => { });
      }
    }

    if (secondaryAdminId) {
      await prisma.user.delete({ where: { id: secondaryAdminId } }).catch(() => { });
    }

    if (testSubcategoryId) {
      await prisma.category.delete({ where: { id: testSubcategoryId } }).catch(() => { });
    }
    if (testCategoryId) {
      await prisma.category.delete({ where: { id: testCategoryId } }).catch(() => { });
    }
    if (testBrandId) {
      await prisma.brand.delete({ where: { id: testBrandId } }).catch(() => { });
    }

    // Reset lease
    await prisma.importExecutionLease.update({
      where: { id: 'GLOBAL_IMPORT_LEASE' },
      data: { status: 'IDLE', batchId: null, ownerId: null, currentChunk: 0 },
    }).catch(() => { });

    if (app) {
      await app.close();
    }
  }, 30000);

  // Helper to generate preview via POST /products/import/preview
  async function generatePreview(csvContent: string, token: string = superAdminToken) {
    const formData = new FormData();
    const blob = new Blob([csvContent], { type: 'text/csv' });
    formData.append('file', blob, 'import.csv');

    const res = await fetch(`${baseUrl}/products/import/preview`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const json = await res.json();
    if (json.data?.previewId) {
      createdPreviewIds.push(json.data.previewId);
    }
    return { status: res.status, data: json.data };
  }

  describe('1. Preview Persistence & Checksum Security', () => {
    it('should persist preview in database with valid checksum and expiration', async () => {
      const csv = `SKU,Product Name,Category,Subcategory,Brand,Selling Price,Cost Price,Stock Quantity
S4-ITEM-101,Stage4 Item 101,${testCategoryId},${testSubcategoryId},${testBrandId},250.00,180.00,25`;

      const { status, data } = await generatePreview(csv);
      expect(status).toBe(201);
      expect(data.previewId).toBeDefined();
      expect(data.previewChecksum).toBeDefined();
      expect(data.expiresAt).toBeDefined();

      const dbPreview = await prisma.productImportPreview.findUnique({
        where: { id: data.previewId },
      });
      expect(dbPreview).not.toBeNull();
      expect(dbPreview?.previewChecksum).toBe(data.previewChecksum);
      expect(dbPreview?.createdById).toBe(superAdminId);
    });

    it('should reject execution when preview checksum is invalid or tampered', async () => {
      const csv = `SKU,Product Name,Category,Subcategory,Brand,Selling Price,Cost Price,Stock Quantity
S4-ITEM-TAMPER,Stage4 Tamper Item,${testCategoryId},${testSubcategoryId},${testBrandId},100.00,70.00,10`;

      const { data } = await generatePreview(csv);

      const res = await fetch(`${baseUrl}/products/import/execute`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          previewId: data.previewId,
          previewChecksum: 'tampered-sha256-checksum-that-does-not-match',
          stockMode: 'SET_STOCK',
          allowUpdates: true,
          idempotencyKey: `idemp-${Date.now()}`,
        }),
      });

      expect(res.status).toBe(400);
      const err = await res.json();
      expect(err.message).toContain('ERR_PREVIEW_CORRUPTED');
    });

    it('should reject execution when preview was generated by a different administrator', async () => {
      const csv = `SKU,Product Name,Category,Subcategory,Brand,Selling Price,Cost Price,Stock Quantity
S4-ITEM-OWNER,Stage4 Owner Item,${testCategoryId},${testSubcategoryId},${testBrandId},120.00,80.00,15`;

      const { data } = await generatePreview(csv, superAdminToken);

      // Attempt to execute with secondary admin
      const res = await fetch(`${baseUrl}/products/import/execute`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secondaryAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          previewId: data.previewId,
          previewChecksum: data.previewChecksum,
          stockMode: 'SET_STOCK',
          allowUpdates: true,
          idempotencyKey: `idemp-owner-${Date.now()}`,
        }),
      });

      expect(res.status).toBe(403);
    });

    it('should reject execution when preview has expired', async () => {
      const csv = `SKU,Product Name,Category,Subcategory,Brand,Selling Price,Cost Price,Stock Quantity
S4-ITEM-EXP,Stage4 Expired Item,${testCategoryId},${testSubcategoryId},${testBrandId},150.00,90.00,20`;

      const { data } = await generatePreview(csv);

      // Manually set preview expiresAt in the past
      await prisma.productImportPreview.update({
        where: { id: data.previewId },
        data: { expiresAt: new Date(Date.now() - 60000) },
      });

      const res = await fetch(`${baseUrl}/products/import/execute`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          previewId: data.previewId,
          previewChecksum: data.previewChecksum,
          stockMode: 'SET_STOCK',
          allowUpdates: true,
          idempotencyKey: `idemp-exp-${Date.now()}`,
        }),
      });

      expect(res.status).toBe(400);
      const err = await res.json();
      expect(err.message).toContain('expired');
    });
  });

  describe('2. Idempotent Import Execution & Global Lease', () => {
    it('should execute import, create product, create inventory movement, and record batch', async () => {
      const sku = `S4-EXEC-${Date.now()}`;
      const csv = `SKU,Product Name,Category,Subcategory,Brand,Selling Price,Cost Price,Stock Quantity
${sku},Execution Product ${sku},${testCategoryId},${testSubcategoryId},${testBrandId},300.00,200.00,40`;

      const { data: previewData } = await generatePreview(csv);
      const idempotencyKey = `idemp-exec-${Date.now()}`;

      const res = await fetch(`${baseUrl}/products/import/execute`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          previewId: previewData.previewId,
          previewChecksum: previewData.previewChecksum,
          stockMode: 'SET_STOCK',
          allowUpdates: true,
          idempotencyKey,
        }),
      });

      expect(res.status).toBe(201);
      const result = await res.json();
      if (result.data.status !== 'COMPLETED') {
        console.log('EXECUTION ROW RESULTS:', JSON.stringify(result.data.rowResults, null, 2));
      }
      expect(result.data.status).toBe('COMPLETED');
      expect(result.data.successfulRows).toBe(1);
      expect(result.data.failedRows).toBe(0);
      createdBatchIds.push(result.data.batchId);

      // Verify product in database
      const createdProd = await prisma.product.findUnique({
        where: { sku },
        include: { movements: true, globalSku: true },
      });
      expect(createdProd).not.toBeNull();
      createdProductIds.push(createdProd!.id);
      expect(createdProd?.stockQuantity).toBe(40);
      expect(createdProd?.globalSku?.ownerType).toBe('PRODUCT');
      expect(createdProd?.movements.length).toBeGreaterThan(0);

      // Verify global lease returned to IDLE
      const lease = await prisma.importExecutionLease.findUnique({
        where: { id: 'GLOBAL_IMPORT_LEASE' },
      });
      expect(lease?.status).toBe('IDLE');
      expect(lease?.batchId).toBeNull();
    });

    it('should return existing batch idempotently without duplicating stock on duplicate request', async () => {
      const sku = `S4-IDEMP-${Date.now()}`;
      const csv = `SKU,Product Name,Category,Subcategory,Brand,Selling Price,Cost Price,Stock Quantity
${sku},Idempotent Product ${sku},${testCategoryId},${testSubcategoryId},${testBrandId},400.00,250.00,30`;

      const { data: previewData } = await generatePreview(csv);
      const idempotencyKey = `idemp-repeat-${Date.now()}`;

      // First execution
      const res1 = await fetch(`${baseUrl}/products/import/execute`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          previewId: previewData.previewId,
          previewChecksum: previewData.previewChecksum,
          stockMode: 'ADD_STOCK',
          allowUpdates: true,
          idempotencyKey,
        }),
      });
      expect(res1.status).toBe(201);
      const json1 = await res1.json();
      createdBatchIds.push(json1.data.batchId);

      const prodAfterFirst = await prisma.product.findUnique({ where: { sku } });
      createdProductIds.push(prodAfterFirst!.id);
      expect(prodAfterFirst?.stockQuantity).toBe(30);

      // Second execution with SAME idempotency key and same parameters
      const res2 = await fetch(`${baseUrl}/products/import/execute`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          previewId: previewData.previewId,
          previewChecksum: previewData.previewChecksum,
          stockMode: 'ADD_STOCK',
          allowUpdates: true,
          idempotencyKey,
        }),
      });
      expect(res2.status).toBe(201);
      const json2 = await res2.json();
      expect(json2.data.batchId).toBe(json1.data.batchId);

      // Ensure stock was NOT added twice!
      const prodAfterSecond = await prisma.product.findUnique({ where: { sku } });
      expect(prodAfterSecond?.stockQuantity).toBe(30);
    });

    it('should reject idempotency key reuse with mismatched parameters (409 Conflict)', async () => {
      const sku = `S4-MISMATCH-${Date.now()}`;
      const csv = `SKU,Product Name,Category,Subcategory,Brand,Selling Price,Cost Price,Stock Quantity
${sku},Mismatch Product ${sku},${testCategoryId},${testSubcategoryId},${testBrandId},200.00,120.00,10`;

      const { data: previewData } = await generatePreview(csv);
      const idempotencyKey = `idemp-mismatch-${Date.now()}`;

      // Execute with SET_STOCK
      await fetch(`${baseUrl}/products/import/execute`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          previewId: previewData.previewId,
          previewChecksum: previewData.previewChecksum,
          stockMode: 'SET_STOCK',
          allowUpdates: true,
          idempotencyKey,
        }),
      });

      // Repeat with ADD_STOCK -> 409 Conflict
      const resMismatch = await fetch(`${baseUrl}/products/import/execute`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          previewId: previewData.previewId,
          previewChecksum: previewData.previewChecksum,
          stockMode: 'ADD_STOCK', // Different parameter!
          allowUpdates: true,
          idempotencyKey,
        }),
      });

      expect(resMismatch.status).toBe(409);
      const err = await resMismatch.json();
      expect(err.message).toContain('ERR_IDEMPOTENCY_MISMATCH');
    });

    it('should reject idempotency key reuse across different administrators (403 Forbidden)', async () => {
      const sku = `S4-CROSS-ADMIN-${Date.now()}`;
      const csv = `SKU,Product Name,Category,Subcategory,Brand,Selling Price,Cost Price,Stock Quantity
${sku},Cross Admin Product ${sku},${testCategoryId},${testSubcategoryId},${testBrandId},200.00,120.00,10`;

      const { data: previewData } = await generatePreview(csv, superAdminToken);
      const idempotencyKey = `idemp-cross-${Date.now()}`;

      // Executed by Super Admin
      await fetch(`${baseUrl}/products/import/execute`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          previewId: previewData.previewId,
          previewChecksum: previewData.previewChecksum,
          stockMode: 'SET_STOCK',
          allowUpdates: true,
          idempotencyKey,
        }),
      });

      // Secondary Admin tries to reuse the same idempotency key
      const resCross = await fetch(`${baseUrl}/products/import/execute`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secondaryAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          previewId: previewData.previewId,
          previewChecksum: previewData.previewChecksum,
          stockMode: 'SET_STOCK',
          allowUpdates: true,
          idempotencyKey,
        }),
      });

      expect(resCross.status).toBe(403);
    });
  });

  describe('3. Stock Modes, Movements & Reservation Protection', () => {
    it('should correctly apply SET_STOCK mode vs ADD_STOCK mode', async () => {
      const sku = `S4-STOCKMODES-${Date.now()}`;
      // Initial creation with 20 units
      const csv1 = `SKU,Product Name,Category,Subcategory,Brand,Selling Price,Cost Price,Stock Quantity
${sku},Stock Modes Product,${testCategoryId},${testSubcategoryId},${testBrandId},150.00,100.00,20`;

      const { data: p1 } = await generatePreview(csv1);
      await fetch(`${baseUrl}/products/import/execute`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          previewId: p1.previewId,
          previewChecksum: p1.previewChecksum,
          stockMode: 'SET_STOCK',
          allowUpdates: true,
          idempotencyKey: `idemp-stk-1-${Date.now()}`,
        }),
      });

      let prod = await prisma.product.findUnique({ where: { sku } });
      createdProductIds.push(prod!.id);
      expect(prod?.stockQuantity).toBe(20);

      // ADD_STOCK 15 units -> 35
      const csv2 = `SKU,Product Name,Category,Subcategory,Brand,Selling Price,Cost Price,Stock Quantity
${sku},Stock Modes Product,${testCategoryId},${testSubcategoryId},${testBrandId},150.00,100.00,15`;
      const { data: p2 } = await generatePreview(csv2);
      await fetch(`${baseUrl}/products/import/execute`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          previewId: p2.previewId,
          previewChecksum: p2.previewChecksum,
          stockMode: 'ADD_STOCK',
          allowUpdates: true,
          idempotencyKey: `idemp-stk-2-${Date.now()}`,
        }),
      });

      prod = await prisma.product.findUnique({ where: { sku } });
      expect(prod?.stockQuantity).toBe(35);

      // SET_STOCK 50 units -> 50
      const csv3 = `SKU,Product Name,Category,Subcategory,Brand,Selling Price,Cost Price,Stock Quantity
${sku},Stock Modes Product,${testCategoryId},${testSubcategoryId},${testBrandId},150.00,100.00,50`;
      const { data: p3 } = await generatePreview(csv3);
      await fetch(`${baseUrl}/products/import/execute`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          previewId: p3.previewId,
          previewChecksum: p3.previewChecksum,
          stockMode: 'SET_STOCK',
          allowUpdates: true,
          idempotencyKey: `idemp-stk-3-${Date.now()}`,
        }),
      });

      prod = await prisma.product.findUnique({ where: { sku } });
      expect(prod?.stockQuantity).toBe(50);
    });

    it('should protect active checkout stock reservations from reduction breaches', async () => {
      const sku = `S4-RES-${Date.now()}`;
      // Create product with 50 units
      const csv = `SKU,Product Name,Category,Subcategory,Brand,Selling Price,Cost Price,Stock Quantity
${sku},Reserved Product,${testCategoryId},${testSubcategoryId},${testBrandId},100.00,60.00,50`;

      const { data: pInit } = await generatePreview(csv);
      await fetch(`${baseUrl}/products/import/execute`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          previewId: pInit.previewId,
          previewChecksum: pInit.previewChecksum,
          stockMode: 'SET_STOCK',
          allowUpdates: true,
          idempotencyKey: `idemp-res-init-${Date.now()}`,
        }),
      });

      const prod = await prisma.product.findUnique({ where: { sku } });
      createdProductIds.push(prod!.id);

      // Create an active stock reservation for 40 units on this product
      const reservation = await prisma.stockReservation.create({
        data: {
          expiresAt: new Date(Date.now() + 15 * 60 * 1000), // active for 15 minutes
          status: 'ACTIVE',
          items: {
            create: {
              productId: prod!.id,
              quantity: 40,
              unitPriceCents: 10000,
            },
          },
        },
      });

      // Now attempt an import that sets stock to 10 (which is less than the 40 reserved units!)
      const breachCsv = `SKU,Product Name,Category,Subcategory,Brand,Selling Price,Cost Price,Stock Quantity
${sku},Reserved Product,${testCategoryId},${testSubcategoryId},${testBrandId},100.00,60.00,10`;

      const { data: pBreach } = await generatePreview(breachCsv);
      const resBreach = await fetch(`${baseUrl}/products/import/execute`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          previewId: pBreach.previewId,
          previewChecksum: pBreach.previewChecksum,
          stockMode: 'SET_STOCK',
          allowUpdates: true,
          idempotencyKey: `idemp-breach-${Date.now()}`,
        }),
      });

      expect(resBreach.status).toBe(201);
      const breachResult = await resBreach.json();
      expect(breachResult.data.status).toBe('PARTIALLY_FAILED');
      expect(breachResult.data.failedRows).toBe(1);

      // Verify row result error code
      const rowResult = await prisma.productImportRowResult.findFirst({
        where: { batchId: breachResult.data.batchId },
      });
      expect(rowResult?.errorCode).toBe('ERR_RESERVED_STOCK_BREACH');

      // Verify physical stock was NOT breached (remained 50)
      const prodCheck = await prisma.product.findUnique({ where: { sku } });
      expect(prodCheck?.stockQuantity).toBe(50);

      // Clean up reservation
      await prisma.stockReservationItem.deleteMany({ where: { reservationId: reservation.id } });
      await prisma.stockReservation.delete({ where: { id: reservation.id } });
    });
  });

  describe('4. Concurrency Snapshot Protection', () => {
    it('should reject catalog modification if product was updated after preview generation', async () => {
      const sku = `S4-CONCUR-${Date.now()}`;
      // Initial creation
      const csv = `SKU,Product Name,Category,Subcategory,Brand,Selling Price,Cost Price,Stock Quantity
${sku},Concurrency Product,${testCategoryId},${testSubcategoryId},${testBrandId},100.00,60.00,20`;

      const { data: pInit } = await generatePreview(csv);
      await fetch(`${baseUrl}/products/import/execute`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          previewId: pInit.previewId,
          previewChecksum: pInit.previewChecksum,
          stockMode: 'SET_STOCK',
          allowUpdates: true,
          idempotencyKey: `idemp-concur-init-${Date.now()}`,
        }),
      });

      const prod = await prisma.product.findUnique({ where: { sku } });
      createdProductIds.push(prod!.id);

      // Generate preview for update
      const updateCsv = `SKU,Product Name,Category,Subcategory,Brand,Selling Price,Cost Price,Stock Quantity
${sku},Concurrency Product New Name,${testCategoryId},${testSubcategoryId},${testBrandId},120.00,70.00,25`;
      const { data: pUpdate } = await generatePreview(updateCsv);

      // Simulate concurrent administrator update in database
      await prisma.product.update({
        where: { id: prod!.id },
        data: { name: 'Interfering Concurrent Update Name' },
      });

      // Now execute the update import
      const res = await fetch(`${baseUrl}/products/import/execute`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          previewId: pUpdate.previewId,
          previewChecksum: pUpdate.previewChecksum,
          stockMode: 'SET_STOCK',
          allowUpdates: true,
          idempotencyKey: `idemp-concur-exec-${Date.now()}`,
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.status).toBe('PARTIALLY_FAILED');
      expect(json.data.failedRows).toBe(1);

      const rowResult = await prisma.productImportRowResult.findFirst({
        where: { batchId: json.data.batchId },
      });
      expect(rowResult?.errorCode).toBe('ERR_CONCURRENT_CATALOG_UPDATE');
    });
  });

  describe('5. Import History & Error Report APIs', () => {
    it('should retrieve paginated execution history', async () => {
      const res = await fetch(`${baseUrl}/products/import/history?page=1&limit=10`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.items).toBeDefined();
      expect(Array.isArray(json.data.items)).toBe(true);
      expect(json.data.meta).toBeDefined();
    });

    it('should download batch error report as CSV', async () => {
      // Find a batch that had failed rows
      const failedBatch = await prisma.productImportBatch.findFirst({
        where: { failedRows: { gt: 0 } },
      });

      if (failedBatch) {
        const res = await fetch(
          `${baseUrl}/products/import/batch/${failedBatch.id}/error-report?format=csv`,
          {
            headers: { Authorization: `Bearer ${superAdminToken}` },
          }
        );

        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toContain('text/csv');
        const text = await res.text();
        expect(text).toContain('Row Number');
        expect(text).toContain('Error Code');
      }
    });
  });

  describe('6. Invariants & Security Guardrails Verification', () => {
    it('should strictly guarantee protected product stock remains exactly 10 units', async () => {
      const protectedProd = await prisma.product.findUnique({
        where: { id: 'cmw0j4cro00089kusmwsbv48t' },
        select: { id: true, name: true, sku: true, stockQuantity: true },
      });
      expect(protectedProd).not.toBeNull();
      expect(protectedProd?.stockQuantity).toBe(10);
    });

    it('should guarantee zero unauthorized role permission grants for products.import', async () => {
      const rolePermCount = await prisma.rolePermission.count({
        where: {
          permission: { key: 'products.import' },
          role: { slug: { notIn: ['super_admin', 'product_manager', 'project_manager'] } },
        },
      });
      expect(rolePermCount).toBe(0);
    });
  });
});
