import { describe, it, expect, beforeEach } from 'vitest';
import { schoolPackService } from '../schoolPackService';

describe('schoolPackService', () => {
  beforeEach(() => {
    schoolPackService.resetToDefault();
  });

  it('calculates pack bundle discount and total accurately', () => {
    const items = [
      { unitPriceCents: 42000, defaultQuantity: 2 }, // 84000
      { unitPriceCents: 35000, defaultQuantity: 1 }, // 35000
    ];
    // raw total = 119000 cents. 15% discount = 17850 cents. Net = 101150 cents.
    const netTotal = schoolPackService.calculatePackTotal(items, 15);
    expect(netTotal).toBe(101150);
  });

  it('retrieves active packs by grade and id', () => {
    const packs = schoolPackService.getAll();
    expect(packs.length).toBeGreaterThan(0);
    const firstPack = packs[0];
    expect(schoolPackService.getById(firstPack.id)).toBeDefined();
  });
});
