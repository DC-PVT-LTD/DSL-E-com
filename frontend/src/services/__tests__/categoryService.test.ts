import { describe, it, expect, vi, beforeEach } from 'vitest';
import { categoryService } from '../categoryService';
import { apiClient } from '@/lib/api/apiClient';

describe('categoryService', () => {
  beforeEach(() => {
    categoryService.resetToDefault();
    vi.restoreAllMocks();
  });

  it('fetches categories from backend API and updates local store', async () => {
    const apiCategories = [
      {
        id: 'cat-books',
        name: 'Books & Notebooks',
        slug: 'books-and-notebooks',
        description: 'CR books and notebooks',
        itemCount: 15,
        featured: true,
      },
      {
        id: 'cat-pens',
        name: 'Pens & Writing',
        slug: 'pens-and-writing',
        description: 'Writing instruments',
        itemCount: 20,
        featured: true,
      },
    ];

    vi.spyOn(apiClient, 'get').mockResolvedValue({
      success: true,
      data: apiCategories,
      meta: {
        page: 1,
        limit: 100,
        totalItems: 2,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    } as any);

    const result = await categoryService.fetchCategories();
    expect(result.length).toBe(2);
    expect(result[0].name).toBe('Books & Notebooks');
    expect(categoryService.getCategoryBySlug('books-and-notebooks')?.description).toBe('CR books and notebooks');
  });

  it('creates, updates, and deletes category via backend API', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      success: true,
      data: {
        id: 'cat-new-art',
        name: 'Art Supplies',
        slug: 'art-supplies',
        description: 'Paints and sketchbooks',
      },
    } as any);

    const created = await categoryService.createCategoryApi({
      name: 'Art Supplies',
      slug: 'art-supplies',
      description: 'Paints and sketchbooks',
    });

    expect(created.id).toBe('cat-new-art');
    expect(categoryService.getCategoryById('cat-new-art')?.name).toBe('Art Supplies');

    vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
      success: true,
      data: {
        id: 'cat-new-art',
        name: 'Fine Art Supplies',
      },
    } as any);

    const updated = await categoryService.updateCategoryApi('cat-new-art', {
      name: 'Fine Art Supplies',
    });
    expect(updated.name).toBe('Fine Art Supplies');

    vi.spyOn(apiClient, 'delete').mockResolvedValueOnce({
      success: true,
      data: { id: 'cat-new-art' },
    } as any);

    const deleted = await categoryService.deleteCategoryApi('cat-new-art');
    expect(deleted).toBe(true);
    expect(categoryService.getCategoryById('cat-new-art')).toBeUndefined();
  });
});
