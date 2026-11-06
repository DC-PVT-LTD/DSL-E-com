import { apiClient, BackendApiResponse } from '@/lib/api/apiClient';
import {
  HomepageBanner,
  BannerStatus,
  CreateBannerInput,
  UpdateBannerInput,
  ReorderBannerItem,
} from '@/types/banner';

class BannerService {
  /**
   * Fetch active banners for public store homepage hero section.
   */
  public async getHomepageBanners(): Promise<HomepageBanner[]> {
    try {
      const res = await apiClient.get<BackendApiResponse<HomepageBanner[]>>('banners/homepage');
      if (res && res.data) {
        return res.data;
      }
      return [];
    } catch (error) {
      console.warn('Failed to load homepage banners, falling back to empty list:', error);
      return [];
    }
  }

  /**
   * Admin: List all banners with optional status or search query.
   */
  public async getAdminBanners(params?: {
    status?: BannerStatus;
    search?: string;
  }): Promise<HomepageBanner[]> {
    const queryParams: Record<string, string> = {};
    if (params?.status) queryParams.status = params.status;
    if (params?.search && params.search.trim()) queryParams.search = params.search.trim();

    const res = await apiClient.get<BackendApiResponse<HomepageBanner[]>>('admin/banners', {
      params: queryParams,
    });
    return res.data || [];
  }

  /**
   * Admin: Get a single banner by ID.
   */
  public async getAdminBannerById(id: string): Promise<HomepageBanner> {
    const res = await apiClient.get<BackendApiResponse<HomepageBanner>>(`admin/banners/${encodeURIComponent(id)}`);
    if (!res.data) {
      throw new Error(res.message || 'Banner not found');
    }
    return res.data;
  }

  /**
   * Admin: Create a new homepage banner.
   */
  public async createBanner(data: CreateBannerInput): Promise<HomepageBanner> {
    const res = await apiClient.post<BackendApiResponse<HomepageBanner>>('admin/banners', data);
    if (!res.data) {
      throw new Error(res.message || 'Failed to create banner');
    }
    return res.data;
  }

  /**
   * Admin: Update an existing banner.
   */
  public async updateBanner(id: string, data: UpdateBannerInput): Promise<HomepageBanner> {
    const res = await apiClient.patch<BackendApiResponse<HomepageBanner>>(
      `admin/banners/${encodeURIComponent(id)}`,
      data
    );
    if (!res.data) {
      throw new Error(res.message || 'Failed to update banner');
    }
    return res.data;
  }

  /**
   * Admin: Delete a banner.
   */
  public async deleteBanner(id: string): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.delete<BackendApiResponse<{ success: boolean; message: string }>>(
      `admin/banners/${encodeURIComponent(id)}`
    );
    return res.data || { success: true, message: res.message || 'Banner deleted' };
  }

  /**
   * Admin: Duplicate an existing banner.
   */
  public async duplicateBanner(id: string): Promise<HomepageBanner> {
    const res = await apiClient.post<BackendApiResponse<HomepageBanner>>(
      `admin/banners/${encodeURIComponent(id)}/duplicate`,
      {}
    );
    if (!res.data) {
      throw new Error(res.message || 'Failed to duplicate banner');
    }
    return res.data;
  }

  /**
   * Admin: Reorder banners in bulk.
   */
  public async reorderBanners(items: ReorderBannerItem[]): Promise<boolean> {
    const res = await apiClient.patch<BackendApiResponse<{ success: boolean }>>('admin/banners/reorder', {
      items,
    });
    return res.success ?? true;
  }

  /**
   * Upload an image file for a banner (desktop or mobile) to the backend.
   * Returns the asset URL.
   */
  public async uploadBannerImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await apiClient.post<BackendApiResponse<{ url: string }>>('uploads', formData, {
      params: { folder: 'banners' },
    });

    if (res.success && res.data?.url) {
      return res.data.url;
    }
    throw new Error(res.message || 'Failed to upload banner image');
  }
}

export const bannerService = new BannerService();
export default bannerService;
