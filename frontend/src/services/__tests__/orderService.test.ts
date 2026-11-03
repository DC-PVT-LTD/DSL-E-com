import { describe, it, expect, beforeEach } from 'vitest';
import { orderService } from '../orderService';
import { productService } from '../productService';

describe('orderService', () => {
  beforeEach(() => {
    orderService.resetToDefault();
  });

  it('enforces permitted order status transitions', () => {
    const product = productService.getAll()[0];
    const newOrder = orderService.createOrder({
      customerName: 'Transition Test',
      customerEmail: 'transition@example.lk',
      customerPhone: '+94 77 111 2222',
      shippingAddress: {
        fullName: 'Transition Test',
        phone: '+94 77 111 2222',
        email: 'transition@example.lk',
        addressLine1: '45 Galle Rd',
        city: 'Colombo',
        district: 'Colombo',
      },
      items: [
        {
          id: product.id,
          productId: product.id,
          product,
          quantity: 1,
          unitPriceCents: product.priceCents,
          totalPriceCents: product.priceCents,
        },
      ],
      subtotalCents: product.priceCents,
      discountCents: 0,
      deliveryCents: 35000,
      totalCents: product.priceCents + 35000,
      paymentMethod: 'cash_on_delivery',
    });

    // Created order starts in 'confirmed' status
    expect(newOrder.orderStatus).toBe('confirmed');

    // Transitioning confirmed -> processing is allowed
    const valid = orderService.updateOrderStatus(newOrder.id, 'processing');
    expect(valid).toBe(true);

    // Transitioning processing -> delivered directly is NOT allowed (must go to shipped first)
    const invalid = orderService.updateOrderStatus(newOrder.id, 'delivered');
    expect(invalid).toBe(false);

    // Transitioning processing -> shipped is allowed
    const shippedValid = orderService.updateOrderStatus(newOrder.id, 'shipped');
    expect(shippedValid).toBe(true);

    // Transitioning shipped -> delivered is allowed
    const deliveredValid = orderService.updateOrderStatus(newOrder.id, 'delivered');
    expect(deliveredValid).toBe(true);
  });

  it('restores stock when an order is cancelled', () => {
    const product = productService.getAll()[0];
    const initialStock = product.stockQuantity;

    const newOrder = orderService.createOrder({
      customerName: 'Test Customer',
      customerEmail: 'test@example.lk',
      customerPhone: '+94 77 123 4567',
      shippingAddress: {
        fullName: 'Test Customer',
        phone: '+94 77 123 4567',
        email: 'test@example.lk',
        addressLine1: 'Test St',
        city: 'Colombo',
        district: 'Colombo',
      },
      items: [
        {
          id: product.id,
          productId: product.id,
          product,
          quantity: 2,
          unitPriceCents: product.priceCents,
          totalPriceCents: product.priceCents * 2,
        },
      ],
      subtotalCents: product.priceCents * 2,
      discountCents: 0,
      deliveryCents: 35000,
      totalCents: product.priceCents * 2 + 35000,
      paymentMethod: 'cash_on_delivery',
    });

    expect(productService.getById(product.id)?.stockQuantity).toBe(initialStock - 2);

    // Cancel order
    orderService.updateOrderStatus(newOrder.id, 'cancelled');
    expect(productService.getById(product.id)?.stockQuantity).toBe(initialStock);
  });
});
