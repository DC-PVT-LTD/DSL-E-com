import { describe, it, expect, vi, beforeEach } from 'vitest';
import { schoolPackService } from '../schoolPackService';
import { apiClient } from '@/lib/api/apiClient';

vi.mock('@/lib/api/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('schoolPackService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retrieves config from API', async () => {
    const mockConfig = {
      gradeGroups: ['Grade 1-2', 'Grade 3-5'],
      tiers: ['essential', 'standard'],
    };
    (apiClient.get as any).mockResolvedValueOnce({ data: mockConfig });

    const config = await schoolPackService.getConfig();
    expect(apiClient.get).toHaveBeenCalledWith('/school-packs/config/grades-tiers');
    expect(config.gradeGroups).toEqual(mockConfig.gradeGroups);
  });

  it('retrieves active packs with filters', async () => {
    const mockPacks = [
      {
        id: 'pack-1',
        name: 'Grade 1-2 Pack',
        grade: 'Grade 1-2',
        tier: 'essential',
        savingsPercentage: 10,
        totalPriceCents: 95000,
        items: [],
      },
    ];
    (apiClient.get as any).mockResolvedValueOnce({
      data: mockPacks,
      meta: { totalItems: 1 },
    });

    const res = await schoolPackService.getPacks({ grade: 'Grade 1-2', tier: 'essential' });
    expect(apiClient.get).toHaveBeenCalledWith('/school-packs', {
      params: { grade: 'Grade 1-2', tier: 'essential' },
    });
    expect(res.items.length).toBe(1);
    expect(res.items[0].name).toBe('Grade 1-2 Pack');
  });

  it('fetches pack by id or slug', async () => {
    const mockPack = {
      id: 'pack-abc',
      name: 'Grade 6-9 Pack',
      slug: 'grade-6-9-pack',
      totalPriceCents: 120000,
    };
    (apiClient.get as any).mockResolvedValueOnce({ data: mockPack });

    const pack = await schoolPackService.getPackById('grade-6-9-pack');
    expect(apiClient.get).toHaveBeenCalledWith('/school-packs/grade-6-9-pack');
    expect(pack?.name).toBe('Grade 6-9 Pack');
  });

  it('calls server calculate endpoint for customized items', async () => {
    const mockCalculated = {
      packId: 'pack-1',
      packName: 'Grade 1-2 Pack',
      calculatedOriginalSubtotalCents: 100000,
      calculatedSavingsCents: 10000,
      calculatedTotalCents: 90000,
      allInStock: true,
      items: [],
    };
    (apiClient.post as any).mockResolvedValueOnce({ data: mockCalculated });

    const result = await schoolPackService.calculateCustomized('pack-1', [
      { productId: 'prod-1', variantId: null, quantity: 2 },
    ]);
    expect(apiClient.post).toHaveBeenCalledWith('/school-packs/pack-1/calculate', {
      items: [{ productId: 'prod-1', variantId: null, quantity: 2 }],
    });
    expect(result?.calculatedTotalCents).toBe(90000);
  });

  it('creates a new school pack via admin endpoint', async () => {
    const newPackData = {
      name: 'New Bundle',
      grade: 'Grade 1-2',
      tier: 'essential',
      description: 'Desc',
      savingsPercentage: 10,
      items: [{ productId: 'p1', defaultQuantity: 2 }],
    };
    (apiClient.post as any).mockResolvedValueOnce({ data: { id: 'pack-created', ...newPackData } });

    const created = await schoolPackService.createPack(newPackData);
    expect(apiClient.post).toHaveBeenCalledWith('/admin/school-packs', newPackData);
    expect(created.id).toBe('pack-created');
  });
});
