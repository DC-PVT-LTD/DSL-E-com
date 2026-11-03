import { describe, it, expect, beforeEach } from 'vitest';
import { useCartStore } from '../cartStore';
import { INITIAL_PRODUCTS } from '@/mocks/products';

describe('useCartStore', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart();
  });

  it('adds a product to cart and calculates subtotal correctly', () => {
    const product = INITIAL_PRODUCTS[0]; // Atlas CR Book - priceCents 42000
    useCartStore.getState().addItem(product, 2);

    const summary = useCartStore.getState().getSummary();
    expect(summary.itemCount).toBe(2);
    expect(summary.subtotalCents).toBe(84000);
    expect(summary.items.length).toBe(1);
  });

  it('updates quantity and prevents exceeding available stock', () => {
    const product = INITIAL_PRODUCTS[0];
    useCartStore.getState().addItem(product, 1);

    const item = useCartStore.getState().items[0];
    useCartStore.getState().updateQuantity(item.id, 5);

    expect(useCartStore.getState().items[0].quantity).toBe(5);
    expect(useCartStore.getState().getSummary().subtotalCents).toBe(42000 * 5);
  });

  it('removes item when quantity is reduced to 0', () => {
    const product = INITIAL_PRODUCTS[0];
    useCartStore.getState().addItem(product, 1);
    const item = useCartStore.getState().items[0];

    useCartStore.getState().updateQuantity(item.id, 0);
    expect(useCartStore.getState().items.length).toBe(0);
  });

  it('applies promotional discount coupon correctly', () => {
    const paper = INITIAL_PRODUCTS[8]; // Double A Paper - 265000 cents
    useCartStore.getState().addItem(paper, 1);

    const result = useCartStore.getState().applyPromoCode('WELCOME10');
    expect(result.success).toBe(true);

    const summary = useCartStore.getState().getSummary();
    expect(summary.discountCents).toBe(Math.round((265000 * 10) / 100));
  });
});
