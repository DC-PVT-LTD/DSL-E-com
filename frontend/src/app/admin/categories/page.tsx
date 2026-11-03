'use client';

import React, { useState, useEffect } from 'react';
import { Layers, Plus, Edit2, Trash2, Check, AlertCircle } from 'lucide-react';
import { categoryService } from '@/services/categoryService';
import { productService } from '@/services/productService';
import { ProductCategory } from '@/types/product';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadData = () => {
    setCategories(categoryService.getCategories());
  };

  useEffect(() => {
    loadData();
    const unsub = categoryService.subscribe(loadData);
    return () => unsub();
  }, []);

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Category name is required');
      return;
    }

    const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
    if (categoryService.getCategoryBySlug(slug)) {
      setError('A category with this name/slug already exists');
      return;
    }

    categoryService.createCategory({
      name: name.trim(),
      slug,
      description: description.trim() || 'School and office stationery category',
      itemCount: 0,
      featured: false,
    });

    setName('');
    setDescription('');
    setIsAdding(false);
  };

  const handleDeleteCategory = (id: string) => {
    // Check if products reference this category
    const count = productService.getAll(true).filter((p) => p.categoryId === id).length;
    if (count > 0) {
      alert(`Cannot delete this category because ${count} product(s) are currently assigned to it.`);
      return;
    }
    categoryService.deleteCategory(id);
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

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="bg-[#08275E] hover:bg-[#103b8c] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-[#FFD21C]" />
          <span>Add Category</span>
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAddCategory} className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs text-xs animate-fade-in">
          <h2 className="text-sm font-bold text-slate-900">New Category</h2>
          {error && <p className="text-rose-600 font-semibold">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Category Name *</label>
              <input
                type="text"
                placeholder="e.g. Calligraphy &amp; Fountain Inks"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200"
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
              className="bg-[#08275E] text-white font-bold px-5 py-2 rounded-xl"
            >
              Save Category
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
            {categories.map((c) => {
              const productCount = productService.getAll(true).filter((p) => p.categoryId === c.id).length;
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
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                      title="Delete category"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
