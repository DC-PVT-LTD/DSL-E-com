'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Plus,
  Minus,
  Check,
  ShoppingCart,
  ArrowLeft,
  RefreshCw,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { schoolPackService } from '@/services/schoolPackService';
import { SchoolPack, SchoolPackItem, SchoolPackSubstitute } from '@/types/school-pack';
import { formatLKR } from '@/lib/currency';
import { useCartStore } from '@/services/cartStore';
import { inventorySocketService, LiveStockUpdate } from '@/services/inventorySocketService';

export type PackStockStatus = 'IN_STOCK' | 'LIMITED_STOCK' | 'OUT_OF_STOCK';

interface ConfiguredItem {
  itemId: string;
  productId: string;
  productName: string;
  sku?: string;
  imageUrl?: string;
  quantity: number;
  unitPriceCents: number;
  stockQuantity: number;
  substitutes: SchoolPackSubstitute[];
  originalProduct: any;
}

function SchoolPackCustomizerContent() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const addSchoolPack = useCartStore((state) => state.addSchoolPack);
  const setDrawerOpen = useCartStore((state) => state.setDrawerOpen);

  const [pack, setPack] = useState<SchoolPack | null>(null);
  const [items, setItems] = useState<ConfiguredItem[]>([]);
  const [added, setAdded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [serverSavingsCents, setServerSavingsCents] = useState<number>(0);
  const [serverTotalCents, setServerTotalCents] = useState<number>(0);
  const [serverSubtotalCents, setServerSubtotalCents] = useState<number>(0);
  const [isCalculating, setIsCalculating] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [liveStockWarning, setLiveStockWarning] = useState<string | null>(null);

  // Dynamic pack availability evaluation based on all component quantities
  const packStockStatus: PackStockStatus = React.useMemo(() => {
    if (items.length === 0) return 'IN_STOCK';
    const anyOutOfStock = items.some(
      (item) => item.stockQuantity <= 0 || item.quantity > item.stockQuantity
    );
    if (anyOutOfStock) return 'OUT_OF_STOCK';
    const anyLowStock = items.some((item) => item.stockQuantity <= 5);
    if (anyLowStock) return 'LIMITED_STOCK';
    return 'IN_STOCK';
  }, [items]);

  useEffect(() => {
    let isMounted = true;

    async function loadPack() {
      setIsLoading(true);
      try {
        const p = await schoolPackService.getPackById(id);
        if (!isMounted) return;

        if (p) {
          setPack(p);
          const configured: ConfiguredItem[] = p.items.map((i) => ({
            itemId: i.id,
            productId: i.productId,
            productName: i.productName || i.product?.name || 'Stationery Item',
            sku: i.product?.sku,
            imageUrl: i.product?.images?.[0],
            quantity: i.defaultQuantity,
            unitPriceCents: i.unitPriceCents,
            stockQuantity: i.stockQuantity ?? i.product?.stockQuantity ?? 100,
            substitutes: i.substitutes || [],
            originalProduct: i.product,
          }));
          setItems(configured);

          // Initial pricing calculation
          calculatePricing(p, configured);
        }
      } catch (err) {
        console.error('Failed to load pack:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadPack();

    return () => {
      isMounted = false;
    };
  }, [id]);

  // Real-time stock subscription for all component products and active substitutes
  useEffect(() => {
    if (items.length === 0) return;

    // Collect all product IDs to subscribe to
    const productIds = new Set<string>();
    items.forEach((item) => {
      if (item.productId) productIds.add(item.productId);
      item.substitutes?.forEach((sub) => {
        const sId = sub.id || sub.productId;
        if (sId) productIds.add(sId);
      });
    });

    const unsubs: (() => void)[] = [];

    productIds.forEach((pid) => {
      const unsub = inventorySocketService.subscribeProduct(pid, (update: LiveStockUpdate) => {
        // Also update cart store if user currently holds this item in their cart
        useCartStore.getState().updateStockAvailability(
          update.productId,
          update.variantId,
          update.availableStock
        );

        setItems((prevItems) => {
          let updatedAny = false;
          let warningMsg: string | null = null;

          const nextItems = prevItems.map((item) => {
            // 1. Check if the updated product is the currently selected component product
            if (item.productId === update.productId) {
              updatedAny = true;
              const newStock = update.availableStock;
              const currentQty = item.quantity;
              let newQty = currentQty;

              if (newStock <= 0) {
                warningMsg = `Live update: "${item.productName}" is now out of stock.`;
              } else if (currentQty > newStock) {
                newQty = Math.max(1, newStock);
                warningMsg = `Live update: Stock for "${item.productName}" dropped to ${newStock}. Quantity adjusted to ${newQty}.`;
              }

              return {
                ...item,
                stockQuantity: newStock,
                quantity: newQty,
              };
            }

            // 2. Check if the updated product is in substitutes
            if (item.substitutes?.some((s) => (s.id || s.productId) === update.productId)) {
              return {
                ...item,
                substitutes: item.substitutes.map((s) => {
                  if ((s.id || s.productId) === update.productId) {
                    return { ...s, stockQuantity: update.availableStock };
                  }
                  return s;
                }),
              };
            }

            return item;
          });

          if (warningMsg) {
            setLiveStockWarning(warningMsg);
          }

          if (updatedAny && pack) {
            calculatePricing(pack, nextItems);
          }

          return nextItems;
        });
      });

      unsubs.push(unsub);
    });

    // Reconnect handler for authoritative stock re-fetch from REST API
    const unsubReconnect = inventorySocketService.onReconnect(async () => {
      try {
        const freshPack = await schoolPackService.getPackById(id);
        if (freshPack) {
          setPack(freshPack);
          setItems((currentItems) => {
            const updated = currentItems.map((ci) => {
              const freshItem = freshPack.items.find((fi) => fi.productId === ci.productId);
              if (freshItem) {
                const newStock = freshItem.stockQuantity ?? freshItem.product?.stockQuantity ?? ci.stockQuantity;
                return {
                  ...ci,
                  stockQuantity: newStock,
                  quantity: Math.min(ci.quantity, Math.max(1, newStock)),
                  unitPriceCents: freshItem.unitPriceCents,
                };
              }
              return ci;
            });
            calculatePricing(freshPack, updated);
            return updated;
          });
        }
      } catch (err) {
        console.error('Failed to refetch pack on socket reconnect:', err);
      }
    });

    unsubs.push(unsubReconnect);

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [items.map((i) => i.productId).join(','), id, pack?.id]);

  const calculatePricing = async (currentPack: SchoolPack, currentItems: ConfiguredItem[]) => {
    const rawSubtotal = currentItems.reduce(
      (acc, i) => acc + i.unitPriceCents * i.quantity,
      0
    );
    const savings = Math.round((rawSubtotal * currentPack.savingsPercentage) / 100);
    const total = Math.max(0, rawSubtotal - savings);

    setServerSubtotalCents(rawSubtotal);
    setServerSavingsCents(savings);
    setServerTotalCents(total);

    // Call server calculation in background for authoritative verification
    try {
      setIsCalculating(true);
      const res = await schoolPackService.calculateCustomized(
        currentPack.id,
        currentItems.map((ci) => ({ productId: ci.productId, quantity: ci.quantity }))
      );
      if (res) {
        setServerSubtotalCents(res.calculatedOriginalSubtotalCents);
        setServerSavingsCents(res.calculatedSavingsCents);
        setServerTotalCents(res.calculatedTotalCents);
      }
    } catch {
      // Fallback already set above
    } finally {
      setIsCalculating(false);
    }
  };

  const handleUpdateQty = (itemId: string, newQty: number) => {
    if (newQty < 1 || !pack) return;
    const updated = items.map((i) => {
      if (i.itemId === itemId) {
        const clampedQty = Math.min(newQty, Math.max(1, i.stockQuantity));
        return { ...i, quantity: clampedQty };
      }
      return i;
    });
    setItems(updated);
    calculatePricing(pack, updated);
  };

  const handleSubstitute = (itemId: string, sub: SchoolPackSubstitute) => {
    if (!pack) return;
    const updated = items.map((i) => {
      if (i.itemId === itemId) {
        const subId = sub.id || sub.productId || '';
        const subName = sub.name || sub.productName || 'Substitute Product';
        const subPrice = sub.priceCents ?? sub.unitPriceCents ?? 0;
        const subStock = sub.stockQuantity ?? 10;
        return {
          ...i,
          productId: subId,
          productName: subName,
          sku: sub.sku,
          imageUrl: sub.images?.[0],
          unitPriceCents: subPrice,
          stockQuantity: subStock,
          quantity: Math.min(i.quantity, subStock),
        };
      }
      return i;
    });
    setItems(updated);
    calculatePricing(pack, updated);
  };

  const handleAddToCart = async () => {
    if (!pack) return;
    setCartError(null);

    // Dynamic stock status check
    if (packStockStatus === 'OUT_OF_STOCK') {
      setCartError(
        'Cannot add school pack: one or more items are out of stock or requested quantity exceeds available stock. Please adjust quantities or select available substitutes.'
      );
      return;
    }

    // Validate component stock
    const oos = items.find((i) => i.quantity > i.stockQuantity || i.stockQuantity <= 0);
    if (oos) {
      setCartError(
        `Item '${oos.productName}' only has ${oos.stockQuantity} units available. Please adjust your quantity.`
      );
      return;
    }

    try {
      const payloadItems = items.map((i) => ({
        productId: i.productId,
        product: {
          id: i.productId,
          name: i.productName,
          slug: i.productId,
          sku: i.sku || i.productId,
          description: '',
          shortDescription: '',
          priceCents: i.unitPriceCents,
          stockQuantity: i.stockQuantity,
          lowStockThreshold: 5,
          isActive: true,
          isFeatured: false,
          isNewArrival: false,
          isBestSeller: false,
          images: i.imageUrl ? [i.imageUrl] : [],
          tags: [],
          rating: 5,
          reviewCount: 0,
          specifications: {},
          categoryId: '',
          categoryName: 'School Stationery',
          brandId: '',
          brandName: '',
          createdAt: '',
          updatedAt: '',
        },
        quantity: i.quantity,
      }));

      const success = await addSchoolPack(
        {
          id: pack.id,
          name: pack.name,
          savingsPercentage: pack.savingsPercentage,
        },
        payloadItems
      );

      if (success) {
        setAdded(true);
        setTimeout(() => {
          setAdded(false);
          setDrawerOpen(true);
        }, 600);
      } else {
        setCartError('Failed to add school pack to cart. Please try again.');
      }
    } catch (err: any) {
      setCartError(err?.message || 'Failed to add school pack to cart.');
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-10 h-10 border-4 border-[#0066CC] border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-xs text-[#292525]/60 font-medium">Loading school pack configuration...</p>
      </div>
    );
  }

  if (!pack) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-[#292525]">School Pack Not Found</h1>
        <p className="text-xs text-[#292525]/60 mt-1">
          The requested pack may be retired or unavailable.
        </p>
        <Link
          href="/school-packs"
          className="mt-4 inline-flex items-center gap-1.5 bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold px-5 py-2.5 rounded-full shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to School Packs</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-10">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-1.5 text-xs text-[#292525]/50 font-medium">
        <Link href="/home" className="hover:text-[#0066CC]">Home</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link href="/school-packs" className="hover:text-[#0066CC]">School Packs</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-[#292525] font-bold">{pack.name}</span>
      </nav>

      {/* Hero Card */}
      <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs font-bold text-[#292525] bg-[#FFFDF0] border border-[#C6E7FF] px-3 py-0.5 rounded-full">
              {pack.grade}
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider text-[#594300] bg-[#FFD84D] px-2.5 py-0.5 rounded-full">
              {pack.tier} tier
            </span>
            {packStockStatus === 'IN_STOCK' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>All Components In Stock</span>
              </span>
            )}
            {packStockStatus === 'LIMITED_STOCK' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Limited Stock Available</span>
              </span>
            )}
            {packStockStatus === 'OUT_OF_STOCK' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                <span>Components Out of Stock</span>
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#292525] leading-tight">
            {pack.name}
          </h1>
          <p className="text-xs sm:text-sm text-[#292525]/70 mt-2 max-w-xl leading-relaxed">
            {pack.description}
          </p>
        </div>

        <div className="bg-[#FFFDF0] border border-[#C6E7FF] rounded-2xl p-5 text-center shrink-0">
          <span className="text-[10px] font-bold text-[#292525]/50 uppercase tracking-wider block">
            Customized Total (LKR)
          </span>
          <span className="text-2xl sm:text-3xl font-black text-[#0066CC] block mt-0.5">
            {formatLKR(serverTotalCents)}
          </span>
          <span className="text-[11px] font-bold text-emerald-600 block mt-1">
            Includes {pack.savingsPercentage}% Bundle Savings (-{formatLKR(serverSavingsCents)})
          </span>
        </div>
      </div>

      {/* Live Stock Warning Banner */}
      {liveStockWarning && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-center justify-between gap-3 text-amber-900 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-medium">{liveStockWarning}</span>
          </div>
          <button
            onClick={() => setLiveStockWarning(null)}
            className="text-amber-800 hover:text-black font-bold text-xs underline shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Out of Stock Component Warning */}
      {packStockStatus === 'OUT_OF_STOCK' && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Pack currently cannot be fulfilled:</p>
            <p className="mt-0.5">
              One or more items in this school pack have run out of stock or requested quantity exceeds available stock. Please swap out-of-stock items with available substitutes below or adjust quantities.
            </p>
          </div>
        </div>
      )}

      {/* Cart Error Notice */}
      {cartError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Cannot add school pack to bag:</p>
            <p className="mt-0.5">{cartError}</p>
          </div>
        </div>
      )}

      {/* Items Customization */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#292525]">Customize Pack Contents</h2>
          <span className="text-xs text-[#292525]/50">Adjust quantities or substitute brands</span>
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.itemId}
              className={`bg-white rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs transition-all ${
                item.stockQuantity <= 0
                  ? 'border-rose-300 bg-rose-50/20'
                  : item.quantity > item.stockQuantity
                  ? 'border-amber-300 bg-amber-50/20'
                  : 'border-[#C6E7FF]/60 hover:border-[#0066CC]'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-[#FFFDF0] border border-[#C6E7FF] overflow-hidden flex items-center justify-center text-[#0066CC] font-bold text-base shrink-0">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.productName}
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <span>{item.productName.charAt(0)}</span>
                  )}
                </div>

                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-[#292525]">{item.productName}</h3>
                  <div className="flex items-center gap-3 text-[11px] text-[#292525]/60 mt-0.5 flex-wrap">
                    <span>Unit: {formatLKR(item.unitPriceCents)}</span>
                    {item.stockQuantity <= 0 ? (
                      <span className="text-rose-600 font-bold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-rose-500" />
                        <span>Out of Stock</span>
                      </span>
                    ) : item.stockQuantity <= 5 ? (
                      <span className="text-amber-700 font-bold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-amber-500" />
                        <span>Low Stock: Only {item.stockQuantity} left</span>
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-medium">In Stock ({item.stockQuantity})</span>
                    )}
                  </div>

                  {/* Substitute Options */}
                  {item.substitutes && item.substitutes.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="text-[10px] font-semibold text-[#292525]/50">Swap Brand:</span>
                      {item.substitutes.map((sub, sIdx) => {
                        const subId = sub.id || sub.productId || `sub-${sIdx}`;
                        const subName = sub.name || sub.productName || 'Substitute';
                        const subPrice = sub.priceCents ?? sub.unitPriceCents ?? 0;
                        const subStock = sub.stockQuantity ?? 0;
                        return (
                          <button
                            key={subId}
                            onClick={() => handleSubstitute(item.itemId, sub)}
                            disabled={subStock <= 0}
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 transition-all ${
                              subId === item.productId
                                ? 'bg-[#0066CC] text-white shadow-xs'
                                : 'text-[#0066CC] hover:underline bg-[#FFFDF0] border border-[#C6E7FF]/60'
                            } disabled:opacity-40 disabled:cursor-not-allowed`}
                          >
                            <RefreshCw className="w-2.5 h-2.5" />
                            <span>
                              {subName.split(' ')[0]} ({formatLKR(subPrice)}) {subStock <= 0 ? '(OOS)' : ''}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-6 pl-16 sm:pl-0">
                {/* Quantity Controls */}
                <div className="flex items-center border border-[#C6E7FF] rounded-full overflow-hidden bg-[#FFFDF0]">
                  <button
                    onClick={() => handleUpdateQty(item.itemId, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                    className="p-1.5 hover:bg-[#C6E7FF]/40 text-[#292525] disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-3 text-xs font-bold text-[#292525]">{item.quantity}</span>
                  <button
                    onClick={() => handleUpdateQty(item.itemId, item.quantity + 1)}
                    disabled={item.quantity >= item.stockQuantity || item.stockQuantity <= 0}
                    className="p-1.5 hover:bg-[#C6E7FF]/40 text-[#292525] disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="text-right min-w-24">
                  <span className="text-sm font-black text-[#0066CC] block">
                    {formatLKR(item.unitPriceCents * item.quantity)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md sticky bottom-6 z-10">
        <div>
          <span className="text-xs text-[#292525]/60 block">
            Bundle Price ({items.length} items customized):
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#0066CC]">{formatLKR(serverTotalCents)}</span>
            <span className="text-xs text-emerald-600 font-bold">
              Save {formatLKR(serverSavingsCents)} ({pack.savingsPercentage}% Off)
            </span>
          </div>
        </div>

        <button
          onClick={handleAddToCart}
          disabled={added || isCalculating || packStockStatus === 'OUT_OF_STOCK'}
          className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 font-bold text-sm px-8 py-3.5 rounded-full shadow-md transition-all ${
            packStockStatus === 'OUT_OF_STOCK'
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
              : 'bg-[#0066CC] hover:bg-[#0052a3] text-white hover:shadow-lg disabled:opacity-75'
          }`}
        >
          {added ? (
            <>
              <Check className="w-4 h-4 text-white" />
              <span>Pack Added to Cart!</span>
            </>
          ) : packStockStatus === 'OUT_OF_STOCK' ? (
            <>
              <AlertCircle className="w-4 h-4 text-gray-500" />
              <span>Unavailable — Components Out of Stock</span>
            </>
          ) : (
            <>
              <ShoppingCart className="w-4 h-4 text-white" />
              <span>Add Complete School Pack to Cart</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default function SchoolPackCustomizerPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-[#292525]/50">Loading pack customizer...</div>}>
      <SchoolPackCustomizerContent />
    </Suspense>
  );
}
