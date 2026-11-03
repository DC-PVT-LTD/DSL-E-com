import { describe, it, expect, beforeEach } from 'vitest';
import { productService } from '../productService';

describe('productService', () => {
  beforeEach(() => {
    productService.resetToDefault();
  });

  it('filters products by query search', () => {
    const result = productService.getFilteredAndSorted({ query: 'Chooty' });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].name).toContain('Chooty');
  });

  it('filters products by category and brand', () => {
    const result = productService.getFilteredAndSorted({ category: 'cat-books', brand: 'brand-atlas' });
    expect(result.items.length).toBeGreaterThan(0);
    result.items.forEach((p) => {
      expect(p.categoryId).toBe('cat-books');
      expect(p.brandId).toBe('brand-atlas');
    });
  });

  it('sorts products by price ascending and descending', () => {
    const asc = productService.getFilteredAndSorted({}, 'price_asc');
    for (let i = 0; i < asc.items.length - 1; i++) {
      expect(asc.items[i].priceCents).toBeLessThanOrEqual(asc.items[i + 1].priceCents);
    }

    const desc = productService.getFilteredAndSorted({}, 'price_desc');
    for (let i = 0; i < desc.items.length - 1; i++) {
      expect(desc.items[i].priceCents).toBeGreaterThanOrEqual(desc.items[i + 1].priceCents);
    }
  });

  it('creates and mutates products and propagates updates', () => {
    const created = productService.createProduct({
      name: 'New Test Gel Pen',
      slug: 'new-test-gel-pen',
      sku: 'TEST-GEL-01',
      description: 'Test pen description',
      shortDescription: 'Test pen',
      categoryId: 'cat-pens',
      categoryName: 'Pens & Writing',
      brandId: 'brand-atlas',
      brandName: 'Atlas',
      priceCents: 15000,
      stockQuantity: 50,
      lowStockThreshold: 10,
      isActive: true,
      images: [],
      tags: ['gel pen'],
      rating: 5,
      reviewCount: 0,
      specifications: {},
    });

    expect(created.id).toBeDefined();
    expect(productService.getById(created.id)?.name).toBe('New Test Gel Pen');

    // Update
    productService.updateProduct(created.id, { priceCents: 18000 });
    expect(productService.getById(created.id)?.priceCents).toBe(18000);
  });
});
