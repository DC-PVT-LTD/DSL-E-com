'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingBag, Plus, Minus, Trash2, ArrowRight, Tag, Truck, ShieldCheck, Check, MessageCircle } from 'lucide-react';
import { useCartStore } from '@/services/cartStore';
import { formatLKR, FREE_DELIVERY_THRESHOLD_CENTS } from '@/lib/currency';
import { WhatsAppOrderButton } from '@/components/cart/WhatsAppOrderButton';
import { getWhatsAppBusinessNumber, validateAndCleanWhatsAppNumber } from '@/lib/whatsapp';

export default function CartPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponMsg, setCouponMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

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
    return <div className="max-w-7xl mx-auto px-4 py-16 text-center text-xs text-[#64748B]">Loading cart...</div>;
  }

  const summary = getSummary();
  const remainingForFreeDelivery = Math.max(0, FREE_DELIVERY_THRESHOLD_CENTS - summary.subtotalCents);
  const freeDeliveryPercent = Math.min(100, Math.round((summary.subtotalCents / FREE_DELIVERY_THRESHOLD_CENTS) * 100));

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim() || isApplyingCoupon) return;
    setIsApplyingCoupon(true);
    setCouponMsg(null);
    try {
      const res = await applyPromoCode(couponCode);
      setCouponMsg({ text: res.message, error: !res.success });
      if (res.success) setCouponCode('');
    } catch (err: any) {
      setCouponMsg({ text: err?.message || 'Failed to apply coupon', error: true });
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  if (summary.items.length === 0) {
    return (
      <div className="bg-[#F7FAFF]/50 min-h-[70vh] flex items-center justify-center py-16 px-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-10 text-center shadow-xs space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#EAF4FF] flex items-center justify-center mx-auto text-[#0866E8]">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-[#09285C]">Your Shopping Bag is Empty</h1>
          <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
            You haven&apos;t added any stationery items yet. Explore our selection of school packs,
            CR notebooks, pen packs, and art supplies.
          </p>
          <div className="pt-3 flex flex-col gap-2.5">
            <Link
              href="/shop"
              className="bg-[#09285C] hover:bg-[#0866E8] text-white text-xs sm:text-sm font-bold py-3.5 rounded-2xl transition-colors shadow-xs touch-target flex items-center justify-center"
            >
              Browse Stationery Catalogue
            </Link>
            <Link
              href="/school-packs"
              className="bg-[#F7FAFF] text-[#09285C] hover:bg-slate-100 border border-slate-200 text-xs sm:text-sm font-bold py-3.5 rounded-2xl transition-colors touch-target flex items-center justify-center"
            >
              Explore School Packs
            </Link>
            <a
              href={`https://wa.me/${validateAndCleanWhatsAppNumber(getWhatsAppBusinessNumber()).cleanedNumber || '94772355530'}?text=${encodeURIComponent('Hello DSL Stationery! I would like to enquire about ordering stationery or school booklists.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs sm:text-sm font-bold py-3.5 rounded-2xl transition-colors shadow-xs touch-target flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Enquire or Order via WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7FAFF]/40 py-6 sm:py-12">
      <div className="max-w-[1720px] mx-auto px-3.5 sm:px-6 lg:px-12 xl:px-16 space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
          <div>
            <h1 className="text-xl sm:text-3xl lg:text-4xl font-black text-[#09285C] tracking-tight">
              Shopping Bag ({summary.itemCount} items)
            </h1>
            <p className="text-xs text-[#64748B] mt-0.5">Review your stationery essentials before proceeding to checkout</p>
          </div>
          <button
            type="button"
            onClick={clearCart}
            className="text-xs font-bold text-[#0866E8] hover:underline transition-colors cursor-pointer"
          >
            Clear All
          </button>
        </div>

        {/* Quick WhatsApp Assisted Ordering Bar */}
        <div className="p-3.5 sm:p-4 bg-emerald-50/90 rounded-2xl sm:rounded-3xl border border-emerald-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2.5 text-emerald-950 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-[#25D366] shrink-0 animate-pulse" />
            <span>
              <strong>Order via WhatsApp:</strong> Share your shopping bag directly with DSL customer care for instant enquiry assistance.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('whatsapp-order-section');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
                el.classList.add('ring-2', 'ring-[#25D366]', 'ring-offset-2');
                setTimeout(() => el.classList.remove('ring-2', 'ring-[#25D366]', 'ring-offset-2'), 2500);
              }
            }}
            className="px-4 py-2 bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>View WhatsApp Option &darr;</span>
          </button>
        </div>

        {/* Free Delivery Bar */}
        <div className="p-4 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-bold text-[#0866E8]">
              <Truck className="w-4 h-4 text-[#0866E8]" />
              {summary.isFreeDeliveryEligible
                ? '🌸 You have unlocked FREE Islandwide Delivery!'
                : `Add ${formatLKR(remainingForFreeDelivery)} more stationery to get FREE Delivery`}
            </span>
            <span className="font-bold text-[#09285C]">{freeDeliveryPercent}%</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0866E8] rounded-full transition-all duration-300"
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Items Container */}
          <div className="lg:col-span-8 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
            {/* Select All Bar */}
            <div className="p-3.5 sm:p-5 border-b border-slate-100 bg-[#F7FAFF]/80 flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={summary.items.length > 0 && summary.items.every((i) => i.selected !== false)}
                  onChange={(e) => selectAllItems(e.target.checked)}
                  className="w-4 h-4 rounded text-[#0866E8] focus:ring-[#0866E8] cursor-pointer"
                />
                <span className="text-xs font-bold text-[#09285C]">
                  Select All Items ({summary.selectedItemCount} of {summary.itemCount} selected)
                </span>
              </label>
              {summary.selectedItemCount < summary.itemCount && (
                <span className="text-[10px] sm:text-[11px] font-semibold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                  Only selected items proceed
                </span>
              )}
            </div>

            <div className="p-4 sm:p-6 divide-y divide-slate-100 space-y-4">
              {summary.items.map((item) => {
                const maxStock = item.variant ? item.variant.stockQuantity : item.product.stockQuantity;
                const isSelected = item.selected !== false;
                return (
                  <div
                    key={item.id}
                    className={`pt-4 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 transition-opacity ${
                      !isSelected ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      {/* Item Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleItemSelection(item.id)}
                        aria-label={`Select ${item.product.name}`}
                        className="w-4 h-4 rounded text-[#0866E8] focus:ring-[#0866E8] cursor-pointer shrink-0 mt-1 sm:mt-0"
                      />
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#F7FAFF] border border-slate-200 flex items-center justify-center text-[#0866E8] font-black text-xl shrink-0 p-1">
                        {item.product.images && item.product.images.length > 0 && typeof item.product.images[0] === 'string' && item.product.images[0].startsWith('http') ? (
                          <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-contain" />
                        ) : (
                          <span>{item.product.name.charAt(0)}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/products/${item.product.slug}`}
                          className="text-xs sm:text-sm font-bold text-[#09285C] hover:text-[#0866E8] transition-colors line-clamp-1"
                        >
                          {item.product.name}
                        </Link>
                        {item.variant && (
                          <p className="text-[11px] text-[#64748B] mt-0.5">{item.variant.name}</p>
                        )}
                        {item.bundleInfo && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#0866E8] bg-[#EAF4FF] px-2 py-0.5 rounded-full">
                              🎒 {item.bundleInfo.packName} ({item.bundleInfo.savingsPercentage}% off)
                            </span>
                          </div>
                        )}
                        <p className="text-[11px] font-medium text-[#64748B] mt-0.5">
                          Unit: {formatLKR(item.unitPriceCents)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-6 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      {/* Quantity Selector */}
                      <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="p-1.5 sm:p-2 hover:bg-slate-50 text-[#09285C] transition-colors touch-target flex items-center justify-center cursor-pointer"
                          title="Decrease"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-2.5 text-xs font-black text-[#09285C]">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          disabled={item.quantity >= maxStock}
                          className="p-1.5 sm:p-2 hover:bg-slate-50 text-[#09285C] disabled:opacity-30 transition-colors touch-target flex items-center justify-center cursor-pointer"
                          title="Increase"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="text-right min-w-20">
                        <div className="text-xs sm:text-sm font-black text-[#09285C]">
                          {formatLKR(item.totalPriceCents)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="text-slate-400 hover:text-rose-600 p-2 rounded-lg transition-colors cursor-pointer touch-target flex items-center justify-center"
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
          <div className="lg:col-span-4 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 sm:p-6 space-y-5 shadow-xs sticky top-24">
            <h2 className="text-sm sm:text-base font-black text-[#09285C] pb-2.5 border-b border-slate-100">
              Order Summary
            </h2>

            {/* Promo code form */}
            {summary.appliedDiscount ? (
              <div className="bg-[#EAF4FF] border border-[#0866E8]/20 text-[#0866E8] p-3 rounded-2xl text-xs space-y-1">
                <div className="flex items-center justify-between font-bold">
                  <div className="flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-[#0866E8] shrink-0" />
                    <span>Coupon <strong>{summary.appliedDiscount.code}</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={removePromoCode}
                    className="text-rose-600 hover:underline font-bold text-[11px] cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
                {summary.appliedDiscount.promotionName && (
                  <p className="text-[11px] text-[#09285C]/80 font-medium pl-5">
                    {summary.appliedDiscount.promotionName}
                  </p>
                )}
              </div>
            ) : (
              <form onSubmit={handleApplyCoupon} className="space-y-2">
                <label className="text-xs font-bold text-[#09285C] block">Have a Promo Voucher?</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Enter code (e.g. 20OFF)"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      disabled={isApplyingCoupon}
                      className="w-full pl-8 pr-3 py-2 bg-[#F7FAFF] border border-slate-200 rounded-xl text-xs sm:text-sm uppercase font-semibold text-[#09285C] focus:outline-hidden focus:border-[#0866E8]"
                    />
                    <Tag className="w-3.5 h-3.5 text-[#0866E8] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                  <button
                    type="submit"
                    disabled={isApplyingCoupon || !couponCode.trim()}
                    className="bg-[#09285C] hover:bg-[#0866E8] disabled:opacity-40 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer touch-target flex items-center justify-center"
                  >
                    {isApplyingCoupon ? '...' : 'Apply'}
                  </button>
                </div>
                {couponMsg && (
                  <p className={`text-[11px] ${couponMsg.error ? 'text-rose-600 font-semibold' : 'text-emerald-600 font-medium'}`}>
                    {couponMsg.text}
                  </p>
                )}
              </form>
            )}

            {/* Cost Line Items */}
            <div className="space-y-2 text-xs pt-1 border-t border-slate-100">
              <div className="flex justify-between text-[#64748B]">
                <span>Items Subtotal</span>
                <span className="font-bold text-[#09285C]">{formatLKR(summary.subtotalCents)}</span>
              </div>

              {/* School Pack savings */}
              {(summary.bundleDiscountCents ?? 0) > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>School Pack Savings</span>
                  <span>-{formatLKR(summary.bundleDiscountCents || 0)}</span>
                </div>
              )}

              {/* Voucher discount */}
              {(summary.voucherDiscountCents ?? 0) > 0 && (
                <div className="flex justify-between text-[#0866E8] font-semibold">
                  <span>Voucher Discount</span>
                  <span>-{formatLKR(summary.voucherDiscountCents || 0)}</span>
                </div>
              )}

              {/* Delivery Fee */}
              <div className="flex justify-between text-[#64748B]">
                <span>Islandwide Delivery</span>
                <span className="font-bold text-[#09285C]">
                  {summary.deliveryCents === 0 ? (
                    <span className="text-emerald-700 font-bold">FREE</span>
                  ) : (
                    formatLKR(summary.deliveryCents)
                  )}
                </span>
              </div>

              <div className="flex justify-between text-sm sm:text-base font-black text-[#09285C] pt-3 border-t border-slate-100">
                <span>Grand Total</span>
                <span className="text-lg sm:text-xl text-[#0866E8] font-black">{formatLKR(summary.totalCents)}</span>
              </div>
            </div>

            {/* Checkout & WhatsApp Actions */}
            <div id="whatsapp-order-section" className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={() => router.push('/checkout')}
                disabled={summary.selectedItemCount === 0}
                className="w-full flex items-center justify-center gap-2 bg-[#09285C] hover:bg-[#0866E8] active:bg-[#0866E8] disabled:opacity-40 disabled:cursor-not-allowed text-white py-3.5 rounded-2xl font-bold text-xs sm:text-sm shadow-md transition-all touch-target cursor-pointer"
              >
                <span>
                  {summary.selectedItemCount === 0
                    ? 'Select Items to Checkout'
                    : `Proceed to Checkout (${summary.selectedItemCount} ${summary.selectedItemCount === 1 ? 'item' : 'items'})`}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <WhatsAppOrderButton summary={summary} />
            </div>

            <div className="pt-1 text-[11px] text-[#64748B] text-center flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#0866E8]" />
              <span>Simulated Checkout Demo • No real payment collected</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
