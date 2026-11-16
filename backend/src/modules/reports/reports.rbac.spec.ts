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
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

const TEST_JWT_SECRET =
  'test_secret_with_sufficient_entropy_for_jwt_verification_testing_dsl_stationery_reports_module_secure';

describe('ReportsController — Live HTTP Request & RBAC Integration Pipeline', () => {
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
            roleId: 'role-super-admin',
            isActive: true,
            assignedRole: {
              id: 'role-super-admin',
              slug: 'super_admin',
              isActive: true,
              permissions: ['reports.view', 'reports.export'],
            },
          },
          'mgr-1': {
            id: 'mgr-1',
            email: 'manager@dsl.lk',
            name: 'Store Manager',
            role: 'MANAGER',
            roleId: 'role-manager',
            isActive: true,
            assignedRole: {
              id: 'role-manager',
              slug: 'store_manager',
              isActive: true,
              permissions: ['reports.view', 'reports.export'],
            },
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

  const mockReportsService = {
    getSummary: vi.fn().mockResolvedValue({
      period: 'last30days',
      dateFrom: '2026-10-17',
      dateTo: '2026-11-15',
      kpi: { grossSalesCents: 500000 },
    }),
    getSalesReport: vi.fn().mockResolvedValue({
      period: 'last30days',
      dateFrom: '2026-10-17',
      dateTo: '2026-11-15',
      dailySales: [],
    }),
    exportReport: vi.fn().mockImplementation(async (query, format, res) => {
      if (res && typeof res.setHeader === 'function') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="report.csv"');
        res.end('orderNumber,amount\nDSL-001,500.00');
        return { filename: 'report.csv', mimeType: 'text/csv' };
      }
      return {
        buffer: Buffer.from('orderNumber,amount\nDSL-001,500.00'),
        filename: 'report.csv',
        mimeType: 'text/csv',
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
      controllers: [ReportsController],
      providers: [
        JwtStrategy,
        JwtAuthGuard,
        RolesGuard,
        Reflector,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => (key === 'JWT_SECRET' ? TEST_JWT_SECRET : null),
          },
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: ReportsService,
          useValue: mockReportsService,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address() as any;
    baseUrl = `http://127.0.0.1:${address.port}/admin/reports`;
    jwtService = moduleRef.get(JwtService);

    // Sign cryptographic JWT tokens for each role using the test secret
    adminToken = jwtService.sign({ sub: 'admin-1', email: 'admin@dsl.lk', role: 'ADMIN' });
    managerToken = jwtService.sign({ sub: 'mgr-1', email: 'manager@dsl.lk', role: 'MANAGER' });
    staffToken = jwtService.sign({ sub: 'staff-1', email: 'staff@dsl.lk', role: 'STAFF' });
    customerToken = jwtService.sign({ sub: 'cust-1', email: 'customer@dsl.lk', role: 'CUSTOMER' });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('1. GET /admin/reports/summary (Live HTTP)', () => {
    it('returns 401 Unauthorized when request carries no authentication token', async () => {
      const res = await fetch(`${baseUrl}/summary`);
      expect(res.status).toBe(401);
    });

    it('returns 401 Unauthorized when request carries an invalid or tampered JWT', async () => {
      const res = await fetch(`${baseUrl}/summary`, {
        headers: { Authorization: 'Bearer invalid.tampered.token' },
      });
      expect(res.status).toBe(401);
    });

    it('returns 403 Forbidden when authenticated as STAFF', async () => {
      const res = await fetch(`${baseUrl}/summary`, {
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      expect(res.status).toBe(403);
    });

    it('returns 403 Forbidden when authenticated as CUSTOMER', async () => {
      const res = await fetch(`${baseUrl}/summary`, {
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      expect(res.status).toBe(403);
    });

    it('returns 200 OK when authenticated as ADMIN (Bearer token)', async () => {
      const res = await fetch(`${baseUrl}/summary?period=last30days`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.period).toBe('last30days');
    });

    it('returns 200 OK when authenticated as MANAGER (dsl_access_token cookie)', async () => {
      const res = await fetch(`${baseUrl}/summary?period=last30days`, {
        headers: { Cookie: `dsl_access_token=${managerToken}` },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  describe('2. GET /admin/reports/sales (Live HTTP)', () => {
    it('returns 401 Unauthorized when unauthenticated', async () => {
      const res = await fetch(`${baseUrl}/sales`);
      expect(res.status).toBe(401);
    });

    it('returns 403 Forbidden when authenticated as STAFF', async () => {
      const res = await fetch(`${baseUrl}/sales`, {
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      expect(res.status).toBe(403);
    });

    it('returns 403 Forbidden when authenticated as CUSTOMER', async () => {
      const res = await fetch(`${baseUrl}/sales`, {
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      expect(res.status).toBe(403);
    });

    it('returns 200 OK when authenticated as ADMIN', async () => {
      const res = await fetch(`${baseUrl}/sales?period=last30days`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.dailySales).toBeDefined();
    });

    it('returns 200 OK when authenticated as MANAGER', async () => {
      const res = await fetch(`${baseUrl}/sales?period=last30days`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  describe('3. GET /admin/reports/export (Live HTTP Streaming)', () => {
    it('returns 401 Unauthorized when unauthenticated', async () => {
      const res = await fetch(`${baseUrl}/export?period=last30days&format=csv`);
      expect(res.status).toBe(401);
    });

    it('returns 403 Forbidden when authenticated as STAFF', async () => {
      const res = await fetch(`${baseUrl}/export?period=last30days&format=csv`, {
        headers: { Authorization: `Bearer ${staffToken}` },
      });
      expect(res.status).toBe(403);
    });

    it('returns 403 Forbidden when authenticated as CUSTOMER', async () => {
      const res = await fetch(`${baseUrl}/export?period=last30days&format=csv`, {
        headers: { Authorization: `Bearer ${customerToken}` },
      });
      expect(res.status).toBe(403);
    });

    it('returns 200 OK and streams file content when authenticated as ADMIN', async () => {
      const res = await fetch(`${baseUrl}/export?period=last30days&format=csv`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/csv');
      const bodyText = await res.text();
      expect(bodyText).toContain('orderNumber,amount');
    });

    it('returns 200 OK when authenticated as MANAGER', async () => {
      const res = await fetch(`${baseUrl}/export?period=last30days&format=csv`, {
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      expect(res.status).toBe(200);
    });
  });
});
