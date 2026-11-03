import { describe, it, expect } from 'vitest';
import {
  formatLKR,
  rupeesToCents,
  centsToRupees,
  calculateDiscountCents,
  calculateDeliveryFeeCents,
  calculateSavingsPercent,
  FREE_DELIVERY_THRESHOLD_CENTS,
  STANDARD_DELIVERY_FEE_CENTS,
} from '../currency';

describe('DSL Currency Utilities', () => {
  it('formats integer cents into LKR currency string correctly', () => {
    expect(formatLKR(45000)).toBe('Rs. 450.00');
    expect(formatLKR(125050)).toBe('Rs. 1,250.50');
    expect(formatLKR(500000, { showCode: true })).toBe('LKR 5,000.00');
    expect(formatLKR(35000, { omitDecimalsIfZero: true })).toBe('Rs. 350');
    expect(formatLKR(-15000)).toBe('-Rs. 150.00');
  });

  it('converts between decimal rupees and integer cents accurately', () => {
    expect(rupeesToCents(450.75)).toBe(45075);
    expect(centsToRupees(45075)).toBe(450.75);
    expect(rupeesToCents(100)).toBe(10000);
  });

  it('calculates percentage discounts accurately in cents', () => {
    // 10% of LKR 1000.00 (100000 cents) = LKR 100.00 (10000 cents)
    const discount = calculateDiscountCents(100000, 'percentage', 10);
    expect(discount).toBe(10000);

    // Capped by maxDiscountCents
    const capped = calculateDiscountCents(100000, 'percentage', 20, 15000);
    expect(capped).toBe(15000);
  });

  it('calculates fixed discounts accurately in cents without exceeding subtotal', () => {
    // LKR 200 off LKR 500
    const discount = calculateDiscountCents(50000, 'fixed', 200);
    expect(discount).toBe(20000);

    // Fixed discount larger than subtotal should cap at subtotal
    const excess = calculateDiscountCents(15000, 'fixed', 200);
    expect(excess).toBe(15000);
  });

  it('calculates delivery fee based on threshold', () => {
    expect(calculateDeliveryFeeCents(0)).toBe(0);
    expect(calculateDeliveryFeeCents(300000)).toBe(STANDARD_DELIVERY_FEE_CENTS);
    expect(calculateDeliveryFeeCents(FREE_DELIVERY_THRESHOLD_CENTS)).toBe(0);
    expect(calculateDeliveryFeeCents(FREE_DELIVERY_THRESHOLD_CENTS + 1000)).toBe(0);
  });

  it('calculates percentage savings correctly', () => {
    expect(calculateSavingsPercent(100000, 80000)).toBe(20);
    expect(calculateSavingsPercent(50000, 50000)).toBe(0);
    expect(calculateSavingsPercent(50000, 60000)).toBe(0);
  });
});
