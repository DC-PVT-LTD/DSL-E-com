import { CartSummary } from '@/types/cart';
import { formatLKR } from './currency';

export const WHATSAPP_STORAGE_KEY = 'dsl_store_whatsapp_number';

export interface WhatsAppValidationResult {
  isValid: boolean;
  cleanedNumber: string;
  display: string;
  error?: string;
}

/**
 * Retrieves the configured WhatsApp Business contact number.
 * Priority:
 * 1. Admin-saved store settings in localStorage
 * 2. Public environment variable NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER
 * 3. Default fallback if defined
 */
export function getWhatsAppBusinessNumber(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(WHATSAPP_STORAGE_KEY);
    if (stored && stored.trim()) {
      return stored.trim();
    }
  }

  const envNumber = process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER;
  if (envNumber && envNumber.trim()) {
    return envNumber.trim();
  }

  return '';
}

/**
 * Validates and cleans a raw phone number for WhatsApp deep-linking.
 * - Removes non-digit characters (spaces, brackets, hyphens, leading '+')
 * - Converts Sri Lankan local leading 0 (e.g., 0771234567 -> 94771234567)
 * - Verifies length adheres to E.164 guidelines (9 to 15 digits)
 * - Never invents or fabricates numbers
 */
export function validateAndCleanWhatsAppNumber(rawNumber: string | null | undefined): WhatsAppValidationResult {
  if (!rawNumber || !rawNumber.trim()) {
    return {
      isValid: false,
      cleanedNumber: '',
      display: '',
      error: 'WhatsApp business number is not configured. Please contact store administration.',
    };
  }

  const trimmed = rawNumber.trim();
  let digits = trimmed.replace(/[^0-9]/g, '');

  // Reject empty or all zeros immediately
  if (!digits || /^0+$/.test(digits)) {
    return {
      isValid: false,
      cleanedNumber: digits,
      display: trimmed,
      error: 'Configured WhatsApp number is invalid.',
    };
  }

  // Handle Sri Lankan local format: 07XXXXXXXX (10 digits starting with 0) -> 947XXXXXXXX
  if (digits.length === 10 && digits.startsWith('0')) {
    digits = '94' + digits.slice(1);
  }

  // Validate E.164 digit length bounds (min 9, max 15 digits)
  if (digits.length < 9) {
    return {
      isValid: false,
      cleanedNumber: digits,
      display: trimmed,
      error: 'Configured WhatsApp number is too short. Please provide a valid international phone number.',
    };
  }

  if (digits.length > 15) {
    return {
      isValid: false,
      cleanedNumber: digits,
      display: trimmed,
      error: 'Configured WhatsApp number exceeds international phone number limits.',
    };
  }

  // Formatted display representation
  let display = `+${digits}`;
  if (digits.startsWith('94') && digits.length === 11) {
    display = `+94 ${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }

  return {
    isValid: true,
    cleanedNumber: digits,
    display,
  };
}

/**
 * Generates a structured, human-readable WhatsApp order enquiry message.
 * Strictly formatted as an enquiry disclaimer:
 * "Your WhatsApp message is an enquiry. Your order is confirmed only after
 * DSL Stationery verifies availability, pricing and payment."
 */
export function generateWhatsAppOrderMessage(
  cart: CartSummary,
  options?: { cartRef?: string | null }
): string {
  const lines: string[] = [];

  lines.push('Hello DSL Stationery!');
  lines.push('');
  lines.push('I would like to enquire about the following stationery items:');
  lines.push('');

  if (options?.cartRef) {
    lines.push(`Cart Reference: ${options.cartRef}`);
    lines.push('');
  }

  const itemsToEnquire = (cart.selectedItems && cart.selectedItems.length > 0)
    ? cart.selectedItems
    : (cart.items || []).filter((item) => item.selected !== false);

  if (!itemsToEnquire || itemsToEnquire.length === 0) {
    lines.push('(No items currently selected in cart)');
  } else {
    itemsToEnquire.forEach((item, idx) => {
      const variantSuffix = item.variant?.name ? ` (${item.variant.name})` : '';
      const priceFormatted = formatLKR(item.totalPriceCents);
      lines.push(`${idx + 1}. ${item.product.name}${variantSuffix} — Qty: ${item.quantity} (${priceFormatted})`);

      if (item.bundleInfo) {
        lines.push(`   🎒 Bundle: ${item.bundleInfo.packName} (${item.bundleInfo.savingsPercentage}% savings)`);
      }

      if (item.isOutOfStock || item.isAvailable === false || item.exceedsStock) {
        lines.push('   ⚠️ Note: Stock confirmation requested for this item.');
      }
    });
  }

  lines.push('');
  lines.push(`Subtotal: ${formatLKR(cart.subtotalCents)}`);

  if (cart.discountCents > 0) {
    const promoCode = cart.appliedDiscount?.code ? ` (Promo: ${cart.appliedDiscount.code})` : '';
    lines.push(`Discount: -${formatLKR(cart.discountCents)}${promoCode}`);
  }

  if (cart.deliveryCents === 0) {
    lines.push('Estimated Delivery: FREE');
  } else {
    lines.push(`Estimated Delivery: ${formatLKR(cart.deliveryCents)}`);
  }

  lines.push(`Estimated Total: ${formatLKR(cart.totalCents)}`);
  lines.push('');
  lines.push('Please confirm product availability and final pricing.');
  lines.push('');
  lines.push('This is an order enquiry, not a confirmed order.');
  lines.push('');
  lines.push('Thank you!');

  return lines.join('\n');
}

/**
 * Builds the official WhatsApp click-to-chat URL:
 * https://wa.me/{PHONE_NUMBER}?text={ENCODED_MESSAGE}
 *
 * Uses encodeURIComponent to strictly prevent injection or URI corruption.
 */
export function generateWhatsAppUrl(
  phone: string | null | undefined,
  message: string
): { success: boolean; url: string; error?: string } {
  const validation = validateAndCleanWhatsAppNumber(phone);
  if (!validation.isValid) {
    return {
      success: false,
      url: '',
      error: validation.error || 'Invalid WhatsApp number configuration.',
    };
  }

  const encodedMessage = encodeURIComponent(message);
  const url = `https://wa.me/${validation.cleanedNumber}?text=${encodedMessage}`;

  return {
    success: true,
    url,
  };
}

/**
 * Initiates the WhatsApp order enquiry flow.
 *
 * SAFETY INVARIANT:
 * This function NEVER:
 * - Creates an order
 * - Modifies database records
 * - Reserves or decrements inventory
 * - Initiates payment gateway requests
 * - Modifies order/payment statuses
 */
export function openWhatsAppEnquiry(
  cart: CartSummary,
  options?: { phone?: string; cartRef?: string | null }
): { success: boolean; url?: string; error?: string } {
  if (!cart.items || cart.items.length === 0) {
    return {
      success: false,
      error: 'Your shopping bag is empty. Please add items before placing an enquiry.',
    };
  }

  const phone = options?.phone || getWhatsAppBusinessNumber();
  const message = generateWhatsAppOrderMessage(cart, { cartRef: options?.cartRef });
  const result = generateWhatsAppUrl(phone, message);

  if (!result.success) {
    return {
      success: false,
      error: result.error,
    };
  }

  if (typeof window !== 'undefined') {
    // Open in a new tab/application safely with noopener, noreferrer
    window.open(result.url, '_blank', 'noopener,noreferrer');
  }

  return {
    success: true,
    url: result.url,
  };
}
