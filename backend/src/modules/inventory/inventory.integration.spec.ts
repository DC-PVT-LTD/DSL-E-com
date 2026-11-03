import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../app.module';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { InventoryChangeReason } from '../../generated/prisma';

describe('Inventory Module Integration Test (HTTP Level)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let adminToken: string;
  let customerToken: string;

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

    const jwtService = app.get(JwtService);

    // Existing active ADMIN user in dsl_stationery database
    adminToken = jwtService.sign({
      sub: 'cmw07gefq0000pousyxdsoal6',
      email: 'admin@dslstationery.lk',
      role: 'ADMIN',
    });

    // Existing active CUSTOMER user in dsl_stationery database
    customerToken = jwtService.sign({
      sub: 'cmw0b90vk0000jsush3ey8h72',
      email: 'qa-customer@dslstationery.lk',
      role: 'CUSTOMER',
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Security and Access Control', () => {
    it('POST /api/v1/inventory/adjust without token returns HTTP 401', async () => {
      const res = await fetch(`${baseUrl}/inventory/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: 'prod-speed-rim-blue',
          delta: 10,
          reason: InventoryChangeReason.RESTOCK,
        }),
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.statusCode).toBe(401);
    });

    it('POST /api/v1/inventory/adjust with CUSTOMER token returns HTTP 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/inventory/adjust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerToken}`,
        },
        body: JSON.stringify({
          productId: 'prod-speed-rim-blue',
          delta: 10,
          reason: InventoryChangeReason.RESTOCK,
        }),
      });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.statusCode).toBe(403);
      expect(json.error).toBe('FORBIDDEN');
    });

    it('GET /api/v1/inventory/movements without token returns HTTP 401', async () => {
      const res = await fetch(`${baseUrl}/inventory/movements`);
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/inventory/movements with CUSTOMER token returns HTTP 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/inventory/movements`, {
        headers: {
          Authorization: `Bearer ${customerToken}`,
        },
      });

      expect(res.status).toBe(403);
    });

    it('GET /api/v1/inventory/low-stock without token returns HTTP 401', async () => {
      const res = await fetch(`${baseUrl}/inventory/low-stock`);
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/inventory/low-stock with CUSTOMER token returns HTTP 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/inventory/low-stock`, {
        headers: {
          Authorization: `Bearer ${customerToken}`,
        },
      });

      expect(res.status).toBe(403);
    });
  });

  describe('Inventory Adjustments (Admin Role)', () => {
    it('returns HTTP 404 when product does not exist', async () => {
      const res = await fetch(`${baseUrl}/inventory/adjust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          productId: 'non-existent-product-id',
          delta: 10,
          reason: InventoryChangeReason.RESTOCK,
        }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.statusCode).toBe(404);
    });

    it('returns HTTP 400 when adjustment would cause negative stock', async () => {
      const res = await fetch(`${baseUrl}/inventory/adjust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          productId: 'prod-speed-rim-blue',
          delta: -999999,
          reason: InventoryChangeReason.DAMAGED,
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.statusCode).toBe(400);
      expect(json.message).toContain('negative stock');
    });

    it('returns HTTP 400 when delta is 0', async () => {
      const res = await fetch(`${baseUrl}/inventory/adjust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          productId: 'prod-speed-rim-blue',
          delta: 0,
          reason: InventoryChangeReason.CORRECTION,
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.statusCode).toBe(400);
    });

    it('successfully adjusts stock, logs movement, and rolls back cleanly with compensating adjustment', async () => {
      // 1. Positive adjustment (+5)
      const adjustRes = await fetch(`${baseUrl}/inventory/adjust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          productId: 'prod-speed-rim-blue',
          delta: 5,
          reason: InventoryChangeReason.RESTOCK,
          note: 'Automated integration test stock addition',
        }),
      });

      expect(adjustRes.status).toBe(200);
      const adjustJson = await adjustRes.json();
      expect(adjustJson.success).toBe(true);
      expect(adjustJson.data.product).toBeDefined();
      expect(adjustJson.data.movement).toBeDefined();
      expect(adjustJson.data.movement.changeAmount).toBe(5);
      expect(adjustJson.data.movement.reason).toBe('RESTOCK');
      expect(adjustJson.data.movement.performedById).toBe('cmw07gefq0000pousyxdsoal6');

      const intermediateStock = adjustJson.data.product.stockQuantity;

      // 2. Compensating adjustment (-5) to return stock to exact original value
      const revertRes = await fetch(`${baseUrl}/inventory/adjust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          productId: 'prod-speed-rim-blue',
          delta: -5,
          reason: InventoryChangeReason.DEMO_RESET,
          note: 'Automated integration test revert to baseline stock',
        }),
      });

      expect(revertRes.status).toBe(200);
      const revertJson = await revertRes.json();
      expect(revertJson.success).toBe(true);
      expect(revertJson.data.product.stockQuantity).toBe(intermediateStock - 5);
      expect(revertJson.data.movement.changeAmount).toBe(-5);
      expect(revertJson.data.movement.reason).toBe('DEMO_RESET');
    });
  });

  describe('Inventory Query Endpoints (Admin Role)', () => {
    it('GET /api/v1/inventory/movements returns paginated audit movements', async () => {
      const res = await fetch(`${baseUrl}/inventory/movements?page=1&limit=10`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.meta).toBeDefined();
      expect(json.meta.page).toBe(1);
      expect(json.meta.totalItems).toBeGreaterThanOrEqual(1);

      const latestMovement = json.data[0];
      expect(latestMovement).toHaveProperty('previousQuantity');
      expect(latestMovement).toHaveProperty('newQuantity');
      expect(latestMovement).toHaveProperty('changeAmount');
      expect(latestMovement).toHaveProperty('reason');
      expect(latestMovement).toHaveProperty('performedById');
      expect(latestMovement).toHaveProperty('product');
      expect(latestMovement.product).toHaveProperty('sku');
    });

    it('GET /api/v1/inventory/movements supports filtering by reason and productId', async () => {
      const res = await fetch(
        `${baseUrl}/inventory/movements?productId=prod-speed-rim-blue&reason=RESTOCK`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      for (const item of json.data) {
        expect(item.productId).toBe('prod-speed-rim-blue');
        expect(item.reason).toBe('RESTOCK');
      }
    });

    it('GET /api/v1/inventory/low-stock returns paginated low stock listing', async () => {
      const res = await fetch(`${baseUrl}/inventory/low-stock?page=1&limit=5`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.meta).toBeDefined();
    });

    it('GET /api/v1/inventory/low-stock with custom high threshold returns matching products', async () => {
      const res = await fetch(`${baseUrl}/inventory/low-stock?threshold=1000`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBeGreaterThan(0);
      expect(json.data[0]).toHaveProperty('stockQuantity');
      expect(json.data[0].costPriceCents).toBeUndefined(); // sensitive field exclusion verified
    });
  });
});

