import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrdersGateway } from './orders.gateway';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Server, Socket } from 'socket.io';

describe('OrdersGateway', () => {
  let gateway: OrdersGateway;
  let jwtService: { verifyAsync: ReturnType<typeof vi.fn> };
  let configService: { get: ReturnType<typeof vi.fn> };
  let prisma: {
    user: { findUnique: ReturnType<typeof vi.fn> };
    order: { findUnique: ReturnType<typeof vi.fn> };
  };
  let mockServer: {
    use: ReturnType<typeof vi.fn>;
    to: ReturnType<typeof vi.fn>;
  };
  let middlewareFn: (socket: any, next: (err?: any) => void) => Promise<void>;

  const mockAdminUser = {
    id: 'user-admin-1',
    email: 'admin@dslstationery.lk',
    name: 'Admin User',
    role: 'ADMIN',
    isActive: true,
    lockedUntil: null,
  };

  const mockStaffUser = {
    id: 'user-staff-1',
    email: 'staff@dslstationery.lk',
    name: 'Staff User',
    role: 'STAFF',
    isActive: true,
    lockedUntil: null,
  };

  const mockCustomer1 = {
    id: 'user-cust-1',
    email: 'cust1@example.lk',
    name: 'Customer One',
    role: 'CUSTOMER',
    isActive: true,
    lockedUntil: null,
  };

  const mockCustomer2 = {
    id: 'user-cust-2',
    email: 'cust2@example.lk',
    name: 'Customer Two',
    role: 'CUSTOMER',
    isActive: true,
    lockedUntil: null,
  };

  beforeEach(() => {
    jwtService = {
      verifyAsync: vi.fn(),
    };
    configService = {
      get: vi.fn((key: string) => {
        if (key === 'JWT_SECRET') return 'test_jwt_secret_value_12345';
        if (key === 'CORS_ORIGIN') return 'http://localhost:3000';
        return null;
      }),
    };
    prisma = {
      user: {
        findUnique: vi.fn(),
      },
      order: {
        findUnique: vi.fn(),
      },
    };
    mockServer = {
      use: vi.fn((fn) => {
        middlewareFn = fn;
      }),
      to: vi.fn().mockReturnValue({
        emit: vi.fn(),
      }),
    };

    gateway = new OrdersGateway(
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      prisma as unknown as PrismaService
    );
    gateway.server = mockServer as unknown as Server;
    gateway.afterInit(mockServer as unknown as Server);
  });

  describe('1. Handshake Authentication Middleware', () => {
    it('rejects connection when token is completely missing', async () => {
      const socket: any = {
        id: 'sock-1',
        handshake: { auth: {}, headers: {} },
        data: {},
      };
      const next = vi.fn();

      await middlewareFn(socket, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe('Authentication token required');
      expect(socket.data.user).toBeUndefined();
    });

    it('rejects connection when token signature or expiry is invalid', async () => {
      const socket: any = {
        id: 'sock-2',
        handshake: { auth: { token: 'invalid.jwt.token' }, headers: {} },
        data: {},
      };
      jwtService.verifyAsync.mockRejectedValueOnce(new Error('jwt expired'));
      const next = vi.fn();

      await middlewareFn(socket, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe('Unauthorized: invalid or expired token');
      expect(socket.data.user).toBeUndefined();
    });

    it('rejects connection when authenticated user does not exist in database', async () => {
      const socket: any = {
        id: 'sock-3',
        handshake: { auth: { token: 'valid.token.sub-ghost' }, headers: {} },
        data: {},
      };
      jwtService.verifyAsync.mockResolvedValueOnce({ sub: 'ghost-user-id' });
      prisma.user.findUnique.mockResolvedValueOnce(null);
      const next = vi.fn();

      await middlewareFn(socket, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe('Unauthorized: user account not found');
      expect(socket.data.user).toBeUndefined();
    });

    it('rejects connection when user account is deactivated', async () => {
      const socket: any = {
        id: 'sock-4',
        handshake: { auth: { token: 'valid.token.deactivated' }, headers: {} },
        data: {},
      };
      jwtService.verifyAsync.mockResolvedValueOnce({ sub: 'deactivated-user-id' });
      prisma.user.findUnique.mockResolvedValueOnce({
        ...mockCustomer1,
        isActive: false,
      });
      const next = vi.fn();

      await middlewareFn(socket, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe('Unauthorized: user account is deactivated');
      expect(socket.data.user).toBeUndefined();
    });

    it('rejects connection when user account is locked', async () => {
      const socket: any = {
        id: 'sock-5',
        handshake: { auth: { token: 'valid.token.locked' }, headers: {} },
        data: {},
      };
      jwtService.verifyAsync.mockResolvedValueOnce({ sub: 'locked-user-id' });
      prisma.user.findUnique.mockResolvedValueOnce({
        ...mockCustomer1,
        lockedUntil: new Date(Date.now() + 600000), // 10 mins in future
      });
      const next = vi.fn();

      await middlewareFn(socket, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe('Unauthorized: user account is temporarily locked');
      expect(socket.data.user).toBeUndefined();
    });

    it('authenticates valid token from handshake.auth.token and attaches authoritative user', async () => {
      const socket: any = {
        id: 'sock-6',
        handshake: {
          auth: { token: 'valid.admin.jwt' },
          headers: {},
        },
        data: {
          // Attacker sends spoofed client role
          user: { role: 'SUPER_ROOT_SPOOFED' },
        },
      };
      jwtService.verifyAsync.mockResolvedValueOnce({
        sub: mockAdminUser.id,
        email: mockAdminUser.email,
        role: mockAdminUser.role,
      });
      prisma.user.findUnique.mockResolvedValueOnce(mockAdminUser);
      const next = vi.fn();

      await middlewareFn(socket, next);

      expect(next).toHaveBeenCalledWith(); // success with no error
      // Authoritative DB role must overwrite any spoofed data
      expect(socket.data.user).toEqual({
        id: mockAdminUser.id,
        email: mockAdminUser.email,
        name: mockAdminUser.name,
        role: mockAdminUser.role,
      });
    });

    it('accepts authorization header Bearer token as fallback', async () => {
      const socket: any = {
        id: 'sock-7',
        handshake: {
          auth: {},
          headers: { authorization: 'Bearer valid.staff.jwt' },
        },
        data: {},
      };
      jwtService.verifyAsync.mockResolvedValueOnce({ sub: mockStaffUser.id });
      prisma.user.findUnique.mockResolvedValueOnce(mockStaffUser);
      const next = vi.fn();

      await middlewareFn(socket, next);

      expect(next).toHaveBeenCalledWith();
      expect(socket.data.user.role).toBe('STAFF');
    });

    it('accepts dsl_access_token cookie as fallback', async () => {
      const socket: any = {
        id: 'sock-8',
        handshake: {
          auth: {},
          headers: { cookie: 'foo=bar; dsl_access_token=cookie.jwt.token; other=1' },
        },
        data: {},
      };
      jwtService.verifyAsync.mockResolvedValueOnce({ sub: mockCustomer1.id });
      prisma.user.findUnique.mockResolvedValueOnce(mockCustomer1);
      const next = vi.fn();

      await middlewareFn(socket, next);

      expect(next).toHaveBeenCalledWith();
      expect(socket.data.user.role).toBe('CUSTOMER');
    });
  });

  describe('2. Admin Room Authorization (subscribe:admin)', () => {
    it('allows ADMIN to join admin:orders', () => {
      const socket: any = {
        id: 'sock-admin',
        data: { user: mockAdminUser },
        join: vi.fn(),
        emit: vi.fn(),
      };

      gateway.handleSubscribeAdmin(socket);

      expect(socket.join).toHaveBeenCalledWith('admin:orders');
      expect(socket.emit).toHaveBeenCalledWith('subscribed:admin', { success: true });
    });

    it('allows STAFF to join admin:orders', () => {
      const socket: any = {
        id: 'sock-staff',
        data: { user: mockStaffUser },
        join: vi.fn(),
        emit: vi.fn(),
      };

      gateway.handleSubscribeAdmin(socket);

      expect(socket.join).toHaveBeenCalledWith('admin:orders');
      expect(socket.emit).toHaveBeenCalledWith('subscribed:admin', { success: true });
    });

    it('rejects CUSTOMER from subscribing to admin:orders', () => {
      const socket: any = {
        id: 'sock-cust',
        data: { user: mockCustomer1 },
        join: vi.fn(),
        emit: vi.fn(),
      };

      gateway.handleSubscribeAdmin(socket);

      expect(socket.join).not.toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith('error', {
        event: 'subscribe:admin',
        message: 'Forbidden: Insufficient permissions for admin orders',
      });
    });

    it('rejects unauthenticated socket from subscribing to admin:orders', () => {
      const socket: any = {
        id: 'sock-anon',
        data: {},
        join: vi.fn(),
        emit: vi.fn(),
      };

      gateway.handleSubscribeAdmin(socket);

      expect(socket.join).not.toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith('error', expect.any(Object));
    });
  });

  describe('3. Individual Order Authorization (subscribe:order)', () => {
    const mockOrder1 = {
      id: 'order-101',
      userId: 'user-cust-1',
      customerEmail: 'cust1@example.lk',
    };

    it('allows ADMIN to access any existing order room', async () => {
      const socket: any = {
        id: 'sock-admin',
        data: { user: mockAdminUser },
        join: vi.fn(),
        emit: vi.fn(),
      };
      prisma.order.findUnique.mockResolvedValueOnce(mockOrder1);

      await gateway.handleSubscribeOrder(socket, { orderId: 'order-101' });

      expect(socket.join).toHaveBeenCalledWith('order:order-101');
      expect(socket.emit).toHaveBeenCalledWith('subscribed:order', {
        orderId: 'order-101',
        success: true,
      });
    });

    it('allows CUSTOMER to access their own order room', async () => {
      const socket: any = {
        id: 'sock-cust-1',
        data: { user: mockCustomer1 },
        join: vi.fn(),
        emit: vi.fn(),
      };
      prisma.order.findUnique.mockResolvedValueOnce(mockOrder1);

      await gateway.handleSubscribeOrder(socket, { orderId: 'order-101' });

      expect(socket.join).toHaveBeenCalledWith('order:order-101');
      expect(socket.emit).toHaveBeenCalledWith('subscribed:order', {
        orderId: 'order-101',
        success: true,
      });
    });

    it('forbids CUSTOMER from accessing another customer order room', async () => {
      const socket: any = {
        id: 'sock-cust-2',
        data: { user: mockCustomer2 }, // Different customer
        join: vi.fn(),
        emit: vi.fn(),
      };
      prisma.order.findUnique.mockResolvedValueOnce(mockOrder1);

      await gateway.handleSubscribeOrder(socket, { orderId: 'order-101' });

      expect(socket.join).not.toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith('error', {
        event: 'subscribe:order',
        orderId: 'order-101',
        message: 'Forbidden: You do not have permission to access this order',
      });
    });

    it('emits error when order does not exist in database', async () => {
      const socket: any = {
        id: 'sock-admin',
        data: { user: mockAdminUser },
        join: vi.fn(),
        emit: vi.fn(),
      };
      prisma.order.findUnique.mockResolvedValueOnce(null);

      await gateway.handleSubscribeOrder(socket, { orderId: 'non-existent-order' });

      expect(socket.join).not.toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith('error', {
        event: 'subscribe:order',
        orderId: 'non-existent-order',
        message: 'Order not found',
      });
    });

    it('emits validation error when orderId is empty or missing', async () => {
      const socket: any = {
        id: 'sock-admin',
        data: { user: mockAdminUser },
        join: vi.fn(),
        emit: vi.fn(),
      };

      await gateway.handleSubscribeOrder(socket, { orderId: '   ' });

      expect(socket.join).not.toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith('error', {
        event: 'subscribe:order',
        message: 'Validation failed: Invalid or missing orderId',
      });
    });
  });

  describe('4. Event Broadcasting', () => {
    it('broadcasts event to admin:orders and order:{orderId} rooms', () => {
      const adminEmit = vi.fn();
      const orderEmit = vi.fn();

      mockServer.to.mockImplementation((room: string) => {
        if (room === 'admin:orders') return { emit: adminEmit };
        if (room === 'order:ord-1') return { emit: orderEmit };
        return { emit: vi.fn() };
      });

      gateway.broadcastOrderEvent('order.status.updated', {
        orderId: 'ord-1',
        orderNumber: 'DSL-2026-0001',
        event: 'order.status.updated',
        timestamp: new Date().toISOString(),
        data: { status: 'SHIPPED' },
      });

      // Targeted event emitted to both rooms
      expect(adminEmit).toHaveBeenCalledWith('order.status.updated', expect.any(Object));
      expect(orderEmit).toHaveBeenCalledWith('order.status.updated', expect.any(Object));

      // Generic order.updated also emitted
      expect(adminEmit).toHaveBeenCalledWith('order.updated', expect.any(Object));
      expect(orderEmit).toHaveBeenCalledWith('order.updated', expect.any(Object));
    });
  });
});

