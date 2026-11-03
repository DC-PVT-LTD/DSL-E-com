import { Order, OrderStatus, PaymentStatus, ShippingAddress, PaymentMethod } from '@/types/order';
import { CartItem } from '@/types/cart';
import { INITIAL_ORDERS } from '@/mocks/customers';
import { productService } from './productService';

const ORDERS_STORAGE_KEY = 'dsl_orders_data_v1';

// Permitted status transitions map
export const PERMITTED_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

class OrderService {
  private orders: Order[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.initData();
  }

  private initData() {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(ORDERS_STORAGE_KEY);
        if (stored) {
          this.orders = JSON.parse(stored);
          return;
        }
      } catch (err) {
        console.error('Error loading orders:', err);
      }
    }
    this.orders = [...INITIAL_ORDERS];
  }

  private persistAndNotify() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(this.orders));
      } catch (err) {
        console.error('Error saving orders:', err);
      }
    }
    this.listeners.forEach((listener) => listener());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public resetToDefault(): void {
    this.orders = [...INITIAL_ORDERS];
    this.persistAndNotify();
  }

  public getAll(): Order[] {
    return [...this.orders];
  }

  public getById(id: string): Order | undefined {
    return this.orders.find((o) => o.id === id || o.orderNumber === id);
  }

  public createOrder(params: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    shippingAddress: ShippingAddress;
    items: CartItem[];
    subtotalCents: number;
    discountCents: number;
    deliveryCents: number;
    totalCents: number;
    paymentMethod: PaymentMethod;
    notes?: string;
  }): Order {
    const orderNumber = `DSL-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber,
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      customerPhone: params.customerPhone,
      shippingAddress: params.shippingAddress,
      items: params.items,
      subtotalCents: params.subtotalCents,
      discountCents: params.discountCents,
      deliveryCents: params.deliveryCents,
      totalCents: params.totalCents,
      paymentMethod: params.paymentMethod,
      // Cash on delivery starts pending, simulated card starts simulated_paid
      paymentStatus: params.paymentMethod === 'cash_on_delivery' ? 'pending' : 'simulated_paid',
      orderStatus: 'confirmed',
      notes: params.notes,
      trackingNumber: `DSL-EXP-${Math.floor(10000 + Math.random() * 89999)}`,
      estimatedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Deduct stock for ordered items
    params.items.forEach((item) => {
      productService.adjustStock(item.productId, -item.quantity);
    });

    this.orders.unshift(newOrder);
    this.persistAndNotify();
    return newOrder;
  }

  public updateOrderStatus(id: string, newStatus: OrderStatus): boolean {
    const order = this.orders.find((o) => o.id === id);
    if (!order) return false;

    // Check transition
    const allowed = PERMITTED_ORDER_TRANSITIONS[order.orderStatus];
    if (!allowed.includes(newStatus)) {
      console.warn(`Transition from ${order.orderStatus} to ${newStatus} is not permitted.`);
      return false;
    }

    order.orderStatus = newStatus;
    order.updatedAt = new Date().toISOString();

    // If cancelled, return stock
    if (newStatus === 'cancelled') {
      order.items.forEach((item) => {
        productService.adjustStock(item.productId, item.quantity);
      });
      if (order.paymentStatus === 'simulated_paid') {
        order.paymentStatus = 'refunded';
      }
    }

    this.persistAndNotify();
    return true;
  }

  public updatePaymentStatus(id: string, paymentStatus: PaymentStatus): boolean {
    const order = this.orders.find((o) => o.id === id);
    if (!order) return false;

    order.paymentStatus = paymentStatus;
    order.updatedAt = new Date().toISOString();
    this.persistAndNotify();
    return true;
  }
}

export const orderService = new OrderService();
