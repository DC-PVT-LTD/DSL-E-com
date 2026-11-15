'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { X, ShoppingBag, Plus, Minus, Trash2, ArrowRight, Tag, Truck, Check } from 'lucide-react';
import { useCartStore } from '@/services/cartStore';
import { formatLKR, FREE_DELIVERY_THRESHOLD_CENTS } from '@/lib/currency';
import { WhatsAppOrderButton } from '@/components/cart/WhatsAppOrderButton';

export const CartDrawer: React.FC = () => {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponMsg, setCouponMsg] = useState<{ text: string; error: boolean } | null>(null);

  const isDrawerOpen = useCartStore((state) => state.isDrawerOpen);
  const setDrawerOpen = useCartStore((state) => state.setDrawerOpen);
  const items = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const toggleItemSelection = useCartStore((state) => state.toggleItemSelection);
  const selectAllItems = useCartStore((state) => state.selectAllItems);
  const applyPromoCode = useCartStore((state) => state.applyPromoCode);
  const removePromoCode = useCartStore((state) => state.removePromoCode);
  const getSummary = useCartStore((state) => state.getSummary);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isDrawerOpen) {
      useCartStore.getState().fetchCart();
    }
  }, [isDrawerOpen]);

  if (!mounted) return null;
  if (!isDrawerOpen) return null;

  const summary = getSummary();
  const remainingForFreeDelivery = Math.max(0, FREE_DELIVERY_THRESHOLD_CENTS - summary.subtotalCents);
  const freeDeliveryPercent = Math.min(100, Math.round((summary.subtotalCents / FREE_DELIVERY_THRESHOLD_CENTS) * 100));

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    const res = applyPromoCode(couponCode);
    setCouponMsg({ text: res.message, error: !res.success });
    if (res.success) setCouponCode('');
  };

  const handleCheckoutClick = () => {
    setDrawerOpen(false);
    router.push('/checkout');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-fade-in select-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#09285C]/60 backdrop-blur-xs transition-opacity"
        onClick={() => setDrawerOpen(false)}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-slate-200">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#EAF4FF] flex items-center justify-center text-[#0866E8]">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-black text-[#09285C]">Shopping Bag</h2>
                <p className="text-[11px] text-[#64748B]">{summary.itemCount} item{summary.itemCount === 1 ? '' : 's'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="p-2 text-slate-400 hover:text-[#09285C] hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              aria-label="Close cart"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Free Delivery Bar */}
          <div className="px-5 py-3 bg-[#F7FAFF] border-b border-slate-100">
            <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
              <span className="flex items-center gap-1.5 text-[#0866E8] font-bold text-[11px]">
                <Truck className="w-3.5 h-3.5 text-[#0866E8]" />
                {summary.isFreeDeliveryEligible
                  ? '🌸 You unlocked FREE Islandwide Delivery!'
                  : `Add ${formatLKR(remainingForFreeDelivery)} more for FREE Delivery`}
              </span>
              <span className="text-[#09285C] font-bold text-[10px]">{freeDeliveryPercent}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0866E8] rounded-full transition-all duration-300"
                style={{ width: `${freeDeliveryPercent}%` }}
              />
            </div>
          </div>

          {/* Cart Item List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
            {summary.items.length === 0 ? (
              <div className="text-center py-16 px-4 space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-[#EAF4FF] flex items-center justify-center mx-auto text-[#0866E8]">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h3 className="text-base font-black text-[#09285C]">Your bag is empty</h3>
                <p className="text-xs text-[#64748B] max-w-xs mx-auto leading-relaxed">
                  Discover our school packs, stationery supplies, and joyful creative tools.
                </p>
                <div className="pt-2">
                  <Link
                    href="/shop"
                    onClick={() => setDrawerOpen(false)}
                    className="inline-flex items-center gap-2 bg-[#09285C] hover:bg-[#0866E8] text-white text-xs font-bold px-6 py-3 rounded-2xl shadow-xs transition-colors touch-target"
                  >
                    <span>Start Shopping</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {/* Select All Toggle Bar */}
                <div className="flex items-center justify-between pb-1 px-1">
                  <label className="flex items-center gap-2 text-xs font-bold text-[#09285C] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={summary.items.length > 0 && summary.items.every((i) => i.selected !== false)}
                      onChange={(e) => selectAllItems(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-[#0866E8] focus:ring-[#0866E8] cursor-pointer"
                    />
                    <span>Select All ({summary.selectedItemCount}/{summary.itemCount})</span>
                  </label>
                  {summary.selectedItemCount < summary.itemCount && (
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      Partial
                    </span>
                  )}
                </div>

                {summary.items.map((item) => {
                  const isSelected = item.selected !== false;
                  return (
                    <div
                      key={item.id}
                      className={`flex gap-3 p-3 bg-[#F7FAFF] rounded-2xl border transition-all ${
                        !isSelected ? 'border-slate-200 opacity-60' : 'border-slate-200'
                      }`}
                    >
                      {/* Checkbox */}
                      <div className="pt-3 shrink-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleItemSelection(item.id)}
                          aria-label={`Select ${item.product.name}`}
                          className="w-4 h-4 rounded text-[#0866E8] focus:ring-[#0866E8] cursor-pointer"
                        />
                      </div>

                      <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[#0866E8] font-bold text-sm shrink-0 p-1">
                        {item.product.images && item.product.images.length > 0 && typeof item.product.images[0] === 'string' && item.product.images[0].startsWith('http') ? (
                          <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-contain" />
                        ) : (
                          <span>{item.product.name.charAt(0)}</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-[#09285C] truncate">
                          {item.product.name}
                        </h4>
                        {item.variant && (
                          <p className="text-[10px] text-[#64748B] mt-0.5">
                            {item.variant.name}
                          </p>
                        )}
                        <div className="text-xs font-black text-[#09285C] mt-1">
                          {formatLKR(item.unitPriceCents)}
                        </div>

                        {/* Quantity controls */}
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="p-1 hover:bg-slate-50 text-[#09285C] transition-colors"
                              title="Decrease"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-2 py-0.5 text-xs font-black text-[#09285C]">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="p-1 hover:bg-slate-50 text-[#09285C] transition-colors"
                              title="Increase"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                            title="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Footer & Checkout Action */}
          {summary.items.length > 0 && (
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-white space-y-3 pb-safe">
              {/* Promo code form */}
              {summary.appliedDiscount ? (
                <div className="flex items-center justify-between bg-[#EAF4FF] border border-[#0866E8]/20 text-[#0866E8] px-3 py-1.5 rounded-xl text-xs font-medium">
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-[#0866E8]" />
                    <span>Coupon <strong>{summary.appliedDiscount.code}</strong> (-{formatLKR(summary.discountCents)})</span>
                  </div>
                  <button
                    type="button"
                    onClick={removePromoCode}
                    className="text-rose-600 hover:underline font-bold text-[11px]"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Coupon (e.g. 20OFF)"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-[#F7FAFF] border border-slate-200 rounded-xl text-xs uppercase font-semibold text-[#09285C] focus:outline-hidden focus:border-[#0866E8]"
                    />
                    <Tag className="w-3.5 h-3.5 text-[#0866E8] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                  <button
                    type="submit"
                    className="bg-[#09285C] hover:bg-[#0866E8] text-white text-xs font-bold px-4 py-1.5 rounded-xl transition-colors cursor-pointer"
                  >
                    Apply
                  </button>
                </form>
              )}

              {/* Price Breakdown */}
              <div className="space-y-1.5 text-xs pt-1">
                <div className="flex justify-between text-[#64748B]">
                  <span>Subtotal</span>
                  <span className="font-bold text-[#09285C]">{formatLKR(summary.subtotalCents)}</span>
                </div>
                {summary.discountCents > 0 && (
                  <div className="flex justify-between text-[#0866E8] font-semibold">
                    <span>Discounts</span>
                    <span>-{formatLKR(summary.discountCents)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#64748B]">
                  <span>Delivery</span>
                  <span className="font-bold text-[#09285C]">
                    {summary.deliveryCents === 0 ? (
                      <span className="text-emerald-700 font-bold">FREE</span>
                    ) : (
                      formatLKR(summary.deliveryCents)
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-black text-[#09285C] pt-2 border-t border-slate-100">
                  <span>Total</span>
                  <span className="text-base text-[#0866E8] font-black">{formatLKR(summary.totalCents)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleCheckoutClick}
                  disabled={summary.selectedItemCount === 0}
                  className="w-full flex items-center justify-center gap-2 bg-[#09285C] hover:bg-[#0866E8] disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-2xl font-bold text-xs sm:text-sm shadow-md transition-all touch-target cursor-pointer"
                >
                  <span>
                    {summary.selectedItemCount === 0
                      ? 'Select Items to Checkout'
                      : `Proceed to Checkout (${summary.selectedItemCount})`}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <WhatsAppOrderButton summary={summary} variant="compact" />

                <Link
                  href="/cart"
                  onClick={() => setDrawerOpen(false)}
                  className="w-full block text-center py-1 text-xs font-bold text-[#0866E8] hover:underline transition-colors"
                >
                  View Full Cart Page
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
