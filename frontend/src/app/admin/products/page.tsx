'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Package,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  AlertTriangle,
  RotateCcw,
  FileSpreadsheet,
  Download,
  Boxes,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { productService } from '@/services/productService';
import { categoryService } from '@/services/categoryService';
import { brandService } from '@/services/brandService';
import { Product, ProductCategory, Brand } from '@/types/product';
import { formatLKR } from '@/lib/currency';
import {
  ColumnVisibilityDropdown,
  ColumnDefinition,
  CatalogPagination,
  CatalogFilterToolbar,
  ActiveFilterChip,
  CatalogKpiCards,
  KpiCardData,
  CatalogExportModal,
} from '@/components/admin/catalog';
import { AdminPageAccess } from '@/components/admin/AdminPageAccess';
import { useUserStore } from '@/services/userStore';

interface ProductAnalyticsData {
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
  outOfStock: number;
  lowStock: number;
  healthyStock: number;
  byBrand: Array<{ id: string; name: string; count: number }>;
  byCategory: Array<{ id: string; name: string; count: number }>;
}

const DEFAULT_COLUMNS: ColumnDefinition[] = [
  { id: 'image', label: 'Image', visible: true, locked: true },
  { id: 'product', label: 'Product Name', visible: true, locked: true },
  { id: 'sku', label: 'SKU', visible: true },
  { id: 'id', label: 'Product ID', visible: false },
  { id: 'category', label: 'Category', visible: true },
  { id: 'brand', label: 'Brand', visible: true },
  { id: 'price', label: 'Price (LKR)', visible: true },
  { id: 'stock', label: 'Stock Quantity', visible: true },
  { id: 'stockHealth', label: 'Stock Health', visible: true },
  { id: 'status', label: 'Active Status', visible: true },
  { id: 'createdAt', label: 'Created Date', visible: false },
  { id: 'actions', label: 'Actions', visible: true, locked: true },
];

