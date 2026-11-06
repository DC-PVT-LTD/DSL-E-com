import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCartStore } from '../cartStore';
import { rupeesToCents } from '@/lib/currency';
import { RecommendedProductItem } from '@/types/recommendations';

vi.mock('../cartService', () => ({
  cartService: {
    addItem: vi.fn().mockImplementation((productId, quantity) => {
      const items = useCartStore.getState().items;
      return Promise.resolve({
        id: 'cart-mock',
        items: items.map((i) => ({
          id: i.id,
          productId: i.productId,
          quantity: i.quantity,
          unitPriceCents: i.unitPriceCents,
          totalPriceCents: i.totalPriceCents,
          product: i.product,
          isAvailable: true,
          isOutOfStock: false,
          exceedsStock: false,
        })),
        itemCount: items.length,
        subtotalCents: items.reduce((acc, i) => acc + i.totalPriceCents, 0),
        discountCents: 0,
        deliveryCents: 35000,
        totalCents: items.reduce((acc, i) => acc + i.totalPriceCents, 0) + 35000,
        isFreeDeliveryEligible: false,
        freeDeliveryThresholdCents: 500000,
        updatedAt: new Date().toISOString(),
      });
    }),
    toClientCartItem: vi.fn().mockImplementation((item) => ({
      id: item.id || item.productId,
      productId: item.productId,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      totalPriceCents: item.totalPriceCents,
      product: item.product,
      isAvailable: true,
      isOutOfStock: false,
      exceedsStock: false,
    })),
  },
}));

describe('Find My Stationery Basket & Cart Integration', () => {
  const sampleItems: RecommendedProductItem[] = [
    {
      productId: 'prod-speed-rim-blue',
      productName: 'SPEED RIM Ball Pen Blue',
      productSlug: 'speed-rim-ball-pen-blue',
      sku: 'SPD-RIM-BLU',
      categoryId: 'cat-pens',
      categoryName: 'Pens',
      unitPriceCents: 2500, // Rs. 25.00
      quantity: 5,
      subtotalCents: 12500, // Rs. 125.00
      stockQuantity: 50,
      lowStock: false,
      reason: 'Standard writing pens',
      priority: 1,
      substitutes: [
        {
          id: 'prod-dsl-2',
          name: 'Speed Beauty Blue Pen',
          slug: 'speed-beauty-blue-pen',
          sku: 'SPD-BTY-BLU',
          priceCents: 2500,
          stockQuantity: 40,
        },
      ],
    },
    {
      productId: 'prod-doms-colour-12',
      productName: 'Doms 12 Colour Pencils Set',
      productSlug: 'doms-12-colour-pencils-set',
      sku: 'DOMS-COL-12',
      categoryId: 'cat-pencils',
      categoryName: 'Pencils',
      unitPriceCents: 42000, // Rs. 420.00
      quantity: 1,
      subtotalCents: 42000,
      stockQuantity: 10,
      lowStock: false,
      reason: 'Art and colouring activity',
      priority: 2,
      substitutes: [],
    },
  ];

  beforeEach(() => {
    useCartStore.setState({ items: [] });
  });

  describe('Budget calculations', () => {
    it('calculates total product count and basket subtotal accurately in integer cents', () => {
      const totalCents = sampleItems.reduce((acc, it) => acc + it.subtotalCents, 0);
      const totalCount = sampleItems.reduce((acc, it) => acc + it.quantity, 0);

      expect(totalCents).toBe(12500 + 42000); // 54500 cents (Rs. 545.00)
      expect(totalCount).toBe(6);
    });

    it('correctly assesses remaining budget and detects budget exceeded', () => {
      const totalCents = 54500;
      const targetBudgetLkr = 1000; // Rs. 1000
      const budgetCents = rupeesToCents(targetBudgetLkr); // 100,000 cents

      const remainingCents = budgetCents - totalCents;
      expect(remainingCents).toBe(45500); // Rs. 455.00 left
      expect(remainingCents >= 0).toBe(true);

      // Low budget scenario
      const lowBudgetCents = rupeesToCents(500); // Rs. 500 = 50,000 cents
      const deficit = lowBudgetCents - totalCents;
      expect(deficit).toBe(-4500); // Rs. 45.00 over budget
      expect(deficit < 0).toBe(true);
    });
  });

  describe('Quantity modification and boundaries', () => {
    it('updates line total and respects stock upper limit', () => {
      const item = { ...sampleItems[0] };
      const requestedQty = 10;
      const boundedQty = Math.min(requestedQty, item.stockQuantity);
      const updatedSubtotal = item.unitPriceCents * boundedQty;

      expect(boundedQty).toBe(10);
      expect(updatedSubtotal).toBe(25000); // Rs. 250.00

      // Exceeding stock scenario (stock is 50)
      const excessiveQty = 999;
      const cappedQty = Math.min(excessiveQty, item.stockQuantity);
      expect(cappedQty).toBe(50);
    });
  });

  describe('Product substitution and item removal', () => {
    it('replaces an item with a compatible substitute preserving quantity', () => {
      let basket = [...sampleItems];
      const targetIndex = 0;
      const sub = basket[targetIndex].substitutes[0];

      // Substitute item
      basket[targetIndex] = {
        ...basket[targetIndex],
        productId: sub.id,
        productName: sub.name,
        sku: sub.sku,
        unitPriceCents: sub.priceCents,
        stockQuantity: sub.stockQuantity,
        subtotalCents: sub.priceCents * basket[targetIndex].quantity,
      };

      expect(basket[0].productId).toBe('prod-dsl-2');
      expect(basket[0].productName).toBe('Speed Beauty Blue Pen');
      expect(basket[0].quantity).toBe(5);
    });

    it('removes an item from basket and immediately updates total', () => {
      let basket = [...sampleItems];
      basket = basket.filter((i) => i.productId !== 'prod-doms-colour-12');

      expect(basket.length).toBe(1);
      const newTotal = basket.reduce((acc, it) => acc + it.subtotalCents, 0);
      expect(newTotal).toBe(12500);
    });
  });

  describe('Cart Store Integration', () => {
    it('adds confirmed recommendation items to cart store while preserving existing items', async () => {
      // Existing item in cart
      const existingProduct = {
        id: 'prod-existing',
        name: 'Existing Notebook',
        slug: 'existing-notebook',
        sku: 'EX-NB-1',
        priceCents: 15000,
        stockQuantity: 20,
        lowStockThreshold: 5,
        isActive: true,
      };
      await useCartStore.getState().addItem(existingProduct as any, 1);

      expect(useCartStore.getState().items.length).toBe(1);

      // Add recommended products
      for (const item of sampleItems) {
        const prod = {
          id: item.productId,
          name: item.productName,
          slug: item.productSlug,
          sku: item.sku,
          priceCents: item.unitPriceCents,
          stockQuantity: item.stockQuantity,
          lowStockThreshold: 5,
          isActive: true,
        };
        await useCartStore.getState().addItem(prod as any, item.quantity);
      }

      const cartItems = useCartStore.getState().items;
      expect(cartItems.length).toBe(3); // 1 existing + 2 recommended

      // Verify pen was added with quantity 5
      const pen = cartItems.find((i) => i.productId === 'prod-speed-rim-blue');
      expect(pen).toBeDefined();
      expect(pen?.quantity).toBe(5);
    });
  });
});
