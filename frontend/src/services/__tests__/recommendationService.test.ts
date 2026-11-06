import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recommendationService } from '../recommendationService';
import { apiClient } from '@/lib/api/apiClient';

vi.mock('@/lib/api/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('recommendationService (Frontend Client)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches wizard config from backend API', async () => {
    const mockConfig = {
      purposes: [{ id: 'school', name: 'School', description: 'desc' }],
      schoolGrades: ['Grade 1-2'],
      subjects: ['Maths'],
    };
    (apiClient.get as any).mockResolvedValueOnce({ data: mockConfig });

    const result = await recommendationService.getConfig();
    expect(apiClient.get).toHaveBeenCalledWith('/recommendations/config');
    expect(result).toEqual(mockConfig);
  });

  it('posts criteria to generate recommendation response', async () => {
    const mockResponse = {
      purpose: 'school',
      totalEstimatedCents: 45000,
      itemCount: 2,
      isWithinBudget: true,
      items: [],
    };
    (apiClient.post as any).mockResolvedValueOnce({ data: mockResponse });

    const criteria = { purpose: 'school' as const, grade: 'Grade 1-2', budgetLkr: 2000 };
    const result = await recommendationService.getRecommendations(criteria);

    expect(apiClient.post).toHaveBeenCalledWith('/recommendations/generate', criteria);
    expect(result).toEqual(mockResponse);
  });

  it('sends basket items to backend for authoritative validation', async () => {
    const mockValidation = {
      isValid: true,
      totalCents: 15000,
      itemCount: 1,
      items: [],
      warnings: [],
    };
    (apiClient.post as any).mockResolvedValueOnce({ data: mockValidation });

    const items = [{ productId: 'prod-1', quantity: 2, submittedPriceCents: 7500 }];
    const result = await recommendationService.validateBasket(items, 1000);

    expect(apiClient.post).toHaveBeenCalledWith('/recommendations/validate-basket', {
      items,
      budgetLkr: 1000,
    });
    expect(result.isValid).toBe(true);
  });

  it('fetches compatible substitutes for a product', async () => {
    const mockSubs = [
      { id: 'sub-1', name: 'Alt Pen', slug: 'alt-pen', sku: 'ALT-1', priceCents: 2500, stockQuantity: 20 },
    ];
    (apiClient.get as any).mockResolvedValueOnce({ data: mockSubs });

    const result = await recommendationService.getSubstitutes('prod-1');
    expect(apiClient.get).toHaveBeenCalledWith('/recommendations/substitutes/prod-1');
    expect(result).toEqual(mockSubs);
  });

  describe('Admin rule methods', () => {
    it('retrieves admin rules with optional purpose filtering', async () => {
      (apiClient.get as any).mockResolvedValueOnce({ data: [] });
      await recommendationService.getAdminRules('office');
      expect(apiClient.get).toHaveBeenCalledWith('/admin/recommendations/rules?purpose=office');
    });

    it('creates and updates admin rules via backend endpoints', async () => {
      (apiClient.post as any).mockResolvedValueOnce({ data: { id: 'new-rule' } });
      const created = await recommendationService.createAdminRule({ name: 'New Rule' });
      expect(apiClient.post).toHaveBeenCalledWith('/admin/recommendations/rules', { name: 'New Rule' });
      expect(created.id).toBe('new-rule');

      (apiClient.patch as any).mockResolvedValueOnce({ data: { id: 'new-rule', defaultQuantity: 5 } });
      const updated = await recommendationService.updateAdminRule('new-rule', { defaultQuantity: 5 });
      expect(apiClient.patch).toHaveBeenCalledWith('/admin/recommendations/rules/new-rule', { defaultQuantity: 5 });
      expect(updated.defaultQuantity).toBe(5);
    });

    it('toggles rule status and deletes rules', async () => {
      (apiClient.patch as any).mockResolvedValueOnce({ data: { id: 'rule-1', isActive: false } });
      await recommendationService.toggleAdminRule('rule-1', false);
      expect(apiClient.patch).toHaveBeenCalledWith('/admin/recommendations/rules/rule-1/toggle', { isActive: false });

      (apiClient.delete as any).mockResolvedValueOnce({ data: { success: true } });
      await recommendationService.deleteAdminRule('rule-1');
      expect(apiClient.delete).toHaveBeenCalledWith('/admin/recommendations/rules/rule-1');
    });
  });
});

