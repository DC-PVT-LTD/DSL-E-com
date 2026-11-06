import 'dotenv/config';
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../app.module';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { PrismaService } from '../../prisma/prisma.service';

describe('Cart API Integration Tests (HTTP Level)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let customerToken: string;
  let prisma: PrismaService;
  let testProduct: any;
  let testVariant: any;
  let customerUserId: string;

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

    // Pick an existing active product with variants that is NOT Double Submission Test Product
    testProduct = await prisma.product.findFirst({
      where: {
        isActive: true,
        name: { not: 'Double Submission Test Product' },
        variants: { some: { isActive: true, stockQuantity: { gt: 0 } } },
      },
      include: { variants: true },
    });

    if (!testProduct) {
      // Fallback to any active product
      testProduct = await prisma.product.findFirst({
        where: {
          isActive: true,
          name: { not: 'Double Submission Test Product' },
        },
        include: { variants: true },
      });
    }

    testVariant = testProduct.variants && testProduct.variants.length > 0 
      ? testProduct.variants.find((v: any) => v.isActive && v.stockQuantity > 0) || null 
      : null;

    // Find an active customer or staff user for auth tests
    const customer = await prisma.user.findFirst({
      where: { isActive: true, role: 'CUSTOMER' },
    });

    customerUserId = customer ? customer.id : 'customer-test-id';

    const jwtService = app.get(JwtService);
    customerToken = jwtService.sign({
      sub: customerUserId,
      email: customer ? customer.email : 'test-customer@dslstationery.lk',
      role: 'CUSTOMER',
    });
  });

  afterAll(async () => {
    // Clean up only our test customer's cart
    if (customerUserId) {
      await prisma.cart.deleteMany({
        where: { userId: customerUserId },
      });
    }
    if (app) {
      await app.close();
    }
  });

  describe('Guest Cart Flow', () => {
    let guestSessionId: string;
    let createdItemId: string;

    it('GET /cart returns an initial guest cart with a secure session ID', async () => {
      const res = await fetch(`${baseUrl}/cart`, {
        method: 'GET',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.itemCount).toBe(0);
      expect(json.data.subtotalCents).toBe(0);

      // Verify guest session identifier
      const sessionHeader = res.headers.get('x-guest-session-id');
      expect(sessionHeader || json.data.sessionId).toBeTruthy();
      guestSessionId = sessionHeader || json.data.sessionId;
    });

    it('POST /cart/items adds an item with server-calculated price and ignores client price', async () => {
      const initialStock = testVariant ? testVariant.stockQuantity : testProduct.stockQuantity;

      const res = await fetch(`${baseUrl}/cart/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-guest-session-id': guestSessionId,
        },
        body: JSON.stringify({
          productId: testProduct.id,
          variantId: testVariant ? testVariant.id : undefined,
          quantity: 2,
          // Malicious attempt to spoof price to 1 cent
          unitPriceCents: 1,
          totalPriceCents: 2,
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.items.length).toBe(1);

      const added = json.data.items[0];
      createdItemId = added.id;
      expect(added.productId).toBe(testProduct.id);
      expect(added.quantity).toBe(2);

      // Price MUST be authoritative from DB, never 1 cent
      const expectedUnitPrice = testVariant ? testVariant.priceCents : testProduct.priceCents;
      expect(added.unitPriceCents).toBe(expectedUnitPrice);
      expect(added.totalPriceCents).toBe(expectedUnitPrice * 2);

      // Verify inventory was NOT decremented
      const checkProduct = await prisma.product.findUnique({
        where: { id: testProduct.id },
        include: { variants: true },
      });
      const currentStock = testVariant
        ? checkProduct?.variants.find((v) => v.id === testVariant.id)?.stockQuantity
        : checkProduct?.stockQuantity;
      expect(currentStock).toBe(initialStock);
    });

    it('POST /cart/items rejects invalid or negative quantities', async () => {
      const res = await fetch(`${baseUrl}/cart/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-guest-session-id': guestSessionId,
        },
        body: JSON.stringify({
          productId: testProduct.id,
          quantity: -1,
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.statusCode).toBe(400);
    });

    it('POST /cart/items rejects non-existent product', async () => {
      const res = await fetch(`${baseUrl}/cart/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-guest-session-id': guestSessionId,
        },
        body: JSON.stringify({
          productId: 'non-existent-product-id',
          quantity: 1,
        }),
      });

      expect(res.status).toBe(404);
    });

    it('PATCH /cart/items/:id updates line quantity', async () => {
      const res = await fetch(`${baseUrl}/cart/items/${createdItemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-guest-session-id': guestSessionId,
        },
        body: JSON.stringify({
          quantity: 3,
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      const updated = json.data.items.find((i: any) => i.id === createdItemId);
      expect(updated.quantity).toBe(3);
    });

    it('DELETE /cart/items/:id removes the specific item', async () => {
      const res = await fetch(`${baseUrl}/cart/items/${createdItemId}`, {
        method: 'DELETE',
        headers: {
          'x-guest-session-id': guestSessionId,
        },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.items.length).toBe(0);
      expect(json.data.itemCount).toBe(0);
    });

    it('DELETE /cart clears all items in active cart', async () => {
      // Re-add one item first
      await fetch(`${baseUrl}/cart/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-guest-session-id': guestSessionId,
        },
        body: JSON.stringify({
          productId: testProduct.id,
          quantity: 1,
        }),
      });

      const clearRes = await fetch(`${baseUrl}/cart`, {
        method: 'DELETE',
        headers: {
          'x-guest-session-id': guestSessionId,
        },
      });

      expect(clearRes.status).toBe(200);
      const json = await clearRes.json();
      expect(json.data.items.length).toBe(0);
    });
  });

  describe('Authenticated Cart & Merge Flow', () => {
    let guestSessionForMerge: string;

    it('merges guest cart items into authenticated user cart upon login', async () => {
      // 1. Create a guest cart with 2 items
      const guestRes = await fetch(`${baseUrl}/cart/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: testProduct.id,
          quantity: 2,
        }),
      });

      const guestJson = await guestRes.json();
      guestSessionForMerge = guestJson.data.sessionId;
      expect(guestSessionForMerge).toBeTruthy();

      // 2. Perform merge as authenticated customer
      const mergeRes = await fetch(`${baseUrl}/cart/merge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerToken}`,
        },
        body: JSON.stringify({
          guestSessionId: guestSessionForMerge,
        }),
      });

      expect(mergeRes.status).toBe(200);
      const mergeJson = await mergeRes.json();
      expect(mergeJson.success).toBe(true);
      expect(mergeJson.data.userId).toBe(customerUserId);
      expect(mergeJson.data.items.length).toBeGreaterThanOrEqual(1);

      // 3. Verify guest cart is cleared from database
      const oldGuestCart = await prisma.cart.findUnique({
        where: { sessionId: guestSessionForMerge },
      });
      expect(oldGuestCart).toBeNull();
    });

    it('rejects POST /cart/merge without authentication', async () => {
      const res = await fetch(`${baseUrl}/cart/merge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          guestSessionId: 'any-session',
        }),
      });

      expect(res.status).toBe(401);
    });
  });
});
