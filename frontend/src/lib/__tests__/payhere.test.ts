import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadPayHereScript, PAYHERE_SANDBOX_SCRIPT_URL, _resetPayHereLoaderForTests } from '../payhere';

describe('PayHere Sandbox SDK Loader', () => {
  beforeEach(() => {
    // Clean up DOM scripts and window.payhere
    document.querySelectorAll('script').forEach((s) => s.remove());
    delete (window as any).payhere;
    _resetPayHereLoaderForTests();
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.querySelectorAll('script').forEach((s) => s.remove());
    delete (window as any).payhere;
    _resetPayHereLoaderForTests();
  });

  it('resolves immediately to true if window.payhere is already loaded and functional', async () => {
    (window as any).payhere = {
      startPayment: vi.fn(),
    };

    const loaded = await loadPayHereScript();
    expect(loaded).toBe(true);
    expect(document.querySelector(`script[src="${PAYHERE_SANDBOX_SCRIPT_URL}"]`)).toBeNull();
  });

  it('injects official sandbox script tag into document head when not loaded', async () => {
    const loadPromise = loadPayHereScript();

    const script = document.querySelector<HTMLScriptElement>(
      `script[src="${PAYHERE_SANDBOX_SCRIPT_URL}"]`
    );
    expect(script).not.toBeNull();
    expect(script?.src).toBe(PAYHERE_SANDBOX_SCRIPT_URL);

    // Mock successful load event and window.payhere injection
    (window as any).payhere = {
      startPayment: vi.fn(),
    };
    script?.dispatchEvent(new Event('load'));

    const loaded = await loadPromise;
    expect(loaded).toBe(true);
  });

  it('deduplicates concurrent load calls and does not inject multiple script tags', async () => {
    const promise1 = loadPayHereScript();
    const promise2 = loadPayHereScript();

    const scripts = document.querySelectorAll(
      `script[src="${PAYHERE_SANDBOX_SCRIPT_URL}"]`
    );
    expect(scripts.length).toBe(1);

    (window as any).payhere = {
      startPayment: vi.fn(),
    };
    scripts[0].dispatchEvent(new Event('load'));

    const [res1, res2] = await Promise.all([promise1, promise2]);
    expect(res1).toBe(true);
    expect(res2).toBe(true);
  });

  it('gracefully handles script load errors without unhandled rejections and removes failed script from DOM', async () => {
    const loadPromise = loadPayHereScript();

    const script = document.querySelector<HTMLScriptElement>(
      `script[src="${PAYHERE_SANDBOX_SCRIPT_URL}"]`
    );
    script?.dispatchEvent(new Event('error'));

    const loaded = await loadPromise;
    expect(loaded).toBe(false);
    // Verifies DOM cleanup so subsequent retries are not blocked
    expect(document.querySelector(`script[src="${PAYHERE_SANDBOX_SCRIPT_URL}"]`)).toBeNull();
  });

  it('allows a successful retry after a previous failure', async () => {
    // 1. Initial attempt fails
    const failPromise = loadPayHereScript();
    const failScript = document.querySelector<HTMLScriptElement>(
      `script[src="${PAYHERE_SANDBOX_SCRIPT_URL}"]`
    );
    failScript?.dispatchEvent(new Event('error'));
    const firstResult = await failPromise;
    expect(firstResult).toBe(false);

    // 2. Retry succeeds
    const retryPromise = loadPayHereScript();
    const retryScript = document.querySelector<HTMLScriptElement>(
      `script[src="${PAYHERE_SANDBOX_SCRIPT_URL}"]`
    );
    expect(retryScript).not.toBeNull();
    (window as any).payhere = {
      startPayment: vi.fn(),
    };
    retryScript?.dispatchEvent(new Event('load'));
    const retryResult = await retryPromise;
    expect(retryResult).toBe(true);
  });

  it('times out and cleans up script if network hangs', async () => {
    vi.useFakeTimers();
    const loadPromise = loadPayHereScript(3000);

    const script = document.querySelector<HTMLScriptElement>(
      `script[src="${PAYHERE_SANDBOX_SCRIPT_URL}"]`
    );
    expect(script).not.toBeNull();

    // Advance time past timeout
    vi.advanceTimersByTime(3500);

    const loaded = await loadPromise;
    expect(loaded).toBe(false);
    expect(document.querySelector(`script[src="${PAYHERE_SANDBOX_SCRIPT_URL}"]`)).toBeNull();
    vi.useRealTimers();
  });
});
