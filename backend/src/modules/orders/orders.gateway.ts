import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export interface OrderEventPayload {
  orderId: string;
  orderNumber: string;
  event: string;
  timestamp: string;
  data?: any;
  actor?: {
    id?: string;
    name?: string;
  };
}

const getAllowedOrigins = (): string[] => {
  const corsOriginEnv = process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3002';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const port = process.env.PORT || '4000';

  const baseList = [
    ...corsOriginEnv.split(',').map((o) => o.trim().replace(/\/+$/, '')),
    frontendUrl.trim().replace(/\/+$/, ''),
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3002',
    'http://127.0.0.1:3002',
  ];

  return Array.from(new Set(baseList.filter(Boolean)));
};

@Injectable()
@WebSocketGateway({
  namespace: '/orders',
  cors: {
    origin: (
      requestOrigin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => {
      // Allow requests with no origin (e.g. mobile apps, curl, tests, server-to-server)
      if (!requestOrigin) {
        return callback(null, true);
      }

      const allowed = getAllowedOrigins();
      const normalized = requestOrigin.trim().replace(/\/+$/, '');

      if (allowed.includes(normalized)) {
        return callback(null, true);
      }

      // Support dynamic cloudflare tunnel or preview subdomains if configured
      if (
        normalized.endsWith('.trycloudflare.com') ||
        normalized.endsWith('.dslstationery.lk')
      ) {
        return callback(null, true);
      }

      callback(new Error(`CORS origin not allowed: ${requestOrigin}`), false);
    },
    credentials: true,
  },
})
export class OrdersGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(OrdersGateway.name);
  private readonly ADMIN_ROLES = ['STAFF', 'MANAGER', 'ADMIN'];

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  afterInit(server: Server) {
    this.logger.log('Orders WebSocket Gateway initialized on namespace /orders');

    // Strict Handshake Authentication Middleware
    server.use(async (socket: Socket, next: (err?: any) => void) => {
      try {
        const token = this.extractToken(socket);
        if (!token) {
          this.logger.warn(`Handshake rejected: missing auth token [Socket ID: ${socket.id}]`);
          return next(new Error('Authentication token required'));
        }

        const secret =
          this.configService?.get<string>('JWT_SECRET') ||
          process.env.JWT_SECRET;

        let payload: any;
        try {
          payload = await this.jwtService.verifyAsync(token, { secret });
        } catch (jwtErr: any) {
          this.logger.warn(
            `Handshake rejected: token verification failed (${jwtErr?.message}) [Socket ID: ${socket.id}]`
          );
          return next(new Error('Unauthorized: invalid or expired token'));
        }

        if (!payload || !payload.sub) {
          this.logger.warn(
            `Handshake rejected: missing sub in token [Socket ID: ${socket.id}]`
          );
          return next(new Error('Unauthorized: invalid token payload'));
        }

        // Verify user against database to enforce status, activity, and authoritative role
        const user = await this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            lockedUntil: true,
          },
        });

        if (!user) {
          this.logger.warn(
            `Handshake rejected: user ${payload.sub} not found in DB [Socket ID: ${socket.id}]`
          );
          return next(new Error('Unauthorized: user account not found'));
        }

        if (!user.isActive) {
          this.logger.warn(
            `Handshake rejected: user ${user.email} is deactivated [Socket ID: ${socket.id}]`
          );
          return next(new Error('Unauthorized: user account is deactivated'));
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          this.logger.warn(
            `Handshake rejected: user ${user.email} is locked [Socket ID: ${socket.id}]`
          );
          return next(new Error('Unauthorized: user account is temporarily locked'));
        }

        // Attach securely verified user credentials (do not trust any client-supplied role or id)
        socket.data.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };

        return next();
      } catch (err: any) {
        this.logger.error(`Handshake error on socket ${socket.id}:`, err);
        return next(new Error('Internal authentication error'));
      }
    });
  }

  handleConnection(client: Socket) {
    if (!client.data.user) {
      this.logger.warn(`Disconnecting unauthenticated socket: ${client.id}`);
      client.emit('error', { message: 'Unauthorized: Authentication required' });
      client.disconnect(true);
      return;
    }

    this.logger.log(
      `Client authenticated on /orders: ${client.data.user.email} (${client.data.user.role}) [Socket ID: ${client.id}]`
    );
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from /orders stream: ${client.id}`);
  }

  /**
   * Subscribe to admin order event stream.
   * STRICT AUTHORIZATION: Only STAFF, MANAGER, ADMIN roles permitted.
   */
  @SubscribeMessage('subscribe:admin')
  handleSubscribeAdmin(@ConnectedSocket() client: Socket) {
    const user = client.data.user;
    if (!user || !this.ADMIN_ROLES.includes(user.role)) {
      this.logger.warn(
        `Forbidden subscribe:admin by client ${client.id} (user: ${user?.email || 'none'}, role: ${user?.role || 'none'})`
      );
      client.emit('error', {
        event: 'subscribe:admin',
        message: 'Forbidden: Insufficient permissions for admin orders',
      });
      return;
    }

    client.join('admin:orders');
    this.logger.log(
      `Client ${client.id} (${user.email}, ${user.role}) subscribed to admin:orders`
    );
    client.emit('subscribed:admin', { success: true });
  }

  @SubscribeMessage('unsubscribe:admin')
  handleUnsubscribeAdmin(@ConnectedSocket() client: Socket) {
    client.leave('admin:orders');
    client.emit('unsubscribed:admin', { success: true });
  }

  /**
   * Subscribe to individual order updates.
   * STRICT AUTHORIZATION:
   * - STAFF/MANAGER/ADMIN can access any order.
   * - CUSTOMER can only access orders belonging to their own userId or email.
   * - Invalid or non-existent orderId rejected.
   */
  @SubscribeMessage('subscribe:order')
  async handleSubscribeOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string }
  ) {
    const user = client.data.user;
    if (!user) {
      client.emit('error', {
        event: 'subscribe:order',
        message: 'Unauthorized: Authentication required',
      });
      return;
    }

    const orderId = data?.orderId ? String(data.orderId).trim() : '';
    if (!orderId) {
      client.emit('error', {
        event: 'subscribe:order',
        message: 'Validation failed: Invalid or missing orderId',
      });
      return;
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        customerEmail: true,
      },
    });

    if (!order) {
      this.logger.warn(
        `Client ${client.id} requested subscription to non-existent order: ${orderId}`
      );
      client.emit('error', {
        event: 'subscribe:order',
        orderId,
        message: 'Order not found',
      });
      return;
    }

    const isAdmin = this.ADMIN_ROLES.includes(user.role);
    const isOwner =
      (order.userId && order.userId === user.id) ||
      (order.customerEmail && order.customerEmail.toLowerCase() === user.email.toLowerCase());

    if (!isAdmin && !isOwner) {
      this.logger.warn(
        `Forbidden subscribe:order: user ${user.email} (${user.role}) denied access to order ${orderId}`
      );
      client.emit('error', {
        event: 'subscribe:order',
        orderId,
        message: 'Forbidden: You do not have permission to access this order',
      });
      return;
    }

    client.join(`order:${order.id}`);
    this.logger.log(
      `Client ${client.id} (${user.email}, ${user.role}) joined room order:${order.id}`
    );
    client.emit('subscribed:order', { orderId: order.id, success: true });
  }

  @SubscribeMessage('unsubscribe:order')
  handleUnsubscribeOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string }
  ) {
    const orderId = data?.orderId ? String(data.orderId).trim() : '';
    if (orderId) {
      client.leave(`order:${orderId}`);
      client.emit('unsubscribed:order', { orderId, success: true });
    }
  }

  /**
   * Broadcast an event to admin room and order-specific room.
   * STRICT INVARIANT: Only call after the database transaction has committed.
   */
  broadcastOrderEvent(event: string, payload: OrderEventPayload) {
    if (!this.server) {
      this.logger.warn(`WebSocket server not ready to broadcast event ${event}`);
      return;
    }

    try {
      // 1. Broadcast to admin monitoring room
      this.server.to('admin:orders').emit(event, payload);

      // 2. Broadcast to order-specific room
      if (payload.orderId) {
        this.server.to(`order:${payload.orderId}`).emit(event, payload);
      }

      // Also emit generic 'order.updated' if specific update event
      if (event !== 'order.updated' && event.startsWith('order.')) {
        this.server.to('admin:orders').emit('order.updated', payload);
        if (payload.orderId) {
          this.server.to(`order:${payload.orderId}`).emit('order.updated', payload);
        }
      }
    } catch (err) {
      this.logger.error(`Error broadcasting order event ${event}:`, err);
    }
  }

  /**
   * Helper to extract JWT token from handshake auth, authorization header, or cookies.
   */
  private extractToken(socket: Socket): string | null {
    // 1. Handshake auth token (client { auth: { token: '...' } })
    const authToken = socket.handshake.auth?.token;
    if (authToken && typeof authToken === 'string') {
      const raw = authToken.trim();
      return raw.startsWith('Bearer ') ? raw.slice(7).trim() : raw;
    }

    // 2. Authorization header (Bearer <token>)
    const authHeader = socket.handshake.headers?.authorization;
    if (authHeader && typeof authHeader === 'string') {
      const raw = authHeader.trim();
      if (raw.startsWith('Bearer ')) {
        return raw.slice(7).trim();
      }
      return raw;
    }

    // 3. HTTP Cookie header (dsl_access_token=<token>)
    const cookieHeader = socket.handshake.headers?.cookie;
    if (cookieHeader && typeof cookieHeader === 'string') {
      const match = cookieHeader.match(/(?:^|;\s*)dsl_access_token=([^;]+)/);
      if (match && match[1]) {
        return decodeURIComponent(match[1]);
      }
    }

    return null;
  }
}
