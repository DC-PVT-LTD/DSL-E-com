'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Check,
  AlertCircle,
  RotateCcw,
  Search,
  CornerDownRight,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  X,
  Download,
  Boxes,
  ChevronsUpDown,
  Tag,
  Package,
} from 'lucide-react';
import { categoryService } from '@/services/categoryService';
import { ProductCategory } from '@/types/product';
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

interface CategoryFormData {
  id?: string;
  name: string;
  slug: string;
  description: string;
  parentId: string; // '' means root category
  displayOrder: number;
}

interface CategoryAnalyticsData {
  totalCategories: number;
  parentCategories: number;
  subcategories: number;
  featuredCategories: number;
  categoriesWithProducts: number;
  emptyCategories: number;
  topCategories: Array<{ id: string; name: string; count: number }>;
}

const emptyFormData: CategoryFormData = {
  name: '',
  slug: '',
  description: '',
  parentId: '',
  displayOrder: 0,
};

const DEFAULT_CATEGORY_COLUMNS: ColumnDefinition[] = [
  { id: 'name', label: 'Category Name & Hierarchy', visible: true, locked: true },
  { id: 'id', label: 'Category ID', visible: false },
  { id: 'slug', label: 'Slug', visible: true },
  { id: 'directProducts', label: 'Direct Products', visible: true },
  { id: 'totalProducts', label: 'Total Products (incl. subs)', visible: true },
  { id: 'subcategories', label: 'Subcategories', visible: true },
  { id: 'featured', label: 'Featured', visible: true },
  { id: 'displayOrder', label: 'Display Order', visible: true },
  { id: 'actions', label: 'Actions', visible: true, locked: true },
];

