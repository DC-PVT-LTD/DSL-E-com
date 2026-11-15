import {
  SchoolPack,
  SchoolPackConfig,
  CalculateCustomizedResult,
} from '@/types/school-pack';
import {
  apiClient,
  BackendApiResponse,
  BackendPaginatedResponse,
} from '@/lib/api/apiClient';
import { INITIAL_SCHOOL_PACKS } from '@/mocks/school-packs';

export interface SchoolPackQueryParams {
  grade?: string;
  tier?: string;
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

class SchoolPackService {
  private listeners: Set<() => void> = new Set();
  private cachedPacks: SchoolPack[] = [...INITIAL_SCHOOL_PACKS];
  private cachedConfig: SchoolPackConfig | null = null;

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  /**
   * Fetch active grade groups and tiers configuration from server.
   */
  public async getConfig(): Promise<SchoolPackConfig> {
    try {
      const res = await apiClient.get<BackendApiResponse<SchoolPackConfig>>(
        '/school-packs/config/grades-tiers'
      );
      this.cachedConfig = res.data;
      return res.data;
    } catch (err) {
      console.warn('Failed to fetch school pack config, using fallback:', err);
      return (
        this.cachedConfig || {
          gradeGroups: [
            'Grade 1-2',
            'Grade 3-5',
            'Grade 6-9',
            'O/L (Grade 10-11)',
            'A/L Science',
            'A/L Commerce',
            'A/L Arts',
          ],
          tiers: ['essential', 'standard', 'premium'],
        }
      );
    }
  }

