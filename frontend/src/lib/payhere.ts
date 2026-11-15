/**
 * PayHere JavaScript SDK Integration Utility
 *
 * Provides client-side-safe dynamic loading for the official PayHere SDK.
 * Guards against SSR issues, prevents duplicate script injection, provides
 * timeout & error cleanup, and ensures type safety for window.payhere.
 *
 * Note: PayHere hosts a single unified JavaScript SDK library at
 * https://www.payhere.lk/lib/payhere.js for BOTH sandbox and production.
 * Routing to the sandbox checkout modal (https://sandbox.payhere.lk/pay/)
 * is controlled at runtime by the `sandbox: true` flag in the payment payload.
 */

export interface PayHerePaymentPayload {
  sandbox: boolean;
  merchant_id: string;
  return_url: string;
  cancel_url: string;
  notify_url: string;
  order_id: string;
  items: string;
  amount: string;
  currency: string;
  hash: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  delivery_address?: string;
  delivery_city?: string;
  delivery_country?: string;
  custom_1?: string;
  custom_2?: string;
  [key: string]: any;
}

export interface PayHereSDK {
  startPayment: (paymentObject: PayHerePaymentPayload) => void;
  onCompleted?: (orderId: string) => void;
  onDismissed?: () => void;
  onError?: (error: string) => void;
}

declare global {
  interface Window {
    payhere?: PayHereSDK;
  }
}

/**
 * Official unified PayHere JavaScript library URL.
 * PayHere serves the JavaScript SDK from www.payhere.lk for both Sandbox and Production.
 * (sandbox.payhere.lk only hosts payment processing endpoints, not the JS library).
 */
export const PAYHERE_SCRIPT_URL = 'https://www.payhere.lk/lib/payhere.js';

/**
 * Backwards compatibility alias
 */
export const PAYHERE_SANDBOX_SCRIPT_URL = PAYHERE_SCRIPT_URL;

let payhereScriptPromise: Promise<boolean> | null = null;

/**
 * Resets the in-memory loader cache for test isolation.
 */
export function _resetPayHereLoaderForTests(): void {
  payhereScriptPromise = null;
}

/**
 * Dynamically loads the official PayHere JavaScript SDK if not already present.
 * Safe for Next.js SSR (no-ops on server, returns false).
 * Deduplicates concurrent load calls via a shared promise.
 * Cleans up DOM elements on failure to allow seamless subsequent retries.
 */
export async function loadPayHereScript(timeoutMs: number = 10000): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false;
  }

  // Already loaded and functional on window
  if (window.payhere && typeof window.payhere.startPayment === 'function') {
    return true;
  }

  // Return existing in-flight loading promise
  if (payhereScriptPromise) {
    return payhereScriptPromise;
  }

  payhereScriptPromise = new Promise<boolean>((resolve) => {
    let timeoutTimer: NodeJS.Timeout | null = null;

    const cleanup = (success: boolean) => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
      payhereScriptPromise = null;
      resolve(success);
    };

    // Clean up any legacy invalid sandbox script or failed script tags in DOM
    try {
      const staleScripts = document.querySelectorAll<HTMLScriptElement>(
        `script[src*="payhere.lk/lib/payhere.js"]`
      );
      staleScripts.forEach((stale) => {
        if (!window.payhere || typeof window.payhere.startPayment !== 'function') {
          stale.remove();
        }
      });
    } catch {
      // ignore DOM cleanup error
    }

    // If window.payhere became ready during cleanup
    if (window.payhere && typeof window.payhere.startPayment === 'function') {
      cleanup(true);
      return;
    }

    const script = document.createElement('script');
    script.src = PAYHERE_SCRIPT_URL;
    script.type = 'text/javascript';
    script.async = true;

    // Timeout guard to prevent hanging promises
    timeoutTimer = setTimeout(() => {
      console.warn(`[PayHere SDK] Script loading timed out after ${timeoutMs}ms`);
      try {
        script.remove();
      } catch {}
      cleanup(false);
    }, timeoutMs);

    script.onload = () => {
      // Check if SDK initialized immediately or with a microtick
      if (window.payhere && typeof window.payhere.startPayment === 'function') {
        cleanup(true);
      } else {
        setTimeout(() => {
          const isAvailable = !!(window.payhere && typeof window.payhere.startPayment === 'function');
          if (!isAvailable) {
            console.warn('[PayHere SDK] Script loaded, but window.payhere.startPayment was not defined.');
            try {
              script.remove();
            } catch {}
          }
          cleanup(isAvailable);
        }, 100);
      }
    };

    script.onerror = () => {
      console.error(`[PayHere SDK] Failed to load PayHere script from ${PAYHERE_SCRIPT_URL}`);
      try {
        script.remove();
      } catch {}
      cleanup(false);
    };

    document.head.appendChild(script);
  });

  return payhereScriptPromise;
}
