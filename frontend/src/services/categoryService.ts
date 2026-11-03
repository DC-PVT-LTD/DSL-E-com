import { ProductCategory, Brand, Product } from '@/types/product';
import { PaginatedResult } from '@/types/common';
import {
  apiClient,
  BackendApiResponse,
  BackendPaginatedResponse,
} from '@/lib/api/apiClient';
import { brandService, BrandQueryOptions } from './brandService';
import { INITIAL_CATEGORIES } from '@/mocks/categories';

const CAT_STORAGE_KEY = 'dsl_categories_data_v1';

export interface CategoryQueryOptions {
  search?: string;
  featured?: boolean;
  page?: number;
  limit?: number;
}

class CategoryService {
  private categories: ProductCategory[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.initData();
  }

  private initData() {
    if (typeof window !== 'undefined') {
      try {
        const catStr = localStorage.getItem(CAT_STORAGE_KEY);
        this.categories = catStr ? JSON.parse(catStr) : [...INITIAL_CATEGORIES];
        return;
      } catch (err) {
        console.error('Error loading categories from storage:', err);
      }
    }
    this.categories = [...INITIAL_CATEGORIES];
  }

  private persistAndNotify() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(CAT_STORAGE_KEY, JSON.stringify(this.categories));
      } catch (err) {
        console.error('Error persisting categories:', err);
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
    this.categories = [...INITIAL_CATEGORIES];
    this.persistAndNotify();
    brandService.resetToDefault();
  }

  /**
   * Fetch categories from backend NestJS REST API.
   */
  public async fetchCategories(options?: CategoryQueryOptions): Promise<ProductCategory[]> {
    try {
      const res = await apiClient.get<BackendPaginatedResponse<ProductCategory>>('categories', {
        params: {
          search: options?.search,
          featured: options?.featured,
          page: options?.page || 1,
          limit: options?.limit || 100,
        },
      });

      if (res.success && Array.isArray(res.data)) {
        this.categories = res.data;
        this.persistAndNotify();
        return res.data;
      }
    } catch (err) {
      console.warn('Could not fetch categories from backend API, using local fallback:', err);
    }
    return [...this.categories];
  }

  /**
   * Backward-compatible helper method.
   */
  public async fetchCategoriesFromApi(): Promise<ProductCategory[]> {
    return this.fetchCategories();
  }

  /**
   * Backward-compatible helper method delegating to brandService.
   */
  public async fetchBrandsFromApi(options?: BrandQueryOptions): Promise<Brand[]> {
    return brandService.fetchBrands(options);
  }

  /**
   * Fetch single category by slug from backend API.
   */
  public async fetchCategoryBySlug(slug: string): Promise<ProductCategory | null> {
    try {
      const res = await apiClient.get<BackendApiResponse<ProductCategory>>(`categories/slug/${encodeURIComponent(slug)}`);
      if (res.success && res.data) {
        return res.data;
      }
    } catch (err) {
      console.warn(`Could not fetch category by slug "${slug}" from backend API:`, err);
    }
    return this.getCategoryBySlug(slug) || null;
  }

  /**
   * Fetch single category by ID from backend API.
   */
  public async fetchCategoryById(id: string): Promise<ProductCategory | null> {
    try {
      const res = await apiClient.get<BackendApiResponse<ProductCategory>>(`categories/${encodeURIComponent(id)}`);
      if (res.success && res.data) {
        return res.data;
      }
    } catch (err) {
      console.warn(`Could not fetch category by ID "${id}" from backend API:`, err);
    }
    return this.getCategoryById(id) || null;
  }

  /**
   * Fetch products belonging to a category from backend API.
   */
  public async fetchCategoryProducts(
    categoryId: string,
    query?: { page?: number; limit?: number }
  ): Promise<PaginatedResult<Product>> {
    try {
      const res = await apiClient.get<BackendPaginatedResponse<Product>>(`categories/${encodeURIComponent(categoryId)}/products`, {
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
      console.warn(`Could not fetch products for category "${categoryId}" from backend API:`, err);
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
   * Create a new category via backend NestJS API.
   */
  public async createCategoryApi(data: {
    name: string;
    slug: string;
    description: string;
    iconName?: string;
    image?: string;
    featured?: boolean;
    displayOrder?: number;
  }): Promise<ProductCategory> {
    const res = await apiClient.post<BackendApiResponse<ProductCategory>>('categories', data);
    if (res.success && res.data) {
      const idx = this.categories.findIndex((c) => c.id === res.data.id);
      if (idx !== -1) {
        this.categories[idx] = res.data;
      } else {
        this.categories.push(res.data);
      }
      this.persistAndNotify();
      return res.data;
    }
    throw new Error(res.message || 'Failed to create category');
  }

  /**
   * Update category via backend NestJS API.
   */
  public async updateCategoryApi(
    id: string,
    data: Partial<{
      name: string;
      slug: string;
      description: string;
      iconName?: string;
      image?: string;
      featured?: boolean;
      displayOrder?: number;
    }>
  ): Promise<ProductCategory> {
    const res = await apiClient.patch<BackendApiResponse<ProductCategory>>(
      `categories/${encodeURIComponent(id)}`,
      data
    );
    if (res.success && res.data) {
      const idx = this.categories.findIndex((c) => c.id === id);
      if (idx !== -1) {
        this.categories[idx] = { ...this.categories[idx], ...res.data };
      }
      this.persistAndNotify();
      return res.data;
    }
    throw new Error(res.message || 'Failed to update category');
  }

  /**
   * Delete / deactivate category via backend NestJS API.
   */
  public async deleteCategoryApi(id: string): Promise<boolean> {
    const res = await apiClient.delete<BackendApiResponse<{ id: string }>>(
      `categories/${encodeURIComponent(id)}`
    );
    if (res.success) {
      this.categories = this.categories.filter((c) => c.id !== id);
      this.persistAndNotify();
      return true;
    }
    throw new Error(res.message || 'Failed to delete category');
  }

  // Categories synchronous cache getters
  public getCategories(): ProductCategory[] {
    return [...this.categories];
  }

  public getCategoryBySlug(slug: string): ProductCategory | undefined {
    return this.categories.find((c) => c.slug === slug);
  }

  public getCategoryById(id: string): ProductCategory | undefined {
    return this.categories.find((c) => c.id === id);
  }

  public createCategory(data: Omit<ProductCategory, 'id'>): ProductCategory {
    const newCat: ProductCategory = {
      ...data,
      id: `cat-${Date.now()}`,
    };
    this.categories.push(newCat);
    this.persistAndNotify();
    return newCat;
  }

  public updateCategory(id: string, updates: Partial<ProductCategory>): ProductCategory | null {
    const idx = this.categories.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    this.categories[idx] = { ...this.categories[idx], ...updates };
    this.persistAndNotify();
    return this.categories[idx];
  }

  public deleteCategory(id: string): boolean {
    const initialLen = this.categories.length;
    this.categories = this.categories.filter((c) => c.id !== id);
    if (this.categories.length !== initialLen) {
      this.persistAndNotify();
      return true;
    }
    return false;
  }

  // Brand delegations for backward compatibility
  public getBrands(): Brand[] {
    return brandService.getBrands();
  }

  public getBrandBySlug(slug: string): Brand | undefined {
    return brandService.getBrandBySlug(slug);
  }

  public getBrandById(id: string): Brand | undefined {
    return brandService.getBrandById(id);
  }

  public createBrand(data: Omit<Brand, 'id'>): Brand {
    return brandService.createBrand(data);
  }

  public updateBrand(id: string, updates: Partial<Brand>): Brand | null {
    return brandService.updateBrand(id, updates);
  }

  public deleteBrand(id: string): boolean {
    return brandService.deleteBrand(id);
  }
}

export const categoryService = new CategoryService();