  /**
   * Retrieve active school packs with live server pricing and stock status.
   */
  public async getPacks(
    params?: SchoolPackQueryParams
  ): Promise<{ items: SchoolPack[]; total: number }> {
    try {
      const queryParams: Record<string, any> = {};
      if (params?.grade && params.grade !== 'all') queryParams.grade = params.grade;
      if (params?.tier && params.tier !== 'all') queryParams.tier = params.tier;
      if (params?.search) queryParams.search = params.search;
      if (params?.page) queryParams.page = params.page;
      if (params?.limit) queryParams.limit = params.limit;

      const res = await apiClient.get<BackendPaginatedResponse<SchoolPack>>(
        '/school-packs',
        { params: queryParams }
      );

      this.cachedPacks = res.data || [];
      return {
        items: res.data || [],
        total: res.meta?.totalItems ?? res.data?.length ?? 0,
      };
    } catch (err) {
      console.warn('Failed to fetch school packs from backend API, using local fallback:', err);
      let items = [...this.cachedPacks];
      if (params?.grade && params.grade !== 'all') {
        items = items.filter((p) => p.grade.toLowerCase() === params.grade?.toLowerCase());
      }
      if (params?.tier && params.tier !== 'all') {
        items = items.filter((p) => p.tier.toLowerCase() === params.tier?.toLowerCase());
      }
      if (params?.search) {
        const q = params.search.toLowerCase();
        items = items.filter(
          (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
        );
      }
      const page = params?.page || 1;
      const limit = params?.limit || items.length || 10;
      const paginated = items.slice((page - 1) * limit, page * limit);
      return { items: paginated, total: items.length };
    }
  }

  /**
   * Retrieve a single school pack by ID or unique slug with full substitutes and live stock.
   */
  public async getPackById(idOrSlug: string): Promise<SchoolPack | null> {
    try {
      const res = await apiClient.get<BackendApiResponse<SchoolPack>>(
        `/school-packs/${encodeURIComponent(idOrSlug)}`
      );
      return res.data;
    } catch (err) {
      console.warn(`Failed to fetch school pack '${idOrSlug}', using fallback:`, err);
      return this.getById(idOrSlug) || null;
    }
  }

  /**
   * Calculate live authoritative server price for customized pack items.
   */
  public async calculateCustomized(
    idOrSlug: string,
    items: { productId: string; variantId?: string | null; quantity: number }[]
  ): Promise<CalculateCustomizedResult | null> {
    try {
      const res = await apiClient.post<BackendApiResponse<CalculateCustomizedResult>>(
        `/school-packs/${encodeURIComponent(idOrSlug)}/calculate`,
        { items }
      );
      return res.data;
    } catch (err) {
      console.warn(`Failed to calculate customized pricing for pack '${idOrSlug}':`, err);
      return null;
    }
  }

  /**
   * Admin: List all packs (including inactive).
   */
  public async getAdminPacks(
    params?: SchoolPackQueryParams
  ): Promise<{ items: SchoolPack[]; total: number }> {
    const queryParams: Record<string, any> = {};
    if (params?.grade && params.grade !== 'all') queryParams.grade = params.grade;
    if (params?.tier && params.tier !== 'all') queryParams.tier = params.tier;
    if (params?.search) queryParams.search = params.search;
    if (params?.isActive !== undefined) queryParams.isActive = params.isActive;
    if (params?.page) queryParams.page = params.page;
    if (params?.limit) queryParams.limit = params.limit;

    const res = await apiClient.get<BackendPaginatedResponse<SchoolPack>>(
      '/admin/school-packs',
      { params: queryParams }
    );

    return {
      items: res.data || [],
      total: res.meta?.totalItems ?? res.data?.length ?? 0,
    };
  }

  /**
   * Admin: Get pack by ID.
   */
  public async getAdminPackById(id: string): Promise<SchoolPack | null> {
    try {
      const res = await apiClient.get<BackendApiResponse<SchoolPack>>(
        `/admin/school-packs/${encodeURIComponent(id)}`
      );
      return res.data;
    } catch (err) {
      console.warn(`Failed to fetch admin school pack '${id}':`, err);
      return null;
    }
  }

  /**
   * Admin: Create a new School Pack.
   */
  public async createPack(data: {
    name: string;
    slug?: string;
    grade: string;
    tier: string;
    description: string;
    savingsPercentage?: number;
    isActive?: boolean;
    items: {
      productId: string;
      defaultQuantity: number;
      substituteProductIds?: string[];
    }[];
  }): Promise<SchoolPack> {
    const res = await apiClient.post<BackendApiResponse<SchoolPack>>(
      '/admin/school-packs',
      data
    );
    this.notify();
    return res.data;
  }

  /**
   * Admin: Update an existing School Pack.
   */
  public async updatePack(
    id: string,
    data: {
      name?: string;
      slug?: string;
      grade?: string;
      tier?: string;
      description?: string;
      savingsPercentage?: number;
      isActive?: boolean;
      items?: {
        productId: string;
        defaultQuantity: number;
        substituteProductIds?: string[];
      }[];
    }
  ): Promise<SchoolPack> {
    const res = await apiClient.patch<BackendApiResponse<SchoolPack>>(
      `/admin/school-packs/${encodeURIComponent(id)}`,
      data
    );
    this.notify();
    return res.data;
  }

  /**
   * Admin: Toggle status.
   */
  public async togglePackStatus(id: string, isActive?: boolean): Promise<SchoolPack> {
    const res = await apiClient.patch<BackendApiResponse<SchoolPack>>(
      `/admin/school-packs/${encodeURIComponent(id)}/status`,
      { isActive }
    );
    this.notify();
    return res.data;
  }

  /**
   * Admin: Delete pack.
   */
  public async deletePack(id: string): Promise<void> {
    await apiClient.delete(`/admin/school-packs/${encodeURIComponent(id)}`);
    this.notify();
  }

  /**
   * Admin: Update configurable grades and tiers.
   */
  public async updateConfig(config: SchoolPackConfig): Promise<SchoolPackConfig> {
    const res = await apiClient.patch<BackendApiResponse<SchoolPackConfig>>(
      '/admin/school-packs/config/grades-tiers',
      config
    );
    this.cachedConfig = res.data;
    this.notify();
    return res.data;
  }

  // Synchronous fallback helpers
  public resetToDefault(): void {
    this.cachedPacks = [...INITIAL_SCHOOL_PACKS];
    this.cachedConfig = null;
    this.notify();
  }

  public getAll(): SchoolPack[] {
    return this.cachedPacks;
  }

  public getById(id: string): SchoolPack | undefined {
    return (
      this.cachedPacks.find((p) => p.id === id || p.slug === id) ||
      INITIAL_SCHOOL_PACKS.find((p) => p.id === id || p.slug === id)
    );
  }
}

export const schoolPackService = new SchoolPackService();
