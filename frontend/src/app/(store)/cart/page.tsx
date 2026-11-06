'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingBag, Plus, Minus, Trash2, ArrowRight, Tag, Truck, ShieldCheck, Check } from 'lucide-react';
import { useCartStore } from '@/services/cartStore';
import { formatLKR, FREE_DELIVERY_THRESHOLD_CENTS } from '@/lib/currency';
import { WhatsAppOrderButton } from '@/components/cart/WhatsAppOrderButton';

export default function CartPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponMsg, setCouponMsg] = useState<{ text: string; error: boolean } | null>(null);

  const items = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const toggleItemSelection = useCartStore((state) => state.toggleItemSelection);
  const selectAllItems = useCartStore((state) => state.selectAllItems);
  const applyPromoCode = useCartStore((state) => state.applyPromoCode);
  const removePromoCode = useCartStore((state) => state.removePromoCode);
  const getSummary = useCartStore((state) => state.getSummary);

  useEffect(() => {
    setMounted(true);
    useCartStore.getState().fetchCart();
  }, []);

  if (!mounted) {
    return <div className="max-w-7xl mx-auto px-4 py-16 text-center text-xs text-[#292525]/60 bg-[#FFFDF0]">Loading cart...</div>;
  }

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

  if (summary.items.length === 0) {
    return (
      <div className="bg-[#FFFDF0] min-h-[70vh] flex items-center justify-center py-20 px-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-[#C6E7FF] p-10 text-center shadow-xs">
          <div className="w-16 h-16 rounded-full bg-[#C6E7FF]/30 flex items-center justify-center mx-auto text-[#0066CC] mb-4">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-[#292525]">Your Shopping Bag is Empty</h1>
          <p className="text-xs text-[#292525]/70 mt-2 leading-relaxed">
            You haven&apos;t added any stationery items yet. Explore our selection of school packs,
            CR notebooks, pen packs, and art supplies.
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <Link
              href="/shop"
              className="bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold py-3 rounded-full transition-colors shadow-xs"
            >
              Browse Stationery Catalogue
            </Link>
            <Link
              href="/school-packs"
              className="bg-[#FFFDF0] text-[#292525] hover:bg-[#FAF7EE] border border-[#C6E7FF] text-xs font-bold py-3 rounded-full transition-colors"
            >
              Explore School Packs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex items-center justify-between pb-4 border-b border-[#C6E7FF]/60">
          <div>
            <h1 className="text-2xl sm:text-4xl font-black text-[#292525] tracking-tight">
              Shopping Bag ({summary.itemCount} items)
            </h1>
            <p className="text-xs text-[#292525]/60 mt-1">Review your stationery essentials before proceeding to checkout</p>
          </div>
          <button
            onClick={clearCart}
            className="text-xs font-semibold text-[#0066CC] hover:underline transition-colors"
          >
            Clear All Items
          </button>
        </div>

        {/* Free Delivery Bar */}
        <div className="p-4 bg-white rounded-3xl border border-[#C6E7FF] shadow-xs">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="flex items-center gap-1.5 font-bold text-[#0066CC]">
              <Truck className="w-4 h-4 text-[#0066CC]" />
              {summary.isFreeDeliveryEligible
                ? '🌸 You have unlocked FREE Islandwide Delivery!'
                : `Add ${formatLKR(remainingForFreeDelivery)} more stationery to get FREE Delivery`}
            </span>
            <span className="font-bold text-[#292525]/70">{freeDeliveryPercent}%</span>
          </div>
          <div className="w-full h-2.5 bg-[#FAF7EE] rounded-full overflow-hidden border border-[#C6E7FF]/40">
            <div
              className="h-full bg-[#0066CC] transition-all duration-300"
              style={{ width: `${freeDeliveryPercent}%` }}
            />
          </div>
        </div>

        {/* Server Stock / Price Change Warnings */}
        {summary.warnings && summary.warnings.length > 0 && (
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-800 text-xs space-y-1">
            <p className="font-bold">Notice regarding items in your bag:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {summary.warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Cart Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Items Table */}
          <div className="lg:col-span-8 bg-white rounded-3xl border border-[#C6E7FF]/70 overflow-hidden shadow-xs">
            {/* Phase A: Select All Bar */}
            <div className="p-4 sm:p-5 border-b border-[#C6E7FF]/40 bg-[#FFFDF0]/50 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={summary.items.length > 0 && summary.items.every((i) => i.selected !== false)}
                  onChange={(e) => selectAllItems(e.target.checked)}
                  className="w-4 h-4 rounded text-[#0066CC] focus:ring-[#0066CC] accent-[#0066CC] cursor-pointer"
                />
                <span className="text-xs font-bold text-[#292525]">
                  Select All Items ({summary.selectedItemCount} of {summary.itemCount} selected)
                </span>
              </label>
              {summary.selectedItemCount < summary.itemCount && (
                <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                  Only selected items proceed to checkout
                </span>
              )}
            </div>

            <div className="p-6 divide-y divide-[#C6E7FF]/30 space-y-4">
              {summary.items.map((item) => {
                const maxStock = item.variant ? item.variant.stockQuantity : item.product.stockQuantity;
                const isSelected = item.selected !== false;
                return (
                  <div
                    key={item.id}
                    className={`pt-4 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-opacity ${!isSelected ? 'opacity-60' : ''
                      }`}
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      {/* Item Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleItemSelection(item.id)}
                        aria-label={`Select ${item.product.name}`}
                        className="w-4 h-4 rounded text-[#0066CC] focus:ring-[#0066CC] accent-[#0066CC] cursor-pointer shrink-0"
                      />
                      <div className="w-16 h-16 rounded-2xl bg-[#FAF7EE] border border-[#C6E7FF] flex items-center justify-center text-[#0066CC] font-black text-xl shrink-0">
                        <span className="font-heylowitch">{item.product.name.charAt(0)}</span>
                      </div>
                      <div>
                        <Link
                          href={`/products/${item.product.slug}`}
                          className="text-sm font-bold text-[#292525] hover:text-[#0066CC] transition-colors"
                        >
                          {item.product.name}
                        </Link>
                        {item.variant && (
                          <p className="text-xs text-[#292525]/60 mt-0.5">{item.variant.name}</p>
                        )}
                        {item.bundleInfo && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#0066CC] bg-[#C6E7FF]/30 border border-[#C6E7FF] px-2 py-0.5 rounded-full">
                              🎒 {item.bundleInfo.packName} ({item.bundleInfo.savingsPercentage}% off)
                            </span>
                          </div>
                        )}
                        <p className="text-xs font-semibold text-[#292525]/50 mt-0.5">
                          Unit: {formatLKR(item.unitPriceCents)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-6">
                      {/* Quantity Selector */}
                      <div className="flex items-center border border-[#C6E7FF] rounded-full overflow-hidden bg-white shadow-xs">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="p-2 hover:bg-[#FFFDF0] text-[#292525] transition-colors"
                          title="Decrease"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-3 text-xs font-bold text-[#292525]">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          disabled={item.quantity >= maxStock}
                          className="p-2 hover:bg-[#FFFDF0] text-[#292525] disabled:opacity-40 transition-colors"
                          title="Increase"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="text-right min-w-24">
                        <div className="text-sm font-black text-[#292525]">
                          {formatLKR(item.totalPriceCents)}
                        </div>
                      </div>

                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-[#292525]/40 hover:text-rose-500 p-1.5 transition-colors"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Order Summary Box */}
          <div className="lg:col-span-4 bg-white rounded-3xl border border-[#C6E7FF]/70 p-6 space-y-6 shadow-xs sticky top-28">
            <h2 className="text-base font-bold text-[#292525] pb-3 border-b border-[#C6E7FF]/30">
              Order Summary
            </h2>

            {/* Promo code form */}
            {summary.appliedDiscount ? (
              <div className="flex items-center justify-between bg-[#EBD5FA]/50 border border-[#EBD5FA] text-[#6b21a8] px-3.5 py-2.5 rounded-full text-xs font-medium">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#6b21a8] shrink-0" />
                  <span>Coupon <strong>{summary.appliedDiscount.code}</strong> applied</span>
                </div>
                <button
                  onClick={removePromoCode}
                  className="text-[#6b21a8] hover:underline font-bold text-[11px]"
                >
                  Remove
                </button>
              </div>
            ) : (
              <form onSubmit={handleApplyCoupon} className="space-y-2">
                <label className="text-xs font-bold text-[#292525] block">Have a Promo Voucher?</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Enter code (e.g. 20OFF)"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-[#FFFDF0] border border-[#C6E7FF] rounded-full text-xs uppercase font-medium focus:outline-none focus:ring-1 focus:ring-[#0066CC]"
                    />
                    <Tag className="w-3.5 h-3.5 text-[#0066CC] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                  <button
                    type="submit"
                    className="bg-[#292525] hover:bg-black text-white text-xs font-bold px-5 py-2 rounded-full transition-colors"
                  >
                    Apply
                  </button>
                </div>
                {couponMsg && (
                  <p className={`text-[11px] ${couponMsg.error ? 'text-rose-600' : 'text-emerald-600'} font-medium`}>
                    {couponMsg.text}
                  </p>
                )}
              </form>
            )}

            {/* Cost Line Items */}
            <div className="space-y-2 text-xs pt-2">
              <div className="flex justify-between text-[#292525]/70">
                <span>Items Subtotal</span>
                <span className="font-semibold text-[#292525]">{formatLKR(summary.subtotalCents)}</span>
              </div>

              {summary.discountCents > 0 && (
                <div className="flex justify-between text-[#0066CC] font-semibold">
                  <span>Bundle & Promotional Savings</span>
                  <span>-{formatLKR(summary.discountCents)}</span>
                </div>
              )}

              <div className="flex justify-between text-[#292525]/70">
                <span>Standard Islandwide Delivery</span>
                <span className="font-semibold text-[#292525]">
                  {summary.deliveryCents === 0 ? (
                    <span className="text-emerald-700 font-bold">FREE</span>
                  ) : (
                    formatLKR(summary.deliveryCents)
                  )}
                </span>
              </div>

              <div className="flex justify-between text-base font-black text-[#292525] pt-4 border-t border-[#C6E7FF]/30">
                <span>Grand Total</span>
                <span className="text-xl text-[#0066CC] font-extrabold">{formatLKR(summary.totalCents)}</span>
              </div>
            </div>

            {/* Checkout & WhatsApp CTAs */}
            <div className="space-y-3 pt-2">
              <button
                onClick={() => router.push('/checkout')}
                disabled={summary.selectedItemCount === 0}
                className="w-full flex items-center justify-center gap-2 bg-[#0066CC] hover:bg-[#0052a3] disabled:opacity-40 disabled:cursor-not-allowed text-white py-3.5 rounded-full font-bold text-sm shadow-md transition-all group"
              >
                <span>
                  {summary.selectedItemCount === 0
                    ? 'Select Items to Checkout'
                    : `Proceed to Checkout (${summary.selectedItemCount} ${summary.selectedItemCount === 1 ? 'item' : 'items'})`}
                </span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-[#C6E7FF]/60"></div>
                <span className="flex-shrink mx-3 text-[11px] font-bold text-[#292525]/40 uppercase tracking-wider">or</span>
                <div className="flex-grow border-t border-[#C6E7FF]/60"></div>
              </div>

              {/* Phase 16: WhatsApp-Assisted Ordering */}
              <WhatsAppOrderButton summary={summary} />
            </div>

            <div className="pt-2 text-[11px] text-[#292525]/50 text-center flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#0066CC]" />
              <span>Simulated Checkout Demo • No real payment collected</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
