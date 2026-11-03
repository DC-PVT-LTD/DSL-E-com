import { describe, it, expect, vi, beforeEach } from 'vitest';
import { brandService } from '../brandService';
import { apiClient } from '@/lib/api/apiClient';

describe('brandService', () => {
  beforeEach(() => {
    brandService.resetToDefault();
    vi.restoreAllMocks();
  });

  it('provides default brands from local dataset', () => {
    const brands = brandService.getBrands();
    expect(brands.length).toBeGreaterThan(0);
    expect(brands.some((b) => b.name.includes('Speed'))).toBe(true);
  });

  it('fetches brands from backend API and updates local store', async () => {
    const apiBrands = [
      {
        id: 'brand-speed',
        name: 'Speed',
        slug: 'speed',
        originCountry: 'Sri Lanka',
        description: 'Quality stationery manufacturer',
      },
      {
        id: 'brand-linc',
        name: 'Linc',
        slug: 'linc',
        originCountry: 'India',
        description: 'Writing instruments',
      },
    ];

    vi.spyOn(apiClient, 'get').mockResolvedValue({
      success: true,
      data: apiBrands,
      meta: {
        page: 1,
        limit: 100,
        totalItems: 2,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    } as any);

    const result = await brandService.fetchBrands();
    expect(result.length).toBe(2);
    expect(result[0].name).toBe('Speed');
    expect(brandService.getBrandBySlug('speed')?.originCountry).toBe('Sri Lanka');
  });

  it('fetches brand details by slug via backend API', async () => {
    const apiBrand = {
      id: 'brand-amigo',
      name: 'Amigo',
      slug: 'amigo',
      originCountry: 'Sri Lanka',
      description: 'Calculators and math instruments',
    };

    vi.spyOn(apiClient, 'get').mockResolvedValue({
      success: true,
      data: apiBrand,
    } as any);

    const brand = await brandService.fetchBrandBySlug('amigo');
    expect(brand).not.toBeNull();
    expect(brand?.name).toBe('Amigo');
  });
});