export default function AdminProductsPage() {
  const hasPermission = useUserStore((state) => state.hasPermission);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [analytics, setAnalytics] = useState<ProductAnalyticsData | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'HEALTHY' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('all');

  // UI state
  const [columns, setColumns] = useState<ColumnDefinition[]>(DEFAULT_COLUMNS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load products from backend with full server-side pagination & multi-filter
  const loadProducts = useCallback(async (targetPage = page, targetLimit = limit) => {
    setIsLoading(true);
    setError(null);
    try {
      const filters: any = {};
      if (searchQuery.trim()) filters.query = searchQuery.trim();
      if (selectedCat !== 'all') filters.category = selectedCat;
      if (selectedBrand !== 'all') filters.brand = selectedBrand;
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (stockStatusFilter !== 'all') filters.stockStatus = stockStatusFilter;

      const res = await productService.fetchProducts(filters, 'newest', targetPage, targetLimit);
      setProducts(res.items);
      setTotal(res.total);
      setPage(res.page);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      console.error('Failed to load products from server:', err);
      setError(err?.message || 'Failed to load products from server');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, searchQuery, selectedCat, selectedBrand, statusFilter, stockStatusFilter]);

  // Load initial dropdowns and analytics
  const loadInitialMetadata = async () => {
    try {
      const [cats, brs, analyticsData] = await Promise.all([
        categoryService.fetchCategories(),
        brandService.fetchBrands(),
        productService.fetchProductAnalytics().catch(() => null),
      ]);
      setCategories(cats);
      setBrands(brs);
      if (analyticsData) {
        setAnalytics(analyticsData);
      }
    } catch (err) {
      console.warn('Metadata fetch error:', err);
    }
  };

  useEffect(() => {
    loadInitialMetadata();
  }, []);

  // Re-fetch products when filters change, resetting to page 1
  useEffect(() => {
    loadProducts(1, limit);
  }, [searchQuery, selectedCat, selectedBrand, statusFilter, stockStatusFilter, limit]);

  // Handlers for pagination
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadProducts(newPage, limit);
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  // Toggle active status
  const handleToggleStatus = async (id: string) => {
    setIsMutating(true);
    setError(null);
    try {
      await productService.toggleProductStatusApi(id);
      await loadProducts(page, limit);
      // Refresh analytics
      productService.fetchProductAnalytics().then(setAnalytics).catch(() => {});
    } catch (err: any) {
      console.error('Failed to toggle product status:', err);
      setError(err?.message || 'Failed to toggle product status');
    } finally {
      setIsMutating(false);
    }
  };

  // Delete product
  const handleDelete = async (id: string) => {
    setIsMutating(true);
    setError(null);
    try {
      await productService.deleteProductApi(id);
      setDeleteConfirmId(null);
      await loadProducts(page, limit);
      productService.fetchProductAnalytics().then(setAnalytics).catch(() => {});
    } catch (err: any) {
      console.error('Failed to delete product:', err);
      setError(err?.message || 'Failed to delete product');
    } finally {
      setIsMutating(false);
    }
  };

  // Handle Export trigger
  const handleExport = async (format: 'csv' | 'xlsx', scope: 'all' | 'selected') => {
    const filters: any = {};
    if (searchQuery.trim()) filters.query = searchQuery.trim();
    if (selectedCat !== 'all') filters.category = selectedCat;
    if (selectedBrand !== 'all') filters.brand = selectedBrand;
    if (statusFilter !== 'all') filters.status = statusFilter;
    if (stockStatusFilter !== 'all') filters.stockStatus = stockStatusFilter;

    const selectedIdsArray = scope === 'selected' ? Array.from(selectedIds) : undefined;
    const blob = await productService.exportProducts(format, filters, selectedIdsArray);

    const timestamp = new Date().toISOString().split('T')[0];
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dsl-products-${timestamp}.${format}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // Multi-row selection
  const handleToggleSelectAll = () => {
    if (selectedIds.size === products.length && products.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    const updated = new Set(selectedIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedIds(updated);
  };

  // Active filter chips
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
    if (selectedCat !== 'all') {
      const catName = categories.find((c) => c.id === selectedCat)?.name || selectedCat;
      chips.push({
        id: 'cat',
        label: 'Category',
        value: catName,
        onRemove: () => setSelectedCat('all'),
      });
    }
    if (selectedBrand !== 'all') {
      const brandName = brands.find((b) => b.id === selectedBrand)?.name || selectedBrand;
      chips.push({
        id: 'brand',
        label: 'Brand',
        value: brandName,
        onRemove: () => setSelectedBrand('all'),
      });
    }
    if (statusFilter !== 'all') {
      chips.push({
        id: 'status',
        label: 'Status',
        value: statusFilter === 'active' ? 'Active' : 'Inactive',
        onRemove: () => setStatusFilter('all'),
      });
    }
    if (stockStatusFilter !== 'all') {
      const map: Record<string, string> = {
        HEALTHY: 'Healthy Stock',
        LOW_STOCK: 'Low Stock Alert',
        OUT_OF_STOCK: 'Out of Stock',
      };
      chips.push({
        id: 'stock',
        label: 'Stock Health',
        value: map[stockStatusFilter] || stockStatusFilter,
        onRemove: () => setStockStatusFilter('all'),
      });
    }
    return chips;
  }, [searchQuery, selectedCat, selectedBrand, statusFilter, stockStatusFilter, categories, brands]);

  const handleClearAllFilters = () => {
    setSearchQuery('');
    setSelectedCat('all');
    setSelectedBrand('all');
    setStatusFilter('all');
    setStockStatusFilter('all');
  };

  // KPI cards definition
  const kpiCards: KpiCardData[] = [
    {
      id: 'total',
      label: 'Total Products',
      value: analytics?.totalProducts ?? total,
      icon: <Boxes className="w-4 h-4" />,
      color: 'blue',
      active: statusFilter === 'all' && stockStatusFilter === 'all',
      onClick: handleClearAllFilters,
    },
    {
      id: 'active',
      label: 'Active Products',
      value: analytics?.activeProducts ?? '-',
      icon: <CheckCircle2 className="w-4 h-4" />,
      color: 'emerald',
      active: statusFilter === 'active',
      onClick: () => {
        setStatusFilter('active');
        setStockStatusFilter('all');
      },
    },
    {
      id: 'inactive',
      label: 'Inactive Products',
      value: analytics?.inactiveProducts ?? '-',
      icon: <EyeOff className="w-4 h-4" />,
      color: 'slate',
      active: statusFilter === 'inactive',
      onClick: () => {
        setStatusFilter('inactive');
        setStockStatusFilter('all');
      },
    },
    {
      id: 'healthy',
      label: 'Healthy Stock',
      value: analytics?.healthyStock ?? '-',
      icon: <ShieldCheck className="w-4 h-4" />,
      color: 'purple',
      active: stockStatusFilter === 'HEALTHY',
      onClick: () => setStockStatusFilter('HEALTHY'),
    },
    {
      id: 'low',
      label: 'Low Stock',
      value: analytics?.lowStock ?? '-',
      icon: <AlertCircle className="w-4 h-4" />,
      color: 'amber',
      active: stockStatusFilter === 'LOW_STOCK',
      onClick: () => setStockStatusFilter('LOW_STOCK'),
    },
    {
      id: 'out',
      label: 'Out of Stock',
      value: analytics?.outOfStock ?? '-',
      icon: <XCircle className="w-4 h-4" />,
      color: 'rose',
      active: stockStatusFilter === 'OUT_OF_STOCK',
      onClick: () => setStockStatusFilter('OUT_OF_STOCK'),
    },
  ];

  // Helper to check column visibility
  const isColVisible = (colId: string) => {
    return columns.find((c) => c.id === colId)?.visible ?? true;
  };

  return (
    <AdminPageAccess permission="products.view" pageTitle="Products Management">
      <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Products Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage stationery catalogue, real-time inventory levels, pricing, categories, and multi-format exports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              loadProducts(page, limit);
              productService.fetchProductAnalytics().then(setAnalytics).catch(() => {});
            }}
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
            title="Export products to CSV or Excel"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Export ({selectedIds.size > 0 ? `${selectedIds.size} Selected` : 'All'})</span>
          </button>

          {hasPermission('products.import') && (
            <Link
              href="/admin/products/import"
              className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-colors"
              title="Import products from Excel (.xlsx) or CSV (.csv)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
              <span>Import</span>
            </Link>
          )}

          {hasPermission('products.create') && (
            <Link
              href="/admin/products/new"
              className="inline-flex items-center gap-1.5 bg-[#08275E] hover:bg-[#103b8c] text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-[#FFD21C]" />
              <span>Add Product</span>
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-center gap-3 text-rose-800 text-xs">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <div className="flex-1 font-medium">{error}</div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 font-bold">
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
        searchPlaceholder="Search by name, SKU, or product ID..."
        activeChips={activeChips}
        onClearAll={handleClearAllFilters}
        totalResults={total}
        rightAction={
          <ColumnVisibilityDropdown
            columns={columns}
            onChange={setColumns}
            storageKey="dsl_admin_products_cols"
          />
        }
      >
        {/* Category Select */}
        <select
          value={selectedCat}
          onChange={(e) => setSelectedCat(e.target.value)}
          aria-label="Filter products by category"
          className="px-2.5 py-2 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Brand Select */}
        <select
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
          aria-label="Filter products by brand"
          className="px-2.5 py-2 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          <option value="all">All Brands</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        {/* Stock Status Select */}
        <select
          value={stockStatusFilter}
          onChange={(e) => setStockStatusFilter(e.target.value as any)}
          aria-label="Filter products by stock status"
          className="px-2.5 py-2 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          <option value="all">All Stock Levels</option>
          <option value="HEALTHY">Healthy Stock</option>
          <option value="LOW_STOCK">Low Stock Alert</option>
          <option value="OUT_OF_STOCK">Out of Stock</option>
        </select>

        {/* Status Select */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          aria-label="Filter products by active status"
          className="px-2.5 py-2 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          <option value="all">All Status</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>
      </CatalogFilterToolbar>

      {/* Products Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.size > 0 && selectedIds.size === products.length}
                    onChange={handleToggleSelectAll}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    title="Select all on this page"
                  />
                </th>
                {isColVisible('image') && <th className="py-3 px-3 font-bold w-12">Image</th>}
                {isColVisible('product') && <th className="py-3 px-3 font-bold">Product</th>}
                {isColVisible('sku') && <th className="py-3 px-3 font-bold">SKU</th>}
                {isColVisible('id') && <th className="py-3 px-3 font-bold">ID</th>}
                {isColVisible('category') && <th className="py-3 px-3 font-bold">Category</th>}
                {isColVisible('brand') && <th className="py-3 px-3 font-bold">Brand</th>}
                {isColVisible('price') && <th className="py-3 px-3 font-bold">Price (LKR)</th>}
                {isColVisible('stock') && <th className="py-3 px-3 font-bold">Stock</th>}
                {isColVisible('stockHealth') && <th className="py-3 px-3 font-bold">Stock Health</th>}
                {isColVisible('status') && <th className="py-3 px-3 font-bold">Status</th>}
                {isColVisible('createdAt') && <th className="py-3 px-3 font-bold">Created</th>}
                {isColVisible('actions') && <th className="py-3 px-4 font-bold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && products.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400">
                    <div className="inline-flex items-center gap-2">
                      <RotateCcw className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Loading products from server...</span>
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <Package className="w-8 h-8 text-slate-300 mb-1" />
                      <p className="font-semibold text-slate-600">No products found</p>
                      <p className="text-[11px] text-slate-400">
                        Try adjusting your filters, or clear all filters to view catalog
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const isSelected = selectedIds.has(p.id);
                  const isLowStock = p.stockQuantity > 0 && p.stockQuantity <= p.lowStockThreshold;
                  const isOutOfStock = p.stockQuantity === 0;

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectOne(p.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>

                      {/* Image Thumbnail */}
                      {isColVisible('image') && (
                        <td className="py-3 px-3">
                          <div className="w-10 h-10 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden relative">
                            {p.images && p.images[0] ? (
                              <Image
                                src={p.images[0]}
                                alt={p.name}
                                width={40}
                                height={40}
                                className="object-contain p-0.5 w-full h-full"
                              />
                            ) : (
                              <Package className="w-5 h-5 text-slate-300" />
                            )}
                          </div>
                        </td>
                      )}

                      {/* Product Name */}
                      {isColVisible('product') && (
                        <td className="py-3 px-3 font-semibold text-slate-900 max-w-xs">
                          <div className="truncate" title={p.name}>
                            {p.name}
                          </div>
                          {p.isFeatured && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                              Featured
                            </span>
                          )}
                        </td>
                      )}

                      {/* SKU */}
                      {isColVisible('sku') && (
                        <td className="py-3 px-3 font-mono text-slate-500 font-medium whitespace-nowrap">
                          {p.sku}
                        </td>
                      )}

                      {/* Product ID */}
                      {isColVisible('id') && (
                        <td className="py-3 px-3 font-mono text-slate-400 text-[10px] truncate max-w-[120px]" title={p.id}>
                          {p.id}
                        </td>
                      )}

                      {/* Category */}
                      {isColVisible('category') && (
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          {p.categoryName || (p as any).category?.name || '-'}
                        </td>
                      )}

                      {/* Brand */}
                      {isColVisible('brand') && (
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          {p.brandName || (p as any).brand?.name || '-'}
                        </td>
                      )}

                      {/* Price */}
                      {isColVisible('price') && (
                        <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                          {formatLKR(p.priceCents)}
                        </td>
                      )}

                      {/* Stock Quantity */}
                      {isColVisible('stock') && (
                        <td className="py-3 px-3">
                          <span
                            className={`font-bold ${
                              isOutOfStock
                                ? 'text-rose-600'
                                : isLowStock
                                ? 'text-amber-600'
                                : 'text-slate-800'
                            }`}
                          >
                            {p.stockQuantity}
                          </span>
                        </td>
                      )}

                      {/* Stock Health Badge */}
                      {isColVisible('stockHealth') && (
                        <td className="py-3 px-3 whitespace-nowrap">
                          {isOutOfStock ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                              Out of Stock
                            </span>
                          ) : isLowStock ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                              Low Stock ({p.lowStockThreshold})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                              Healthy
                            </span>
                          )}
                        </td>
                      )}

                      {/* Active Status Toggle */}
                      {isColVisible('status') && (
                        <td className="py-3 px-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(p.id)}
                            disabled={isMutating}
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase transition-all ${
                              p.isActive
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                            title="Click to toggle active status"
                          >
                            {p.isActive ? (
                              <>
                                <Eye className="w-3 h-3" />
                                <span>Active</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3 h-3" />
                                <span>Hidden</span>
                              </>
                            )}
                          </button>
                        </td>
                      )}

                      {/* Created At */}
                      {isColVisible('createdAt') && (
                        <td className="py-3 px-3 text-slate-400 text-[10px] whitespace-nowrap">
                          {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '-'}
                        </td>
                      )}

                      {/* Actions */}
                      {isColVisible('actions') && (
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {hasPermission('products.edit') && (
                              <Link
                                href={`/admin/products/${p.id}/edit`}
                                className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Edit product"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Link>
                            )}

                            {hasPermission('products.delete') && (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(p.id)}
                                disabled={isMutating}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Delete product"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Server-Side Pagination */}
        <CatalogPagination
          page={page}
          limit={limit}
          total={total}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
          isLoading={isLoading}
        />
      </div>

      {/* Export Modal */}
      <CatalogExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExport}
        title="Export Products Catalog"
        totalFilteredCount={total}
        selectedCount={selectedIds.size}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Confirm Product Deletion</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to deactivate/delete this product? This action will set the product status to inactive.
            </p>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors"
              >
                Delete Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </AdminPageAccess>
  );
}
