'use client';

import React, { useState, useEffect } from 'react';
import { Award, Plus, Trash2 } from 'lucide-react';
import { categoryService } from '@/services/categoryService';
import { productService } from '@/services/productService';
import { Brand } from '@/types/product';

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [originCountry, setOriginCountry] = useState('Sri Lanka');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadData = () => {
    setBrands(categoryService.getBrands());
  };

  useEffect(() => {
    loadData();
    const unsub = categoryService.subscribe(loadData);
    return () => unsub();
  }, []);

  const handleAddBrand = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Brand name is required');
      return;
    }

    const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
    if (categoryService.getBrandBySlug(slug)) {
      setError('A brand with this name/slug already exists');
      return;
    }

    categoryService.createBrand({
      name: name.trim(),
      slug,
      originCountry,
      description: description.trim() || 'Verified stationery manufacturer',
    });

    setName('');
    setDescription('');
    setIsAdding(false);
  };

  const handleDeleteBrand = (id: string) => {
    const count = productService.getAll(true).filter((p) => p.brandId === id).length;
    if (count > 0) {
      alert(`Cannot delete this brand because ${count} product(s) reference it.`);
      return;
    }
    categoryService.deleteBrand(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Brands Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage partner stationery brands and manufacturers
          </p>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="bg-[#08275E] hover:bg-[#103b8c] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-[#FFD21C]" />
          <span>Add Brand</span>
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAddBrand} className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs text-xs animate-fade-in">
          <h2 className="text-sm font-bold text-slate-900">New Brand</h2>
          {error && <p className="text-rose-600 font-semibold">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Brand Name *</label>
              <input
                type="text"
                placeholder="e.g. Maped"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Country of Origin</label>
              <input
                type="text"
                placeholder="e.g. France / Sri Lanka"
                value={originCountry}
                onChange={(e) => setOriginCountry(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Description</label>
              <input
                type="text"
                placeholder="Brand overview"
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
              Save Brand
            </button>
          </div>
        </form>
      )}

      {/* Brands Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <th className="py-3 px-4 font-bold">Brand Name</th>
              <th className="py-3 px-4 font-bold">Origin</th>
              <th className="py-3 px-4 font-bold">Description</th>
              <th className="py-3 px-4 font-bold text-center">Catalogue Items</th>
              <th className="py-3 px-4 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {brands.map((b) => {
              const productCount = productService.getAll(true).filter((p) => p.brandId === b.id).length;
              return (
                <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">{b.name}</td>
                  <td className="py-3 px-4">
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700">
                      {b.originCountry}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 max-w-sm truncate">{b.description}</td>
                  <td className="py-3 px-4 text-center font-bold text-[#08275E]">
                    {productCount} products
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleDeleteBrand(b.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                      title="Delete brand"
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
