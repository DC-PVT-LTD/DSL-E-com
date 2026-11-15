import { Brand, Product } from '@/types/product';
import { PaginatedResult } from '@/types/common';
import {
  apiClient,
  BackendApiResponse,
  BackendPaginatedResponse,
} from '@/lib/api/apiClient';
import { INITIAL_BRANDS } from '@/mocks/brands';

const BRAND_STORAGE_KEY = 'dsl_brands_data_v1';

export function deduplicateBrands(brands: Brand[]): Brand[] {
  const seenIds = new Set<string>();
  const seenSlugs = new Set<string>();
  const seenNames = new Set<string>();
  const result: Brand[] = [];

  for (const b of brands) {
    if (!b) continue;
    const idKey = (b.id || '').toLowerCase().trim();
    const slugKey = (b.slug || '').toLowerCase().trim();
    const nameKey = (b.name || '').toLowerCase().trim();

    if (idKey && seenIds.has(idKey)) continue;
    if (slugKey && seenSlugs.has(slugKey)) continue;
    if (nameKey && seenNames.has(nameKey)) continue;

    if (idKey) seenIds.add(idKey);
    if (slugKey) seenSlugs.add(slugKey);
    if (nameKey) seenNames.add(nameKey);

    result.push(b);
  }
  return result;
}

export interface BrandQueryOptions {
  search?: string;
  featured?: boolean;
  page?: number;
  limit?: number;
}

class BrandService {
  private brands: Brand[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.initData();
  }

