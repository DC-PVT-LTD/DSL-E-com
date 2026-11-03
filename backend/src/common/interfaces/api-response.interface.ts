export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: PaginationMeta;
  message?: string;
}

/**
 * Creates a standard envelope response for single resource endpoints.
 */
export function createApiResponse<T>(
  data: T,
  message?: string,
  meta?: Record<string, unknown>
): ApiResponse<T> {
  return {
    success: true,
    data,
    ...(message ? { message } : {}),
    ...(meta ? { meta } : {}),
  };
}

/**
 * Creates a standard envelope response for paginated collection endpoints.
 */
export function createPaginatedResponse<T>(
  data: T[],
  meta: PaginationMeta,
  message?: string
): PaginatedResponse<T> {
  return {
    success: true,
    data,
    meta,
    ...(message ? { message } : {}),
  };
}
