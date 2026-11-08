'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { categoryService } from '@/services/categoryService';
import { productService } from '@/services/productService';
import { ProductCategory, Product } from '@/types/product';

interface CategoryFormData {
  id?: string;
  name: string;
  slug: string;
  description: string;
  parentId: string; // '' means root category
  displayOrder: number;
}

const emptyFormData: CategoryFormData = {
  name: '',
  slug: '',
  description: '',
  parentId: '',
  displayOrder: 0,
};

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>(emptyFormData);
  const [collapsedRoots, setCollapsedRoots] = useState<Record<string, boolean>>({});

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [cats, prodRes] = await Promise.all([
        categoryService.fetchCategoryTree(),
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
      // Re-fetch tree when local storage triggers
    });
    return () => unsub();
  }, []);

  // Filter root categories that are candidates for being parents (excluding the one being edited)
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
        // Update category
        await categoryService.updateCategoryApi(editingCategory.id, {
          name: formData.name.trim(),
          slug,
          description: formData.description.trim() || 'School and office stationery category',
          parentId: formData.parentId ? formData.parentId : null,
          displayOrder: Number(formData.displayOrder) || 0,
        });
        setSuccessMsg(`Category "${formData.name}" updated successfully`);
      } else {
        // Create category
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
    const directProdCount = products.filter((p) => p.categoryId === cat.id && !p.subcategoryId).length;
    const subProdCount = products.filter((p) => p.subcategoryId === cat.id).length;
    const totalProdCount = directProdCount + subProdCount;

    if (hasChildren) {
      setError(`Cannot delete "${cat.name}": it contains subcategories. Reassign or remove subcategories first.`);
      return;
    }

    if (totalProdCount > 0) {
      setError(`Cannot delete "${cat.name}": it is referenced by ${totalProdCount} existing product(s). Reassign or remove products first.`);
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

  // Filtered categories based on search
  const filteredTree = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return categories;

    return categories
      .map((root) => {
        const rootMatches =
          root.name.toLowerCase().includes(q) ||
          root.slug.toLowerCase().includes(q) ||
          root.description.toLowerCase().includes(q);

        const matchingChildren = (root.children || []).filter(
          (child) =>
            child.name.toLowerCase().includes(q) ||
            child.slug.toLowerCase().includes(q) ||
            child.description.toLowerCase().includes(q)
        );

        if (rootMatches || matchingChildren.length > 0) {
          return {
            ...root,
            children: rootMatches ? root.children : matchingChildren,
          };
        }
        return null;
      })
      .filter(Boolean) as ProductCategory[];
  }, [categories, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Categories &amp; Subcategories
            </h1>
            <span className="bg-[#08275E]/10 text-[#08275E] text-xs font-bold px-2.5 py-0.5 rounded-full">
              2-Level Hierarchy
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Organize catalog departments and nested subcategories with strict integrity protection.
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
            onClick={() => openAddModal()}
            className="bg-[#08275E] hover:bg-[#103b8c] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 text-[#FFD21C]" />
            <span>Add Category</span>
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex items-center gap-3 text-rose-800 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <div className="flex-1 font-medium">{error}</div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 font-bold">
            Dismiss
          </button>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <div className="flex-1 font-medium">{successMsg}</div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* Search & Statistics Bar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search categories or subcategories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-[#08275E]"
          />
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-600 font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#08275E]" />
            <span>{rootCategories.length} Root Categories</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>
              {categories.reduce((acc, r) => acc + (r.children ? r.children.length : 0), 0)} Subcategories
            </span>
          </div>
        </div>
      </div>

      {/* Categories Hierarchical Tree / Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 font-bold">
              <th className="py-3 px-4">Category / Subcategory Name</th>
              <th className="py-3 px-4">Slug</th>
              <th className="py-3 px-4">Hierarchy Level</th>
              <th className="py-3 px-4 text-center">Subcategories</th>
              <th className="py-3 px-4 text-center">Products</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && categories.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  <div className="inline-flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 animate-spin text-[#08275E]" />
                    <span>Loading category hierarchy...</span>
                  </div>
                </td>
              </tr>
            ) : filteredTree.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  {searchQuery ? 'No categories matching your search.' : 'No categories found.'}
                </td>
              </tr>
            ) : (
              filteredTree.map((root) => {
                const isCollapsed = !!collapsedRoots[root.id];
                const children = root.children || [];
                const directProdCount = products.filter((p) => p.categoryId === root.id && !p.subcategoryId).length;
                const totalRootProdCount = root.itemCount ?? directProdCount;
                const canDeleteRoot = children.length === 0 && directProdCount === 0;

                return (
                  <React.Fragment key={root.id}>
                    {/* Root Category Row */}
                    <tr className="bg-slate-50/60 hover:bg-slate-50 transition-colors font-medium">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {children.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => toggleCollapse(root.id)}
                              className="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-600"
                              title={isCollapsed ? 'Expand subcategories' : 'Collapse subcategories'}
                            >
                              {isCollapsed ? (
                                <ChevronRight className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          ) : (
                            <span className="w-5" />
                          )}
                          <Folder className="w-4 h-4 text-[#08275E] shrink-0" />
                          <span className="font-bold text-slate-900 text-sm">{root.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">{root.slug}</td>
                      <td className="py-3 px-4">
                        <span className="bg-blue-50 text-[#08275E] font-bold text-[11px] px-2.5 py-1 rounded-full border border-blue-200">
                          Root Category
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-700">
                        {children.length > 0 ? (
                          <span className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                            {children.length} subcategories
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">None</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-[#08275E]">
                        <span className="bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                          {totalRootProdCount} items
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openAddModal(root.id)}
                            className="p-1.5 text-slate-500 hover:text-[#08275E] hover:bg-blue-50 rounded-lg transition-colors"
                            title="Add subcategory under this category"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(root)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit category"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(root)}
                            disabled={isMutating || !canDeleteRoot}
                            className={`p-1.5 rounded-lg transition-colors ${
                              canDeleteRoot
                                ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                : 'text-slate-300 cursor-not-allowed'
                            }`}
                            title={
                              canDeleteRoot
                                ? 'Delete category'
                                : children.length > 0
                                ? 'Cannot delete: category has subcategories'
                                : 'Cannot delete: category has products'
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Subcategories (Indented Rows) */}
                    {!isCollapsed &&
                      children.map((child) => {
                        const childProdCount = products.filter((p) => p.subcategoryId === child.id).length;
                        const canDeleteChild = childProdCount === 0;

                        return (
                          <tr key={child.id} className="hover:bg-amber-50/30 transition-colors">
                            <td className="py-2.5 px-4 pl-10">
                              <div className="flex items-center gap-2">
                                <CornerDownRight className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span className="font-semibold text-slate-800">{child.name}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-4 font-mono text-slate-500">{child.slug}</td>
                            <td className="py-2.5 px-4">
                              <span className="bg-amber-50 text-amber-800 font-semibold text-[10px] px-2 py-0.5 rounded-full border border-amber-200">
                                Subcategory
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-center text-slate-400 text-[11px]">—</td>
                            <td className="py-2.5 px-4 text-center font-bold text-amber-900">
                              <span className="bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 text-[11px]">
                                {childProdCount} items
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEditModal(child)}
                                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Edit subcategory"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCategory(child)}
                                  disabled={isMutating || !canDeleteChild}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    canDeleteChild
                                      ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                      : 'text-slate-300 cursor-not-allowed'
                                  }`}
                                  title={
                                    canDeleteChild
                                      ? 'Delete subcategory'
                                      : 'Cannot delete: subcategory has products'
                                  }
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
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

      {/* Category Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 space-y-4 shadow-xl text-xs animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                {editingCategory ? `Edit Category: ${editingCategory.name}` : 'New Category / Subcategory'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Parent Category (Hierarchy Level)
                </label>
                <select
                  value={formData.parentId}
                  onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white"
                  disabled={
                    Boolean(
                      editingCategory &&
                      (editingCategory.children?.length ?? 0) > 0 &&
                      !editingCategory.parentId
                    )
                  }
                >
                  <option value="">None (Top-Level Root Category)</option>
                  {rootCategories
                    .filter((rc) => !editingCategory || rc.id !== editingCategory.id)
                    .map((rc) => (
                      <option key={rc.id} value={rc.id}>
                        {rc.name} (Subcategory Level)
                      </option>
                    ))}
                </select>
                {editingCategory && (editingCategory.children?.length ?? 0) > 0 && !editingCategory.parentId && (
                  <p className="text-[11px] text-amber-700 mt-1">
                    This root category already contains subcategories and cannot be made a child of another category.
                  </p>
                )}
                <p className="text-[11px] text-slate-500 mt-1">
                  DSL Stationery strictly supports two hierarchy levels (Root Category &rarr; Subcategory).
                </p>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Category Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Fountain Pens"
                  value={formData.name}
                  onChange={(e) => {
                    const newName = e.target.value;
                    const autoSlug = newName
                      .toLowerCase()
                      .trim()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-+|-+$/g, '');
                    setFormData({
                      ...formData,
                      name: newName,
                      slug: editingCategory ? formData.slug : autoSlug,
                    });
                  }}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">URL Slug *</label>
                <input
                  type="text"
                  placeholder="e.g. fountain-pens"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-mono text-[11px]"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Brief description for storefront navigation and SEO"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Display Order</label>
                <input
                  type="number"
                  value={formData.displayOrder}
                  onChange={(e) => setFormData({ ...formData, displayOrder: Number(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isMutating}
                  className="bg-[#08275E] hover:bg-[#103b8c] text-white font-bold px-5 py-2 rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  {isMutating ? 'Saving...' : editingCategory ? 'Save Changes' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
