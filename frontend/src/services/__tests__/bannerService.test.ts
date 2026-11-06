import { describe, it, expect, beforeEach, vi } from 'vitest';
import { bannerService } from '../bannerService';
import { apiClient } from '@/lib/api/apiClient';

describe('bannerService (Phase 15.5)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getHomepageBanners', () => {
    it('fetches active homepage banners from /banners/homepage', async () => {
      const mockBanners = [
        {
          id: 'banner-1',
          title: 'Special Back-to-School Offers',
          subtitle: 'Save up to 40% on essentials',
          desktopImage: '/uploads/banners/bts-desktop.jpg',
          mobileImage: '/uploads/banners/bts-mobile.jpg',
          imageAltText: 'Back to School Sale',
          sortOrder: 0,
          status: 'PUBLISHED' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          effectiveStatus: 'ACTIVE' as const,
          isCurrentlyActive: true,
        },
      ];

      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: mockBanners,
        message: 'Homepage banners retrieved successfully',
      } as any);

      const res = await bannerService.getHomepageBanners();
      expect(res).toHaveLength(1);
      expect(res[0].title).toBe('Special Back-to-School Offers');
      expect(apiClient.get).toHaveBeenCalledWith('banners/homepage');
    });

    it('falls back to an empty array when API call fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValueOnce(new Error('Network error'));
      const res = await bannerService.getHomepageBanners();
      expect(res).toEqual([]);
    });
  });

  describe('getAdminBanners', () => {
    it('fetches admin banners with query parameters', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: [{ id: 'b-admin', title: 'Admin Banner' }],
      } as any);

      const res = await bannerService.getAdminBanners({ status: 'DRAFT', search: 'School' });
      expect(res).toHaveLength(1);
      expect(apiClient.get).toHaveBeenCalledWith('admin/banners', {
        params: { status: 'DRAFT', search: 'School' },
      });
    });
  });

  describe('getAdminBannerById', () => {
    it('fetches banner by id', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: { id: 'b-1', title: 'Single Banner' },
      } as any);

      const res = await bannerService.getAdminBannerById('b-1');
      expect(res.id).toBe('b-1');
      expect(apiClient.get).toHaveBeenCalledWith('admin/banners/b-1');
    });

    it('throws error if banner not found', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: null,
        message: 'Not found',
      } as any);

      await expect(bannerService.getAdminBannerById('missing')).rejects.toThrow('Not found');
    });
  });

  describe('createBanner', () => {
    it('posts new banner data to admin endpoint', async () => {
      const input = {
        title: 'New Year Stationery Sale',
        desktopImage: '/uploads/banners/ny.jpg',
        imageAltText: 'New Year Sale',
      };
      vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: { id: 'new-b', ...input },
      } as any);

      const res = await bannerService.createBanner(input);
      expect(res.id).toBe('new-b');
      expect(apiClient.post).toHaveBeenCalledWith('admin/banners', input);
    });
  });

  describe('updateBanner', () => {
    it('patches banner update to admin endpoint', async () => {
      vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        data: { id: 'b-1', title: 'Updated' },
      } as any);

      const res = await bannerService.updateBanner('b-1', { title: 'Updated' });
      expect(res.title).toBe('Updated');
      expect(apiClient.patch).toHaveBeenCalledWith('admin/banners/b-1', { title: 'Updated' });
    });
  });

  describe('deleteBanner', () => {
    it('deletes banner via DELETE call', async () => {
      vi.spyOn(apiClient, 'delete').mockResolvedValueOnce({
        data: { success: true, message: 'Deleted' },
      } as any);

      const res = await bannerService.deleteBanner('b-1');
      expect(res.success).toBe(true);
      expect(apiClient.delete).toHaveBeenCalledWith('admin/banners/b-1');
    });
  });

  describe('duplicateBanner', () => {
    it('duplicates banner via POST duplicate call', async () => {
      vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: { id: 'b-copy', title: 'Orig (Copy)' },
      } as any);

      const res = await bannerService.duplicateBanner('b-orig');
      expect(res.id).toBe('b-copy');
      expect(apiClient.post).toHaveBeenCalledWith('admin/banners/b-orig/duplicate', {});
    });
  });

  describe('reorderBanners', () => {
    it('sends reordered list to reorder endpoint', async () => {
      vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        success: true,
      } as any);

      const res = await bannerService.reorderBanners([
        { id: 'b-1', sortOrder: 1 },
        { id: 'b-2', sortOrder: 2 },
      ]);
      expect(res).toBe(true);
      expect(apiClient.patch).toHaveBeenCalledWith('admin/banners/reorder', {
        items: [
          { id: 'b-1', sortOrder: 1 },
          { id: 'b-2', sortOrder: 2 },
        ],
      });
    });
  });

  describe('uploadBannerImage', () => {
    it('uploads image via multipart form data with folder=banners', async () => {
      const file = new File(['dummy'], 'test.png', { type: 'image/png' });
      vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        success: true,
        data: { url: '/uploads/banners/uuid.png' },
      } as any);

      const url = await bannerService.uploadBannerImage(file);
      expect(url).toBe('/uploads/banners/uuid.png');
      expect(apiClient.post).toHaveBeenCalledWith(
        'uploads',
        expect.any(FormData),
        { params: { folder: 'banners' } }
      );
    });
  });
});

