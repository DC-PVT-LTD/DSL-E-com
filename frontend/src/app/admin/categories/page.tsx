'use client';

import React, { useState, useEffect } from 'react';
import { Layers, Plus, Edit2, Trash2, Check, AlertCircle, RotateCcw } from 'lucide-react';
import { categoryService } from '@/services/categoryService';
import { productService } from '@/services/productService';
import { ProductCategory, Product } from '@/types/product';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [cats, prodRes] = await Promise.all([
        categoryService.fetchCategories(),
        productService.fetchProducts({}, 'newest', 1, 100),
      ]);
      setCategories(cats);
      setProducts(prodRes.items);
    } catch (err: any) {
      console.error('Failed to load categories:', err);
      setError(err?.message || 'Failed to load categories from server');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = categoryService.subscribe(() => {
      setCategories(categoryService.getCategories());
    });
    return () => unsub();
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Category name is required');
      return;
    }

    const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
    setIsMutating(true);

    try {
      await categoryService.createCategoryApi({
        name: name.trim(),
        slug,
        description: description.trim() || 'School and office stationery category',
        featured: false,
      });

      setName('');
      setDescription('');
      setIsAdding(false);
      await loadData();
    } catch (err: any) {
      console.error('Failed to create category:', err);
      setError(err?.message || 'Failed to create category on server');
    } finally {
      setIsMutating(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate/delete this category?')) return;
    setIsMutating(true);
    setError(null);

    try {
      await categoryService.deleteCategoryApi(id);
      await loadData();
    } catch (err: any) {
      console.error('Failed to delete category:', err);
      setError(err?.message || 'Failed to delete category on server');
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Categories Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Organize stationery items into departments (CR books, writing pens, paper, art supplies)
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={loadData}
            disabled={isLoading || isMutating}
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-2.5 rounded-xl transition-colors disabled:opacity-50"
            title="Refresh from server"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="bg-[#08275E] hover:bg-[#103b8c] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 text-[#FFD21C]" />
            <span>Add Category</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex items-center gap-3 text-rose-800 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <div className="flex-1 font-medium">{error}</div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 font-bold">Dismiss</button>
        </div>
      )}

      {isAdding && (
        <form onSubmit={handleAddCategory} className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs text-xs animate-fade-in">
          <h2 className="text-sm font-bold text-slate-900">New Category</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Category Name *</label>
              <input
                type="text"
                placeholder="e.g. Calligraphy &amp; Fountain Inks"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200"
                required
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Description</label>
              <input
                type="text"
                placeholder="Brief description for customer shop"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isMutating}
              className="bg-[#08275E] text-white font-bold px-5 py-2 rounded-xl disabled:opacity-50"
            >
              {isMutating ? 'Saving...' : 'Save Category'}
            </button>
          </div>
        </form>
      )}

      {/* Categories Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <th className="py-3 px-4 font-bold">Category Name</th>
              <th className="py-3 px-4 font-bold">Slug</th>
              <th className="py-3 px-4 font-bold">Description</th>
              <th className="py-3 px-4 font-bold text-center">Products</th>
              <th className="py-3 px-4 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && categories.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400">
                  <div className="inline-flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 animate-spin text-[#08275E]" />
                    <span>Loading categories from server...</span>
                  </div>
                </td>
              </tr>
            ) : categories.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400">
                  No categories found. Click &quot;Add Category&quot; to create one.
                </td>
              </tr>
            ) : (
              categories.map((c) => {
                const productCount = products.filter((p) => p.categoryId === c.id).length;
                return (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{c.name}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{c.slug}</td>
                    <td className="py-3 px-4 text-slate-600 max-w-sm truncate">{c.description}</td>
                    <td className="py-3 px-4 text-center font-bold text-[#08275E]">
                      <span className="bg-blue-50 px-2 py-0.5 rounded-full">{productCount} items</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteCategory(c.id)}
                        disabled={isMutating}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors disabled:opacity-40"
                        title="Delete category"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
