import { io, Socket } from 'socket.io-client';

export interface LiveStockUpdate {
  productId: string;
  variantId?: string | null;
  physicalStock: number;
  reservedStock: number;
  availableStock: number;
  timestamp: string;
  reason?: string;
}

type StockCallback = (update: LiveStockUpdate) => void;
type ReconnectCallback = () => void;

class InventorySocketService {
  private socket: Socket | null = null;
  private productListeners: Map<string, Set<StockCallback>> = new Map();
  private adminListeners: Set<StockCallback> = new Set();
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
      this.socket = io(`${socketUrl}/inventory`, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        // Resubscribe active rooms on reconnection
        for (const [productId] of this.productListeners.entries()) {
          this.socket?.emit('subscribe:product', { productId });
        }
        if (this.adminListeners.size > 0) {
          this.socket?.emit('subscribe:admin');
        }
        // Trigger authoritative refetch
        this.reconnectListeners.forEach((cb) => {
          try {
            cb();
          } catch (e) {
            console.error('Error in socket reconnect listener:', e);
          }
        });
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
      });

      // Handle stock update broadcasts
      this.socket.on('inventory:updated', (payload: LiveStockUpdate) => {
        this.dispatchStockUpdate(payload);
      });

      this.socket.on('product:stock-changed', (payload: LiveStockUpdate) => {
        this.dispatchStockUpdate(payload);
      });
    } catch (err) {
      console.warn('Failed to initialize inventory WebSocket connection:', err);
    }
  }

  private dispatchStockUpdate(payload: LiveStockUpdate) {
    if (!payload?.productId) return;

    // Notify product-specific listeners
    const listeners = this.productListeners.get(payload.productId);
    if (listeners) {
      listeners.forEach((cb) => {
        try {
          cb(payload);
        } catch (e) {
          console.error('Error in product stock callback:', e);
        }
      });
    }

    // Notify admin listeners
    this.adminListeners.forEach((cb) => {
      try {
        cb(payload);
      } catch (e) {
        console.error('Error in admin stock callback:', e);
      }
    });
  }

  /**
   * Subscribe to stock changes for a specific product.
   */
  public subscribeProduct(productId: string, callback: StockCallback): () => void {
    if (!this.productListeners.has(productId)) {
      this.productListeners.set(productId, new Set());
      if (this.socket && this.isConnected) {
        this.socket.emit('subscribe:product', { productId });
      }
    }

    this.productListeners.get(productId)!.add(callback);

    return () => {
      const set = this.productListeners.get(productId);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.productListeners.delete(productId);
          if (this.socket && this.isConnected) {
            this.socket.emit('unsubscribe:product', { productId });
          }
        }
      }
    };
  }

  /**
   * Subscribe to all inventory events (Admin warehouse view).
   */
  public subscribeAdmin(callback: StockCallback): () => void {
    this.adminListeners.add(callback);
    if (this.socket && this.isConnected && this.adminListeners.size === 1) {
      this.socket.emit('subscribe:admin');
    }

    return () => {
      this.adminListeners.delete(callback);
    };
  }

  /**
   * Register a callback when the socket reconnects to perform authoritative refetch.
   */
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

export const inventorySocketService = new InventorySocketService();

