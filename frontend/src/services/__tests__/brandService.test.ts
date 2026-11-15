import { describe, it, expect, vi, beforeEach } from 'vitest';
import { brandService } from '../brandService';
import { apiClient } from '@/lib/api/apiClient';
import { INITIAL_BRANDS } from '@/mocks/brands';

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

    // 1. Exact count: 13 default items with 2 merged/updated items
    expect(result.length).toBe(INITIAL_BRANDS.length);

    // 2. Strict uniqueness verification across IDs and Slugs
    const uniqueIds = new Set(result.map((b) => b.id));
    expect(uniqueIds.size).toBe(result.length);
    const uniqueSlugs = new Set(result.map((b) => b.slug));
    expect(uniqueSlugs.size).toBe(result.length);

    // 3. Expected API-fetched records and API-over-default override behavior
    const speed = result.find((b) => b.slug === 'speed');
    expect(speed).toBeDefined();
    expect(speed?.name).toBe('Speed');
    expect(speed?.description).toBe('Quality stationery manufacturer');
    expect(speed?.originCountry).toBe('Sri Lanka');

    const linc = result.find((b) => b.slug === 'linc');
    expect(linc).toBeDefined();
    expect(linc?.name).toBe('Linc');
    expect(linc?.description).toBe('Writing instruments');
    expect(linc?.originCountry).toBe('India');

    // 4. Preservation of non-overridden default brands
    const doms = result.find((b) => b.slug === 'doms');
    expect(doms).toBeDefined();
    expect(doms?.name).toBe('Doms');

    // 5. Query helpers return accurate entity attributes
    expect(brandService.getBrandBySlug('speed')?.originCountry).toBe('Sri Lanka');
    expect(brandService.getBrandBySlug('linc')?.originCountry).toBe('India');
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

  it('creates, updates, and deletes brand via backend API', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      success: true,
      data: {
        id: 'brand-natraj',
        name: 'Natraj',
        slug: 'natraj',
        originCountry: 'India',
        description: 'Pencils and erasers',
      },
    } as any);

    const created = await brandService.createBrandApi({
      name: 'Natraj',
      slug: 'natraj',
      originCountry: 'India',
      description: 'Pencils and erasers',
    });

    expect(created.id).toBe('brand-natraj');
    expect(brandService.getBrandById('brand-natraj')?.name).toBe('Natraj');

    vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
      success: true,
      data: {
        id: 'brand-natraj',
        name: 'Natraj Deluxe',
      },
    } as any);

    const updated = await brandService.updateBrandApi('brand-natraj', {
      name: 'Natraj Deluxe',
    });
    expect(updated.name).toBe('Natraj Deluxe');

    vi.spyOn(apiClient, 'delete').mockResolvedValueOnce({
      success: true,
      data: { id: 'brand-natraj' },
    } as any);

    const deleted = await brandService.deleteBrandApi('brand-natraj');
    expect(deleted).toBe(true);
    expect(brandService.getBrandById('brand-natraj')).toBeUndefined();
  });
});

