'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Boxes,
  AlertTriangle,
  History,
  RefreshCw,
  Check,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { inventoryService } from '@/services/inventoryService';
import { productService } from '@/services/productService';
import { inventorySocketService } from '@/services/inventorySocketService';
import { apiClient } from '@/lib/api/apiClient';
import { Product, ProductVariant } from '@/types/product';
import { InventoryMovement, InventoryChangeReason } from '@/types/admin';
import { formatLKR } from '@/lib/currency';

export default function AdminInventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [filterLowStock, setFilterLowStock] = useState(false);

  // Pagination & Filtering state for movements
  const [movementPage, setMovementPage] = useState(1);
  const [movementTotalPages, setMovementTotalPages] = useState(1);
  const [movementTotalItems, setMovementTotalItems] = useState(0);
  const [reasonFilter, setReasonFilter] = useState<string>('all');

  // Loading & Error states
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isLoadingMovements, setIsLoadingMovements] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Adjustment modal state
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [newQuantity, setNewQuantity] = useState<number>(0);
  const [reason, setReason] = useState<InventoryChangeReason>('RESTOCK');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState(false);

  // Fetch products (all or low-stock)
  const loadProducts = useCallback(async (isLowStockOnly: boolean) => {
    setIsLoadingProducts(true);
    setPageError(null);
    try {
      let rawItems: Product[] = [];
      if (isLowStockOnly) {
        const res = await inventoryService.fetchLowStock({ page: 1, limit: 100 });
        rawItems = res.items;
      } else {
        const res = await productService.fetchProducts({}, 'newest', 1, 100);
        rawItems = res.items;
      }

      // Fetch live reserved & available stock breakdown
      try {
        const ids = rawItems.map((p) => p.id).join(',');
        const batchRes = await apiClient.get<any>(`/public/inventory/batch-status?ids=${ids}`);
        if (batchRes?.data) {
          const enriched = rawItems.map((p) => {
            const live = batchRes.data[p.id];
            return {
              ...p,
              stockQuantity: live ? live.physicalStock : p.stockQuantity,
              reservedStock: live ? live.reservedStock : 0,
              availableStock: live ? live.availableStock : p.stockQuantity,
            };
          });
          setProducts(enriched);
          return;
        }
      } catch {
        // Fallback to raw items
      }
      setProducts(rawItems);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load products from server';
      setPageError(msg);
      setProducts(productService.getAll(true));
    } finally {
      setIsLoadingProducts(false);
    }
  }, []);

  // Fetch movements audit trail
  const loadMovements = useCallback(async (page: number, reason: string) => {
    setIsLoadingMovements(true);
    try {
      const filterReason =
        reason !== 'all' ? (reason.toUpperCase() as any) : undefined;
      const res = await inventoryService.fetchMovements({
        page,
        limit: 10,
        reason: filterReason,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      setMovements(res.items);
      setMovementPage(res.page);
      setMovementTotalPages(res.totalPages);
      setMovementTotalItems(res.total);
    } catch (err: unknown) {
      console.warn('Failed to load inventory movements from server:', err);
      // Synchronous fallback to locally cached movements
      setMovements(inventoryService.getMovements());
    } finally {
      setIsLoadingMovements(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadProducts(filterLowStock);
  }, [loadProducts, filterLowStock]);

  useEffect(() => {
    loadMovements(movementPage, reasonFilter);
  }, [loadMovements, movementPage, reasonFilter]);

  // Subscribe to external store & real-time WebSocket inventory updates (Phase 12)
  useEffect(() => {
    const unsubInv = inventoryService.subscribe(() => {
      setMovements(inventoryService.getMovements());
    });
    const unsubProd = productService.subscribe(() => {
      if (!filterLowStock) {
        setProducts(productService.getAll(true));
      }
    });
    const unsubSocket = inventorySocketService.subscribeAdmin((update) => {
      setProducts((prev) =>
        prev.map((p) => {
          if (p.id === update.productId) {
            return {
              ...p,
              stockQuantity: update.physicalStock,
              reservedStock: update.reservedStock,
              availableStock: update.availableStock,
            };
          }
          return p;
        })
      );
    });
    const unsubReconnect = inventorySocketService.onReconnect(() => {
      loadProducts(filterLowStock);
    });

    return () => {
      unsubInv();
      unsubProd();
      unsubSocket();
      unsubReconnect();
    };
  }, [filterLowStock, loadProducts]);

  const handleToggleLowStock = () => {
    const nextState = !filterLowStock;
    setFilterLowStock(nextState);
  };

  const openAdjustModal = (product: Product) => {
    setAdjustingProduct(product);
    setSelectedVariantId('');
    setNewQuantity(product.stockQuantity);
    setReason('RESTOCK');
    setNote('');
    setModalError(null);
    setSuccessMsg(false);
  };

  // Determine currently selected item's stock (variant vs base product)
  const getSelectedStock = (): number => {
    if (!adjustingProduct) return 0;
    if (selectedVariantId && adjustingProduct.variants) {
      const variant = adjustingProduct.variants.find((v) => v.id === selectedVariantId);
      return variant ? variant.stockQuantity : adjustingProduct.stockQuantity;
    }
    return adjustingProduct.stockQuantity;
  };

  const handleVariantChange = (variantId: string) => {
    setSelectedVariantId(variantId);
    if (adjustingProduct) {
      if (variantId && adjustingProduct.variants) {
        const variant = adjustingProduct.variants.find((v) => v.id === variantId);
        setNewQuantity(variant ? variant.stockQuantity : adjustingProduct.stockQuantity);
      } else {
        setNewQuantity(adjustingProduct.stockQuantity);
      }
    }
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct || isSubmitting) return;

    setModalError(null);

    // Client-side validation: Physical Stock cannot be reduced below active customer reservations (Phase 13)
    const currentReserved = adjustingProduct.reservedStock || 0;
    if (newQuantity < currentReserved) {
      setModalError(
        `Cannot reduce physical stock to ${newQuantity}: ${currentReserved} units are currently reserved by customer checkout sessions. Physical stock cannot fall below active reservations.`
      );
      return;
    }

    setIsSubmitting(true);

    try {
      await inventoryService.adjustStock({
        productId: adjustingProduct.id,
        variantId: selectedVariantId || undefined,
        targetQuantity: newQuantity,
        reason: (reason || 'RESTOCK').toUpperCase() as any,
        note: note.trim() || undefined,
      });

      setSuccessMsg(true);

      // Refresh data to reflect updated stock and movements
      await Promise.all([
        loadProducts(filterLowStock),
        loadMovements(1, reasonFilter),
      ]);

      setTimeout(() => {
        setSuccessMsg(false);
        setIsSubmitting(false);
        setAdjustingProduct(null);
      }, 700);
    } catch (err: unknown) {
      setIsSubmitting(false);
      const msg = err instanceof Error ? err.message : 'Stock adjustment failed on server';
      setModalError(msg);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Inventory &amp; Stock Control
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time warehouse inventory adjustments, movement audit trail, and low-stock alerts
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => {
              loadProducts(filterLowStock);
              loadMovements(movementPage, reasonFilter);
            }}
            disabled={isLoadingProducts || isLoadingMovements}
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
            title="Refresh inventory from server"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoadingProducts || isLoadingMovements ? 'animate-spin' : ''}`}
            />
          </button>

          <button
            onClick={handleToggleLowStock}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              filterLowStock
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>{filterLowStock ? 'Showing Low Stock Only' : 'Filter Low Stock Alert'}</span>
          </button>
        </div>
      </div>

      {/* Page Error Banner */}
      {pageError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-800 flex items-start gap-3 shadow-2xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="block font-bold">Failed to sync inventory with server</strong>
            <span>{pageError}</span>
          </div>
          <button
            onClick={() => setPageError(null)}
            className="text-rose-500 hover:text-rose-800 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Stock Overview Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Boxes className="w-4 h-4 text-[#08275E]" />
            <h2 className="text-sm font-bold text-slate-900">
              {filterLowStock ? 'Low Stock Alerts' : 'Warehouse Stock Levels'}
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            {isLoadingProducts ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading items...
              </span>
            ) : (
              `${products.length} products displayed`
            )}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4 font-bold">Product</th>
                <th className="py-3 px-4 font-bold">SKU</th>
                <th className="py-3 px-4 font-bold">Price</th>
                <th className="py-3 px-4 font-bold text-center">Physical Stock</th>
                <th className="py-3 px-4 font-bold text-center">Reserved Stock</th>
                <th className="py-3 px-4 font-bold text-center">Available Stock</th>
                <th className="py-3 px-4 font-bold">Alert Level</th>
                <th className="py-3 px-4 font-bold">Status</th>
                <th className="py-3 px-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingProducts ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#08275E] mb-2" />
                    <span>Fetching live warehouse inventory...</span>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    {filterLowStock ? (
                      <div className="space-y-1">
                        <Check className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                        <strong className="block font-bold text-slate-700">All stock levels healthy!</strong>
                        <span className="text-[11px]">No products are currently at or below their low-stock threshold.</span>
                      </div>
                    ) : (
                      <span>No warehouse products found.</span>
                    )}
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const isLow = p.stockQuantity <= p.lowStockThreshold;
                  const isOut = p.stockQuantity <= 0;
                  const hasVariants = Boolean(p.variants && p.variants.length > 0);
                  const reserved = p.reservedStock || 0;
                  const available = p.availableStock !== undefined ? p.availableStock : Math.max(0, p.stockQuantity - reserved);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900 max-w-xs truncate">
                        <div>
                          <span>{p.name}</span>
                          {hasVariants && (
                            <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                              {p.variants?.length} variants configured
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">{p.sku}</td>
                      <td className="py-3.5 px-4 font-black text-[#08275E]">
                        {formatLKR(p.priceCents)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="text-sm font-black text-slate-900">
                          {p.stockQuantity}
                        </span>
                        {hasVariants && (
                          <span className="text-[10px] text-slate-400 font-medium block">
                            (aggregate)
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`text-sm font-bold ${reserved > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                          {reserved}
                        </span>
                        {reserved > 0 && (
                          <span className="text-[9px] text-amber-600/80 font-medium block">
                            in checkout hold
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`text-sm font-black ${available > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {available}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-medium">
                        {p.lowStockThreshold} units
                      </td>
                      <td className="py-3.5 px-4">
                        {isOut ? (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full uppercase">
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full uppercase">
                            Low Stock
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">
                            Healthy
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => openAdjustModal(p)}
                          className="bg-slate-100 hover:bg-[#08275E] hover:text-white text-[#08275E] font-bold text-[11px] px-3 py-1.5 rounded-xl transition-colors"
                        >
                          Adjust Stock
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

      {/* Inventory Movements Log */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
          <div className="flex items-center gap-1.5">
            <History className="w-4 h-4 text-[#08275E]" />
            <h2 className="text-sm font-bold text-slate-900">
              Audit Trail: Stock Movement History
            </h2>
            <span className="text-xs text-slate-400 ml-2">
              ({movementTotalItems} recorded)
            </span>
          </div>

          {/* Movement Filter by Reason */}
          <div className="flex items-center gap-2 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500 font-medium">Reason:</span>
            <select
              value={reasonFilter}
              onChange={(e) => {
                setReasonFilter(e.target.value);
                setMovementPage(1);
              }}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#08275E]"
            >
              <option value="all">All Reasons</option>
              <option value="RESTOCK">Restock / Intake</option>
              <option value="CORRECTION">Audit Count Correction</option>
              <option value="DAMAGED">Damaged / Expired</option>
              <option value="ORDER_FULFILLMENT">Order Fulfillment</option>
              <option value="DEMO_RESET">Demo Reset</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="pb-2 font-semibold">Timestamp</th>
                <th className="pb-2 font-semibold">Product / SKU</th>
                <th className="pb-2 font-semibold">Reason</th>
                <th className="pb-2 font-semibold">Adjustment</th>
                <th className="pb-2 font-semibold">New Qty</th>
                <th className="pb-2 font-semibold">Actor / User</th>
                <th className="pb-2 font-semibold">Audit Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingMovements ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#08275E] mb-2" />
                    <span>Loading audit records...</span>
                  </td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    No inventory movement logs recorded yet.
                  </td>
                </tr>
              ) : (
                movements.map((m) => {
                  const dateString = m.createdAt || m.timestamp;
                  const formattedDate = dateString
                    ? new Date(dateString).toLocaleString()
                    : 'N/A';
                  const productName = m.product?.name || m.productName || 'Product';
                  const sku = m.variant?.sku || m.product?.sku || m.sku || 'N/A';
                  const reasonLabel = String(m.reason || '').toUpperCase().replace(/_/g, ' ');

                  return (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="py-2.5 text-slate-400 font-mono text-[11px]">
                        {formattedDate}
                      </td>
                      <td className="py-2.5">
                        <span className="font-bold text-slate-800 block truncate max-w-xs">
                          {productName}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400 block">
                          SKU: {sku}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold uppercase">
                          {reasonLabel}
                        </span>
                      </td>
                      <td className="py-2.5 font-bold">
                        <span
                          className={m.changeAmount >= 0 ? 'text-emerald-600' : 'text-rose-600'}
                        >
                          {m.changeAmount >= 0 ? `+${m.changeAmount}` : m.changeAmount}
                        </span>
                      </td>
                      <td className="py-2.5 font-mono font-bold text-slate-900">
                        {m.newQuantity}
                      </td>
                      <td className="py-2.5 text-slate-500 font-mono text-[11px]">
                        {m.performedById || m.performedBy || 'Admin'}
                      </td>
                      <td className="py-2.5 text-slate-500 italic max-w-xs truncate">
                        {m.note || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Movement Pagination Bar */}
        {movementTotalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
            <span className="text-slate-400">
              Page {movementPage} of {movementTotalPages} ({movementTotalItems} total logs)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setMovementPage((p) => Math.max(1, p - 1))}
                disabled={movementPage <= 1 || isLoadingMovements}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1 font-semibold transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>
              <button
                onClick={() => setMovementPage((p) => Math.min(movementTotalPages, p + 1))}
                disabled={movementPage >= movementTotalPages || isLoadingMovements}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1 font-semibold transition-colors"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Adjust Stock Modal */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <form
            onSubmit={handleSaveAdjustment}
            className="bg-white rounded-3xl border border-slate-200 p-6 max-w-md w-full space-y-4 shadow-xl text-xs"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Adjust Warehouse Inventory
              </h3>
              <button
                type="button"
                onClick={() => !isSubmitting && setAdjustingProduct(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Product
              </span>
              <strong className="block text-slate-900 text-xs font-bold">
                {adjustingProduct.name}
              </strong>
              <span className="font-mono text-[11px] text-slate-500">
                Base SKU: {adjustingProduct.sku}
              </span>
              <div className="grid grid-cols-3 gap-2 pt-2 mt-2 border-t border-slate-200/80 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[9px] uppercase font-bold">Physical</span>
                  <strong className="text-slate-800">{adjustingProduct.stockQuantity}</strong>
                </div>
                <div>
                  <span className="text-amber-600 block text-[9px] uppercase font-bold">Reserved</span>
                  <strong className="text-amber-700">{adjustingProduct.reservedStock || 0}</strong>
                </div>
                <div>
                  <span className="text-emerald-700 block text-[9px] uppercase font-bold">Available</span>
                  <strong className="text-emerald-800">
                    {adjustingProduct.availableStock !== undefined
                      ? adjustingProduct.availableStock
                      : Math.max(0, adjustingProduct.stockQuantity - (adjustingProduct.reservedStock || 0))}
                  </strong>
                </div>
              </div>
            </div>

            {/* In-Modal Error Banner */}
            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-start gap-2 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Variant Picker (if product has variants) */}
            {adjustingProduct.variants && adjustingProduct.variants.length > 0 && (
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Target Product Option / Variant *
                </label>
                <select
                  value={selectedVariantId}
                  onChange={(e) => handleVariantChange(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white font-medium"
                >
                  <option value="">
                    Base Product Aggregate (Current: {adjustingProduct.stockQuantity} units)
                  </option>
                  {adjustingProduct.variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.sku}) — Current: {v.stockQuantity} units
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Selecting a variant updates its specific SKU stock and increments the parent aggregate in lockstep.
                </span>
              </div>
            )}

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                New Target Stock Level (Units) *
              </label>
              <input
                type="number"
                min="0"
                value={newQuantity}
                onChange={(e) => setNewQuantity(Math.max(0, Number(e.target.value)))}
                disabled={isSubmitting}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#08275E]/20"
              />
              <span className="text-[11px] text-slate-400 mt-1 block font-medium">
                Current stock: <strong className="text-slate-700">{getSelectedStock()}</strong>. Signed change amount: {' '}
                <strong
                  className={
                    newQuantity - getSelectedStock() >= 0
                      ? 'text-emerald-600'
                      : 'text-rose-600'
                  }
                >
                  {newQuantity - getSelectedStock() >= 0
                    ? `+${newQuantity - getSelectedStock()}`
                    : newQuantity - getSelectedStock()}
                </strong>
              </span>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Adjustment Reason *
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as any)}
                disabled={isSubmitting}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white"
              >
                <option value="RESTOCK">Restock / Container Intake</option>
                <option value="CORRECTION">Audit Stock Count Correction</option>
                <option value="DAMAGED">Damaged / Expired Stationery</option>
                <option value="ORDER_FULFILLMENT">Manual Order Fulfillment</option>
                <option value="DEMO_RESET">Demo Reset</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Audit Note (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Received shipment container from Atlas warehouse"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={isSubmitting}
                maxLength={500}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
              />
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAdjustingProduct(null)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || newQuantity - getSelectedStock() === 0}
                className="bg-[#08275E] hover:bg-[#103b8c] text-white font-bold px-5 py-2 rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : successMsg ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirmed!</span>
                  </>
                ) : (
                  <span>Confirm Adjustment</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
