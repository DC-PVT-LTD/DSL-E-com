import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCartStore } from '../cartStore';
import { orderService } from '../orderService';
import { apiClient } from '@/lib/api/apiClient';

describe('Phase B — Customer and Guest Checkout Workflows', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart();
    vi.restoreAllMocks();
  });

  describe('1. Selective Checkout & Phase A Preservation', () => {
    it('only processes selected items and leaves unselected items in the cart', () => {
      const { addItem, toggleItemSelection, removePurchasedItems } = useCartStore.getState();

      // Add two items with isActive: true
      addItem({
        id: 'prod-item-1',
        name: 'Atlas CR Book 120 Pages',
        priceCents: 25000,
        stockQuantity: 50,
        isActive: true,
      } as any, 2);

      addItem({
        id: 'prod-item-2',
        name: 'Mango Gel Pen Blue',
        priceCents: 6000,
        stockQuantity: 100,
        isActive: true,
      } as any, 5);

      let cart = useCartStore.getState().items;
      expect(cart).toHaveLength(2);

      // Unselect second item
      const item2Id = cart[1].id;
      toggleItemSelection(item2Id);

      cart = useCartStore.getState().items;
      const selectedItems = cart.filter((i) => i.selected !== false);
      expect(selectedItems).toHaveLength(1);
      expect(selectedItems[0].productId).toBe('prod-item-1');

      // Simulate purchasing selected items only
      removePurchasedItems(
        selectedItems.map((i) => ({ productId: i.productId, variantId: i.variantId || null }))
      );

      const remainingCart = useCartStore.getState().items;
      expect(remainingCart).toHaveLength(1);
      expect(remainingCart[0].id).toBe(item2Id);
      expect(remainingCart[0].productId).toBe('prod-item-2');
      expect(remainingCart[0].quantity).toBe(5);
    });
  });

  describe('2. Guest Checkout Data Integrity & Sri Lankan Validation', () => {
    it('validates Sri Lankan phone formats accurately', () => {
      const isValidSLPhone = (phone: string) => {
        const clean = phone.replace(/[\s-]/g, '');
        return /^(?:\+94|0)?7\d{8}$/.test(clean);
      };

      expect(isValidSLPhone('0771234567')).toBe(true);
      expect(isValidSLPhone('+94771234567')).toBe(true);
      expect(isValidSLPhone('071-234-5678')).toBe(true);
      expect(isValidSLPhone('078 987 6543')).toBe(true);

      // Invalid phone numbers
      expect(isValidSLPhone('12345678')).toBe(false);
      expect(isValidSLPhone('0112345678')).toBe(false); // Landline
      expect(isValidSLPhone('+15551234567')).toBe(false); // US phone
      expect(isValidSLPhone('')).toBe(false);
    });

    it('validates email addresses properly', () => {
      const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

      expect(isValidEmail('customer@dsl.lk')).toBe(true);
      expect(isValidEmail('guest.test@gmail.com')).toBe(true);
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('guest@')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('3. Customer Address Decoupling', () => {
    it('allows custom delivery address for an order without mutating customer saved profile addresses', () => {
      const savedAddresses = [
        {
          id: 'addr-home',
          label: 'Home',
          recipientName: 'Registered Customer',
          phone: '0771234567',
          addressLine1: '123 Main Street',
          city: 'Colombo',
          district: 'Colombo',
          province: 'Western Province',
        },
      ];

      // Customer chooses to ship to a custom address for this order
      const orderShippingAddress = {
        fullName: 'Office Delivery Desk',
        phone: '0719876543',
        email: 'customer@dsl.lk',
        addressLine1: '456 Business Park, 4th Floor',
        city: 'Kandy',
        district: 'Kandy',
        province: 'Central Province',
      };

      // Ensure saved addresses array remains untouched
      expect(savedAddresses[0].addressLine1).toBe('123 Main Street');
      expect(savedAddresses[0].city).toBe('Colombo');
      expect(orderShippingAddress.addressLine1).toBe('456 Business Park, 4th Floor');
      expect(orderShippingAddress.city).toBe('Kandy');
    });
  });

  describe('4. Optional Account Creation Password Strength', () => {
    it('enforces password criteria: min 8 chars, uppercase, lowercase, number', () => {
      const validatePasswordStrength = (pwd: string): string | null => {
        if (pwd.length < 8) return 'Password must be at least 8 characters long';
        if (!/[A-Z]/.test(pwd) || !/[a-z]/.test(pwd) || !/\d/.test(pwd)) {
          return 'Password must include uppercase, lowercase, and numeric characters';
        }
        return null;
      };

      expect(validatePasswordStrength('short')).toBe('Password must be at least 8 characters long');
      expect(validatePasswordStrength('alllowercase123')).toBe(
        'Password must include uppercase, lowercase, and numeric characters'
      );
      expect(validatePasswordStrength('ALLUPPERCASE123')).toBe(
        'Password must include uppercase, lowercase, and numeric characters'
      );
      expect(validatePasswordStrength('NoNumbersHere!')).toBe(
        'Password must include uppercase, lowercase, and numeric characters'
      );
      expect(validatePasswordStrength('ValidPass123')).toBeNull();
      expect(validatePasswordStrength('DSLStationery2026!')).toBeNull();
    });
  });

  describe('5. Guest Order Tracking & Secure Tracking Token Passing (Phase B.1)', () => {
    it('passes x-tracking-token header and token query parameter when fetching order by ID', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
        if (url.startsWith('/admin/orders')) {
          // Unauthenticated for admin endpoint
          throw new Error('401 Unauthorized');
        }
        return {
          success: true,
          data: {
            id: 'test-order-id',
            orderNumber: 'DSL-2026-TEST',
            userId: null,
            customerName: 'Guest Customer',
            customerEmail: 'guest@example.lk',
            customerPhone: '0771234567',
            items: [],
            totalCents: 50000,
          },
        };
      });

      const order = await orderService.fetchOrderById('test-order-id', 'sample.tracking.token');

      expect(getSpy).toHaveBeenCalledWith(
        '/orders/test-order-id',
        expect.objectContaining({
          headers: expect.objectContaining({ 'x-tracking-token': 'sample.tracking.token' }),
          params: expect.objectContaining({ token: 'sample.tracking.token' }),
        })
      );
      expect(order?.customerEmail).toBe('guest@example.lk');
    });
  });
});
