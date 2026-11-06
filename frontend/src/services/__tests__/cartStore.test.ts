import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCartStore } from '../cartStore';
import { cartService } from '../cartService';
import { INITIAL_PRODUCTS } from '@/mocks/products';

describe('useCartStore', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart();
  });

  it('adds a product to cart and calculates subtotal correctly', () => {
    const product = INITIAL_PRODUCTS[0];
    useCartStore.getState().addItem(product, 2);

    const summary = useCartStore.getState().getSummary();
    expect(summary.itemCount).toBe(2);
    expect(summary.subtotalCents).toBe(product.priceCents * 2);
    expect(summary.items.length).toBe(1);
  });

  it('updates quantity and prevents exceeding available stock', () => {
    const product = INITIAL_PRODUCTS[0];
    useCartStore.getState().addItem(product, 1);

    const item = useCartStore.getState().items[0];
    useCartStore.getState().updateQuantity(item.id, 5);

    expect(useCartStore.getState().items[0].quantity).toBe(5);
    expect(useCartStore.getState().getSummary().subtotalCents).toBe(product.priceCents * 5);
  });

  it('removes item when quantity is reduced to 0', () => {
    const product = INITIAL_PRODUCTS[0];
    useCartStore.getState().addItem(product, 1);
    const item = useCartStore.getState().items[0];

    useCartStore.getState().updateQuantity(item.id, 0);
    expect(useCartStore.getState().items.length).toBe(0);
  });

  it('applies promotional discount coupon correctly', () => {
    // WELCOME10 requires minOrderAmountCents >= 200,000
    const item = INITIAL_PRODUCTS.find((p) => p.priceCents >= 200000) || INITIAL_PRODUCTS[0];
    useCartStore.getState().addItem(item, 1);

    const result = useCartStore.getState().applyPromoCode('WELCOME10');
    expect(result.success).toBe(true);

    const summary = useCartStore.getState().getSummary();
    expect(summary.discountCents).toBe(Math.round((item.priceCents * 10) / 100));
  });

  it('handles products with variants using compound line keys', () => {
    const product = INITIAL_PRODUCTS[0];
    const variant = {
      id: 'var-blue',
      productId: product.id,
      name: 'Blue Ruling',
      sku: 'SKU-VAR-BLUE',
      priceCents: 45000,
      stockQuantity: 15,
      attributes: { color: 'Blue' },
      isActive: true,
      createdAt: '',
      updatedAt: '',
    };

    useCartStore.getState().addItem(product, 2, variant);

    const items = useCartStore.getState().items;
    expect(items.length).toBe(1);
    expect(items[0].variantId).toBe('var-blue');
    expect(items[0].unitPriceCents).toBe(45000);
    expect(items[0].totalPriceCents).toBe(90000);
  });

  it('isolates cart on logout via clearCartLocal', () => {
    const product = INITIAL_PRODUCTS[0];
    useCartStore.getState().addItem(product, 2);
    expect(useCartStore.getState().items.length).toBe(1);

    useCartStore.getState().clearCartLocal();
    expect(useCartStore.getState().items.length).toBe(0);
    expect(useCartStore.getState().getSummary().itemCount).toBe(0);
  });

  it('calculates delivery fee and free delivery threshold correctly', () => {
    const product = INITIAL_PRODUCTS[0];
    useCartStore.getState().addItem(product, 1);

    let summary = useCartStore.getState().getSummary();
    expect(summary.isFreeDeliveryEligible).toBe(false);
    expect(summary.deliveryCents).toBe(35000); // Standard flat delivery fee

    // Add high-value items (e.g. 2 calculators at 290,000 cents each = 580,000 > 500,000 threshold)
    const highValueItem = INITIAL_PRODUCTS.find((p) => p.priceCents >= 290000) || product;
    useCartStore.getState().addItem(highValueItem, 2);
    summary = useCartStore.getState().getSummary();
    expect(summary.isFreeDeliveryEligible).toBe(true);
    expect(summary.deliveryCents).toBe(0);
  });

  it('regression: adding selected pen variant (Blue and Black) tracks separate items and increments quantities correctly without opening drawer', async () => {
    // Drawer should initially be closed
    expect(useCartStore.getState().isDrawerOpen).toBe(false);

    const penProduct = {
      id: 'prod-speed-rim-blue',
      name: 'SPEED RIM Ball Pen Blue',
      slug: 'speed-rim-ball-pen-blue',
      sku: 'DSL-SPEED-RIM-BLUE',
      description: 'Classic 0.7mm smooth writing blue ballpoint pen.',
      shortDescription: 'Classic 0.7mm smooth writing blue ballpoint pen.',
      categoryName: 'Pens',
      brandId: 'brand-speed',
      brandName: 'Speed',
      priceCents: 2500,
      stockQuantity: 610,
      lowStockThreshold: 50,
      isActive: true,
      isFeatured: true,
      isNewArrival: false,
      isBestSeller: true,
      images: ['/products/speed-rim-blue.png'],
      tags: ['pen', 'ballpoint'],
      rating: 5,
      reviewCount: 34,
      specifications: {},
      categoryId: 'cat-pens',
      createdAt: '',
      updatedAt: '',
    };

    const blueVariant = {
      id: 'var-speed-rim-blue',
      productId: 'prod-speed-rim-blue',
      name: 'Blue',
      sku: 'DSL-SPEED-RIM-VAR-BLUE',
      priceCents: 2500,
      stockQuantity: 610,
      attributes: { color: 'Blue' },
      isActive: true,
      createdAt: '',
      updatedAt: '',
    };

    const blackVariant = {
      id: 'var-speed-rim-black',
      productId: 'prod-speed-rim-blue',
      name: 'Black',
      sku: 'DSL-SPEED-RIM-VAR-BLACK',
      priceCents: 2500,
      stockQuantity: 450,
      attributes: { color: 'Black' },
      isActive: true,
      createdAt: '',
      updatedAt: '',
    };

    // 1. Add Blue variant
    await useCartStore.getState().addItem(penProduct, 1, blueVariant);

    let items = useCartStore.getState().items;
    expect(items.length).toBe(1);
    expect(items[0].variantId).toBe('var-speed-rim-blue');
    expect(items[0].variant?.name).toBe('Blue');
    expect(items[0].quantity).toBe(1);
    expect(items[0].unitPriceCents).toBe(2500);
    // Drawer must remain closed
    expect(useCartStore.getState().isDrawerOpen).toBe(false);

    // 2. Add Black variant
    await useCartStore.getState().addItem(penProduct, 2, blackVariant);

    items = useCartStore.getState().items;
    expect(items.length).toBe(2);
    expect(items[1].variantId).toBe('var-speed-rim-black');
    expect(items[1].variant?.name).toBe('Black');
    expect(items[1].quantity).toBe(2);

    // 3. Re-add Blue variant (should update quantity to 2, not add 3rd line item)
    await useCartStore.getState().addItem(penProduct, 1, blueVariant);
    items = useCartStore.getState().items;
    expect(items.length).toBe(2);
    expect(items[0].variantId).toBe('var-speed-rim-blue');
    expect(items[0].quantity).toBe(2);

    // Summary reflects total items (4 pens)
    const summary = useCartStore.getState().getSummary();
    expect(summary.itemCount).toBe(4);
    expect(summary.subtotalCents).toBe(2500 * 4);
    expect(useCartStore.getState().isDrawerOpen).toBe(false);
  });

  it('regression: rejects inactive variants without adding to cart', async () => {
    const penProduct = {
      id: 'prod-speed-rim-blue',
      name: 'SPEED RIM Ball Pen Blue',
      slug: 'speed-rim-ball-pen-blue',
      sku: 'DSL-SPEED-RIM-BLUE',
      description: 'Classic 0.7mm smooth writing blue ballpoint pen.',
      shortDescription: 'Classic 0.7mm smooth writing blue ballpoint pen.',
      categoryName: 'Pens',
      brandId: 'brand-speed',
      brandName: 'Speed',
      priceCents: 2500,
      stockQuantity: 610,
      lowStockThreshold: 50,
      isActive: true,
      isFeatured: true,
      isNewArrival: false,
      isBestSeller: true,
      images: [],
      tags: [],
      rating: 5,
      reviewCount: 34,
      specifications: {},
      categoryId: 'cat-pens',
      createdAt: '',
      updatedAt: '',
    };

    const inactiveVariant = {
      id: 'var-speed-rim-inactive',
      productId: 'prod-speed-rim-blue',
      name: 'Old Inactive',
      sku: 'DSL-SPEED-RIM-OLD',
      priceCents: 2500,
      stockQuantity: 10,
      attributes: { color: 'Blue' },
      isActive: false,
      createdAt: '',
      updatedAt: '',
    };

    const success = await useCartStore.getState().addItem(penProduct, 1, inactiveVariant);
    expect(success).toBe(false);
    expect(useCartStore.getState().items.length).toBe(0);
  });

  it('adds school pack and retains bundle discount in cart summary', async () => {
    useCartStore.getState().clearCartLocal();

    const bookProduct = {
      id: 'prod-book-1',
      name: 'Atlas Exercise Book 80pgs',
      slug: 'atlas-exercise-book-80pgs',
      sku: 'ATL-EX-80',
      description: 'Single ruled',
      shortDescription: 'Exercise book',
      priceCents: 16000, // Rs. 160.00
      stockQuantity: 50,
      lowStockThreshold: 5,
      isActive: true,
      isFeatured: false,
      isNewArrival: false,
      isBestSeller: false,
      images: [],
      tags: [],
      rating: 5,
      reviewCount: 0,
      specifications: {},
      categoryId: 'cat-books',
      categoryName: 'Exercise Books',
      brandId: 'brand-atlas',
      brandName: 'Atlas',
      createdAt: '',
      updatedAt: '',
    };

    const pack = {
      id: 'pack-primary-1',
      name: 'Grade 1-2 Starter Pack',
      savingsPercentage: 10,
    };

    const customizedItems = [
      {
        productId: bookProduct.id,
        product: bookProduct,
        quantity: 5,
      },
    ];

    await useCartStore.getState().addSchoolPack(pack, customizedItems);

    const items = useCartStore.getState().items;
    expect(items.length).toBe(1);
    expect(items[0].bundleInfo?.packName).toBe('Grade 1-2 Starter Pack');
    expect(items[0].bundleInfo?.savingsPercentage).toBe(10);

    const summary = useCartStore.getState().getSummary();
    // 5 * 16000 = 80000 cents subtotal
    // 10% bundle savings = 8000 cents
    expect(summary.subtotalCents).toBe(80000);
    expect(summary.discountCents).toBe(8000);
    expect(summary.totalCents).toBe(80000 - 8000 + summary.deliveryCents);
  });

  it('updates stock availability via WebSocket event without losing bundleInfo or bundle discount', async () => {
    useCartStore.getState().clearCartLocal();

    const bookProduct = {
      id: 'prod-atlas-cr-120',
      name: 'Atlas CR Book 120pgs',
      slug: 'atlas-cr-book-120pgs',
      sku: 'ATL-CR-120',
      description: 'Ruled',
      shortDescription: 'CR Book',
      priceCents: 35000,
      stockQuantity: 20,
      lowStockThreshold: 5,
      isActive: true,
      isFeatured: false,
      isNewArrival: false,
      isBestSeller: false,
      images: [],
      tags: [],
      rating: 5,
      reviewCount: 0,
      specifications: {},
      categoryId: 'cat-books',
      categoryName: 'Exercise Books',
      brandId: 'brand-atlas',
      brandName: 'Atlas',
      createdAt: '',
      updatedAt: '',
    };

    const pack = {
      id: 'pack-al-commerce-1',
      name: 'A/L Commerce Starter Bundle',
      savingsPercentage: 15,
    };

    await useCartStore.getState().addSchoolPack(pack, [
      {
        productId: bookProduct.id,
        product: bookProduct,
        quantity: 10,
      },
    ]);

    // Verify initial state
    let items = useCartStore.getState().items;
    expect(items.length).toBe(1);
    expect(items[0].quantity).toBe(10);
    expect(items[0].bundleInfo?.savingsPercentage).toBe(15);
    expect(items[0].product.stockQuantity).toBe(20);

    // Simulate real-time stock drop event: available stock drops to 4 (< 10 in cart)
    useCartStore.getState().updateStockAvailability('prod-atlas-cr-120', null, 4);

    items = useCartStore.getState().items;
    expect(items[0].product.stockQuantity).toBe(4);
    expect(items[0].exceedsStock).toBe(true);
    expect(items[0].isOutOfStock).toBe(false);
    expect(items[0].bundleInfo?.packName).toBe('A/L Commerce Starter Bundle');
    expect(items[0].bundleInfo?.savingsPercentage).toBe(15);

    // Bundle discount calculation must remain strictly intact
    const summary = useCartStore.getState().getSummary();
    expect(summary.subtotalCents).toBe(35000 * 10);
    expect(summary.discountCents).toBe(Math.round((35000 * 10 * 15) / 100));
    expect(useCartStore.getState().warnings?.length).toBeGreaterThan(0);
    expect(useCartStore.getState().warnings![0]).toContain('Only 4 units');

    // Simulate stock drops to 0 (Out of stock)
    useCartStore.getState().updateStockAvailability('prod-atlas-cr-120', null, 0);
    items = useCartStore.getState().items;
    expect(items[0].product.stockQuantity).toBe(0);
    expect(items[0].isOutOfStock).toBe(true);
    expect(items[0].isAvailable).toBe(false);
    expect(items[0].bundleInfo?.savingsPercentage).toBe(15);
  });

  describe('Phase A: Individual Cart Item Selection and Selective Checkout', () => {
    it('sets selected = true by default when items are added', () => {
      useCartStore.getState().clearCartLocal();
      const p1 = INITIAL_PRODUCTS[0];
      const p2 = INITIAL_PRODUCTS[1];
      useCartStore.getState().addItem(p1, 1);
      useCartStore.getState().addItem(p2, 2);

      const items = useCartStore.getState().items;
      expect(items.length).toBe(2);
      expect(items[0].selected).toBe(true);
      expect(items[1].selected).toBe(true);

      const summary = useCartStore.getState().getSummary();
      expect(summary.selectedItemCount).toBe(3);
      expect(summary.selectedItems.length).toBe(2);
    });

    it('toggles individual item selection and updates cart summary totals', () => {
      useCartStore.getState().clearCartLocal();
      const p1 = INITIAL_PRODUCTS[0];
      const p2 = INITIAL_PRODUCTS[1];
      useCartStore.getState().addItem(p1, 1);
      useCartStore.getState().addItem(p2, 1);

      const items = useCartStore.getState().items;
      const id1 = items[0].id;
      const id2 = items[1].id;

      // Unselect item 1
      useCartStore.getState().toggleItemSelection(id1);

      const itemsAfterToggle = useCartStore.getState().items;
      expect(itemsAfterToggle.find((i) => i.id === id1)?.selected).toBe(false);
      expect(itemsAfterToggle.find((i) => i.id === id2)?.selected).toBe(true);

      // Verify summary reflects ONLY item 2
      const summary = useCartStore.getState().getSummary();
      expect(summary.itemCount).toBe(2);
      expect(summary.selectedItemCount).toBe(1);
      expect(summary.selectedItems.length).toBe(1);
      expect(summary.selectedItems[0].id).toBe(id2);
      expect(summary.subtotalCents).toBe(p2.priceCents);
      expect(summary.totalCents).toBe(p2.priceCents + summary.deliveryCents);

      // Re-select item 1
      useCartStore.getState().toggleItemSelection(id1);
      const summaryAfterReselect = useCartStore.getState().getSummary();
      expect(summaryAfterReselect.selectedItemCount).toBe(2);
      expect(summaryAfterReselect.subtotalCents).toBe(p1.priceCents + p2.priceCents);
    });

    it('selectAllItems toggles all items and zero-outs totals when none selected', () => {
      useCartStore.getState().clearCartLocal();
      const p1 = INITIAL_PRODUCTS[0];
      const p2 = INITIAL_PRODUCTS[1];
      useCartStore.getState().addItem(p1, 2);
      useCartStore.getState().addItem(p2, 3);

      // Unselect all items
      useCartStore.getState().selectAllItems(false);

      const items = useCartStore.getState().items;
      expect(items.length).toBe(2);
      expect(items.every((i) => i.selected === false)).toBe(true);

      const summary = useCartStore.getState().getSummary();
      expect(summary.selectedItemCount).toBe(0);
      expect(summary.selectedItems.length).toBe(0);
      expect(summary.subtotalCents).toBe(0);
      expect(summary.discountCents).toBe(0);
      expect(summary.deliveryCents).toBe(0);
      expect(summary.totalCents).toBe(0);

      // Select all items back
      useCartStore.getState().selectAllItems(true);
      const summaryAll = useCartStore.getState().getSummary();
      expect(summaryAll.selectedItemCount).toBe(5);
      expect(summaryAll.subtotalCents).toBe(p1.priceCents * 2 + p2.priceCents * 3);
    });

    it('removePurchasedItems removes only specified items and preserves unselected items', async () => {
      useCartStore.getState().clearCartLocal();
      const p1 = INITIAL_PRODUCTS[0];
      const p2 = INITIAL_PRODUCTS[1];
      const p3 = INITIAL_PRODUCTS[2];

      useCartStore.setState({
        items: [
          {
            id: p1.id,
            productId: p1.id,
            product: p1,
            quantity: 1,
            unitPriceCents: p1.priceCents,
            totalPriceCents: p1.priceCents,
            selected: true,
          },
          {
            id: p2.id,
            productId: p2.id,
            product: p2,
            quantity: 1,
            unitPriceCents: p2.priceCents,
            totalPriceCents: p2.priceCents,
            selected: true,
          },
          {
            id: p3.id,
            productId: p3.id,
            product: p3,
            quantity: 2,
            unitPriceCents: p3.priceCents,
            totalPriceCents: p3.priceCents * 2,
            selected: false,
          },
        ],
      });

      vi.spyOn(cartService, 'removePurchasedItems').mockResolvedValue({
        id: 'cart-mock-1',
        userId: null,
        sessionId: 'session-1',
        items: [
          {
            id: 'backend-item-3',
            cartId: 'cart-mock-1',
            productId: p3.id,
            variantId: null,
            quantity: 2,
            unitPriceCents: p3.priceCents,
            totalPriceCents: p3.priceCents * 2,
            product: p3,
          },
        ],
        itemCount: 2,
        subtotalCents: p3.priceCents * 2,
        discountCents: 0,
        deliveryCents: 35000,
        totalCents: p3.priceCents * 2 + 35000,
        warnings: [],
      } as any);

      // Simulate purchasing p1 and p2, leaving p3 in cart
      await useCartStore.getState().removePurchasedItems([
        { productId: p1.id, variantId: null },
        { productId: p2.id, variantId: null },
      ]);

      const remainingItems = useCartStore.getState().items;
      expect(remainingItems.length).toBe(1);
      expect(remainingItems[0].productId).toBe(p3.id);
      expect(remainingItems[0].quantity).toBe(2);

      const summary = useCartStore.getState().getSummary();
      expect(summary.itemCount).toBe(2);
    });
  });
});
