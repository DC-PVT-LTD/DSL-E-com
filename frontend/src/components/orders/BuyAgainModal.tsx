'use client';

import React from 'react';
import Link from 'next/link';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShoppingBag,
  ArrowRight,
  TrendingUp,
  Package,
  Sparkles,
} from 'lucide-react';
import { BuyAgainResponse } from '@/types/order';
import { formatLKR } from '@/lib/currency';

interface BuyAgainModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: BuyAgainResponse | null;
}

export const BuyAgainModal: React.FC<BuyAgainModalProps> = ({ isOpen, onClose, result }) => {
  if (!isOpen || !result) return null;

  const { items, summary, orderNumber } = result;
  const hasAddedItems = summary.totalAddedQuantity > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-2xl rounded-3xl border border-[#C6E7FF] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#C6E7FF]/40 flex items-center justify-between bg-gradient-to-r from-[#F0F7FF] via-[#FFFDF0] to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0066CC] text-white flex items-center justify-center shadow-xs">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#0066CC] uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Buy Again Summary</span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-[#292525]">
                Reorder from #{orderNumber}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-stone-200 hover:border-stone-400 flex items-center justify-center text-stone-500 hover:text-stone-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary Badges Bar */}
        <div className="px-6 py-3 bg-[#FFFDF0]/70 border-b border-[#C6E7FF]/30 flex flex-wrap gap-2 text-xs">
          {summary.availableCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{summary.availableCount} In Stock</span>
            </span>
          )}
          {summary.partialCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>{summary.partialCount} Quantity Adjusted</span>
            </span>
          )}
          {summary.unavailableCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200 font-semibold">
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>{summary.unavailableCount} Unavailable</span>
            </span>
          )}
        </div>

        {/* Item List */}
        <div className="p-6 overflow-y-auto space-y-3 divide-y divide-stone-100 flex-1">
          {items.map((it) => {
            const isAvailable = it.status === 'AVAILABLE';
            const isPartial = it.status === 'PARTIAL';
            const isUnavailable = it.status === 'UNAVAILABLE';

            return (
              <div key={it.orderItemId} className="pt-3 first:pt-0 flex items-start justify-between gap-4 text-xs">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    {isAvailable && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                    {isPartial && (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    {isUnavailable && (
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <h4 className="font-bold text-[#292525]">{it.productName}</h4>
                  </div>

                  {it.variantName && (
                    <p className="text-[11px] text-[#0066CC] font-medium pl-6">
                      Variant: {it.variantName}
                    </p>
                  )}

                  {it.bundleInfo && (
                    <span className="inline-block ml-6 text-[10px] font-bold text-[#0066CC] bg-[#C6E7FF]/40 px-2 py-0.5 rounded-full">
                      🎒 {it.bundleInfo.packName} ({it.bundleInfo.savingsPercentage}% Bundle Savings)
                    </span>
                  )}

                  {/* Quantity & Status feedback */}
                  <div className="pl-6 text-[11px] space-y-0.5">
                    {isAvailable && (
                      <p className="text-emerald-700 font-medium">
                        Added {it.availableQuantity} of {it.requestedQuantity} to cart
                      </p>
                    )}
                    {isPartial && (
                      <p className="text-amber-700 font-medium">
                        Stock limited: Added {it.availableQuantity} to cart (requested {it.requestedQuantity})
                      </p>
                    )}
                    {isUnavailable && (
                      <p className="text-rose-700 font-medium">
                        {it.reason === 'OUT_OF_STOCK'
                          ? 'Out of stock in warehouse (not added)'
                          : it.reason === 'DISCONTINUED' || it.reason === 'VARIANT_DISCONTINUED'
                          ? 'Product or variant discontinued (not added)'
                          : 'Currently unavailable (not added)'}
                      </p>
                    )}

                    {/* Price change notice */}
                    {it.priceChanged && it.availableQuantity > 0 && (
                      <p className="text-[#0066CC] inline-flex items-center gap-1 font-semibold text-[10px] bg-[#F0F7FF] px-2 py-0.5 rounded">
                        <TrendingUp className="w-3 h-3" />
                        Price updated: {formatLKR(it.currentPriceCents)} (was {formatLKR(it.historicalPriceCents)} in previous order)
                      </p>
                    )}
                  </div>
                </div>

                {/* Price column */}
                <div className="text-right shrink-0">
                  {it.availableQuantity > 0 ? (
                    <div>
                      <span className="font-bold text-[#292525] text-xs">
                        {formatLKR(it.availableQuantity * it.currentPriceCents)}
                      </span>
                      <span className="block text-[10px] text-[#292525]/50">
                        {it.availableQuantity} × {formatLKR(it.currentPriceCents)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                      Unavailable
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer / Actions */}
        <div className="p-6 bg-[#F8FAFC] border-t border-[#C6E7FF]/40 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-[#292525]">Added to Cart</span>
              <p className="text-[10px] text-[#292525]/50">
                {summary.totalAddedQuantity} {summary.totalAddedQuantity === 1 ? 'unit' : 'units'} added &bull; Existing cart items preserved
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[#292525]/50 block uppercase">Added Value</span>
              <strong className="text-base font-extrabold text-[#0066CC]">
                {formatLKR(summary.estimatedTotalCents)}
              </strong>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full border border-stone-200 text-xs font-bold text-[#292525] hover:bg-white transition-all shadow-xs"
            >
              Continue Shopping
            </button>

            {hasAddedItems ? (
              <Link
                href="/cart"
                onClick={onClose}
                className="bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold px-6 py-2.5 rounded-full transition-all shadow-md flex items-center gap-2"
              >
                <span>Review Cart &amp; Checkout</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <Link
                href="/shop"
                onClick={onClose}
                className="bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold px-6 py-2.5 rounded-full transition-all shadow-md flex items-center gap-2"
              >
                <span>Browse Catalogue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

