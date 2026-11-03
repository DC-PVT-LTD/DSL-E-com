/**
 * DSL Stationery - Central Frontend API Client
 * Provides typed HTTP communication with the NestJS backend API (/api/v1).
 * Features:
 * - Proper URL path construction preserving the /api/v1 prefix.
 * - Typed request parameters (search, filter, sort, pagination).
 * - Standardized envelope unwrapping (ApiResponse<T>, PaginatedResponse<T>).
 * - Comprehensive error handling with status codes and network failure detection.
 */

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
  timeoutMs?: number;
  _retryCount?: number;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly data?: unknown;
  public readonly isNetworkError: boolean;

  constructor(message: string, status = 500, data?: unknown, isNetworkError = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.isNetworkError = isNetworkError;
  }
}

export interface BackendPaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface BackendApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
}

export interface BackendPaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: BackendPaginationMeta;
  message?: string;
}

class ApiClient {
  private baseUrl: string;
  private isMockMode: boolean;
  private refreshPromise: Promise<boolean> | null = null;

  constructor() {
    this.baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1').replace(/\/+$/, '');
    this.isMockMode = process.env.NEXT_PUBLIC_USE_MOCK === 'true';
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public getIsMockMode(): boolean {
    return this.isMockMode;
  }

  public setMockMode(enabled: boolean): void {
    this.isMockMode = enabled;
  }

  /**
   * Safely builds the target URL by joining baseUrl with the relative endpoint,
   * guaranteeing that path prefixes like /api/v1 are preserved.
   */
  public buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined | null>): string {
    const cleanBase = this.baseUrl.replace(/\/+$/, '');
    const cleanEndpoint = endpoint.replace(/^\/+/, '');
    const fullUrlString = `${cleanBase}/${cleanEndpoint}`;

    const url = new URL(fullUrlString);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  /**
   * Coordinated silent token refresh. Ensures simultaneous 401s share a single refresh request.
   */
  private async refreshSession(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const fullUrl = this.buildUrl('/auth/refresh');
        const res = await fetch(fullUrl, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
        });
        return res.ok;
      } catch {
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Performs an HTTP request and parses JSON response with strict error extraction.
   */
  public async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, timeoutMs = 10000, _retryCount = 0, ...fetchOptions } = options;
    const fullUrl = this.buildUrl(endpoint, params);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Add credentials and CSRF protection headers
    const method = (fetchOptions.method || 'GET').toUpperCase();
    const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    const isFormData = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData;

    const headers: Record<string, string> = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      Accept: 'application/json',
      ...(isMutating ? { 'X-Requested-With': 'XMLHttpRequest' } : {}),
      ...(fetchOptions.headers as Record<string, string>),
    };

    if (isFormData) {
      delete headers['Content-Type'];
    }

    try {
      const response = await fetch(fullUrl, {
        ...fetchOptions,
        credentials: 'include',
        signal: controller.signal,
        headers,
      });

      clearTimeout(timeoutId);

      // Handle 401: attempt silent refresh if request is eligible
      const isAuthEndpoint = endpoint.includes('/auth/login') || endpoint.includes('/auth/refresh') || endpoint.includes('/auth/register');
      if (response.status === 401 && !isAuthEndpoint && _retryCount === 0) {
        const refreshed = await this.refreshSession();
        if (refreshed) {
          return this.request<T>(endpoint, {
            ...options,
            _retryCount: _retryCount + 1,
          });
        }
      }

      let responseBody: any = null;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          responseBody = await response.json();
        } catch {
          responseBody = null;
        }
      } else {
        responseBody = await response.text();
      }

      if (!response.ok) {
        const errorMessage =
          (typeof responseBody === 'object' && responseBody !== null && (responseBody.message || responseBody.error)) ||
          response.statusText ||
          `Request failed with status ${response.status}`;

        throw new ApiError(
          Array.isArray(errorMessage) ? errorMessage.join(', ') : String(errorMessage),
          response.status,
          responseBody,
          false
        );
      }

      return responseBody as T;
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      if (err instanceof ApiError) {
        throw err;
      }

      const isAbort = (err as any)?.name === 'AbortError';
      const message = isAbort
        ? `Request timed out after ${timeoutMs}ms: ${endpoint}`
        : err instanceof Error
        ? err.message
        : 'Failed to communicate with API server';

      throw new ApiError(message, 0, undefined, true);
    }
  }

  public get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
