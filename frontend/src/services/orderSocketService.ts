import { io, Socket } from 'socket.io-client';

export interface OrderSocketEvent {
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

type OrderEventCallback = (event: OrderSocketEvent) => void;
type ReconnectCallback = () => void;

class OrderSocketService {
  private socket: Socket | null = null;
  private orderListeners: Map<string, Set<OrderEventCallback>> = new Map();
  private adminListeners: Set<OrderEventCallback> = new Set();
  private reconnectListeners: Set<ReconnectCallback> = new Set();
  private isConnected = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initSocket();
    }
  }

  private initSocket() {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
    const socketUrl = apiBase.replace(/\/api\/v1\/?$/, '');

    try {
      this.socket = io(`${socketUrl}/orders`, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
        withCredentials: true,
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        // Resubscribe rooms on reconnect
        if (this.adminListeners.size > 0) {
          this.socket?.emit('subscribe:admin');
        }
        for (const [orderId] of this.orderListeners.entries()) {
          this.socket?.emit('subscribe:order', { orderId });
        }
        // Notify reconnect listeners to trigger authoritative refetch
        this.reconnectListeners.forEach((cb) => {
          try {
            cb();
          } catch (e) {
            console.error('Error in order socket reconnect listener:', e);
          }
        });
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
      });

      // Register all Phase 11 required event listeners
      const events = [
        'order.created',
        'order.updated',
        'order.status.updated',
        'order.customer.updated',
        'order.delivery.updated',
        'order.items.updated',
        'order.payment.updated',
        'order.cancelled',
        'order.return.updated',
        'order.refund.updated',
      ];

      events.forEach((eventName) => {
        this.socket?.on(eventName, (payload: OrderSocketEvent) => {
          this.dispatchOrderEvent(payload);
        });
      });
    } catch (err) {
      console.warn('Failed to initialize orders WebSocket connection:', err);
    }
  }

  private dispatchOrderEvent(payload: OrderSocketEvent) {
    if (!payload?.orderId) return;

    // 1. Dispatch to admin global order listeners
    this.adminListeners.forEach((cb) => {
      try {
        cb(payload);
      } catch (e) {
        console.error('Error in admin order listener callback:', e);
      }
    });

    // 2. Dispatch to specific order subscribers
    const orderSet = this.orderListeners.get(payload.orderId);
    if (orderSet) {
      orderSet.forEach((cb) => {
        try {
          cb(payload);
        } catch (e) {
          console.error('Error in order listener callback:', e);
        }
      });
    }
  }

  public subscribeAdmin(callback: OrderEventCallback): () => void {
    this.adminListeners.add(callback);
    if (this.socket?.connected) {
      this.socket.emit('subscribe:admin');
    }
    return () => {
      this.adminListeners.delete(callback);
      if (this.adminListeners.size === 0 && this.socket?.connected) {
        this.socket.emit('unsubscribe:admin');
      }
    };
  }

  public subscribeOrder(orderId: string, callback: OrderEventCallback): () => void {
    if (!this.orderListeners.has(orderId)) {
      this.orderListeners.set(orderId, new Set());
    }
    this.orderListeners.get(orderId)!.add(callback);

    if (this.socket?.connected) {
      this.socket.emit('subscribe:order', { orderId });
    }

    return () => {
      const set = this.orderListeners.get(orderId);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.orderListeners.delete(orderId);
          if (this.socket?.connected) {
            this.socket.emit('unsubscribe:order', { orderId });
          }
        }
      }
    };
  }

  public onReconnect(callback: ReconnectCallback): () => void {
    this.reconnectListeners.add(callback);
    return () => {
      this.reconnectListeners.delete(callback);
    };
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }
}

export const orderSocketService = new OrderSocketService();

