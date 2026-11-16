import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { UserRole, OrderStatus, PaymentStatus } from '../../generated/prisma';

const TEST_JWT_SECRET =
  'test_secret_with_sufficient_entropy_for_jwt_verification_testing_dsl_stationery_dashboard_module_secure';

describe('DashboardController — Live HTTP Request & RBAC Integration Pipeline', () => {
  let app: INestApplication;
  let baseUrl: string;
  let jwtService: JwtService;

  let adminToken: string;
  let managerToken: string;
  let staffToken: string;
  let customerToken: string;

  const mockPrisma = {
    user: {
      findUnique: vi.fn().mockImplementation(async ({ where }: any) => {
        const users: Record<string, any> = {
          'admin-1': {
            id: 'admin-1',
            email: 'admin@dsl.lk',
            name: 'System Admin',
            role: 'ADMIN',
            isActive: true,
          },
          'mgr-1': {
            id: 'mgr-1',
            email: 'manager@dsl.lk',
            name: 'Store Manager',
            role: 'MANAGER',
            isActive: true,
          },
          'staff-1': {
            id: 'staff-1',
            email: 'staff@dsl.lk',
            name: 'Floor Staff',
            role: 'STAFF',
            isActive: true,
          },
          'cust-1': {
            id: 'cust-1',
            email: 'customer@dsl.lk',
            name: 'Registered Buyer',
            role: 'CUSTOMER',
            isActive: true,
          },
        };
        return users[where.id] || null;
      }),
    },
  };

  const mockDashboardService = {
    getDashboardKpis: vi.fn().mockImplementation(async (query: any, userRole: UserRole) => {
      const isFinancialPermitted = userRole === UserRole.ADMIN || userRole === UserRole.MANAGER;
      return {
        period: query.period || 'last30days',
        dateFrom: '2026-10-17',
        dateTo: '2026-11-15',
        timezone: 'Asia/Colombo',
        userRole,
        financial: isFinancialPermitted
          ? {
              grossSalesCents: 500000,
              netRevenueCents: 450000,
              completedRefundsCents: 50000,
              paidOrdersCount: 10,
              averageOrderValueCents: 45000,
            }
          : null,
        orders: {
          totalOrdersInPeriod: 12,
          pendingFulfillmentQueue: 3,
        },
        inventory: {
          lowStockSkuCount: 2,
          lowStockItems: [
            {
              id: 'prod-1',
              productId: 'prod-1',
              name: 'CR Book',
              sku: 'DSL-CR-01',
              stockQuantity: 2,
              lowStockThreshold: 5,
              isVariant: false,
            },
          ],
        },
        topSellingProducts: [
          {
            productId: 'prod-1',
            name: 'CR Book',
            sku: 'DSL-CR-01',
            image: null,
            priceCents: 45000,
            unitsSold: 45,
          },
        ],
        recentOrders: [
          {
            id: 'ord-1',
            orderNumber: 'DSL-2026-001',
            customerName: 'Saman Perera',
            orderStatus: OrderStatus.CONFIRMED,
            paymentStatus: PaymentStatus.PAID,
            totalCents: isFinancialPermitted ? 25000 : undefined,
            createdAt: '2026-11-15T05:30:00.000Z',
            createdAtColombo: '2026-11-15 11:00:00 (+05:30)',
          },
        ],
      };
    }),
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: TEST_JWT_SECRET,
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [DashboardController],
      providers: [
        JwtStrategy,
        JwtAuthGuard,
        RolesGuard,
        Reflector,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string, defaultVal?: any) => {
              if (key === 'JWT_SECRET') return TEST_JWT_SECRET;
              return defaultVal;
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: DashboardService,
          useValue: mockDashboardService,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');

    await app.listen(0);
    const address = app.getHttpServer().address();
    const port = typeof address === 'string' ? address : address.port;
    baseUrl = `http://127.0.0.1:${port}/api/v1`;

    jwtService = moduleRef.get<JwtService>(JwtService);

    adminToken = jwtService.sign({
      sub: 'admin-1',
      email: 'admin@dsl.lk',
      role: 'ADMIN',
    });
    managerToken = jwtService.sign({
      sub: 'mgr-1',
      email: 'manager@dsl.lk',
      role: 'MANAGER',
    });
    staffToken = jwtService.sign({
      sub: 'staff-1',
      email: 'staff@dsl.lk',
      role: 'STAFF',
    });
    customerToken = jwtService.sign({
      sub: 'cust-1',
      email: 'customer@dsl.lk',
      role: 'CUSTOMER',
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Authentication Enforcement', () => {
    it('rejects unauthenticated request with 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/admin/dashboard/kpis`);
      expect(res.status).toBe(401);
    });

    it('rejects request with forged / tampered bearer token with 401 Unauthorized', async () => {
      const forged = adminToken.slice(0, -6) + 'abc123';
      const res = await fetch(`${baseUrl}/admin/dashboard/kpis`, {
        headers: { Authorization: `Bearer ${forged}` },
      });
      expect(res.status).toBe(401);
    });
  });

  describe('Role-Based Access Control (RBAC)', () => {
    it('strictly denies CUSTOMER role with 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/admin/dashboard/kpis`, {
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      expect(res.status).toBe(403);
    });

    it('allows ADMIN and returns financial metrics and order totals', async () => {
      const res = await fetch(`${baseUrl}/admin/dashboard/kpis`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.financial).not.toBeNull();
      expect(data.financial.grossSalesCents).toBe(500000);
      expect(data.recentOrders[0].totalCents).toBe(25000);
    });

    it('allows MANAGER and returns financial metrics and order totals', async () => {
      const res = await fetch(`${baseUrl}/admin/dashboard/kpis`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.financial).not.toBeNull();
      expect(data.financial.netRevenueCents).toBe(450000);
      expect(data.recentOrders[0].totalCents).toBe(25000);
    });

    it('allows STAFF to access operational metrics but strictly omits financial data', async () => {
      const res = await fetch(`${baseUrl}/admin/dashboard/kpis`, {
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.financial).toBeNull();
      expect(data.orders.totalOrdersInPeriod).toBe(12);
      expect(data.orders.pendingFulfillmentQueue).toBe(3);
      expect(data.inventory.lowStockSkuCount).toBe(2);
      expect(data.recentOrders[0].totalCents).toBeUndefined();
    });

    it('authenticates successfully via HTTP-only cookie (dsl_access_token)', async () => {
      const res = await fetch(`${baseUrl}/admin/dashboard/kpis`, {
        headers: {
          Cookie: `dsl_access_token=${adminToken}`,
        },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.userRole).toBe(UserRole.ADMIN);
    });
  });
});
