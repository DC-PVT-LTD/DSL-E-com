import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';

describe('Catalogue Endpoints Integration Test (HTTP Level)', () => {
  let app: INestApplication;
  let baseUrl: string;

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
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Categories API', () => {
    it('GET /api/v1/categories returns HTTP 200 with paginated categories', async () => {
      const res = await fetch(`${baseUrl}/categories?page=1&limit=5`);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(1);
      expect(json.meta).toBeDefined();
      expect(json.meta.page).toBe(1);
      expect(json.data[0]).toHaveProperty('itemCount');
    });

    it('GET /api/v1/categories/slug/pens returns category details', async () => {
      const res = await fetch(`${baseUrl}/categories/slug/pens`);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.slug).toBe('pens');
      expect(json.data.name).toBe('Pens');
    });

    it('GET /api/v1/categories/slug/non-existent returns HTTP 404', async () => {
      const res = await fetch(`${baseUrl}/categories/slug/non-existent-cat`);
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.statusCode).toBe(404);
      expect(json.error).toBe('NOT_FOUND');
    });

    it('POST /api/v1/categories without auth returns HTTP 401', async () => {
      const res = await fetch(`${baseUrl}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Unauthorized Category',
          slug: 'unauthorized-category',
          description: 'Testing auth protection',
        }),
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.statusCode).toBe(401);
      expect(json.error).toBe('UNAUTHORIZED');
    });
  });

  describe('Brands API', () => {
    it('GET /api/v1/brands returns HTTP 200 with brands list', async () => {
      const res = await fetch(`${baseUrl}/brands?page=1&limit=5`);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/brands/slug/speed returns Speed brand', async () => {
      const res = await fetch(`${baseUrl}/brands/slug/speed`);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.slug).toBe('speed');
    });

    it('POST /api/v1/brands without auth returns HTTP 401', async () => {
      const res = await fetch(`${baseUrl}/brands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Fake Brand',
          slug: 'fake-brand',
          description: 'Testing write guard',
          originCountry: 'Sri Lanka',
        }),
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.statusCode).toBe(401);
    });
  });

  describe('Products API', () => {
    it('GET /api/v1/products returns published products without costPriceCents', async () => {
      const res = await fetch(`${baseUrl}/products?page=1&limit=10`);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(1);

      // Verify confidential costPriceCents is redacted
      for (const product of json.data) {
        expect(product.costPriceCents).toBeUndefined();
        expect(product.categoryName).toBeDefined();
        expect(product.brandName).toBeDefined();
      }
    });

    it('GET /api/v1/products?search=pen filters correctly', async () => {
      const res = await fetch(`${baseUrl}/products?search=pen`);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });

    it('GET /api/v1/products/slug/speed-rim-ball-pen-blue returns product details', async () => {
      const res = await fetch(`${baseUrl}/products/slug/speed-rim-ball-pen-blue`);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.slug).toBe('speed-rim-ball-pen-blue');
      expect(json.data.costPriceCents).toBeUndefined();
    });

    it('GET /api/v1/products/non-existent-id returns HTTP 404', async () => {
      const res = await fetch(`${baseUrl}/products/prod-does-not-exist`);
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.statusCode).toBe(404);
      expect(json.error).toBe('NOT_FOUND');
    });

    it('POST /api/v1/products without auth returns HTTP 401', async () => {
      const res = await fetch(`${baseUrl}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Unauthorized Product',
          slug: 'unauthorized-product',
          sku: 'UNAUTH-1',
          description: 'desc',
          shortDescription: 'short',
          categoryId: 'cat-pens',
          brandId: 'brand-speed',
          priceCents: 1000,
        }),
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.statusCode).toBe(401);
    });
  });
});
