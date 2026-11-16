'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Award,
  Plus,
  Trash2,
  RotateCcw,
  AlertCircle,
  Search,
  Download,
  Package,
  Globe,
  Tag,
  Check,
  X,
  Boxes,
} from 'lucide-react';
import { brandService } from '@/services/brandService';
import { Brand } from '@/types/product';
import {
  ColumnVisibilityDropdown,
  ColumnDefinition,
  CatalogFilterToolbar,
  ActiveFilterChip,
  CatalogKpiCards,
  KpiCardData,
  CatalogExportModal,
} from '@/components/admin/catalog';
import { AdminPageAccess } from '@/components/admin/AdminPageAccess';
import { useUserStore } from '@/services/userStore';

interface BrandAnalyticsData {
  totalBrands: number;
  featuredBrands: number;
  brandsWithProducts: number;
  emptyBrands: number;
  topBrands: Array<{ id: string; name: string; count: number }>;
}

const DEFAULT_BRAND_COLUMNS: ColumnDefinition[] = [
  { id: 'brand', label: 'Brand Name', visible: true, locked: true },
  { id: 'id', label: 'Brand ID', visible: false },
  { id: 'slug', label: 'Slug', visible: true },
  { id: 'origin', label: 'Origin Country', visible: true },
  { id: 'products', label: 'Product Count', visible: true },
  { id: 'featured', label: 'Featured', visible: true },
  { id: 'description', label: 'Description', visible: true },
  { id: 'createdAt', label: 'Created Date', visible: false },
  { id: 'actions', label: 'Actions', visible: true, locked: true },
];

