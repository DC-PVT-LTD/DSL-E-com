/**
 * DSL Stationery - Safe Currency & Pricing Utilities
 * All monetary calculations use integer cents (minor units, 1 LKR = 100 cents)
 * to avoid IEEE 754 floating point inaccuracies.
 */

export const FREE_DELIVERY_THRESHOLD_CENTS = 500000; // LKR 5,000.00
export const STANDARD_DELIVERY_FEE_CENTS = 35000; // LKR 350.00 Flat rate islandwide

/**
 * Formats integer cents into Sri Lankan Rupees (LKR)
 * Example: 45000 -> "Rs. 450.00"
 */
export function formatLKR(cents: number, options?: { showCode?: boolean; omitDecimalsIfZero?: boolean }): string {
  const isNegative = cents < 0;
  const absCents = Math.abs(Math.round(cents));
  const rupees = Math.floor(absCents / 100);
  const remainderCents = absCents % 100;

  // Sri Lankan rupee number formatting with thousand separators
  const formattedRupees = rupees.toLocaleString('en-LK');
  
  const prefix = options?.showCode ? 'LKR ' : 'Rs. ';
  const sign = isNegative ? '-' : '';

  if (options?.omitDecimalsIfZero && remainderCents === 0) {
    return `${sign}${prefix}${formattedRupees}`;
  }

  const formattedCents = remainderCents.toString().padStart(2, '0');
  return `${sign}${prefix}${formattedRupees}.${formattedCents}`;
}

/**
 * Converts LKR decimal rupees into safe integer cents
 * Example: 450.50 -> 45050
 */
export function rupeesToCents(rupees: number): number {
  return Math.round(rupees * 100);
}

/**
 * Converts integer cents into decimal rupees for display inputs
 * Example: 45050 -> 450.5
 */
export function centsToRupees(cents: number): number {
  return cents / 100;
}

/**
 * Safely calculates discount amount in cents
 */
export function calculateDiscountCents(
  subtotalCents: number,
  discountType: 'percentage' | 'fixed' | 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_DELIVERY' | string,
  discountValue: number,
  maxDiscountCents?: number
): number {
  if (subtotalCents <= 0 || discountValue <= 0) {
    return 0;
  }

  if (discountType === 'FREE_DELIVERY') {
    return 0;
  }

  let discountCents = 0;

  if (discountType === 'percentage' || discountType === 'PERCENTAGE') {
    // Integer percentage calculation
    discountCents = Math.round((subtotalCents * discountValue) / 100);
  } else {
    // Fixed amount is supplied in Rupees, converted to cents
    discountCents = rupeesToCents(discountValue);
  }

  if (maxDiscountCents && discountCents > maxDiscountCents) {
    discountCents = maxDiscountCents;
  }

  // Discount cannot exceed subtotal
  return Math.min(discountCents, subtotalCents);
}

/**
 * Calculates delivery fee based on order subtotal
 */
export function calculateDeliveryFeeCents(subtotalCents: number): number {
  if (subtotalCents >= FREE_DELIVERY_THRESHOLD_CENTS || subtotalCents === 0) {
    return 0;
  }
  return STANDARD_DELIVERY_FEE_CENTS;
}

/**
 * Calculates percentage discount savings between original and sale price
 */
export function calculateSavingsPercent(originalCents: number, saleCents: number): number {
  if (originalCents <= 0 || saleCents >= originalCents) {
    return 0;
  }
  return Math.round(((originalCents - saleCents) / originalCents) * 100);
}
