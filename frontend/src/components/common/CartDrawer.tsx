'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { X, ShoppingBag, Plus, Minus, Trash2, ArrowRight, Tag, Truck, Check } from 'lucide-react';
import { useCartStore } from '@/services/cartStore';
import { formatLKR, FREE_DELIVERY_THRESHOLD_CENTS } from '@/lib/currency';

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
  const applyPromoCode = useCartStore((state) => state.applyPromoCode);
  const removePromoCode = useCartStore((state) => state.removePromoCode);
  const getSummary = useCartStore((state) => state.getSummary);

  useEffect(() => {
    setMounted(true);
  }, []);

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
        className="absolute inset-0 bg-[#292525]/40 backdrop-blur-xs transition-opacity"
        onClick={() => setDrawerOpen(false)}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[#FFFDF0] shadow-2xl flex flex-col border-l border-[#C6E7FF]">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-[#C6E7FF]/60 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#C6E7FF]/40 flex items-center justify-center text-[#0066CC]">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#292525]">Shopping Bag</h2>
                <p className="text-[11px] text-[#292525]/50">{summary.itemCount} item{summary.itemCount === 1 ? '' : 's'}</p>
              </div>
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              className="p-1.5 text-[#292525]/50 hover:text-[#292525] hover:bg-[#C6E7FF]/30 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Free Delivery Bar */}
          <div className="px-5 py-3 bg-white border-b border-[#C6E7FF]/40">
            <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
              <span className="flex items-center gap-1.5 text-[#0066CC] font-semibold text-[11px]">
                <Truck className="w-3.5 h-3.5 text-[#0066CC]" />
                {summary.isFreeDeliveryEligible
                  ? '🌸 You unlocked FREE Islandwide Delivery!'
                  : `Add ${formatLKR(remainingForFreeDelivery)} more for FREE Delivery`}
              </span>
              <span className="text-[#292525]/70 font-bold text-[10px]">{freeDeliveryPercent}%</span>
            </div>
            <div className="w-full h-2 bg-[#FAF7EE] rounded-full overflow-hidden border border-[#C6E7FF]/40">
              <div
                className="h-full bg-[#0066CC] transition-all duration-300"
                style={{ width: `${freeDeliveryPercent}%` }}
              />
            </div>
          </div>

          {/* Cart Item List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
            {summary.items.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-16 h-16 rounded-full bg-[#C6E7FF]/30 flex items-center justify-center mx-auto mb-4 text-[#0066CC]">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-[#292525]">Your bag is empty</h3>
                <p className="text-xs text-[#292525]/60 mt-1 max-w-xs mx-auto leading-relaxed">
                  Discover our colourful pastel stationery, school packs, and joyful desk items.
                </p>
                <Link
                  href="/shop"
                  onClick={() => setDrawerOpen(false)}
                  className="mt-5 inline-flex items-center gap-2 bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold px-6 py-2.5 rounded-full shadow-xs transition-colors"
                >
                  Start Shopping
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              summary.items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3 p-3.5 bg-white rounded-2xl border border-[#C6E7FF]/60 shadow-xs"
                >
                  <div className="w-16 h-16 rounded-xl bg-[#FAF7EE] border border-[#C6E7FF]/40 flex items-center justify-center text-[#0066CC] font-bold text-sm shrink-0">
                    <span className="font-heylowitch text-2xl">{item.product.name.charAt(0)}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-[#292525] truncate">
                      {item.product.name}
                    </h4>
                    {item.variant && (
                      <p className="text-[10px] text-[#292525]/50 mt-0.5">
                        {item.variant.name}
                      </p>
                    )}
                    <div className="text-xs font-black text-[#292525] mt-1">
                      {formatLKR(item.unitPriceCents)}
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center border border-[#C6E7FF] rounded-full overflow-hidden bg-white">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="p-1 hover:bg-[#FFFDF0] text-[#292525] transition-colors"
                          title="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2.5 py-0.5 text-xs font-bold text-[#292525]">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="p-1 hover:bg-[#FFFDF0] text-[#292525] transition-colors"
                          title="Increase quantity"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-[#292525]/40 hover:text-rose-500 p-1 transition-colors"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer & Checkout Action */}
          {summary.items.length > 0 && (
            <div className="p-4 sm:p-5 border-t border-[#C6E7FF]/60 bg-white space-y-3">
              {/* Promo code form */}
              {summary.appliedDiscount ? (
                <div className="flex items-center justify-between bg-[#EBD5FA]/50 border border-[#EBD5FA] text-[#6b21a8] px-3 py-2 rounded-full text-xs font-medium">
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-[#6b21a8]" />
                    <span>Coupon <strong>{summary.appliedDiscount.code}</strong> (-{formatLKR(summary.discountCents)})</span>
                  </div>
                  <button
                    onClick={removePromoCode}
                    className="text-[#6b21a8] hover:underline font-bold text-[11px]"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Coupon code (e.g. 20OFF)"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-[#FFFDF0] border border-[#C6E7FF] rounded-full text-xs uppercase font-medium focus:outline-none focus:ring-1 focus:ring-[#0066CC]"
                    />
                    <Tag className="w-3.5 h-3.5 text-[#0066CC] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                  <button
                    type="submit"
                    className="bg-[#292525] hover:bg-black text-white text-xs font-semibold px-4 py-1.5 rounded-full transition-colors"
                  >
                    Apply
                  </button>
                </form>
              )}

              {couponMsg && (
                <p className={`text-[11px] ${couponMsg.error ? 'text-rose-600' : 'text-emerald-600'} font-medium`}>
                  {couponMsg.text}
                </p>
              )}

              {/* Price Breakdown */}
              <div className="space-y-1.5 text-xs pt-1">
                <div className="flex justify-between text-[#292525]/70">
                  <span>Subtotal</span>
                  <span className="font-semibold text-[#292525]">{formatLKR(summary.subtotalCents)}</span>
                </div>
                {summary.discountCents > 0 && (
                  <div className="flex justify-between text-[#0066CC] font-semibold">
                    <span>Discount</span>
                    <span>-{formatLKR(summary.discountCents)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#292525]/70">
                  <span>Estimated Delivery</span>
                  <span className="font-semibold text-[#292525]">
                    {summary.deliveryCents === 0 ? (
                      <span className="text-emerald-700 font-bold">FREE</span>
                    ) : (
                      formatLKR(summary.deliveryCents)
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-black text-[#292525] pt-2 border-t border-[#C6E7FF]/40">
                  <span>Total</span>
                  <span className="text-base text-[#0066CC] font-extrabold">{formatLKR(summary.totalCents)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={handleCheckoutClick}
                  className="w-full flex items-center justify-center gap-2 bg-[#0066CC] hover:bg-[#0052a3] text-white py-3 rounded-full font-bold text-xs sm:text-sm shadow-md transition-all group"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
                <Link
                  href="/cart"
                  onClick={() => setDrawerOpen(false)}
                  className="w-full block text-center py-1.5 text-xs font-semibold text-[#292525]/70 hover:text-[#292525] transition-colors"
                >
                  View Full Cart Details
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
