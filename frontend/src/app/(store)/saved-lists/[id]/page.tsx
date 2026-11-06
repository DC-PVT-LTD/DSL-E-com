'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Bookmark,
  ArrowLeft,
  ShoppingCart,
  Trash2,
  Edit2,
  Plus,
  Minus,
  Search,
  Loader2,
  Check,
  AlertTriangle,
  XCircle,
  Package,
  ExternalLink,
} from 'lucide-react';
import { useSavedListStore } from '@/services/savedListStore';
import { useCartStore } from '@/services/cartStore';
import { useUserStore } from '@/services/userStore';
import { productService } from '@/services/productService';
import { Product } from '@/types/product';
import { SavedListItem, ListAvailabilityReport } from '@/types/savedList';
import { formatLKR } from '@/lib/currency';

export default function SavedListDetailPage() {
  const params = useParams();
  const listId = params.id as string;
  const router = useRouter();

  const currentUser = useUserStore((state) => state.currentUser);
  const {
    activeList,
    isLoading,
    error,
    fetchListById,
    renameList,
    deleteList,
    updateItemQuantity,
    removeItemFromList,
    addItemToList,
    checkAvailability,
  } = useSavedListStore();

  const addItemToCart = useCartStore((state) => state.addItem);

  // Rename modal
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [updatedName, setUpdatedName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Search catalogue to add products
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingProductId, setAddingProductId] = useState<string | null>(null);

  // "Add All to Cart" status and report modal
  const [isAddingAllToCart, setIsAddingAllToCart] = useState(false);
  const [availabilityReport, setAvailabilityReport] = useState<ListAvailabilityReport | null>(null);
  const [cartTransferSummary, setCartTransferSummary] = useState<{
    addedCount: number;
    partialCount: number;
    outOfStockCount: number;
  } | null>(null);

  const loadList = useCallback(() => {
    if (listId && currentUser) {
      fetchListById(listId);
    }
  }, [listId, currentUser, fetchListById]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  // Handle catalogue search
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await productService.fetchProducts({ query: trimmed }, 'newest', 1, 5);
        setSearchResults(res.items || []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updatedName.trim()) return;

    setIsRenaming(true);
    const success = await renameList(listId, updatedName.trim());
    setIsRenaming(false);
    if (success) {
      setIsRenameOpen(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this saved list?')) return;
    const success = await deleteList(listId);
    if (success) {
      router.push('/saved-lists');
    }
  };

  const handleAddSearchResult = async (product: Product) => {
    setAddingProductId(product.id);
    await addItemToList(listId, product.id, 1);
    setAddingProductId(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleAddAllToCart = async () => {
    if (!activeList || activeList.items.length === 0) return;

    setIsAddingAllToCart(true);
    const report = await checkAvailability(listId);
    setAvailabilityReport(report);

    if (!report || !report.canAddAny) {
      setIsAddingAllToCart(false);
      setCartTransferSummary({
        addedCount: 0,
        partialCount: 0,
        outOfStockCount: activeList.items.length,
      });
      return;
    }

    let addedCount = 0;
    let partialCount = 0;
    let outOfStockCount = 0;

    for (const item of activeList.items) {
      const repItem = report.items.find((r) => r.itemId === item.id);
      if (!repItem || !repItem.isActive || repItem.availableStock <= 0) {
        outOfStockCount++;
        continue;
      }

      const qtyToAdd = Math.min(repItem.requestedQuantity, repItem.availableStock);
      if (qtyToAdd < repItem.requestedQuantity) {
        partialCount++;
      } else {
        addedCount++;
      }

      // Add to client cart store
      await addItemToCart(item.product as any, qtyToAdd);
    }

    setIsAddingAllToCart(false);
    setCartTransferSummary({
      addedCount,
      partialCount,
      outOfStockCount,
    });
  };

  if (!currentUser) {
    return (
      <div className="bg-[#FFFDF0] min-h-screen py-16 text-center px-4">
        <h1 className="text-xl font-bold text-[#292525]">Sign In Required</h1>
        <p className="text-xs text-[#292525]/60 mt-2">Please sign in to view this saved list.</p>
        <Link
          href={`/login?redirect=/saved-lists/${listId}`}
          className="mt-4 inline-flex items-center px-6 py-2.5 rounded-full text-xs font-bold text-white bg-[#0066CC]"
        >
          Sign In
        </Link>
      </div>
    );
  }

  if (isLoading && !activeList) {
    return (
      <div className="bg-[#FFFDF0] min-h-screen py-24 text-center flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#0066CC]" />
        <p className="mt-3 text-xs text-[#292525]/60 font-medium">Loading list details...</p>
      </div>
    );
  }

  if (error || !activeList) {
    return (
      <div className="bg-[#FFFDF0] min-h-screen py-16 text-center px-4">
        <h1 className="text-xl font-bold text-[#292525]">List Not Found</h1>
        <p className="text-xs text-rose-600 mt-2">{error || 'This list could not be loaded.'}</p>
        <Link
          href="/saved-lists"
          className="mt-4 inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold text-white bg-[#0066CC]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Saved Lists</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-[#FFFDF0] min-h-screen py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Navigation & Header */}
        <div className="mb-6">
          <Link
            href="/saved-lists"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0066CC] hover:underline mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Saved Lists</span>
          </Link>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[#C6E7FF]/60">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#292525]">
                  {activeList.name}
                </h1>
                <button
                  onClick={() => {
                    setUpdatedName(activeList.name);
                    setIsRenameOpen(true);
                  }}
                  className="p-1.5 rounded-full text-[#292525]/40 hover:text-[#0066CC] hover:bg-[#F0F7FF] transition-colors"
                  title="Rename List"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDelete}
                  className="p-1.5 rounded-full text-[#292525]/40 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  title="Delete List"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs sm:text-sm text-[#292525]/60 mt-1">
                {activeList.itemCount} {activeList.itemCount === 1 ? 'item' : 'items'} • Last
                updated {new Date(activeList.updatedAt).toLocaleDateString()}
              </p>
            </div>

            {/* Quick Actions / Estimated Total Card */}
            <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-3xl border border-[#C6E7FF]/60 shadow-xs">
              <div>
                <span className="text-[11px] font-bold text-[#292525]/50 uppercase tracking-wider block">
                  Estimated Total
                </span>
                <span className="text-lg font-black text-[#0066CC]">
                  {formatLKR(activeList.estimatedTotalCents)}
                </span>
              </div>

              <button
                onClick={handleAddAllToCart}
                disabled={isAddingAllToCart || activeList.items.length === 0}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-xs font-bold text-white bg-[#0066CC] hover:bg-[#0052a3] disabled:opacity-50 shadow-md transition-all cursor-pointer"
              >
                {isAddingAllToCart ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShoppingCart className="w-4 h-4" />
                )}
                <span>Add All to Cart</span>
              </button>
            </div>
          </div>
        </div>

        {/* Product Catalogue Search Bar to Add More Items to this List */}
        <div className="relative mb-8 max-w-xl">
          <label className="text-xs font-bold text-[#292525] block mb-1.5">
            Add More Products to This List:
          </label>
          <div className="relative flex items-center">
            <Search className="w-4 h-4 absolute left-3.5 text-[#292525]/40" />
            <input
              type="text"
              placeholder="Search product name or SKU to add..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-10 pr-4 py-2.5 rounded-2xl border border-[#C6E7FF] focus:outline-hidden focus:border-[#0066CC] bg-white shadow-2xs"
            />
            {isSearching && (
              <Loader2 className="w-4 h-4 absolute right-3.5 animate-spin text-[#0066CC]" />
            )}
          </div>

          {/* Search Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white rounded-2xl border border-[#C6E7FF] shadow-lg max-h-64 overflow-y-auto p-2 space-y-1">
              {searchResults.map((prod) => (
                <div
                  key={prod.id}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-[#F0F7FF] transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[#FAF7EE] border border-[#C6E7FF]/40 shrink-0 p-0.5 flex items-center justify-center overflow-hidden">
                      {prod.images?.[0] ? (
                        <img src={prod.images[0]} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <Package className="w-4 h-4 text-[#0066CC]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#292525] truncate">{prod.name}</p>
                      <p className="text-[10px] text-[#0066CC] font-semibold">
                        {formatLKR(prod.priceCents)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddSearchResult(prod)}
                    disabled={addingProductId === prod.id}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold text-white bg-[#0066CC] hover:bg-[#0052a3] shadow-xs shrink-0"
                  >
                    {addingProductId === prod.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Plus className="w-3 h-3" />
                    )}
                    <span>Add</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* List Items Grid */}
        {activeList.items.length === 0 ? (
          <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-12 text-center max-w-lg mx-auto">
            <Package className="w-12 h-12 text-[#0066CC]/40 mx-auto mb-3" />
            <h3 className="font-bold text-base text-[#292525]">This list is currently empty</h3>
            <p className="text-xs text-[#292525]/60 mt-1 max-w-xs mx-auto">
              Use the search bar above or browse the product catalogue to add stationery items with
              custom quantities.
            </p>
            <Link
              href="/shop"
              className="mt-5 inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold text-white bg-[#0066CC] hover:bg-[#0052a3] shadow-md transition-all"
            >
              <span>Explore Catalogue</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {activeList.items.map((item) => {
                const prod = item.product;
                const isOutOfStock = !prod.isActive || prod.stockQuantity <= 0;
                const isLowStock = prod.isActive && prod.stockQuantity > 0 && prod.stockQuantity < 5;
                const lineTotal = prod.priceCents * item.quantity;

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-3xl border border-[#C6E7FF]/70 p-5 shadow-xs hover:border-[#0066CC] transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Top row: Thumbnail & details */}
                      <div className="flex gap-3.5 mb-3">
                        <Link
                          href={`/products/${prod.slug}`}
                          className="w-18 h-18 rounded-2xl bg-[#FAF7EE] border border-[#C6E7FF]/50 p-1 flex items-center justify-center shrink-0 overflow-hidden"
                        >
                          {prod.images?.[0] ? (
                            <img
                              src={prod.images[0]}
                              alt={prod.name}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <Package className="w-6 h-6 text-[#0066CC]" />
                          )}
                        </Link>
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/products/${prod.slug}`}
                            className="text-xs font-bold text-[#292525] hover:text-[#0066CC] line-clamp-2"
                          >
                            {prod.name}
                          </Link>
                          <div className="text-[10px] text-[#292525]/50 mt-0.5">
                            SKU: {prod.sku}
                          </div>
                          <div className="text-xs font-extrabold text-[#0066CC] mt-1">
                            {formatLKR(prod.priceCents)}
                          </div>
                        </div>
                      </div>

                      {/* Stock Status Badge */}
                      <div className="mb-4">
                        {isOutOfStock ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            Out of Stock
                          </span>
                        ) : isLowStock ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            Only {prod.stockQuantity} left
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            In Stock ({prod.stockQuantity} available)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quantity Selector & Item Total */}
                    <div className="pt-3 border-t border-[#C6E7FF]/40 flex items-center justify-between">
                      <div className="flex items-center border border-[#C6E7FF] rounded-full bg-[#FFFDF0]">
                        <button
                          onClick={() => {
                            if (item.quantity > 1) {
                              updateItemQuantity(listId, item.id, item.quantity - 1);
                            }
                          }}
                          disabled={item.quantity <= 1}
                          className="px-2.5 py-1 text-xs font-bold text-[#292525] hover:bg-slate-100 disabled:opacity-40 rounded-l-full transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-3 py-1 text-xs font-bold text-[#292525]">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateItemQuantity(listId, item.id, item.quantity + 1)}
                          className="px-2.5 py-1 text-xs font-bold text-[#292525] hover:bg-slate-100 rounded-r-full transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-[#292525]/50 block">Line Total</span>
                        <span className="text-xs font-black text-[#292525]">
                          {formatLKR(lineTotal)}
                        </span>
                      </div>

                      <button
                        onClick={() => removeItemFromList(listId, item.id)}
                        className="p-1.5 rounded-full text-[#292525]/40 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Remove Item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Modal: Rename List */}
        {isRenameOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-[#C6E7FF]/60">
              <h3 className="font-bold text-base text-[#292525] mb-2">Rename List</h3>
              <form onSubmit={handleRename} className="space-y-4">
                <input
                  type="text"
                  value={updatedName}
                  onChange={(e) => setUpdatedName(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-2xl border border-[#C6E7FF] focus:outline-hidden focus:border-[#0066CC] bg-[#FFFDF0]"
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRenameOpen(false)}
                    className="px-4 py-2 rounded-full text-xs font-bold text-[#292525]/70 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRenaming}
                    className="px-6 py-2 rounded-full text-xs font-bold text-white bg-[#0066CC] hover:bg-[#0052a3] disabled:opacity-50 shadow-md transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Cart Transfer Summary */}
        {cartTransferSummary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-[#C6E7FF]/60">
              <div className="flex items-center gap-2 text-[#0066CC] mb-3">
                <ShoppingCart className="w-5 h-5" />
                <h3 className="font-bold text-base text-[#292525]">Cart Transfer Report</h3>
              </div>

              <div className="space-y-3 py-2 text-xs text-[#292525]">
                {cartTransferSummary.addedCount > 0 && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-emerald-800 font-semibold">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      {cartTransferSummary.addedCount} {cartTransferSummary.addedCount === 1 ? 'item' : 'items'} added to your cart with full requested quantity.
                    </span>
                  </div>
                )}

                {cartTransferSummary.partialCount > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2 text-amber-800 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      {cartTransferSummary.partialCount} {cartTransferSummary.partialCount === 1 ? 'item' : 'items'} adjusted to available stock limit.
                    </span>
                  </div>
                )}

                {cartTransferSummary.outOfStockCount > 0 && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-rose-800 font-semibold">
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      {cartTransferSummary.outOfStockCount} {cartTransferSummary.outOfStockCount === 1 ? 'item is' : 'items are'} currently out of stock and skipped.
                    </span>
                  </div>
                )}

                {cartTransferSummary.addedCount === 0 && cartTransferSummary.partialCount === 0 && (
                  <p className="text-xs text-[#292525]/70 py-2">
                    None of the items could be added because they are currently out of stock or unavailable.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#C6E7FF]/40">
                <button
                  type="button"
                  onClick={() => setCartTransferSummary(null)}
                  className="px-5 py-2.5 rounded-full text-xs font-bold text-[#292525]/70 hover:bg-slate-100 transition-colors"
                >
                  Stay on List
                </button>
                <Link
                  href="/cart"
                  className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-[#0066CC] hover:bg-[#0052a3] shadow-md transition-all inline-flex items-center gap-1.5"
                >
                  <span>View Cart</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
