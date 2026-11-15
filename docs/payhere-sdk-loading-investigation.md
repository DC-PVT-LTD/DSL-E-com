# DSL Stationery — PayHere Sandbox SDK Loading Failure Investigation Report

**Document Date:** November 14, 2026  
**Status:** Root Cause Identified, Fixed & Fully Verified  
**Affected Component:** `frontend/src/lib/payhere.ts`, Checkout Payment Gateway Initialization  

---

## 1. Executive Summary

During checkout testing with PayHere card payments selected, the application threw the following error:
```
Checkout Error: Secure PayHere gateway could not be loaded. Please check your internet connection.
```

Despite the user's internet connection working normally, PayHere initialization failed because the SDK loader in `frontend/src/lib/payhere.ts` was configured to request:
```
https://sandbox.payhere.lk/lib/payhere.js
```

Network diagnostics confirmed that `sandbox.payhere.lk/lib/payhere.js` returns **HTTP 404 Not Found**. PayHere does not host JavaScript SDK files on its `sandbox.` subdomain. According to official PayHere SDK specifications and verified network diagnostics, PayHere serves a **single unified JavaScript SDK** from:
```
https://www.payhere.lk/lib/payhere.js
```
The SDK dynamically determines whether to open the Sandbox popup (`https://sandbox.payhere.lk/pay/`) or the Live popup (`https://www.payhere.lk/pay/`) at runtime based on the `sandbox: true` flag in the payment payload.

Furthermore, a secondary defect in `frontend/src/lib/payhere.ts` caused failed `<script>` tags to remain in the DOM. Subsequent retry attempts found the dead script element, attached event listeners to an already-failed DOM node that would never fire `load` or `error` events again, and stalled indefinitely without a timeout.

---

## 2. Network Diagnostics & Response Verification

| Diagnostic Check | Target / Endpoint | Result | Technical Details |
| :--- | :--- | :--- | :--- |
| **Old Configured URL** | `https://sandbox.payhere.lk/lib/payhere.js` | **FAIL (404)** | HTTP/1.1 404 Not Found, `Content-Type: text/html`. Cloudflare edge error (the file does not exist on sandbox subdomain). |
| **Official SDK URL** | `https://www.payhere.lk/lib/payhere.js` | **PASS (200 OK)** | HTTP/1.1 200 OK, `Content-Type: application/javascript`, `Content-Length: 11557` bytes. |
| **DNS Resolution** | `sandbox.payhere.lk` & `www.payhere.lk` | **PASS** | Successfully resolves to Cloudflare Anycast IPs. |
| **TLS / SSL Handshake** | `https://www.payhere.lk` | **PASS** | TLS 1.3 negotiated cleanly. |
| **JavaScript Content Validation** | `https://www.payhere.lk/lib/payhere.js` | **PASS** | Valid executable JavaScript defining `window.payhere.startPayment`. Contains runtime logic routing to `https://sandbox.payhere.lk/pay/` when `payload.sandbox === true`. |
| **Content Security Policy (CSP)** | Frontend `next.config.ts` | **PASS** | No restrictive CSP headers blocking `payhere.lk` scripts. |

---

## 3. Code Diagnostics & Root Causes

### Root Cause 1: Invalid SDK URL Configuration
In `frontend/src/lib/payhere.ts`:
```typescript
// Previous implementation:
export const PAYHERE_SANDBOX_SCRIPT_URL = 'https://sandbox.payhere.lk/lib/payhere.js';
```
PayHere only serves payment submission endpoints on the sandbox domain (`https://sandbox.payhere.lk/pay/`). The JavaScript client library is strictly hosted at `https://www.payhere.lk/lib/payhere.js`. When the browser injected `<script src="https://sandbox.payhere.lk/lib/payhere.js">`, Cloudflare responded with HTTP 404, triggering `script.onerror`.

### Root Cause 2: Dead Script Tag Retention in DOM & Retry Deadlock
When `script.onerror` fired:
```typescript
script.onerror = () => {
  payhereScriptPromise = null;
  resolve(false);
};
document.head.appendChild(script);
```
The failed `<script>` tag remained in `document.head`. On subsequent user retries:
```typescript
const existingScript = document.querySelector<HTMLScriptElement>(`script[src="..."]`);
if (existingScript) {
  existingScript.addEventListener('load', ...);
  existingScript.addEventListener('error', ...);
}
```
Because the browser does not re-fire `load` or `error` events on an already-evaluated script element in the DOM, adding event listeners to `existingScript` caused all subsequent retries to hang indefinitely.

### Root Cause 3: Missing Timeout Protection
`loadPayHereScript()` had no timeout guard. If a network request stalled or hung, the promise never resolved, leaving checkout in a permanent loading state.

---

## 4. Fix Implemented

The loader in `frontend/src/lib/payhere.ts` was refactored with the following safeguards:

1. **Official Unified URL**:
   ```typescript
   export const PAYHERE_SCRIPT_URL = 'https://www.payhere.lk/lib/payhere.js';
   export const PAYHERE_SANDBOX_SCRIPT_URL = PAYHERE_SCRIPT_URL; // Backwards compatibility alias
   ```
2. **Dead Script Cleanup on Error**:
   When `script.onerror` or timeout fires, `script.remove()` is called immediately, purging the failed element from `document.head` and resetting `payhereScriptPromise = null`.
3. **Legacy Script Purging**:
   On load initialization, any existing dead or invalid scripts matching `*payhere.lk/lib/payhere.js*` are cleaned from the DOM if `window.payhere` is not functional.
4. **10-Second Safety Timeout**:
   Added a configurable `timeoutMs: number = 10000` guard. If script loading stalls, the timer cleans up the DOM and safely resolves `false`.
5. **Shared Promise Deduplication & SSR Safety**:
   Concurrent calls reuse the in-flight promise. Server-side rendering safely returns `false` when `typeof window === 'undefined'`.

---

## 5. Automated Verification Results

### A. PayHere Unit Tests
- Command: `npm --prefix frontend test -- payhere`
- Result: **PASS (6 of 6 tests passed)**
  - Resolves immediately to true if `window.payhere` already operational.
  - Injects official script tag when not loaded.
  - Deduplicates concurrent load calls without injecting multiple script tags.
  - Gracefully handles script load errors and cleans DOM element.
  - Allows clean, successful retries after an initial failure.
  - Times out and cleans up script if network stalls.

### B. Checkout Suite Tests
- Command: `npm --prefix frontend test -- checkout`
- Result: **PASS (15 of 15 tests passed)**
  - `checkoutService.test.ts` (4 passed)
  - `checkoutPhaseC.test.ts` (5 passed)
  - `checkoutPhaseB.test.ts` (6 passed)

### C. Next.js Production Build
- Command: `npm --prefix frontend run build`
- Result: **PASS (Exit code 0)**
  - All 58 application routes compiled and prerendered cleanly.
  - TypeScript 100% clean.

---

## 6. Safety Compliance Audit

- **Merchant ID & Secret:** Preserved intact (`PAYHERE_MERCHANT_ID=1239105`, `PAYHERE_SANDBOX=true`).
- **StoreSettings:** `onlineCardEnabled` remains `true`.
- **Protected Product (`cmw0j4cro00089kusmwsbv48t`):** Stock quantity verified at strictly **10**.
- **Orders & Payments:** Exactly 0 new orders or transactions created.

