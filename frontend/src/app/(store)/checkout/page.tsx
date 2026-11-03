'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CreditCard,
  Banknote,
  Building,
  AlertCircle,
  Truck,
  Lock,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useCartStore } from '@/services/cartStore';
import { useUserStore } from '@/services/userStore';
import { orderService } from '@/services/orderService';
import { PaymentMethod, ShippingAddress } from '@/types/order';
import { formatLKR } from '@/lib/currency';

const SRI_LANKA_DISTRICTS = [
  'Colombo',
  'Gampaha',
  'Kalutara',
  'Kandy',
  'Matale',
  'Nuwara Eliya',
  'Galle',
  'Matara',
  'Hambantota',
  'Jaffna',
  'Kilinochchi',
  'Mannar',
  'Vavuniya',
  'Mullaitivu',
  'Batticaloa',
  'Ampara',
  'Trincomalee',
  'Kurunegala',
  'Puttalam',
  'Anuradhapura',
  'Polonnaruwa',
  'Badulla',
  'Monaragala',
  'Ratnapura',
  'Kegalle',
];

export default function CheckoutPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const getSummary = useCartStore((state) => state.getSummary);
  const currentUser = useUserStore((state) => state.currentUser);

  // Form State
  const [formData, setFormData] = useState<ShippingAddress>({
    fullName: currentUser?.name || 'Kavindu Senanayake',
    email: currentUser?.email || 'kavindu.s@example.lk',
    phone: currentUser?.phone || '+94 77 123 4567',
    addressLine1: currentUser?.addresses[0]?.addressLine1 || 'No. 42/3, Galle Road',
    addressLine2: currentUser?.addresses[0]?.addressLine2 || 'Kollupitiya',
    city: currentUser?.addresses[0]?.city || 'Colombo 03',
    district: currentUser?.addresses[0]?.district || 'Colombo',
    postalCode: currentUser?.addresses[0]?.postalCode || '00300',
    deliveryNotes: '',
  });

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card_mock');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="max-w-7xl mx-auto px-4 py-16 text-center text-xs text-[#292525]/50">Loading checkout...</div>;
  }

  const summary = getSummary();

  if (summary.items.length === 0) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 bg-white rounded-3xl border border-[#C6E7FF]/60 text-center space-y-4 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-[#FFFDF0] border-2 border-dashed border-[#0066CC] flex items-center justify-center mx-auto text-[#0066CC]">
          <Sparkles className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold text-[#292525]">Your Cart is Empty</h1>
        <p className="text-xs text-[#292525]/70">Please select some charming stationery items before proceeding to checkout.</p>
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold px-6 py-3 rounded-full transition-all shadow-sm"
        >
          Return to Shop <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.fullName.trim()) errs.fullName = 'Full name is required';
    if (!formData.email.trim() || !formData.email.includes('@')) errs.email = 'Valid email is required';
    if (!formData.phone.trim() || formData.phone.length < 9) errs.phone = 'Valid phone number is required';
    if (!formData.addressLine1.trim()) errs.addressLine1 = 'Street address is required';
    if (!formData.city.trim()) errs.city = 'City is required';
    if (!formData.district) errs.district = 'Please select a district in Sri Lanka';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);

    setTimeout(() => {
      const order = orderService.createOrder({
        customerName: formData.fullName,
        customerEmail: formData.email,
        customerPhone: formData.phone,
        shippingAddress: formData,
        items: summary.items,
        subtotalCents: summary.subtotalCents,
        discountCents: summary.discountCents,
        deliveryCents: summary.deliveryCents,
        totalCents: summary.totalCents,
        paymentMethod,
        notes: formData.deliveryNotes,
      });

      clearCart();
      router.push(`/checkout/result?orderId=${order.id}`);
    }, 900);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      {/* Simulation Notice Banner */}
      <div className="mb-8 p-4 bg-[#FFF9D2] border border-[#FFD84D] rounded-2xl flex items-start gap-3 shadow-xs">
        <AlertCircle className="w-5 h-5 text-[#B38A00] shrink-0 mt-0.5" />
        <div className="text-xs text-[#594300] leading-relaxed">
          <strong className="font-bold">Demonstration Checkout Environment:</strong> This frontend simulates the complete
          checkout experience for DSL Stationery. No real credit card details are collected and no real monetary transactions
          will be processed. Orders placed will appear instantly in your order history and the admin dashboard.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Form Details (Left 7 Cols) */}
        <div className="lg:col-span-7 space-y-8">
          <form onSubmit={handlePlaceOrder} className="space-y-8">
            {/* 1. Customer Contact & Delivery Details */}
            <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 sm:p-8 space-y-6 shadow-sm">
              <div className="flex items-center gap-3 pb-3 border-b border-[#C6E7FF]/30">
                <span className="w-7 h-7 rounded-full bg-[#0066CC] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  1
                </span>
                <h2 className="text-base font-bold text-[#292525]">
                  Customer Contact &amp; Shipping Address
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="sm:col-span-2">
                  <label className="font-bold text-[#292525] block mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#C6E7FF]/40 transition-all text-[#292525] bg-[#FFFDF0]/50"
                  />
                  {errors.fullName && <p className="text-rose-600 mt-1">{errors.fullName}</p>}
                </div>

                <div>
                  <label className="font-bold text-[#292525] block mb-1.5">Email Address (Order Updates) *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#C6E7FF]/40 transition-all text-[#292525] bg-[#FFFDF0]/50"
                  />
                  {errors.email && <p className="text-rose-600 mt-1">{errors.email}</p>}
                </div>

                <div>
                  <label className="font-bold text-[#292525] block mb-1.5">Mobile Phone (Delivery Contact) *</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#C6E7FF]/40 transition-all text-[#292525] bg-[#FFFDF0]/50"
                  />
                  {errors.phone && <p className="text-rose-600 mt-1">{errors.phone}</p>}
                </div>

                <div className="sm:col-span-2">
                  <label className="font-bold text-[#292525] block mb-1.5">Street Address *</label>
                  <input
                    type="text"
                    placeholder="House / Building No, Street name"
                    value={formData.addressLine1}
                    onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#C6E7FF]/40 transition-all text-[#292525] bg-[#FFFDF0]/50"
                  />
                  {errors.addressLine1 && <p className="text-rose-600 mt-1">{errors.addressLine1}</p>}
                </div>

                <div>
                  <label className="font-bold text-[#292525] block mb-1.5">City / Town *</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#C6E7FF]/40 transition-all text-[#292525] bg-[#FFFDF0]/50"
                  />
                  {errors.city && <p className="text-rose-600 mt-1">{errors.city}</p>}
                </div>

                <div>
                  <label className="font-bold text-[#292525] block mb-1.5">District (Sri Lanka) *</label>
                  <select
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    aria-label="Select delivery district"
                    className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#C6E7FF]/40 transition-all text-[#292525] bg-[#FFFDF0]/50"
                  >
                    {SRI_LANKA_DISTRICTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="font-bold text-[#292525] block mb-1.5">Delivery Instructions (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Leave with reception, call before delivery"
                    value={formData.deliveryNotes || ''}
                    onChange={(e) => setFormData({ ...formData, deliveryNotes: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#C6E7FF]/40 transition-all text-[#292525] bg-[#FFFDF0]/50"
                  />
                </div>
              </div>
            </div>

            {/* 2. Delivery Method */}
            <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 sm:p-8 space-y-4 shadow-sm">
              <div className="flex items-center gap-3 pb-3 border-b border-[#C6E7FF]/30">
                <span className="w-7 h-7 rounded-full bg-[#0066CC] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  2
                </span>
                <h2 className="text-base font-bold text-[#292525]">Delivery Method</h2>
              </div>

              <div className="p-4 rounded-2xl border-2 border-[#0066CC] bg-[#C6E7FF]/10 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#FFFDF0] border border-[#C6E7FF] flex items-center justify-center text-[#0066CC] shrink-0">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="block font-bold text-[#292525]">Standard Islandwide Courier Dispatch</strong>
                    <span className="text-[#292525]/60">Delivered within 2 to 3 business days via verified logistics</span>
                  </div>
                </div>
                <div className="font-black text-sm text-[#0066CC]">
                  {summary.deliveryCents === 0 ? 'FREE' : formatLKR(summary.deliveryCents)}
                </div>
              </div>
            </div>

            {/* 3. Payment Method Simulation */}
            <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 sm:p-8 space-y-4 shadow-sm">
              <div className="flex items-center gap-3 pb-3 border-b border-[#C6E7FF]/30">
                <span className="w-7 h-7 rounded-full bg-[#0066CC] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  3
                </span>
                <h2 className="text-base font-bold text-[#292525]">Select Demo Payment Method</h2>
              </div>

              <div className="space-y-3">
                {/* Simulated Card */}
                <label className={`block p-4 rounded-2xl border-2 cursor-pointer transition-all ${paymentMethod === 'card_mock' ? 'border-[#0066CC] bg-[#C6E7FF]/10' : 'border-stone-200 hover:border-[#C6E7FF]'}`}>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="card_mock"
                        checked={paymentMethod === 'card_mock'}
                        onChange={() => setPaymentMethod('card_mock')}
                        className="w-4 h-4 text-[#0066CC] focus:ring-[#0066CC]"
                      />
                      <CreditCard className="w-5 h-5 text-[#0066CC]" />
                      <div>
                        <strong className="block font-bold text-[#292525]">Visa / Mastercard (Simulated)</strong>
                        <span className="text-[#292525]/60">Instant test card payment simulation</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold bg-[#FFD84D] text-[#594300] px-2.5 py-0.5 rounded-full">Demo</span>
                  </div>
                </label>

                {/* Cash on Delivery */}
                <label className={`block p-4 rounded-2xl border-2 cursor-pointer transition-all ${paymentMethod === 'cash_on_delivery' ? 'border-[#0066CC] bg-[#C6E7FF]/10' : 'border-stone-200 hover:border-[#C6E7FF]'}`}>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="cash_on_delivery"
                        checked={paymentMethod === 'cash_on_delivery'}
                        onChange={() => setPaymentMethod('cash_on_delivery')}
                        className="w-4 h-4 text-[#0066CC] focus:ring-[#0066CC]"
                      />
                      <Banknote className="w-5 h-5 text-emerald-600" />
                      <div>
                        <strong className="block font-bold text-[#292525]">Cash on Delivery (COD)</strong>
                        <span className="text-[#292525]/60">Pay in cash when rider delivers to your doorstep</span>
                      </div>
                    </div>
                  </div>
                </label>

                {/* Bank Transfer */}
                <label className={`block p-4 rounded-2xl border-2 cursor-pointer transition-all ${paymentMethod === 'bank_transfer_mock' ? 'border-[#0066CC] bg-[#C6E7FF]/10' : 'border-stone-200 hover:border-[#C6E7FF]'}`}>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="bank_transfer_mock"
                        checked={paymentMethod === 'bank_transfer_mock'}
                        onChange={() => setPaymentMethod('bank_transfer_mock')}
                        className="w-4 h-4 text-[#0066CC] focus:ring-[#0066CC]"
                      />
                      <Building className="w-5 h-5 text-indigo-500" />
                      <div>
                        <strong className="block font-bold text-[#292525]">Direct Bank Deposit / Transfer (Mock)</strong>
                        <span className="text-[#292525]/60">Commercial Bank / Sampath Bank deposit slip demo</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold bg-[#EBD5FA] text-[#4A154B] px-2.5 py-0.5 rounded-full">Demo</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 bg-[#0066CC] hover:bg-[#0052a3] text-white py-4 rounded-full font-bold text-base shadow-md hover:shadow-lg transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Generating Simulated Order...</span>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Confirm Order ({formatLKR(summary.totalCents)})</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Order Summary Sidebar (Right 5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 space-y-6 shadow-sm sticky top-28">
          <h2 className="text-base font-bold text-[#292525] pb-3 border-b border-[#C6E7FF]/30">
            Order Review ({summary.itemCount} items)
          </h2>

          <div className="divide-y divide-stone-100 max-h-72 overflow-y-auto pr-1 space-y-3">
            {summary.items.map((item) => (
              <div key={item.id} className="pt-3 first:pt-0 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 truncate">
                  <div className="w-8 h-8 rounded-full bg-[#FFFDF0] border border-[#C6E7FF] flex items-center justify-center font-bold text-[#0066CC] shrink-0 text-xs">
                    {item.quantity}x
                  </div>
                  <div className="truncate">
                    <span className="font-bold text-[#292525] block truncate">{item.product.name}</span>
                    {item.variant && <span className="text-[10px] text-[#292525]/60">{item.variant.name}</span>}
                  </div>
                </div>
                <span className="font-bold text-[#292525] shrink-0">
                  {formatLKR(item.totalPriceCents)}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-2.5 text-xs pt-4 border-t border-[#C6E7FF]/30">
            <div className="flex justify-between text-[#292525]/70">
              <span>Subtotal</span>
              <span className="font-semibold text-[#292525]">{formatLKR(summary.subtotalCents)}</span>
            </div>

            {summary.discountCents > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Promotional Voucher</span>
                <span>-{formatLKR(summary.discountCents)}</span>
              </div>
            )}

            <div className="flex justify-between text-[#292525]/70">
              <span>Delivery Fee</span>
              <span className="font-semibold text-[#292525]">
                {summary.deliveryCents === 0 ? <span className="text-[#0066CC] font-bold">FREE</span> : formatLKR(summary.deliveryCents)}
              </span>
            </div>

            <div className="flex justify-between text-base font-bold text-[#292525] pt-3 border-t border-[#C6E7FF]/30">
              <span>Total Payable</span>
              <span className="text-xl font-black text-[#0066CC]">{formatLKR(summary.totalCents)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
