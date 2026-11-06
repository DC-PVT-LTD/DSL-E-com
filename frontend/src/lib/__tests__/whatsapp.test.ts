import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  validateAndCleanWhatsAppNumber,
  generateWhatsAppOrderMessage,
  generateWhatsAppUrl,
  openWhatsAppEnquiry,
  getWhatsAppBusinessNumber,
  WHATSAPP_STORAGE_KEY,
} from '../whatsapp';
import { CartSummary, CartItem } from '@/types/cart';
import { Product } from '@/types/product';
import { inventoryService } from '@/services/inventoryService';
import { orderService } from '@/services/orderService';

function createMockProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    name: 'Sample Stationery Item',
    slug: 'sample-stationery-item',
    sku: 'DSL-SMP-1',
    description: 'High quality stationery item',
    shortDescription: 'Stationery item',
    categoryId: 'cat-books',
    categoryName: 'Books & Exercise',
    brandId: 'brand-dsl',
    brandName: 'DSL Stationery',
    priceCents: 25000,
    costPriceCents: 15000,
    stockQuantity: 50,
    lowStockThreshold: 5,
    isActive: true,
    isFeatured: false,
    isNewArrival: false,
    isBestSeller: false,
    images: [],
    tags: ['stationery'],
    specifications: {},
    rating: 5,
    reviewCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('Phase 16: WhatsApp-Assisted Ordering', () => {
  const originalEnv = process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER;

  beforeEach(() => {
    localStorage.clear();
    process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER = '+94 77 123 4567';
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER = originalEnv;
    vi.restoreAllMocks();
  });

  describe('1. WhatsApp Number Formatting & Validation', () => {
    it('formats and cleans standard international numbers by removing spaces, brackets, hyphens and +', () => {
      const inputs = [
        '+94 77 123 4567',
        '+94-77-123-4567',
        '+94 (77) 123 4567',
        '  +94 77 1234567  ',
        '+94771234567',
      ];

      inputs.forEach((num) => {
        const result = validateAndCleanWhatsAppNumber(num);
        expect(result.isValid).toBe(true);
        expect(result.cleanedNumber).toBe('94771234567');
        expect(result.display).toBe('+94 77 123 4567');
      });
    });

    it('converts Sri Lankan local 10-digit mobile numbers starting with 0 to 94 format', () => {
      const result = validateAndCleanWhatsAppNumber('0771234567');
      expect(result.isValid).toBe(true);
      expect(result.cleanedNumber).toBe('94771234567');
      expect(result.display).toBe('+94 77 123 4567');
    });

    it('rejects empty or missing phone numbers', () => {
      expect(validateAndCleanWhatsAppNumber('').isValid).toBe(false);
      expect(validateAndCleanWhatsAppNumber('   ').isValid).toBe(false);
      expect(validateAndCleanWhatsAppNumber(null).isValid).toBe(false);
      expect(validateAndCleanWhatsAppNumber(undefined).isValid).toBe(false);
    });

    it('rejects numbers that are too short (< 9 digits) or too long (> 15 digits)', () => {
      const tooShort = validateAndCleanWhatsAppNumber('12345');
      expect(tooShort.isValid).toBe(false);
      expect(tooShort.error).toContain('too short');

      const tooLong = validateAndCleanWhatsAppNumber('123456789012345678');
      expect(tooLong.isValid).toBe(false);
      expect(tooLong.error).toContain('exceeds international');
    });

    it('rejects strings containing only zeros', () => {
      const allZeros = validateAndCleanWhatsAppNumber('0000000000');
      expect(allZeros.isValid).toBe(false);
      expect(allZeros.error).toContain('invalid');
    });

    it('retrieves configured number with priority: localStorage > env > empty', () => {
      // 1. env fallback
      expect(getWhatsAppBusinessNumber()).toBe('+94 77 123 4567');

      // 2. localStorage overrides env
      localStorage.setItem(WHATSAPP_STORAGE_KEY, '+94 71 999 8888');
      expect(getWhatsAppBusinessNumber()).toBe('+94 71 999 8888');

      // 3. empty when neither exists
      localStorage.removeItem(WHATSAPP_STORAGE_KEY);
      delete process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER;
      expect(getWhatsAppBusinessNumber()).toBe('');
    });
  });

  describe('2. Message Generation & Formatting', () => {
    const mockProduct1 = createMockProduct({
      id: 'prod-1',
      name: 'CR Exercise Book (120 Pages)',
      slug: 'cr-exercise-book-120',
      sku: 'DSL-CR-120',
      priceCents: 25000,
      stockQuantity: 50,
    });

    const mockProduct2 = createMockProduct({
      id: 'prod-2',
      name: 'Gel Pen Set & "Highlighter" Mix (Pack of 5)',
      slug: 'gel-pen-set',
      sku: 'DSL-GEL-5',
      priceCents: 45000,
      stockQuantity: 20,
    });

    const mockCartItem1: CartItem = {
      id: 'item-1',
      productId: 'prod-1',
      product: mockProduct1,
      quantity: 2,
      unitPriceCents: 25000,
      totalPriceCents: 50000,
    };

    const mockCartItem2: CartItem = {
      id: 'item-2',
      productId: 'prod-2',
      product: mockProduct2,
      quantity: 1,
      unitPriceCents: 45000,
      totalPriceCents: 45000,
    };

    it('generates a concise, structured message for multiple cart items with quantities and totals', () => {
      const summary: CartSummary = {
        items: [mockCartItem1, mockCartItem2],
        selectedItems: [mockCartItem1, mockCartItem2],
        itemCount: 3,
        selectedItemCount: 3,
        subtotalCents: 95000,
        discountCents: 10000,
        deliveryCents: 35000,
        totalCents: 120000,
        appliedDiscount: {
          code: 'DSL10',
          description: '10% Off Stationery',
          discountType: 'fixed',
          discountValue: 100,
          discountAmountCents: 10000,
        },
        isFreeDeliveryEligible: false,
        freeDeliveryThresholdCents: 500000,
      };

      const message = generateWhatsAppOrderMessage(summary, { cartRef: 'CART-789' });

      expect(message).toContain('Hello DSL Stationery!');
      expect(message).toContain('I would like to enquire about the following stationery items:');
      expect(message).toContain('Cart Reference: CART-789');
      expect(message).toContain('1. CR Exercise Book (120 Pages) — Qty: 2 (Rs. 500.00)');
      expect(message).toContain('2. Gel Pen Set & "Highlighter" Mix (Pack of 5) — Qty: 1 (Rs. 450.00)');
      expect(message).toContain('Subtotal: Rs. 950.00');
      expect(message).toContain('Discount: -Rs. 100.00 (Promo: DSL10)');
      expect(message).toContain('Estimated Delivery: Rs. 350.00');
      expect(message).toContain('Estimated Total: Rs. 1,200.00');
      expect(message).toContain('Please confirm product availability and final pricing.');
      expect(message).toContain('This is an order enquiry, not a confirmed order.');
      expect(message).toContain('Thank you!');
    });

    it('correctly handles School Pack bundle items and savings metadata', () => {
      const bundleItem: CartItem = {
        id: 'bundle-item-1',
        productId: 'prod-1',
        product: mockProduct1,
        quantity: 3,
        unitPriceCents: 20000,
        totalPriceCents: 60000,
        bundleInfo: {
          packId: 'pack-grade-3',
          packName: 'Grade 3 School Starter Pack',
          savingsPercentage: 15,
        },
      };

      const summary: CartSummary = {
        items: [bundleItem],
        selectedItems: [bundleItem],
        itemCount: 3,
        selectedItemCount: 3,
        subtotalCents: 60000,
        discountCents: 0,
        deliveryCents: 0,
        totalCents: 60000,
        isFreeDeliveryEligible: true,
        freeDeliveryThresholdCents: 500000,
      };

      const message = generateWhatsAppOrderMessage(summary);

      expect(message).toContain('1. CR Exercise Book (120 Pages) — Qty: 3 (Rs. 600.00)');
      expect(message).toContain('🎒 Bundle: Grade 3 School Starter Pack (15% savings)');
      expect(message).toContain('Estimated Delivery: FREE');
      expect(message).toContain('Estimated Total: Rs. 600.00');
    });

    it('correctly handles Find My Stationery recommended products with variant names', () => {
      const variantItem: CartItem = {
        id: 'variant-item-1',
        productId: 'prod-2',
        variantId: 'var-blue',
        product: mockProduct2,
        variant: {
          id: 'var-blue',
          name: 'Blue Ink / 0.7mm Tip',
          sku: 'DSL-GEL-5-BLU',
          priceCents: 45000,
          stockQuantity: 15,
          isActive: true,
          attributes: { color: 'Blue', tip: '0.7mm' },
        },
        quantity: 2,
        unitPriceCents: 45000,
        totalPriceCents: 90000,
      };

      const summary: CartSummary = {
        items: [variantItem],
        selectedItems: [variantItem],
        itemCount: 2,
        selectedItemCount: 2,
        subtotalCents: 90000,
        discountCents: 0,
        deliveryCents: 35000,
        totalCents: 125000,
        isFreeDeliveryEligible: false,
        freeDeliveryThresholdCents: 500000,
      };

      const message = generateWhatsAppOrderMessage(summary);

      expect(message).toContain('1. Gel Pen Set & "Highlighter" Mix (Pack of 5) (Blue Ink / 0.7mm Tip) — Qty: 2 (Rs. 900.00)');
    });

    it('flags items requiring stock verification when marked out of stock or exceeding stock', () => {
      const outOfStockItem: CartItem = {
        id: 'item-oos',
        productId: 'prod-1',
        product: mockProduct1,
        quantity: 1,
        unitPriceCents: 25000,
        totalPriceCents: 25000,
        isOutOfStock: true,
      };

      const summary: CartSummary = {
        items: [outOfStockItem],
        selectedItems: [outOfStockItem],
        itemCount: 1,
        selectedItemCount: 1,
        subtotalCents: 25000,
        discountCents: 0,
        deliveryCents: 35000,
        totalCents: 60000,
        isFreeDeliveryEligible: false,
        freeDeliveryThresholdCents: 500000,
      };

      const message = generateWhatsAppOrderMessage(summary);

      expect(message).toContain('⚠️ Note: Stock confirmation requested for this item.');
    });

    it('handles special characters safely without corrupting text or calculations', () => {
      const specialProduct = createMockProduct({
        id: 'spec-1',
        name: 'Maths & Art Compass — 100% Stainless Steel <Grade A> #1',
        slug: 'maths-art-compass',
        sku: 'DSL-COMP-A',
        priceCents: 85000,
        stockQuantity: 10,
      });

      const summary: CartSummary = {
        items: [
          {
            id: 'spec-item',
            productId: 'spec-1',
            product: specialProduct,
            quantity: 1,
            unitPriceCents: 85000,
            totalPriceCents: 85000,
          },
        ],
        selectedItems: [
          {
            id: 'spec-item',
            productId: 'spec-1',
            product: specialProduct,
            quantity: 1,
            unitPriceCents: 85000,
            totalPriceCents: 85000,
          },
        ],
        itemCount: 1,
        selectedItemCount: 1,
        subtotalCents: 85000,
        discountCents: 0,
        deliveryCents: 35000,
        totalCents: 120000,
        isFreeDeliveryEligible: false,
        freeDeliveryThresholdCents: 500000,
      };

      const message = generateWhatsAppOrderMessage(summary);
      expect(message).toContain('Maths & Art Compass — 100% Stainless Steel <Grade A> #1');
    });
  });

  describe('3. WhatsApp Deep Link Generation & URL Encoding', () => {
    it('generates the official click-to-chat URL format https://wa.me/{number}?text={encoded}', () => {
      const message = 'Hello DSL Stationery!\nSubtotal: Rs. 500.00';
      const result = generateWhatsAppUrl('+94 77 123 4567', message);

      expect(result.success).toBe(true);
      expect(result.url).toMatch(/^https:\/\/wa\.me\/94771234567\?text=/);
      expect(result.url).toContain(encodeURIComponent(message));
    });

    it('properly encodes special characters, newlines, and emojis using encodeURIComponent', () => {
      const complexMessage = 'Hello 🌸 Stationery & Books!\nPrice: Rs. 1,000.00\nSpecial: "Blue & Red" <Grade 1>';
      const result = generateWhatsAppUrl('+94 77 123 4567', complexMessage);

      expect(result.success).toBe(true);
      // Raw string characters like newlines or spaces must NEVER appear unencoded in the URL query string
      expect(result.url).not.toContain('\n');
      expect(result.url).not.toContain(' ');
      expect(result.url).toContain('%0A'); // encoded newline
      expect(result.url).toContain('%20'); // encoded space
      expect(result.url).toContain('%26'); // encoded &
    });

    it('returns error when phone number is invalid or unconfigured', () => {
      const resMissing = generateWhatsAppUrl('', 'Test message');
      expect(resMissing.success).toBe(false);
      expect(resMissing.url).toBe('');

      const resInvalid = generateWhatsAppUrl('123', 'Test message');
      expect(resInvalid.success).toBe(false);
      expect(resInvalid.url).toBe('');
    });
  });

  describe('4. openWhatsAppEnquiry Validation & Edge Cases', () => {
    it('rejects an empty cart and provides a helpful error message', () => {
      const emptySummary: CartSummary = {
        items: [],
        selectedItems: [],
        itemCount: 0,
        selectedItemCount: 0,
        subtotalCents: 0,
        discountCents: 0,
        deliveryCents: 0,
        totalCents: 0,
        isFreeDeliveryEligible: false,
        freeDeliveryThresholdCents: 500000,
      };

      const result = openWhatsAppEnquiry(emptySummary);
      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('rejects when no WhatsApp business number is configured', () => {
      delete process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER;
      localStorage.clear();

      const summary: CartSummary = {
        items: [
          {
            id: 'item-1',
            productId: 'p-1',
            product: createMockProduct({
              id: 'p-1',
              name: 'Pen',
              slug: 'pen',
              sku: 'PEN-1',
              priceCents: 5000,
              stockQuantity: 10,
            }),
            quantity: 1,
            unitPriceCents: 5000,
            totalPriceCents: 5000,
          },
        ],
        selectedItems: [
          {
            id: 'item-1',
            productId: 'p-1',
            product: createMockProduct({
              id: 'p-1',
              name: 'Pen',
              slug: 'pen',
              sku: 'PEN-1',
              priceCents: 5000,
              stockQuantity: 10,
            }),
            quantity: 1,
            unitPriceCents: 5000,
            totalPriceCents: 5000,
          },
        ],
        itemCount: 1,
        selectedItemCount: 1,
        subtotalCents: 5000,
        discountCents: 0,
        deliveryCents: 35000,
        totalCents: 40000,
        isFreeDeliveryEligible: false,
        freeDeliveryThresholdCents: 500000,
      };

      const result = openWhatsAppEnquiry(summary);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('successfully constructs URL and calls window.open with noopener, noreferrer', () => {
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      const summary: CartSummary = {
        items: [
          {
            id: 'item-1',
            productId: 'p-1',
            product: createMockProduct({
              id: 'p-1',
              name: 'CR Book',
              slug: 'cr-book',
              sku: 'CRB-1',
              priceCents: 15000,
              stockQuantity: 10,
            }),
            quantity: 1,
            unitPriceCents: 15000,
            totalPriceCents: 15000,
          },
        ],
        selectedItems: [
          {
            id: 'item-1',
            productId: 'p-1',
            product: createMockProduct({
              id: 'p-1',
              name: 'CR Book',
              slug: 'cr-book',
              sku: 'CRB-1',
              priceCents: 15000,
              stockQuantity: 10,
            }),
            quantity: 1,
            unitPriceCents: 15000,
            totalPriceCents: 15000,
          },
        ],
        itemCount: 1,
        selectedItemCount: 1,
        subtotalCents: 15000,
        discountCents: 0,
        deliveryCents: 35000,
        totalCents: 50000,
        isFreeDeliveryEligible: false,
        freeDeliveryThresholdCents: 500000,
      };

      const result = openWhatsAppEnquiry(summary);
      expect(result.success).toBe(true);
      expect(result.url).toBeDefined();
      expect(windowOpenSpy).toHaveBeenCalledTimes(1);
      expect(windowOpenSpy).toHaveBeenCalledWith(result.url, '_blank', 'noopener,noreferrer');
    });
  });

  describe('5. Strict Order & Payment Safety Invariants', () => {
    it('VERIFIES: opening WhatsApp NEVER creates an order, modifies stock, or creates payment attempts', () => {
      // Mock order creation spy to ensure it is never invoked
      const createOrderSpy = vi.spyOn(orderService, 'createOrder');
      const adjustStockSpy = vi.spyOn(inventoryService, 'adjustStock');
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      const summary: CartSummary = {
        items: [
          {
            id: 'item-1',
            productId: 'prod-test',
            product: createMockProduct({
              id: 'prod-test',
              name: 'Test Safe Product',
              slug: 'test-safe-product',
              sku: 'TEST-SAFE-1',
              priceCents: 10000,
              stockQuantity: 10,
            }),
            quantity: 2,
            unitPriceCents: 10000,
            totalPriceCents: 20000,
          },
        ],
        selectedItems: [
          {
            id: 'item-1',
            productId: 'prod-test',
            product: createMockProduct({
              id: 'prod-test',
              name: 'Test Safe Product',
              slug: 'test-safe-product',
              sku: 'TEST-SAFE-1',
              priceCents: 10000,
              stockQuantity: 10,
            }),
            quantity: 2,
            unitPriceCents: 10000,
            totalPriceCents: 20000,
          },
        ],
        itemCount: 2,
        selectedItemCount: 2,
        subtotalCents: 20000,
        discountCents: 0,
        deliveryCents: 35000,
        totalCents: 55000,
        isFreeDeliveryEligible: false,
        freeDeliveryThresholdCents: 500000,
      };

      // Execute WhatsApp enquiry
      const result = openWhatsAppEnquiry(summary);

      expect(result.success).toBe(true);
      // Critical safety assertions:
      expect(createOrderSpy).not.toHaveBeenCalled();
      expect(adjustStockSpy).not.toHaveBeenCalled();
      expect(windowOpenSpy).toHaveBeenCalledTimes(1);
    });
  });
});
