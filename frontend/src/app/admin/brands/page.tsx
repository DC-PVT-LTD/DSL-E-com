'use client';

import React, { useState, useEffect } from 'react';
import { Award, Plus, Trash2, RotateCcw, AlertCircle } from 'lucide-react';
import { brandService } from '@/services/brandService';
import { productService } from '@/services/productService';
import { Brand, Product } from '@/types/product';

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [originCountry, setOriginCountry] = useState('Sri Lanka');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [brs, prodRes] = await Promise.all([
        brandService.fetchBrands(),
        productService.fetchProducts({}, 'newest', 1, 100),
      ]);
      setBrands(brs);
      setProducts(prodRes.items);
    } catch (err: any) {
      console.error('Failed to load brands from server:', err);
      setError(err?.message || 'Failed to load brands from server');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = brandService.subscribe(() => {
      setBrands(brandService.getBrands());
    });
    return () => unsub();
  }, []);

  const handleAddBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Brand name is required');
      return;
    }

    const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
    setIsMutating(true);

    try {
      await brandService.createBrandApi({
        name: name.trim(),
        slug,
        originCountry: originCountry.trim() || 'Sri Lanka',
        description: description.trim() || 'Verified stationery manufacturer',
        featured: false,
      });

      setName('');
      setDescription('');
      setIsAdding(false);
      await loadData();
    } catch (err: any) {
      console.error('Failed to create brand:', err);
      setError(err?.message || 'Failed to create brand on server');
    } finally {
      setIsMutating(false);
    }
  };

  const handleDeleteBrand = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate/delete this brand?')) return;
    setIsMutating(true);
    setError(null);

    try {
      await brandService.deleteBrandApi(id);
      await loadData();
    } catch (err: any) {
      console.error('Failed to delete brand:', err);
      setError(err?.message || 'Failed to delete brand on server');
    } finally {
      setIsMutating(false);
    }
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
            <span>Add Brand</span>
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
        <form onSubmit={handleAddBrand} className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs text-xs animate-fade-in">
          <h2 className="text-sm font-bold text-slate-900">New Brand</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Brand Name *</label>
              <input
                type="text"
                placeholder="e.g. Maped"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200"
                required
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
              disabled={isMutating}
              className="bg-[#08275E] text-white font-bold px-5 py-2 rounded-xl disabled:opacity-50"
            >
              {isMutating ? 'Saving...' : 'Save Brand'}
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
            {isLoading && brands.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400">
                  <div className="inline-flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 animate-spin text-[#08275E]" />
                    <span>Loading brands from server...</span>
                  </div>
                </td>
              </tr>
            ) : brands.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400">
                  No brands found. Click &quot;Add Brand&quot; to create one.
                </td>
              </tr>
            ) : (
              brands.map((b) => {
                const productCount = products.filter((p) => p.brandId === b.id).length;
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
                        disabled={isMutating}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors disabled:opacity-40"
                        title="Delete brand"
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
