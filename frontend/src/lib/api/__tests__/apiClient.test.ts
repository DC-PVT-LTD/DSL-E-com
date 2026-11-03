import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient, ApiError } from '../apiClient';

describe('apiClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('correctly constructs URLs preserving the /api/v1 prefix and params', () => {
    const url = apiClient.buildUrl('products', {
      search: 'pen',
      page: 2,
      inStockOnly: true,
      emptyField: undefined,
      nullField: null,
    });

    expect(url).toContain('/api/v1/products');
    expect(url).toContain('search=pen');
    expect(url).toContain('page=2');
    expect(url).toContain('inStockOnly=true');
    expect(url).not.toContain('emptyField');
    expect(url).not.toContain('nullField');
  });

  it('handles successful GET responses with parsed JSON data', async () => {
    const mockData = { success: true, data: [{ id: '1', name: 'Speed Pen' }] };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (h: string) => (h.toLowerCase() === 'content-type' ? 'application/json' : null),
      },
      json: async () => mockData,
    } as any);

    const response = await apiClient.get<typeof mockData>('products');
    expect(response.success).toBe(true);
    expect(response.data[0].name).toBe('Speed Pen');
  });

  it('throws ApiError with status and message on 404 or unsuccessful responses', async () => {
    const errorBody = { statusCode: 404, message: 'Product not found', error: 'Not Found' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: {
        get: (h: string) => (h.toLowerCase() === 'content-type' ? 'application/json' : null),
      },
      json: async () => errorBody,
    } as any);

    await expect(apiClient.get('products/slug/nonexistent')).rejects.toThrow(
      'Product not found'
    );
  });

  it('catches network failures and sets isNetworkError', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    await expect(apiClient.get('products')).rejects.toMatchObject({
      isNetworkError: true,
      message: 'Failed to fetch',
    });
  });
});