export default function AdminBrandsPage() {
  const hasPermission = useUserStore((state) => state.hasPermission);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [analytics, setAnalytics] = useState<BrandAnalyticsData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [featuredFilter, setFeaturedFilter] = useState<'all' | 'featured' | 'standard'>('all');
  const [productFilter, setProductFilter] = useState<'all' | 'with_products' | 'empty'>('all');

  const [isAdding, setIsAdding] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [columns, setColumns] = useState<ColumnDefinition[]>(DEFAULT_BRAND_COLUMNS);

  const [name, setName] = useState('');
  const [originCountry, setOriginCountry] = useState('Sri Lanka');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [brs, analyticsData] = await Promise.all([
        brandService.fetchBrands(),
        brandService.fetchBrandAnalytics().catch(() => null),
      ]);
      setBrands(brs);
      if (analyticsData) setAnalytics(analyticsData);
    } catch (err: any) {
      console.error('Failed to load brands from server:', err);
      setError(err?.message || 'Failed to load brands from server');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
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
      setSuccessMsg(`Brand "${name}" added successfully`);
      await loadData();
    } catch (err: any) {
      console.error('Failed to create brand:', err);
      setError(err?.message || 'Failed to create brand on server');
    } finally {
      setIsMutating(false);
    }
  };

  const handleDeleteBrand = async (id: string, brandName: string, productCount = 0) => {
    if (productCount > 0) {
      setError(`Cannot delete "${brandName}": it is referenced by ${productCount} existing product(s).`);
      return;
    }

    if (!confirm(`Are you sure you want to deactivate/delete brand "${brandName}"?`)) return;
    setIsMutating(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await brandService.deleteBrandApi(id);
      setSuccessMsg(`Brand "${brandName}" deleted successfully`);
      await loadData();
    } catch (err: any) {
      console.error('Failed to delete brand:', err);
      setError(err?.message || 'Failed to delete brand on server');
    } finally {
      setIsMutating(false);
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    const blob = await brandService.exportBrands(format);
    const timestamp = new Date().toISOString().split('T')[0];
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dsl-brands-${timestamp}.${format}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // Filtered brands
  const filteredBrands = useMemo(() => {
    return brands.filter((b) => {
      const prodCount = (b as any).itemCount ?? (b as any)._count?.products ?? 0;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          b.name.toLowerCase().includes(q) ||
          b.slug.toLowerCase().includes(q) ||
          b.originCountry.toLowerCase().includes(q) ||
          (b.description && b.description.toLowerCase().includes(q)) ||
          b.id.toLowerCase().includes(q);
        if (!matches) return false;
      }

      if (featuredFilter === 'featured' && !b.featured) return false;
      if (featuredFilter === 'standard' && b.featured) return false;

      if (productFilter === 'with_products' && prodCount === 0) return false;
      if (productFilter === 'empty' && prodCount > 0) return false;

      return true;
    });
  }, [brands, searchQuery, featuredFilter, productFilter]);

  // Active chips
  const activeChips: ActiveFilterChip[] = useMemo(() => {
    const chips: ActiveFilterChip[] = [];
    if (searchQuery.trim()) {
      chips.push({
        id: 'search',
        label: 'Search',
        value: searchQuery.trim(),
        onRemove: () => setSearchQuery(''),
      });
    }
    if (featuredFilter !== 'all') {
      chips.push({
        id: 'featured',
        label: 'Featured',
        value: featuredFilter === 'featured' ? 'Featured Brands' : 'Standard Brands',
        onRemove: () => setFeaturedFilter('all'),
      });
    }
    if (productFilter !== 'all') {
      chips.push({
        id: 'products',
        label: 'Products',
        value: productFilter === 'with_products' ? 'With Products' : 'Empty Brands',
        onRemove: () => setProductFilter('all'),
      });
    }
    return chips;
  }, [searchQuery, featuredFilter, productFilter]);

  const handleClearAllFilters = () => {
    setSearchQuery('');
    setFeaturedFilter('all');
    setProductFilter('all');
  };

  // KPI cards
  const kpiCards: KpiCardData[] = [
    {
      id: 'total',
      label: 'Total Brands',
      value: analytics?.totalBrands ?? brands.length,
      icon: <Award className="w-4 h-4" />,
      color: 'blue',
      active: featuredFilter === 'all' && productFilter === 'all',
      onClick: handleClearAllFilters,
    },
    {
      id: 'featured',
      label: 'Featured Brands',
      value: analytics?.featuredBrands ?? brands.filter((b) => b.featured).length,
      icon: <Tag className="w-4 h-4" />,
      color: 'purple',
      active: featuredFilter === 'featured',
      onClick: () => setFeaturedFilter('featured'),
    },
    {
      id: 'with_prod',
      label: 'With Products',
      value: analytics?.brandsWithProducts ?? '-',
      icon: <Boxes className="w-4 h-4" />,
      color: 'emerald',
      active: productFilter === 'with_products',
      onClick: () => setProductFilter('with_products'),
    },
    {
      id: 'empty',
      label: 'Empty Brands',
      value: analytics?.emptyBrands ?? '-',
      icon: <AlertCircle className="w-4 h-4" />,
      color: 'amber',
      active: productFilter === 'empty',
      onClick: () => setProductFilter('empty'),
    },
  ];

  const isColVisible = (colId: string) => {
    return columns.find((c) => c.id === colId)?.visible ?? true;
  };

  return (
    <AdminPageAccess permission="brands.view" pageTitle="Brands Management">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Brands Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage partner stationery brands, manufacturers, origin countries, and linked catalogue items.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading || isMutating}
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
            title="Refresh from server"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs px-3 py-2 rounded-xl border border-slate-300 transition-colors shadow-xs"
            title="Export brands to CSV or Excel"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Export</span>
          </button>

          {hasPermission('brands.create') && (
            <button
              type="button"
              onClick={() => setIsAdding(!isAdding)}
              className="inline-flex items-center gap-1.5 bg-[#08275E] hover:bg-[#103b8c] text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-[#FFD21C]" />
              <span>Add Brand</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-center gap-3 text-rose-800 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <div className="flex-1 font-medium">{error}</div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 font-bold">
            Dismiss
          </button>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center gap-3 text-emerald-800 text-xs">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <div className="flex-1 font-medium">{successMsg}</div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <CatalogKpiCards cards={kpiCards} isLoading={isLoading && !analytics} />

      {/* Filter and Search Toolbar */}
      <CatalogFilterToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search brand name, slug, origin country, or ID..."
        activeChips={activeChips}
        onClearAll={handleClearAllFilters}
        totalResults={filteredBrands.length}
        rightAction={
          <ColumnVisibilityDropdown
            columns={columns}
            onChange={setColumns}
            storageKey="dsl_admin_brands_cols"
          />
        }
      >
        <select
          value={featuredFilter}
          onChange={(e) => setFeaturedFilter(e.target.value as any)}
          className="px-2.5 py-2 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          <option value="all">All Brand Tiers</option>
          <option value="featured">Featured Brands</option>
          <option value="standard">Standard Brands</option>
        </select>

        <select
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value as any)}
          className="px-2.5 py-2 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          <option value="all">All Product Counts</option>
          <option value="with_products">Brands With Products</option>
          <option value="empty">Empty Brands</option>
        </select>
      </CatalogFilterToolbar>

      {/* Add Brand Inline Form */}
      {isAdding && (
        <form
          onSubmit={handleAddBrand}
          className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm text-xs animate-in fade-in"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Add New Stationery Brand</h2>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Brand Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Atlas, Doms, Speed"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Origin Country</label>
              <input
                type="text"
                value={originCountry}
                onChange={(e) => setOriginCountry(e.target.value)}
                placeholder="e.g. Sri Lanka, India, Japan"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief manufacturer info..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isMutating}
              className="px-5 py-2 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
            >
              {isMutating ? 'Saving...' : 'Save Brand'}
            </button>
          </div>
        </form>
      )}

      {/* Brands Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                {isColVisible('brand') && <th className="py-3 px-4 font-bold">Brand Name</th>}
                {isColVisible('id') && <th className="py-3 px-3 font-bold">Brand ID</th>}
                {isColVisible('slug') && <th className="py-3 px-3 font-bold">Slug</th>}
                {isColVisible('origin') && <th className="py-3 px-3 font-bold">Origin Country</th>}
                {isColVisible('products') && <th className="py-3 px-3 font-bold">Products</th>}
                {isColVisible('featured') && <th className="py-3 px-3 font-bold">Featured</th>}
                {isColVisible('description') && <th className="py-3 px-3 font-bold">Description</th>}
                {isColVisible('createdAt') && <th className="py-3 px-3 font-bold">Created</th>}
                {isColVisible('actions') && <th className="py-3 px-4 font-bold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && brands.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="inline-flex items-center gap-2">
                      <RotateCcw className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Loading brands from server...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredBrands.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <Award className="w-8 h-8 text-slate-300 mb-1" />
                      <p className="font-semibold text-slate-600">No brands match your filters</p>
                      <p className="text-[11px] text-slate-400">Try adjusting your search criteria</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredBrands.map((b) => {
                  const prodCount = (b as any).itemCount ?? (b as any)._count?.products ?? 0;

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                      {isColVisible('brand') && (
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-black text-xs">
                              {b.name.charAt(0)}
                            </div>
                            <span>{b.name}</span>
                          </div>
                        </td>
                      )}

                      {isColVisible('id') && (
                        <td className="py-3.5 px-3 font-mono text-[10px] text-slate-400 truncate max-w-[120px]" title={b.id}>
                          {b.id}
                        </td>
                      )}

                      {isColVisible('slug') && (
                        <td className="py-3.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                          {b.slug}
                        </td>
                      )}

                      {isColVisible('origin') && (
                        <td className="py-3.5 px-3 whitespace-nowrap text-slate-700">
                          <span className="inline-flex items-center gap-1">
                            <Globe className="w-3 h-3 text-slate-400" />
                            <span>{b.originCountry}</span>
                          </span>
                        </td>
                      )}

                      {isColVisible('products') && (
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                              prodCount > 0
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {prodCount} products
                          </span>
                        </td>
                      )}

                      {isColVisible('featured') && (
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {b.featured ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              Featured
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">Standard</span>
                          )}
                        </td>
                      )}

                      {isColVisible('description') && (
                        <td className="py-3.5 px-3 text-slate-500 max-w-xs truncate" title={b.description}>
                          {b.description || '-'}
                        </td>
                      )}

                      {isColVisible('createdAt') && (
                        <td className="py-3.5 px-3 text-slate-400 text-[10px] whitespace-nowrap">
                          {b.createdAt ? new Date(b.createdAt).toLocaleDateString() : '-'}
                        </td>
                      )}

                      {isColVisible('actions') && (
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {hasPermission('brands.delete') && (
                            <button
                              type="button"
                              onClick={() => handleDeleteBrand(b.id, b.name, prodCount)}
                              disabled={isMutating}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete brand"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export Modal */}
      <CatalogExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExport}
        title="Export Brands Dataset"
        totalFilteredCount={filteredBrands.length}
      />
    </div>
    </AdminPageAccess>
  );
}
