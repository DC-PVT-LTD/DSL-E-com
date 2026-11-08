import { describe, it, expect, beforeEach, vi } from 'vitest';
import { productService } from '../productService';
import { apiClient } from '@/lib/api/apiClient';

describe('productService', () => {
  beforeEach(() => {
    productService.resetToDefault();
  });

  it('filters products by query search', () => {
    const result = productService.getFilteredAndSorted({ query: 'SPEED' });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].name.toUpperCase()).toContain('SPEED');
  });

  it('filters products by category and brand', () => {
    const result = productService.getFilteredAndSorted({ category: 'cat-pens', brand: 'brand-speed' });
    expect(result.items.length).toBeGreaterThan(0);
    result.items.forEach((p) => {
      expect(p.categoryId).toBe('cat-pens');
      expect(p.brandId).toBe('brand-speed');
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

  describe('variant management API methods', () => {
    it('creates a variant and increments aggregate product stock', async () => {
      const product = productService.getAll()[0];
      const initialStock = product.stockQuantity;

      vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        success: true,
        data: {
          id: 'var-test-1',
          productId: product.id,
          name: 'Blue 0.7mm',
          sku: 'TEST-VAR-BL',
          priceCents: 6500,
          stockQuantity: 15,
        },
      } as any);

      const created = await productService.createVariant(product.id, {
        name: 'Blue 0.7mm',
        sku: 'TEST-VAR-BL',
        priceCents: 6500,
        stockQuantity: 15,
      });

      expect(created.id).toBe('var-test-1');
      const updatedProd = productService.getById(product.id);
      expect(updatedProd?.stockQuantity).toBe(initialStock + 15);
      expect(updatedProd?.variants?.some((v) => v.id === 'var-test-1')).toBe(true);
    });

    it('fetches variants from API and caches in product', async () => {
      const product = productService.getAll()[0];

      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        success: true,
        data: [
          {
            id: 'var-1',
            productId: product.id,
            name: 'Single Line',
            sku: 'VAR-SL',
            priceCents: 5000,
            stockQuantity: 10,
          },
        ],
      } as any);

      const variants = await productService.fetchVariants(product.id);
      expect(variants).toHaveLength(1);
      expect(productService.getById(product.id)?.variants).toHaveLength(1);
    });

    it('updates variant in product cache', async () => {
      const product = productService.getAll()[0];
      productService.updateProduct(product.id, {
        variants: [
          {
            id: 'var-1',
            productId: product.id,
            name: 'Single Line',
            sku: 'VAR-SL',
            priceCents: 5000,
            stockQuantity: 10,
            attributes: {},
          } as any,
        ],
      });

      vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        success: true,
        data: {
          id: 'var-1',
          name: 'Single Line Deluxe',
          priceCents: 5500,
        },
      } as any);

      const updated = await productService.updateVariant(product.id, 'var-1', {
        name: 'Single Line Deluxe',
        priceCents: 5500,
      });

      expect(updated.name).toBe('Single Line Deluxe');
      const cached = productService.getById(product.id);
      expect(cached?.variants?.[0].name).toBe('Single Line Deluxe');
    });

    it('deletes variant from product cache', async () => {
      const product = productService.getAll()[0];
      productService.updateProduct(product.id, {
        variants: [
          {
            id: 'var-del',
            productId: product.id,
            name: 'To Delete',
            sku: 'VAR-DEL',
            priceCents: 5000,
            stockQuantity: 5,
            attributes: {},
          } as any,
        ],
      });

      vi.spyOn(apiClient, 'delete').mockResolvedValueOnce({
        success: true,
      } as any);

      const ok = await productService.deleteVariant(product.id, 'var-del');
      expect(ok).toBe(true);
      expect(productService.getById(product.id)?.variants?.length).toBe(0);
    });
  });

  describe('backend product API CRUD methods', () => {
    it('creates product via backend API', async () => {
      vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        success: true,
        data: {
          id: 'prod-api-1',
          name: 'API Created Book',
          sku: 'API-BK-01',
          priceCents: 25000,
          stockQuantity: 100,
          isActive: true,
        },
      } as any);

      const created = await productService.createProductApi({
        name: 'API Created Book',
        sku: 'API-BK-01',
        priceCents: 25000,
      });

      expect(created.id).toBe('prod-api-1');
      expect(productService.getById('prod-api-1')?.name).toBe('API Created Book');
    });

    it('updates product via backend API', async () => {
      vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        success: true,
        data: {
          id: 'prod-api-1',
          name: 'API Updated Book',
          priceCents: 27500,
        },
      } as any);

      const updated = await productService.updateProductApi('prod-api-1', {
        name: 'API Updated Book',
        priceCents: 27500,
      });

      expect(updated.name).toBe('API Updated Book');
    });

    it('toggles product status via backend API', async () => {
      vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        success: true,
        data: {
          id: 'prod-api-1',
          isActive: false,
        },
      } as any);

      const res = await productService.toggleProductStatusApi('prod-api-1');
      expect(res.isActive).toBe(false);
    });

    it('deletes product via backend API', async () => {
      vi.spyOn(apiClient, 'delete').mockResolvedValueOnce({
        success: true,
        data: { id: 'prod-api-1' },
      } as any);

      const ok = await productService.deleteProductApi('prod-api-1');
      expect(ok).toBe(true);
      expect(productService.getById('prod-api-1')).toBeUndefined();
    });

    it('uploads and previews Excel/CSV product import without mutating data', async () => {
      const mockResult = {
        summary: {
          totalRows: 2,
          validRows: 2,
          invalidRows: 0,
          warningRows: 0,
          duplicateRows: 0,
          existingRows: 0,
          newProducts: 2,
          newVariants: 0,
        },
        rows: [
          {
            rowNumber: 2,
            sku: 'DSL-TEST-001',
            proposedSku: 'DSL-TEST-001',
            name: 'Test Product 1',
            categoryName: 'Writing Instruments',
            brandName: 'Atlas',
            sellingPrice: 60,
            stockQuantity: 100,
            status: 'VALID',
            isExisting: false,
            errors: [],
            warnings: [],
          },
        ],
        fileName: 'test.csv',
        fileSizeBytes: 200,
        parsedAt: '2026-11-08T10:00:00.000Z',
      };

      vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        success: true,
        data: mockResult,
      } as any);

      const file = new File(['dummy content'], 'test.csv', { type: 'text/csv' });
      const preview = await productService.uploadImportPreview(file);

      expect(preview.summary.totalRows).toBe(2);
      expect(preview.summary.validRows).toBe(2);
      expect(preview.rows[0].status).toBe('VALID');
      expect(apiClient.post).toHaveBeenCalledWith('products/import/preview', expect.any(FormData));
    });

    it('downloads import template for excel and csv', async () => {
      const mockBlob = new Blob(['sample-template-content'], { type: 'text/csv' });
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        blob: vi.fn().mockResolvedValueOnce(mockBlob),
      } as any);

      const blob = await productService.downloadImportTemplate('csv');
      expect(blob).toBeDefined();
      expect(fetchSpy).toHaveBeenCalled();
    });

    it('downloads error report for invalid preview rows', async () => {
      const mockBlob = new Blob(['error-report-content'], { type: 'text/csv' });
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        blob: vi.fn().mockResolvedValueOnce(mockBlob),
      } as any);

      const blob = await productService.downloadErrorReport([], 'csv');
      expect(blob).toBeDefined();
      expect(fetchSpy).toHaveBeenCalled();
    });
  });
});