  private initData() {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(BRAND_STORAGE_KEY);
        if (stored) {
          this.brands = deduplicateBrands(JSON.parse(stored));
          localStorage.setItem(BRAND_STORAGE_KEY, JSON.stringify(this.brands));
          return;
        }
      } catch (err) {
        console.error('Error loading brands from storage:', err);
      }
    }
    this.brands = deduplicateBrands([...INITIAL_BRANDS]);
  }

  private persistAndNotify() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(BRAND_STORAGE_KEY, JSON.stringify(this.brands));
      } catch (err) {
        console.error('Error persisting brands:', err);
      }
    }
    this.listeners.forEach((listener) => listener());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public resetToDefault(): void {
    this.brands = [...INITIAL_BRANDS];
    this.persistAndNotify();
  }

  /**
   * Fetch brands from the backend NestJS REST API.
   */
  public async fetchBrands(options?: BrandQueryOptions): Promise<Brand[]> {
    try {
      const res = await apiClient.get<BackendPaginatedResponse<Brand>>('brands', {
        params: {
          search: options?.search,
          featured: options?.featured,
          page: options?.page || 1,
          limit: options?.limit || 100,
        },
      });

      if (res.success && Array.isArray(res.data)) {
        // Filter out test and non-stationery brands (e.g. Wetex, Stage4)
        const validBrands = res.data.filter(
          (b) =>
            !b.slug.includes('wetex') &&
            !b.slug.includes('stage4') &&
            !b.name.toLowerCase().includes('stage4') &&
            !b.name.toLowerCase().includes('wetex')
        );
        this.brands = deduplicateBrands([...validBrands, ...INITIAL_BRANDS]);
        this.persistAndNotify();
        return [...this.brands];
      }
    } catch (err) {
      console.warn('Could not fetch brands from backend API, using local fallback:', err);
    }
    return [...this.brands];
  }

  /**
   * Fetches accurate brand analytics directly from backend.
   */
  public async fetchBrandAnalytics(): Promise<{
    totalBrands: number;
    featuredBrands: number;
    brandsWithProducts: number;
    emptyBrands: number;
    topBrands: Array<{ id: string; name: string; count: number }>;
  }> {
    const res = await apiClient.get<BackendApiResponse<any>>('brands/admin/analytics');
    return res.data;
  }

  /**
   * Exports brands to CSV or Excel directly from backend streaming endpoint.
   */
  public async exportBrands(
    format: 'csv' | 'xlsx' = 'xlsx',
    selectedIds?: string[]
  ): Promise<Blob> {
    const params: Record<string, string | undefined> = { format };
    if (selectedIds && selectedIds.length > 0) {
      params.selectedIds = selectedIds.join(',');
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('dsl_admin_token') : null;
    const queryString = new URLSearchParams(
      Object.entries(params)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString();

    const response = await fetch(`http://localhost:4000/api/v1/brands/export?${queryString}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Export failed with status ${response.status}: ${response.statusText}`);
    }

    return await response.blob();
  }

  /**
   * Fetch single brand by slug from backend API.
   */
  public async fetchBrandBySlug(slug: string): Promise<Brand | null> {
    try {
      const res = await apiClient.get<BackendApiResponse<Brand>>(`brands/slug/${encodeURIComponent(slug)}`);
      if (res.success && res.data) {
        return res.data;
      }
    } catch (err) {
      console.warn(`Could not fetch brand by slug "${slug}" from backend API:`, err);
    }
    return this.getBrandBySlug(slug) || null;
  }

  /**
   * Fetch single brand by ID from backend API.
   */
  public async fetchBrandById(id: string): Promise<Brand | null> {
    try {
      const res = await apiClient.get<BackendApiResponse<Brand>>(`brands/${encodeURIComponent(id)}`);
      if (res.success && res.data) {
        return res.data;
      }
    } catch (err) {
      console.warn(`Could not fetch brand by ID "${id}" from backend API:`, err);
    }
    return this.getBrandById(id) || null;
  }

  /**
   * Fetch products belonging to a brand from backend API.
   */
  public async fetchBrandProducts(
    brandId: string,
    query?: { page?: number; limit?: number }
  ): Promise<PaginatedResult<Product>> {
    try {
      const res = await apiClient.get<BackendPaginatedResponse<Product>>(`brands/${encodeURIComponent(brandId)}/products`, {
        params: {
          page: query?.page || 1,
          limit: query?.limit || 20,
        },
      });

      if (res.success && Array.isArray(res.data)) {
        return {
          items: res.data,
          total: res.meta.totalItems,
          page: res.meta.page,
          pageSize: res.meta.limit,
          totalPages: res.meta.totalPages,
        };
      }
    } catch (err) {
      console.warn(`Could not fetch products for brand "${brandId}" from backend API:`, err);
    }

    return {
      items: [],
      total: 0,
      page: query?.page || 1,
      pageSize: query?.limit || 20,
      totalPages: 1,
    };
  }

  /**
   * Create a new brand via backend NestJS API.
   */
  public async createBrandApi(data: {
    name: string;
    slug: string;
    description: string;
    originCountry: string;
    logo?: string;
    featured?: boolean;
  }): Promise<Brand> {
    const res = await apiClient.post<BackendApiResponse<Brand>>('brands', data);
    if (res.success && res.data) {
      this.brands.push(res.data);
      this.persistAndNotify();
      return res.data;
    }
    throw new Error(res.message || 'Failed to create brand');
  }

  /**
   * Update brand via backend NestJS API.
   */
  public async updateBrandApi(
    id: string,
    data: Partial<{
      name: string;
      slug: string;
      description: string;
      originCountry: string;
      logo?: string;
      featured?: boolean;
    }>
  ): Promise<Brand> {
    const res = await apiClient.patch<BackendApiResponse<Brand>>(
      `brands/${encodeURIComponent(id)}`,
      data
    );
    if (res.success && res.data) {
      const idx = this.brands.findIndex((b) => b.id === id);
      if (idx !== -1) {
        this.brands[idx] = { ...this.brands[idx], ...res.data };
      }
      this.persistAndNotify();
      return res.data;
    }
    throw new Error(res.message || 'Failed to update brand');
  }

  /**
   * Delete / deactivate brand via backend NestJS API.
   */
  public async deleteBrandApi(id: string): Promise<boolean> {
    const res = await apiClient.delete<BackendApiResponse<{ id: string }>>(
      `brands/${encodeURIComponent(id)}`
    );
    if (res.success) {
      this.brands = this.brands.filter((b) => b.id !== id);
      this.persistAndNotify();
      return true;
    }
    throw new Error(res.message || 'Failed to delete brand');
  }

  // Synchronous cache getters
  public getBrands(): Brand[] {
    return [...this.brands];
  }

  public getBrandBySlug(slug: string): Brand | undefined {
    return this.brands.find((b) => b.slug === slug);
  }

  public getBrandById(id: string): Brand | undefined {
    return this.brands.find((b) => b.id === id);
  }

  public createBrand(data: Omit<Brand, 'id'>): Brand {
    const newBrand: Brand = {
      ...data,
      id: `brand-${Date.now()}`,
    };
    this.brands.push(newBrand);
    this.persistAndNotify();
    return newBrand;
  }

  public updateBrand(id: string, updates: Partial<Brand>): Brand | null {
    const idx = this.brands.findIndex((b) => b.id === id);
    if (idx === -1) return null;
    this.brands[idx] = { ...this.brands[idx], ...updates };
    this.persistAndNotify();
    return this.brands[idx];
  }

  public deleteBrand(id: string): boolean {
    const initialLen = this.brands.length;
    this.brands = this.brands.filter((b) => b.id !== id);
    if (this.brands.length !== initialLen) {
      this.persistAndNotify();
      return true;
    }
    return false;
  }
}

export const brandService = new BrandService();