export default function AdminCategoriesPage() {
  const hasPermission = useUserStore((state) => state.hasPermission);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [analytics, setAnalytics] = useState<CategoryAnalyticsData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hierarchyFilter, setHierarchyFilter] = useState<'all' | 'roots' | 'subs'>('all');
  const [productFilter, setProductFilter] = useState<'all' | 'with_products' | 'empty'>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>(emptyFormData);
  const [collapsedRoots, setCollapsedRoots] = useState<Record<string, boolean>>({});
  const [columns, setColumns] = useState<ColumnDefinition[]>(DEFAULT_CATEGORY_COLUMNS);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [tree, analyticsData] = await Promise.all([
        categoryService.fetchCategoryTree(),
        categoryService.fetchCategoryAnalytics().catch(() => null),
      ]);
      setCategories(tree);
      if (analyticsData) setAnalytics(analyticsData);
    } catch (err: any) {
      console.error('Failed to load categories:', err);
      setError(err?.message || 'Failed to load categories from server');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Root categories list for parent select
  const rootCategories = useMemo(() => {
    return categories.filter((c) => !c.parentId);
  }, [categories]);

  const openAddModal = (defaultParentId = '') => {
    setEditingCategory(null);
    setFormData({
      ...emptyFormData,
      parentId: defaultParentId,
    });
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (cat: ProductCategory) => {
    setEditingCategory(cat);
    setFormData({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      parentId: cat.parentId || '',
      displayOrder: cat.displayOrder || 0,
    });
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
    setFormData(emptyFormData);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!formData.name.trim()) {
      setError('Category name is required');
      return;
    }

    const slug = (formData.slug.trim() || formData.name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    setIsMutating(true);

    try {
      if (editingCategory) {
        await categoryService.updateCategoryApi(editingCategory.id, {
          name: formData.name.trim(),
          slug,
          description: formData.description.trim() || 'School and office stationery category',
          parentId: formData.parentId ? formData.parentId : null,
          displayOrder: Number(formData.displayOrder) || 0,
        });
        setSuccessMsg(`Category "${formData.name}" updated successfully`);
      } else {
        await categoryService.createCategoryApi({
          name: formData.name.trim(),
          slug,
          description: formData.description.trim() || 'School and office stationery category',
          parentId: formData.parentId ? formData.parentId : null,
          displayOrder: Number(formData.displayOrder) || 0,
          featured: false,
        });
        setSuccessMsg(`Category "${formData.name}" created successfully`);
      }

      closeModal();
      await loadData();
    } catch (err: any) {
      console.error('Failed to save category:', err);
      setError(err?.message || 'Failed to save category on server');
    } finally {
      setIsMutating(false);
    }
  };

  const handleDeleteCategory = async (cat: ProductCategory) => {
    const hasChildren = (cat.children && cat.children.length > 0) || (cat.subcategoryCount ?? 0) > 0;
    const directProd = cat.directProductCount ?? 0;
    const totalProd = cat.itemCount ?? 0;

    if (hasChildren) {
      setError(`Cannot delete "${cat.name}": it contains subcategories. Reassign or remove subcategories first.`);
      return;
    }

    if (directProd > 0 || totalProd > 0) {
      setError(`Cannot delete "${cat.name}": it contains ${totalProd} product(s). Reassign or remove products first.`);
      return;
    }

    if (!confirm(`Are you sure you want to permanently delete category "${cat.name}"?`)) return;

    setIsMutating(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await categoryService.deleteCategoryApi(cat.id);
      setSuccessMsg(`Category "${cat.name}" deleted successfully`);
      await loadData();
    } catch (err: any) {
      console.error('Failed to delete category:', err);
      setError(err?.message || 'Failed to delete category on server');
    } finally {
      setIsMutating(false);
    }
  };

  const toggleCollapse = (rootId: string) => {
    setCollapsedRoots((prev) => ({
      ...prev,
      [rootId]: !prev[rootId],
    }));
  };

  const expandAll = () => {
    setCollapsedRoots({});
  };

  const collapseAll = () => {
    const map: Record<string, boolean> = {};
    categories.forEach((c) => {
      map[c.id] = true;
    });
    setCollapsedRoots(map);
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    const blob = await categoryService.exportCategories(format);
    const timestamp = new Date().toISOString().split('T')[0];
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dsl-categories-${timestamp}.${format}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // Filtered categories
  const filteredTree = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return categories
      .map((root) => {
        const rootDirect = root.directProductCount ?? 0;
        const rootTotal = root.itemCount ?? 0;

        // Product presence check
        if (productFilter === 'with_products' && rootTotal === 0) return null;
        if (productFilter === 'empty' && rootTotal > 0) return null;

        // Hierarchy filter
        if (hierarchyFilter === 'subs') {
          // Only show roots if they have matching children
          const matchingChildren = (root.children || []).filter((child) => {
            const childMatches =
              !q ||
              child.name.toLowerCase().includes(q) ||
              child.slug.toLowerCase().includes(q);
            const childProd = child.itemCount ?? 0;
            if (productFilter === 'with_products' && childProd === 0) return false;
            if (productFilter === 'empty' && childProd > 0) return false;
            return childMatches;
          });
          if (matchingChildren.length === 0) return null;
          return { ...root, children: matchingChildren };
        }

        const rootMatches =
          !q ||
          root.name.toLowerCase().includes(q) ||
          root.slug.toLowerCase().includes(q) ||
          root.description.toLowerCase().includes(q);

        const matchingChildren = (root.children || []).filter((child) => {
          const childMatches =
            !q ||
            child.name.toLowerCase().includes(q) ||
            child.slug.toLowerCase().includes(q);
          const childProd = child.itemCount ?? 0;
          if (productFilter === 'with_products' && childProd === 0) return false;
          if (productFilter === 'empty' && childProd > 0) return false;
          return childMatches;
        });

        if (hierarchyFilter === 'roots') {
          if (!rootMatches) return null;
          return { ...root, children: [] };
        }

        if (rootMatches || matchingChildren.length > 0) {
          return {
            ...root,
            children: rootMatches ? root.children : matchingChildren,
          };
        }
        return null;
      })
      .filter(Boolean) as ProductCategory[];
  }, [categories, searchQuery, hierarchyFilter, productFilter]);

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
    if (hierarchyFilter !== 'all') {
      chips.push({
        id: 'hierarchy',
        label: 'Level',
        value: hierarchyFilter === 'roots' ? 'Parent Categories Only' : 'Subcategories Only',
        onRemove: () => setHierarchyFilter('all'),
      });
    }
    if (productFilter !== 'all') {
      chips.push({
        id: 'products',
        label: 'Products',
        value: productFilter === 'with_products' ? 'With Products' : 'Empty Categories',
        onRemove: () => setProductFilter('all'),
      });
    }
    return chips;
  }, [searchQuery, hierarchyFilter, productFilter]);

  const handleClearAllFilters = () => {
    setSearchQuery('');
    setHierarchyFilter('all');
    setProductFilter('all');
  };

  // KPI cards
  const kpiCards: KpiCardData[] = [
    {
      id: 'total',
      label: 'Total Categories',
      value: analytics?.totalCategories ?? categories.length,
      icon: <Layers className="w-4 h-4" />,
      color: 'blue',
      active: hierarchyFilter === 'all' && productFilter === 'all',
      onClick: handleClearAllFilters,
    },
    {
      id: 'parents',
      label: 'Parent Categories',
      value: analytics?.parentCategories ?? rootCategories.length,
      icon: <Folder className="w-4 h-4" />,
      color: 'purple',
      active: hierarchyFilter === 'roots',
      onClick: () => setHierarchyFilter('roots'),
    },
    {
      id: 'subs',
      label: 'Subcategories',
      value: analytics?.subcategories ?? categories.reduce((sum, c) => sum + (c.children?.length ?? 0), 0),
      icon: <CornerDownRight className="w-4 h-4" />,
      color: 'emerald',
      active: hierarchyFilter === 'subs',
      onClick: () => setHierarchyFilter('subs'),
    },
    {
      id: 'with_prod',
      label: 'With Products',
      value: analytics?.categoriesWithProducts ?? '-',
      icon: <Package className="w-4 h-4" />,
      color: 'blue',
      active: productFilter === 'with_products',
      onClick: () => setProductFilter('with_products'),
    },
    {
      id: 'empty',
      label: 'Empty Categories',
      value: analytics?.emptyCategories ?? '-',
      icon: <AlertCircle className="w-4 h-4" />,
      color: 'amber',
      active: productFilter === 'empty',
      onClick: () => setProductFilter('empty'),
    },
    {
      id: 'featured',
      label: 'Featured Categories',
      value: analytics?.featuredCategories ?? '-',
      icon: <Tag className="w-4 h-4" />,
      color: 'rose',
    },
  ];

  const isColVisible = (colId: string) => {
    return columns.find((c) => c.id === colId)?.visible ?? true;
  };

  return (
    <AdminPageAccess permission="categories.view" pageTitle="Categories Management">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Categories &amp; Subcategories
            </h1>
            <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
              2-Level Tree
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage category parent-child relationships, subcategories, product count distributions, and hierarchy exports.
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
            title="Export categories to CSV or Excel"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Export</span>
          </button>

          {hasPermission('categories.create') && (
            <button
              type="button"
              onClick={() => openAddModal()}
              className="inline-flex items-center gap-1.5 bg-[#08275E] hover:bg-[#103b8c] text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-[#FFD21C]" />
              <span>Add Category</span>
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
        searchPlaceholder="Search category name, slug, or description..."
        activeChips={activeChips}
        onClearAll={handleClearAllFilters}
        totalResults={filteredTree.length}
        rightAction={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200"
              title="Expand all tree nodes"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200"
              title="Collapse all tree nodes"
            >
              Collapse All
            </button>
            <ColumnVisibilityDropdown
              columns={columns}
              onChange={setColumns}
              storageKey="dsl_admin_categories_cols"
            />
          </div>
        }
      >
        <select
          value={hierarchyFilter}
          onChange={(e) => setHierarchyFilter(e.target.value as any)}
          className="px-2.5 py-2 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          <option value="all">All Hierarchy Levels</option>
          <option value="roots">Parent Categories Only</option>
          <option value="subs">Subcategories Only</option>
        </select>

        <select
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value as any)}
          className="px-2.5 py-2 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        >
          <option value="all">All Product Counts</option>
          <option value="with_products">Categories With Products</option>
          <option value="empty">Empty Categories</option>
        </select>
      </CatalogFilterToolbar>

      {/* Categories Hierarchy Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                {isColVisible('name') && <th className="py-3 px-4 font-bold">Category Hierarchy</th>}
                {isColVisible('id') && <th className="py-3 px-3 font-bold">Category ID</th>}
                {isColVisible('slug') && <th className="py-3 px-3 font-bold">Slug</th>}
                {isColVisible('directProducts') && <th className="py-3 px-3 font-bold">Direct Products</th>}
                {isColVisible('totalProducts') && <th className="py-3 px-3 font-bold">Total Products</th>}
                {isColVisible('subcategories') && <th className="py-3 px-3 font-bold">Subcategories</th>}
                {isColVisible('featured') && <th className="py-3 px-3 font-bold">Featured</th>}
                {isColVisible('displayOrder') && <th className="py-3 px-3 font-bold">Order</th>}
                {isColVisible('actions') && <th className="py-3 px-4 font-bold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && categories.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="inline-flex items-center gap-2">
                      <RotateCcw className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Loading category hierarchy...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredTree.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <Folder className="w-8 h-8 text-slate-300 mb-1" />
                      <p className="font-semibold text-slate-600">No categories match your filters</p>
                      <p className="text-[11px] text-slate-400">Try adjusting search or level filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTree.map((root) => {
                  const isCollapsed = !!collapsedRoots[root.id];
                  const hasChildren = (root.children || []).length > 0;
                  const directCount = root.directProductCount ?? 0;
                  const totalCount = root.itemCount ?? directCount;
                  const subCount = root.children?.length ?? 0;

                  return (
                    <React.Fragment key={root.id}>
                      {/* Parent Root Row */}
                      <tr className="hover:bg-slate-50/80 transition-colors bg-white font-medium">
                        {isColVisible('name') && (
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              {hasChildren ? (
                                <button
                                  type="button"
                                  onClick={() => toggleCollapse(root.id)}
                                  className="p-1 rounded hover:bg-slate-200 text-slate-600 transition-colors"
                                  title={isCollapsed ? 'Expand subcategories' : 'Collapse subcategories'}
                                >
                                  {isCollapsed ? (
                                    <ChevronRight className="w-4 h-4" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                </button>
                              ) : (
                                <span className="w-6 inline-block" />
                              )}

                              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
                                {isCollapsed ? <Folder className="w-4 h-4" /> : <FolderOpen className="w-4 h-4" />}
                              </div>

                              <div>
                                <span className="font-bold text-slate-900 text-sm">{root.name}</span>
                                {root.description && (
                                  <p className="text-[11px] text-slate-400 truncate max-w-xs">
                                    {root.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                        )}

                        {isColVisible('id') && (
                          <td className="py-3 px-3 font-mono text-[10px] text-slate-400 truncate max-w-[120px]" title={root.id}>
                            {root.id}
                          </td>
                        )}

                        {isColVisible('slug') && (
                          <td className="py-3 px-3 font-mono text-slate-500 whitespace-nowrap">
                            {root.slug}
                          </td>
                        )}

                        {isColVisible('directProducts') && (
                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-800">{directCount}</span>
                          </td>
                        )}

                        {isColVisible('totalProducts') && (
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center gap-1 font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full text-xs">
                              {totalCount}
                            </span>
                          </td>
                        )}

                        {isColVisible('subcategories') && (
                          <td className="py-3 px-3">
                            <span className="font-medium text-slate-600">
                              {subCount} {subCount === 1 ? 'sub' : 'subs'}
                            </span>
                          </td>
                        )}

                        {isColVisible('featured') && (
                          <td className="py-3 px-3 whitespace-nowrap">
                            {root.featured ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                Featured
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">No</span>
                            )}
                          </td>
                        )}

                        {isColVisible('displayOrder') && (
                          <td className="py-3 px-3 text-slate-600 font-mono">
                            {root.displayOrder ?? 0}
                          </td>
                        )}

                        {isColVisible('actions') && (
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              {hasPermission('categories.create') && (
                                <button
                                  type="button"
                                  onClick={() => openAddModal(root.id)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Add subcategory"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {hasPermission('categories.edit') && (
                                <button
                                  type="button"
                                  onClick={() => openEditModal(root)}
                                  className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-slate-100 rounded-lg transition-colors"
                                  title="Edit category"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {hasPermission('categories.delete') && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCategory(root)}
                                  disabled={isMutating}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Delete category"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>

                      {/* Subcategories (if expanded) */}
                      {!isCollapsed &&
                        (root.children || []).map((child, idx, arr) => {
                          const isLast = idx === arr.length - 1;
                          const childDirect = child.directProductCount ?? child.itemCount ?? 0;

                          return (
                            <tr
                              key={child.id}
                              className="hover:bg-blue-50/30 transition-colors bg-slate-50/40 text-xs"
                            >
                              {isColVisible('name') && (
                                <td className="py-2.5 px-4 pl-12">
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-400 font-mono select-none">
                                      {isLast ? '└──' : '├──'}
                                    </span>
                                    <CornerDownRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <div>
                                      <span className="font-semibold text-slate-800">{child.name}</span>
                                      {child.description && (
                                        <p className="text-[10px] text-slate-400 truncate max-w-xs">
                                          {child.description}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              )}

                              {isColVisible('id') && (
                                <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400 truncate max-w-[120px]" title={child.id}>
                                  {child.id}
                                </td>
                              )}

                              {isColVisible('slug') && (
                                <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                                  {child.slug}
                                </td>
                              )}

                              {isColVisible('directProducts') && (
                                <td className="py-2.5 px-3 font-semibold text-slate-700">
                                  {childDirect}
                                </td>
                              )}

                              {isColVisible('totalProducts') && (
                                <td className="py-2.5 px-3 font-semibold text-slate-700">
                                  {childDirect}
                                </td>
                              )}

                              {isColVisible('subcategories') && (
                                <td className="py-2.5 px-3 text-slate-400">-</td>
                              )}

                              {isColVisible('featured') && (
                                <td className="py-2.5 px-3 text-slate-400 text-xs">
                                  {child.featured ? 'Yes' : 'No'}
                                </td>
                              )}

                              {isColVisible('displayOrder') && (
                                <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                                  {child.displayOrder ?? 0}
                                </td>
                              )}

                              {isColVisible('actions') && (
                                <td className="py-2.5 px-4 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1">
                                    {hasPermission('categories.edit') && (
                                      <button
                                        type="button"
                                        onClick={() => openEditModal(child)}
                                        className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-slate-100 rounded-lg transition-colors"
                                        title="Edit subcategory"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    {hasPermission('categories.delete') && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteCategory(child)}
                                        disabled={isMutating}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                        title="Delete subcategory"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                    </React.Fragment>
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
        title="Export Categories Dataset"
        totalFilteredCount={filteredTree.length}
      />

      {/* Create / Edit Category Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingCategory ? `Edit "${editingCategory.name}"` : 'Add New Category'}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Category Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Writing Instruments"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  URL Slug (Optional - auto generated if blank)
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="e.g. writing-instruments"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Parent Category (Hierarchy Level)
                </label>
                <select
                  value={formData.parentId}
                  onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                >
                  <option value="">None (Top-Level Root Category)</option>
                  {rootCategories
                    .filter((c) => c.id !== editingCategory?.id)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        Parent: {r.name}
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Selecting a parent nests this as a subcategory.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Short description for SEO and catalog navigation..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Display Order</label>
                <input
                  type="number"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData({ ...formData, displayOrder: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isMutating}
                  className="px-4 py-2 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isMutating}
                  className="px-5 py-2 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
                >
                  {isMutating ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </AdminPageAccess>
  );
}
