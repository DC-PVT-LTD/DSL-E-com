import { Product } from '@/types/product';
import { FilterParams, PaginatedResult, SortOption } from '@/types/common';
import {
  apiClient,
  BackendApiResponse,
  BackendPaginatedResponse,
} from '@/lib/api/apiClient';
import { INITIAL_PRODUCTS } from '@/mocks/products';

const STORAGE_KEY = 'dsl_products_data_v1';

export interface ProductQueryOptions {
  filters?: FilterParams;
  sort?: SortOption;
  page?: number;
  limit?: number;
}

class ProductService {
  private products: Product[] = [];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.initData();
  }

  private initData() {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          this.products = JSON.parse(stored);
          return;
        }
      } catch (err) {
        console.error('Error loading products from storage:', err);
      }
    }
    this.products = [...INITIAL_PRODUCTS];
  }

  private persistAndNotify() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.products));
      } catch (err) {
        console.error('Error persisting products:', err);
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
    this.products = [...INITIAL_PRODUCTS];
    this.persistAndNotify();
  }

  /**
   * Maps frontend SortOption to NestJS backend sortBy & sortOrder fields.
   */
  private mapSortToBackend(sort?: SortOption): { sortBy: string; sortOrder: 'asc' | 'desc' } {
    switch (sort) {
      case 'price_asc':
        return { sortBy: 'priceCents', sortOrder: 'asc' };
      case 'price_desc':
        return { sortBy: 'priceCents', sortOrder: 'desc' };
      case 'name_asc':
        return { sortBy: 'name', sortOrder: 'asc' };
      case 'name_desc':
        return { sortBy: 'name', sortOrder: 'desc' };
      case 'rating':
        return { sortBy: 'rating', sortOrder: 'desc' };
      case 'newest':
      default:
        return { sortBy: 'createdAt', sortOrder: 'desc' };
    }
  }

  /**
   * Fetch paginated and filtered products from the backend NestJS REST API.
   */
  public async fetchProducts(
    filters: FilterParams = {},
    sort: SortOption = 'newest',
    page = 1,
    limit = 12
  ): Promise<PaginatedResult<Product>> {
    const { sortBy, sortOrder } = this.mapSortToBackend(sort);

    const params: Record<string, string | number | boolean | undefined> = {
      page,
      limit,
      sortBy,
      sortOrder,
    };

    if (filters.query?.trim()) {
      params.search = filters.query.trim();
    }

    if (filters.category && filters.category !== 'all') {
      if (filters.category.startsWith('cat-')) {
        params.categoryId = filters.category;
      } else {
        params.categorySlug = filters.category;
      }
    }

    if (filters.brand && filters.brand !== 'all') {
      if (filters.brand.startsWith('brand-')) {
        params.brandId = filters.brand;
      } else {
        params.brandSlug = filters.brand;
      }
    }

    if (filters.minPrice !== undefined) {
      params.minPrice = filters.minPrice;
    }

    if (filters.maxPrice !== undefined) {
      params.maxPrice = filters.maxPrice;
    }

    if (filters.inStockOnly) {
      params.inStockOnly = true;
    }

    if (filters.featured) {
      params.isFeatured = true;
    }

    try {
      const res = await apiClient.get<BackendPaginatedResponse<Product>>('products', { params });

      if (res.success && Array.isArray(res.data)) {
        // Cache the fetched items in the local store
        const existingMap = new Map(this.products.map((p) => [p.id, p]));
        res.data.forEach((p) => existingMap.set(p.id, p));
        this.products = Array.from(existingMap.values());
        this.persistAndNotify();

        return {
          items: res.data,
          total: res.meta.totalItems,
          page: res.meta.page,
          pageSize: res.meta.limit,
          totalPages: res.meta.totalPages,
        };
      }
    } catch (err) {
      console.warn('Backend products API call failed, falling back to local dataset:', err);
    }

    // Graceful offline fallback
    return this.getFilteredAndSorted(filters, sort, page, limit);
  }

  /**
   * Fetch single product by slug from the backend API.
   */
  public async fetchProductBySlug(slug: string): Promise<Product | null> {
    const cleanSlug = slug.trim();
    const normalizedSlug = cleanSlug.toLowerCase().replace(/_/g, '-');

    try {
      const res = await apiClient.get<BackendApiResponse<Product>>(`products/slug/${encodeURIComponent(cleanSlug)}`);
      if (res.success && res.data) {
        const existingIdx = this.products.findIndex((p) => p.id === res.data.id);
        if (existingIdx !== -1) {
          this.products[existingIdx] = res.data;
        } else {
          this.products.push(res.data);
        }
        this.persistAndNotify();
        return res.data;
      }
    } catch (err) {
      console.warn(`Could not fetch product by slug "${slug}" from backend API:`, err);
    }

    return this.getBySlug(cleanSlug) || this.getBySlug(normalizedSlug) || null;
  }

  /**
   * Fetch single product by ID from the backend API.
   */
  public async fetchProductById(id: string): Promise<Product | null> {
    try {
      const res = await apiClient.get<BackendApiResponse<Product>>(`products/${encodeURIComponent(id)}`);
      if (res.success && res.data) {
        const existingIdx = this.products.findIndex((p) => p.id === res.data.id);
        if (existingIdx !== -1) {
          this.products[existingIdx] = res.data;
        } else {
          this.products.push(res.data);
        }
        this.persistAndNotify();
        return res.data;
      }
    } catch (err) {
      console.warn(`Could not fetch product by ID "${id}" from backend API:`, err);
    }

    return this.getById(id) || null;
  }

  /**
   * Backward-compatible helper method.
   */
  public async fetchProductsFromApi(params?: FilterParams): Promise<Product[]> {
    const result = await this.fetchProducts(params || {}, 'newest', 1, 100);
    return result.items;
  }

  public getAll(includeInactive = false): Product[] {
    if (includeInactive) return [...this.products];
    return this.products.filter((p) => p.isActive);
  }

  public getById(id: string): Product | undefined {
    return this.products.find((p) => p.id === id);
  }

  public getBySlug(slug: string): Product | undefined {
    const cleanSlug = slug.trim();
    const normalized = cleanSlug.toLowerCase().replace(/_/g, '-');
    return this.products.find(
      (p) =>
        p.slug === cleanSlug ||
        p.slug === normalized ||
        p.slug.toLowerCase() === normalized ||
        p.id === cleanSlug ||
        p.id === `prod-dsl-${cleanSlug}` ||
        p.sku.toLowerCase() === cleanSlug.toLowerCase() ||
        p.specifications?.['Original Product ID'] === cleanSlug ||
        p.name.toLowerCase() === cleanSlug.replace(/[-_]/g, ' ').toLowerCase()
    );
  }

  public getBySku(sku: string): Product | undefined {
    return this.products.find((p) => p.sku.toLowerCase() === sku.toLowerCase());
  }

  public getFilteredAndSorted(
    params: FilterParams = {},
    sort: SortOption = 'newest',
    page = 1,
    pageSize = 12,
    includeInactive = false
  ): PaginatedResult<Product> {
    let result = includeInactive ? [...this.products] : this.products.filter((p) => p.isActive);

    // Filter by query (search in name, description, SKU, tags)
    if (params.query?.trim()) {
      const q = params.query.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.shortDescription.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Filter by category
    if (params.category && params.category !== 'all') {
      result = result.filter(
        (p) =>
          p.categoryId === params.category ||
          p.categoryName?.toLowerCase() === params.category?.toLowerCase() ||
          (p as any).category?.slug === params.category
      );
    }

    // Filter by brand
    if (params.brand && params.brand !== 'all') {
      result = result.filter(
        (p) =>
          p.brandId === params.brand ||
          p.brandName?.toLowerCase() === params.brand?.toLowerCase() ||
          (p as any).brand?.slug === params.brand
      );
    }

    // Filter by price range (in cents)
    if (params.minPrice !== undefined) {
      result = result.filter((p) => p.priceCents >= (params.minPrice || 0));
    }
    if (params.maxPrice !== undefined) {
      result = result.filter((p) => p.priceCents <= (params.maxPrice || Infinity));
    }

    // Filter by in stock
    if (params.inStockOnly) {
      result = result.filter((p) => p.stockQuantity > 0);
    }

    // Filter by featured
    if (params.featured) {
      result = result.filter((p) => p.isFeatured);
    }

    // Filter by on sale
    if (params.onSale) {
      result = result.filter((p) => p.compareAtPriceCents && p.compareAtPriceCents > p.priceCents);
    }

    // Sorting
    result.sort((a, b) => {
      switch (sort) {
        case 'price_asc':
          return a.priceCents - b.priceCents;
        case 'price_desc':
          return b.priceCents - a.priceCents;
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'name_desc':
          return b.name.localeCompare(a.name);
        case 'rating':
          return b.rating - a.rating;
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    const total = result.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const startIndex = (page - 1) * pageSize;
    const items = result.slice(startIndex, startIndex + pageSize);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  public createProduct(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Product {
    const newProduct: Product = {
      ...data,
      id: `prod-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.products.unshift(newProduct);
    this.persistAndNotify();
    return newProduct;
  }

  public updateProduct(id: string, updates: Partial<Product>): Product | null {
    const index = this.products.findIndex((p) => p.id === id);
    if (index === -1) return null;

    this.products[index] = {
      ...this.products[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.persistAndNotify();
    return this.products[index];
  }

  public deleteProduct(id: string): boolean {
    const initialLen = this.products.length;
    this.products = this.products.filter((p) => p.id !== id);
    if (this.products.length !== initialLen) {
      this.persistAndNotify();
      return true;
    }
    return false;
  }

  public toggleProductStatus(id: string): Product | null {
    const product = this.getById(id);
    if (!product) return null;
    return this.updateProduct(id, { isActive: !product.isActive });
  }

  public adjustStock(id: string, delta: number): Product | null {
    const product = this.getById(id);
    if (!product) return null;
    const newStock = Math.max(0, product.stockQuantity + delta);
    return this.updateProduct(id, { stockQuantity: newStock });
  }

  // ============================================================================
  // BACKEND PRODUCT API CRUD METHODS
  // ============================================================================

  /**
   * Create a new product via backend NestJS API.
   */
  public async createProductApi(data: Record<string, any>): Promise<Product> {
    const res = await apiClient.post<BackendApiResponse<Product>>('products', data);
    if (res.success && res.data) {
      const existingIdx = this.products.findIndex((p) => p.id === res.data.id);
      if (existingIdx !== -1) {
        this.products[existingIdx] = res.data;
      } else {
        this.products.unshift(res.data);
      }
      this.persistAndNotify();
      return res.data;
    }
    throw new Error(res.message || 'Failed to create product');
  }

  /**
   * Update an existing product via backend NestJS API.
   */
  public async updateProductApi(id: string, data: Record<string, any>): Promise<Product> {
    const res = await apiClient.patch<BackendApiResponse<Product>>(`products/${encodeURIComponent(id)}`, data);
    if (res.success && res.data) {
      const existingIdx = this.products.findIndex((p) => p.id === id);
      if (existingIdx !== -1) {
        this.products[existingIdx] = { ...this.products[existingIdx], ...res.data };
      } else {
        this.products.unshift(res.data);
      }
      this.persistAndNotify();
      return res.data;
    }
    throw new Error(res.message || 'Failed to update product');
  }

  /**
   * Uploads an image to the backend and returns the public asset URL.
   */
  public async uploadProductImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await apiClient.post<BackendApiResponse<{ url: string }>>('uploads', formData, {
      params: { folder: 'products' },
    });

    if (res.success && res.data?.url) {
      return res.data.url;
    }
    throw new Error(res.message || 'Failed to upload image');
  }

  /**
   * Toggle product active/hidden status via backend NestJS API.
   */
  public async toggleProductStatusApi(id: string): Promise<Product> {
    const res = await apiClient.patch<BackendApiResponse<Product>>(`products/${encodeURIComponent(id)}/status`, {});
    if (res.success && res.data) {
      const existingIdx = this.products.findIndex((p) => p.id === id);
      if (existingIdx !== -1) {
        this.products[existingIdx] = { ...this.products[existingIdx], ...res.data };
      }
      this.persistAndNotify();
      return res.data;
    }
    throw new Error(res.message || 'Failed to toggle product status');
  }

  /**
   * Soft-delete / deactivate product via backend NestJS API.
   */
  public async deleteProductApi(id: string): Promise<boolean> {
    const res = await apiClient.delete<BackendApiResponse<{ id: string }>>(`products/${encodeURIComponent(id)}`);
    if (res.success) {
      this.products = this.products.filter((p) => p.id !== id);
      this.persistAndNotify();
      return true;
    }
    throw new Error(res.message || 'Failed to delete product');
  }

  // ============================================================================
  // PRODUCT VARIANT API METHODS
  // ============================================================================

  /**
   * Fetch variants for a product from the backend API.
   */
  public async fetchVariants(productId: string): Promise<any[]> {
    try {
      const res = await apiClient.get<BackendApiResponse<any[]>>(`products/${productId}/variants`);
      if (res.success && Array.isArray(res.data)) {
        // Synchronize in local product cache
        const prod = this.getById(productId);
        if (prod) {
          this.updateProduct(productId, { variants: res.data });
        }
        return res.data;
      }
    } catch (err) {
      console.warn(`Failed to fetch variants for product "${productId}":`, err);
    }
    return this.getById(productId)?.variants || [];
  }

  /**
   * Create a variant for an existing product.
   */
  public async createVariant(productId: string, data: any): Promise<any> {
    const res = await apiClient.post<BackendApiResponse<any>>(`products/${productId}/variants`, data);
    if (res.success && res.data) {
      const prod = this.getById(productId);
      if (prod) {
        const variants = [...(prod.variants || []).filter((v) => v.id !== res.data.id), res.data];
        const newAggregate = prod.stockQuantity + (res.data.stockQuantity || 0);
        this.updateProduct(productId, { variants, stockQuantity: newAggregate });
      }
      return res.data;
    }
    throw new Error(res.message || 'Failed to create variant');
  }

  /**
   * Update an existing product variant.
   */
  public async updateVariant(productId: string, variantId: string, data: any): Promise<any> {
    const res = await apiClient.patch<BackendApiResponse<any>>(
      `products/${productId}/variants/${variantId}`,
      data
    );
    if (res.success && res.data) {
      const prod = this.getById(productId);
      if (prod && prod.variants) {
        const updatedVariants = prod.variants.map((v) => (v.id === variantId ? { ...v, ...res.data } : v));
        this.updateProduct(productId, { variants: updatedVariants });
      }
      return res.data;
    }
    throw new Error(res.message || 'Failed to update variant');
  }

  /**
   * Deactivate a product variant.
   */
  public async deleteVariant(productId: string, variantId: string): Promise<boolean> {
    const res = await apiClient.delete<BackendApiResponse<any>>(
      `products/${productId}/variants/${variantId}`
    );
    if (res.success) {
      const prod = this.getById(productId);
      if (prod && prod.variants) {
        const updatedVariants = prod.variants.filter((v) => v.id !== variantId);
        this.updateProduct(productId, { variants: updatedVariants });
      }
      return true;
    }
    return false;
  }
}

export const productService = new ProductService();
