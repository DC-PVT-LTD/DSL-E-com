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
import { Logger } from '@nestjs/common';

export interface StockUpdatePayload {
  productId: string;
  variantId?: string | null;
  physicalStock: number;
  reservedStock: number;
  availableStock: number;
  timestamp: string;
  reason?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/inventory',
})
export class InventoryGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(InventoryGateway.name);

  afterInit(server: Server) {
    this.logger.log('Inventory WebSocket Gateway initialized on namespace /inventory');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to inventory stream: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from inventory stream: ${client.id}`);
  }

  @SubscribeMessage('subscribe:product')
  handleSubscribeProduct(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { productId: string }
  ) {
    if (data?.productId) {
      client.join(`product:${data.productId}`);
      this.logger.log(`Client ${client.id} joined room product:${data.productId}`);
    }
  }

  @SubscribeMessage('unsubscribe:product')
  handleUnsubscribeProduct(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { productId: string }
  ) {
    if (data?.productId) {
      client.leave(`product:${data.productId}`);
    }
  }

  @SubscribeMessage('subscribe:admin')
  handleSubscribeAdmin(@ConnectedSocket() client: Socket) {
    // Join warehouse admin room for all inventory changes
    client.join('admin:inventory');
    this.logger.log(`Client ${client.id} subscribed to admin:inventory`);
  }

  /**
   * Broadcast committed stock updates to connected storefront and admin clients.
   * STRICT INVARIANT: Only call after the database transaction has committed.
   */
  broadcastStockUpdate(payload: StockUpdatePayload) {
    if (!this.server) {
      this.logger.warn('WebSocket server not ready to broadcast stock update');
      return;
    }

    try {
      // 1. Broadcast to product-specific room
      this.server.to(`product:${payload.productId}`).emit('inventory:updated', payload);

      // 2. Broadcast to admin inventory monitoring room
      this.server.to('admin:inventory').emit('inventory:updated', payload);

      // 3. Global broadcast for general catalog stock updates
      this.server.emit('product:stock-changed', {
        productId: payload.productId,
        variantId: payload.variantId,
        physicalStock: payload.physicalStock,
        reservedStock: payload.reservedStock,
        availableStock: payload.availableStock,
        timestamp: payload.timestamp,
      });

      this.logger.log(
        `[WS Broadcast] Product ${payload.productId}: Physical=${payload.physicalStock}, Reserved=${payload.reservedStock}, Available=${payload.availableStock}`
      );
    } catch (err) {
      this.logger.error('Failed to emit WebSocket stock update:', err);
    }
  }
}

