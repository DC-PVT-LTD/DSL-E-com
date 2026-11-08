import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as ExcelJS from 'exceljs';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';

describe('Product Import Preparation Engine Integration Tests (Stage 3)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl: string;
  let adminToken: string;
  let customerToken: string;
  let unauthorizedAdminToken: string;
  let authorizedAdminToken: string;
  let quarantinedAdminToken: string;

  let testCustomerUserId: string;
  let testUnauthorizedAdminId: string;
  let testAuthorizedAdminId: string;
  let testQuarantinedAdminId: string;

  let existingProdId: string;
  let existingProdSku: string;
  let testCategoryId: string;
  let testCategorySlug: string;
  let testSubcategoryId: string;
  let testSubcategorySlug: string;
  let otherCategoryId: string;
  let testBrandId: string;
  let testBrandSlug: string;

  let preTestProductCount: number;
  let preTestVariantCount: number;
  let preTestGlobalSkuCount: number;

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

    adminToken = jwt.sign({
      sub: 'cmw07gefq0000pousyxdsoal6',
      email: 'admin@dslstationery.lk',
      role: 'ADMIN',
    });

    // 0. Setup test users for granular database-backed permission tests
    const customer = await prisma.user.create({
      data: {
        email: `cust-${Date.now()}@test.com`,
        name: 'Test Customer',
        role: 'CUSTOMER',
        isActive: true,
      },
    });
    testCustomerUserId = customer.id;
    customerToken = jwt.sign({
      sub: customer.id,
      email: customer.email,
      role: 'CUSTOMER',
    });

    const orderRole = await prisma.role.findUnique({ where: { slug: 'order_manager' } });
    const unauthorizedAdmin = await prisma.user.create({
      data: {
        email: `ord-mgr-${Date.now()}@dslstationery.lk`,
        name: 'Order Manager Admin',
        role: 'ADMIN',
        roleId: orderRole?.id,
        isActive: true,
      },
    });
    testUnauthorizedAdminId = unauthorizedAdmin.id;
    unauthorizedAdminToken = jwt.sign({
      sub: unauthorizedAdmin.id,
      email: unauthorizedAdmin.email,
      role: 'ADMIN',
    });

    const prodRole = await prisma.role.findUnique({ where: { slug: 'product_manager' } });
    const authorizedAdmin = await prisma.user.create({
      data: {
        email: `prod-mgr-${Date.now()}@dslstationery.lk`,
        name: 'Product Manager Admin',
        role: 'ADMIN',
        roleId: prodRole?.id,
        isActive: true,
      },
    });
    testAuthorizedAdminId = authorizedAdmin.id;
    authorizedAdminToken = jwt.sign({
      sub: authorizedAdmin.id,
      email: authorizedAdmin.email,
      role: 'ADMIN',
    });

    const quarantinedAdmin = await prisma.user.create({
      data: {
        email: `quarantine-${Date.now()}@dslstationery.lk`,
        name: 'Quarantined Admin',
        role: 'ADMIN',
        roleId: null,
        isActive: true,
      },
    });
    testQuarantinedAdminId = quarantinedAdmin.id;
    quarantinedAdminToken = jwt.sign({
      sub: quarantinedAdmin.id,
      email: quarantinedAdmin.email,
      role: 'ADMIN',
    });

    // 1. Create test root category
    testCategorySlug = `import-test-cat-${Date.now()}`;
    const cat = await prisma.category.create({
      data: {
        name: `Import Test Cat ${Date.now()}`,
        slug: testCategorySlug,
        description: 'Test category description',
      },
    });
    testCategoryId = cat.id;

    // 2. Create test subcategory under testCategoryId
    testSubcategorySlug = `import-test-subcat-${Date.now()}`;
    const subcat = await prisma.category.create({
      data: {
        name: `Import Test Subcat ${Date.now()}`,
        slug: testSubcategorySlug,
        description: 'Test subcategory description',
        parentId: testCategoryId,
      },
    });
    testSubcategoryId = subcat.id;

    // 3. Create an unrelated category to test subcategory hierarchy mismatches
    const otherCat = await prisma.category.create({
      data: {
        name: `Unrelated Cat ${Date.now()}`,
        slug: `unrelated-cat-${Date.now()}`,
        description: 'Unrelated root category',
      },
    });
    otherCategoryId = otherCat.id;

    // 4. Create test brand
    testBrandSlug = `import-test-brd-${Date.now()}`;
    const brd = await prisma.brand.create({
      data: {
        name: `Import Brand ${Date.now()}`,
        slug: testBrandSlug,
        originCountry: 'Sri Lanka',
        description: 'Test brand description',
      },
    });
    testBrandId = brd.id;

    // 5. Create an existing product in DB to test existing SKU collision
    existingProdSku = `EXISTING-SKU-${Date.now().toString().slice(-6)}`;
    const existingProduct = await prisma.product.create({
      data: {
        name: 'Existing Database Product',
        slug: `existing-product-${Date.now()}`,
        sku: existingProdSku,
        description: 'A pre-existing product in db',
        shortDescription: 'Pre-existing',
        categoryId: testCategoryId,
        brandId: testBrandId,
        priceCents: 45000,
        stockQuantity: 100,
      },
    });
    existingProdId = existingProduct.id;

    // Record baseline database counts
    preTestProductCount = await prisma.product.count();
    preTestVariantCount = await prisma.productVariant.count();
    preTestGlobalSkuCount = await prisma.globalSku.count();
  }, 30000);

  afterAll(async () => {
    // Clean up created entities
    if (existingProdId) {
      await prisma.product.delete({ where: { id: existingProdId } }).catch(() => { });
    }
    if (testSubcategoryId) {
      await prisma.category.delete({ where: { id: testSubcategoryId } }).catch(() => { });
    }
    if (testCategoryId) {
      await prisma.category.delete({ where: { id: testCategoryId } }).catch(() => { });
    }
    if (otherCategoryId) {
      await prisma.category.delete({ where: { id: otherCategoryId } }).catch(() => { });
    }
    if (testBrandId) {
      await prisma.brand.delete({ where: { id: testBrandId } }).catch(() => { });
    }
    if (testCustomerUserId) {
      await prisma.user.delete({ where: { id: testCustomerUserId } }).catch(() => { });
    }
    if (testUnauthorizedAdminId) {
      await prisma.user.delete({ where: { id: testUnauthorizedAdminId } }).catch(() => { });
    }
    if (testAuthorizedAdminId) {
      await prisma.user.delete({ where: { id: testAuthorizedAdminId } }).catch(() => { });
    }
    if (testQuarantinedAdminId) {
      await prisma.user.delete({ where: { id: testQuarantinedAdminId } }).catch(() => { });
    }
    if (app) {
      await app.close();
    }
  }, 30000);

  describe('1. Template Endpoints', () => {
    it('should download Excel template with correct content-type and headers', async () => {
      const res = await fetch(`${baseUrl}/products/import/template/excel`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(res.headers.get('content-disposition')).toContain(
        'dsl-product-import-template.xlsx'
      );

      const arrayBuf = await res.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Buffer.from(arrayBuf) as any);
      expect(workbook.worksheets.length).toBe(2);
      expect(workbook.worksheets[0].name).toBe('Product Template');
      expect(workbook.worksheets[1].name).toBe('Instructions & Field Guide');
    });

    it('should download CSV template with correct content-type and headers', async () => {
      const res = await fetch(`${baseUrl}/products/import/template/csv`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/csv');
      expect(res.headers.get('content-disposition')).toContain(
        'dsl-product-import-template.csv'
      );

      const text = await res.text();
      expect(text).toContain('Product Name *');
      expect(text).toContain('Selling Price (LKR) *');
      expect(text).toContain('Writing Instruments');
    });
  });

  describe('2. Import Preview & Validation', () => {
    it('should successfully parse and validate a valid CSV upload', async () => {
      const csvContent = `SKU,Product Name *,Category *,Subcategory,Brand *,Selling Price (LKR) *,Stock Quantity *,Cost Price (LKR)
IMPORT-VALID-01,Valid Test Item 1,${testCategorySlug},${testSubcategorySlug},${testBrandSlug},150.00,50,110.00
IMPORT-VALID-02,Valid Test Item 2,${testCategorySlug},,${testBrandSlug},85.00,30,60.00`;

      const formData = new FormData();
      const blob = new Blob([csvContent], { type: 'text/csv' });
      formData.append('file', blob, 'import_valid.csv');

      const res = await fetch(`${baseUrl}/products/import/preview`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: formData,
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.summary.totalRows).toBe(2);
      expect(json.data.summary.validRows).toBe(2);
      expect(json.data.summary.invalidRows).toBe(0);
      expect(json.data.rows[0].status).toBe('VALID');
      expect(json.data.rows[1].status).toBe('VALID');
    });

    it('should detect category/subcategory mismatches during preview', async () => {
      // Use unrelated category as category, but testSubcategorySlug as subcategory
      const csvContent = `SKU,Product Name *,Category *,Subcategory,Brand *,Selling Price (LKR) *,Stock Quantity *
IMPORT-BAD-CAT,Bad Hierarchy Item,Unrelated Cat ${Date.now().toString().slice(-4)},${testSubcategorySlug},${testBrandSlug},120.00,20`;

      const formData = new FormData();
      const blob = new Blob([csvContent], { type: 'text/csv' });
      formData.append('file', blob, 'mismatched_hierarchy.csv');

      const res = await fetch(`${baseUrl}/products/import/preview`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: formData,
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.summary.invalidRows).toBeGreaterThan(0);
      expect(json.data.rows[0].status).toBe('INVALID');
    });

    it('should detect duplicate SKUs within the file', async () => {
      const dupSku = `DUP-FILE-SKU-${Date.now().toString().slice(-5)}`;
      const csvContent = `SKU,Product Name *,Category *,Brand *,Selling Price (LKR) *,Stock Quantity *
${dupSku},First Item,${testCategorySlug},${testBrandSlug},100.00,10
${dupSku},Duplicate Item,${testCategorySlug},${testBrandSlug},100.00,10`;

      const formData = new FormData();
      const blob = new Blob([csvContent], { type: 'text/csv' });
      formData.append('file', blob, 'file_dupes.csv');

      const res = await fetch(`${baseUrl}/products/import/preview`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: formData,
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.summary.duplicateRows).toBe(2);
      expect(json.data.rows[0].status).toBe('DUPLICATE_IN_FILE');
      expect(json.data.rows[1].status).toBe('DUPLICATE_IN_FILE');
    });

    it('should detect existing database SKUs via GlobalSku', async () => {
      const csvContent = `SKU,Product Name *,Category *,Brand *,Selling Price (LKR) *,Stock Quantity *
${existingProdSku},Updated Existing Item,${testCategorySlug},${testBrandSlug},500.00,200`;

      const formData = new FormData();
      const blob = new Blob([csvContent], { type: 'text/csv' });
      formData.append('file', blob, 'existing_sku.csv');

      const res = await fetch(`${baseUrl}/products/import/preview`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: formData,
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.summary.existingRows).toBe(1);
      expect(json.data.rows[0].status).toBe('EXISTS_IN_DB');
      expect(json.data.rows[0].isExisting).toBe(true);
    });
  });

  describe('3. Database Immutability & Invariant Stock Protection', () => {
    it('should guarantee that preview operations NEVER alter database records or stock levels', async () => {
      const currentProductCount = await prisma.product.count();
      const currentVariantCount = await prisma.productVariant.count();
      const currentGlobalSkuCount = await prisma.globalSku.count();

      expect(currentProductCount).toBe(preTestProductCount);
      expect(currentVariantCount).toBe(preTestVariantCount);
      expect(currentGlobalSkuCount).toBe(preTestGlobalSkuCount);

      // Verify protected product cmw0j4cro00089kusmwsbv48t has strictly 10 units
      const protectedProduct = await prisma.product.findUnique({
        where: { id: 'cmw0j4cro00089kusmwsbv48t' },
        select: { id: true, stockQuantity: true },
      });
      expect(protectedProduct).toBeDefined();
      expect(protectedProduct?.stockQuantity).toBe(10);
    });
  });

  describe('4. Downloadable Error Report', () => {
    it('should stream a CSV error report for invalid preview rows', async () => {
      const invalidRows = [
        {
          rowNumber: 2,
          status: 'INVALID',
          errors: ['Product name is required', 'Brand "FakeBrand" not found'],
          warnings: [],
          sku: 'ERR-SKU-01',
          name: '',
          categoryName: 'Writing Instruments',
          brandName: 'FakeBrand',
          sellingPrice: 100,
          stockQuantity: 10,
        },
      ];

      const res = await fetch(`${baseUrl}/products/import/error-report?format=csv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ rows: invalidRows }),
      });

      expect(res.status).toBe(201);
      expect(res.headers.get('content-type')).toContain('text/csv');
      const text = await res.text();
      expect(text).toContain('Validation Errors');
      expect(text).toContain('Product name is required');
      expect(text).toContain('FakeBrand');
    });

    it('should stream an Excel error report for invalid preview rows', async () => {
      const invalidRows = [
        {
          rowNumber: 2,
          status: 'INVALID',
          errors: ['Selling price is required'],
          warnings: [],
          sku: 'ERR-SKU-02',
          name: 'Broken Pen',
          categoryName: 'Writing Instruments',
          brandName: 'Atlas',
          sellingPrice: 0,
          stockQuantity: 10,
        },
      ];

      const res = await fetch(`${baseUrl}/products/import/error-report?format=xlsx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ rows: invalidRows }),
      });

      expect(res.status).toBe(201);
      expect(res.headers.get('content-type')).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      const arrayBuf = await res.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Buffer.from(arrayBuf) as any);
      expect(workbook.worksheets[0].name).toBe('Validation Report');
      expect(workbook.worksheets[0].rowCount).toBe(2);
    });
  });

  describe('5. Granular Database-Backed Permissions Enforcement', () => {
    const endpoints = [
      { name: 'Download Excel template', method: 'GET', path: '/products/import/template/excel' },
      { name: 'Download CSV template', method: 'GET', path: '/products/import/template/csv' },
      { name: 'Upload and preview', method: 'POST', path: '/products/import/preview', isUpload: true },
      { name: 'Download error report', method: 'POST', path: '/products/import/error-report', isJson: true },
    ];

    const getRequestInit = (method: string, token?: string, isUpload?: boolean, isJson?: boolean): RequestInit => {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let body: any = undefined;
      if (isUpload) {
        const formData = new FormData();
        const blob = new Blob(['name\nPen'], { type: 'text/csv' });
        formData.append('file', blob, 'test.csv');
        body = formData;
      } else if (isJson) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify({ rows: [] });
      }

      return {
        method,
        headers,
        body,
      };
    };

    it('should reject unauthenticated requests on all four endpoints with 401', async () => {
      for (const ep of endpoints) {
        const res = await fetch(`${baseUrl}${ep.path}`, getRequestInit(ep.method, undefined, ep.isUpload, ep.isJson));
        expect(res.status, `Endpoint ${ep.name} should reject unauthenticated request`).toBe(401);
      }
    });

    it('should reject customer accounts on all four endpoints with 403', async () => {
      for (const ep of endpoints) {
        const res = await fetch(`${baseUrl}${ep.path}`, getRequestInit(ep.method, customerToken, ep.isUpload, ep.isJson));
        expect(res.status, `Endpoint ${ep.name} should reject customer account`).toBe(403);
      }
    });

    it('should reject quarantined/unassigned administrators (roleId = null) on all four endpoints with 403', async () => {
      for (const ep of endpoints) {
        const res = await fetch(`${baseUrl}${ep.path}`, getRequestInit(ep.method, quarantinedAdminToken, ep.isUpload, ep.isJson));
        expect(res.status, `Endpoint ${ep.name} should reject quarantined admin`).toBe(403);
      }
    });

    it('should reject administrators lacking products.view permission on all four endpoints with 403', async () => {
      for (const ep of endpoints) {
        const res = await fetch(`${baseUrl}${ep.path}`, getRequestInit(ep.method, unauthorizedAdminToken, ep.isUpload, ep.isJson));
        expect(res.status, `Endpoint ${ep.name} should reject admin lacking products.view`).toBe(403);
      }
    });

    it('should permit administrators WITH products.view permission on all four endpoints', async () => {
      for (const ep of endpoints) {
        const res = await fetch(`${baseUrl}${ep.path}`, getRequestInit(ep.method, authorizedAdminToken, ep.isUpload, ep.isJson));
        expect([200, 201]).toContain(res.status);
      }
    });

    it('should permit Super Admin on all four endpoints', async () => {
      for (const ep of endpoints) {
        const res = await fetch(`${baseUrl}${ep.path}`, getRequestInit(ep.method, adminToken, ep.isUpload, ep.isJson));
        expect([200, 201]).toContain(res.status);
      }
    });
  });
});

