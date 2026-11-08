'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CreditCard,
  Banknote,
  AlertCircle,
  Truck,
  Lock,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  RefreshCw,
  Clock,
  MapPin,
  CheckCircle2,
} from 'lucide-react';
import { useCartStore } from '@/services/cartStore';
import { useUserStore } from '@/services/userStore';
import { checkoutService, ReservationResponse, AuthoritativeTotals } from '@/services/checkoutService';
import { inventorySocketService } from '@/services/inventorySocketService';
import { PaymentMethod, ShippingAddress } from '@/types/order';
import { formatLKR } from '@/lib/currency';
import ReservationCountdown from '@/components/checkout/ReservationCountdown';
import DeliveryLocationPicker from '@/components/checkout/DeliveryLocationPicker';
import { CheckoutGateway } from '@/components/checkout/CheckoutGateway';

export default function CheckoutPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Stepper state: 'gateway' | 'details'
  const [checkoutStep, setCheckoutStep] = useState<'gateway' | 'details'>('gateway');

  // Cart & User Stores
  const items = useCartStore((state) => state.items);
  const appliedDiscount = useCartStore((state) => state.appliedDiscount);
  const removePurchasedItems = useCartStore((state) => state.removePurchasedItems);
  const currentUser = useUserStore((state) => state.currentUser);
  const fetchCurrentUser = useUserStore((state) => state.fetchCurrentUser);

  const addresses = (currentUser?.addresses as any[]) || [];
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  // Phase A: Filter strictly for selected items
  const itemsToCheckout = items.filter((item) => item.selected !== false);

  // Reservation State
  const [reservation, setReservation] = useState<ReservationResponse | null>(null);
  const [isReserving, setIsReserving] = useState(true);
  const [reservationError, setReservationError] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);

  // Server Authoritative Totals
  const [authoritativeTotals, setAuthoritativeTotals] = useState<AuthoritativeTotals | null>(null);

  // Form State - strictly zero hardcoded mock values
  const [formData, setFormData] = useState<ShippingAddress>({
    fullName: '',
    phone: '',
    email: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    district: 'Colombo',
    postalCode: '',
    province: 'Western',
    deliveryNotes: '',
  });

  const [useCustomAddress, setUseCustomAddress] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('CARD_PAYHERE');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Sync customer details when currentUser loads or changes
  useEffect(() => {
    fetchCurrentUser().catch(() => {});
  }, [fetchCurrentUser]);

  useEffect(() => {
    if (currentUser) {
      setFormData((prev) => ({
        ...prev,
        fullName: prev.fullName || currentUser.name || '',
        email: prev.email || currentUser.email || '',
        phone: prev.phone || currentUser.phone || '',
      }));
    }
  }, [currentUser]);

  // Sync selected saved address if available and not using custom
  useEffect(() => {
    if (currentUser && addresses.length > 0 && !useCustomAddress) {
      const activeAddr =
        addresses.find((a: any) => a.id === selectedAddressId) || addresses[0];
      if (activeAddr) {
        if (!selectedAddressId) {
          setSelectedAddressId(activeAddr.id);
        }
        setFormData((prev) => ({
          ...prev,
          fullName: activeAddr.recipientName || prev.fullName || currentUser.name || '',
          phone: activeAddr.phone || prev.phone || currentUser.phone || '',
          addressLine1: activeAddr.addressLine1 || '',
          addressLine2: activeAddr.addressLine2 || '',
          city: activeAddr.city || '',
          district: activeAddr.district || 'Colombo',
          postalCode: activeAddr.postalCode || '',
          province: activeAddr.province || 'Western',
        }));
      }
    }
  }, [currentUser, addresses, selectedAddressId, useCustomAddress]);

  // Stable Checkout Session Management (Phase C)
  // Ensures session ID is generated once and persisted across refreshes and navigation
  const getOrCreateCheckoutSessionId = useCallback((): string => {
    if (typeof window === 'undefined') return '';
    let sid = sessionStorage.getItem('dsl_checkout_session_id');
    if (!sid) {
      sid = `csess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem('dsl_checkout_session_id', sid);
    }
    return sid;
  }, []);

  // Safe Warehouse Stock Hold Reservation (Phase C)
  const initReservation = useCallback(async () => {
    if (itemsToCheckout.length === 0) return;

    setIsReserving(true);
    setReservationError(null);
    try {
      const sessionId = getOrCreateCheckoutSessionId();
      const reservationItems = itemsToCheckout.map((item) => ({
        productId: item.productId,
        variantId: item.variantId || null,
        quantity: item.quantity,
      }));

      const res = await checkoutService.createReservation({
        items: reservationItems,
        sessionId,
      });

      setReservation(res);

      if (res.isExpired || res.status === 'EXPIRED') {
        setIsExpired(true);
      } else {
        setIsExpired(false);
      }
    } catch (err: any) {
      setReservationError(err?.message || 'Failed to reserve warehouse stock for checkout.');
    } finally {
      setIsReserving(false);
    }
  }, [itemsToCheckout, getOrCreateCheckoutSessionId]);

  useEffect(() => {
    setMounted(true);
    initReservation();
  }, [initReservation]);

  // Real-time stock subscription
  useEffect(() => {
    if (!reservation) return;

    const unsubs = reservation.items.map((item) =>
      inventorySocketService.subscribeProduct(item.productId, (update) => {
        if (update.availableStock < item.quantity) {
          console.warn(`Stock level changed for ${item.productName}: ${update.availableStock} available.`);
        }
      })
    );

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [reservation]);

  const handleReservationExpired = useCallback(async () => {
    setIsExpired(true);
    if (!reservation) return;

    try {
      const checkRes = await checkoutService.checkExpiredStock(reservation.reservationId);
      setReservation(checkRes);
    } catch (err: any) {
      console.error('Failed to check expired stock availability:', err);
    }
  }, [reservation]);

  const handleRenewReservation = async () => {
    if (!reservation) {
      await initReservation();
      return;
    }

    setIsRenewing(true);
    setReservationError(null);
    try {
      const res = await checkoutService.checkExpiredStock(reservation.reservationId);
      setReservation(res);
      if (res.isExpired || res.status === 'EXPIRED') {
        setIsExpired(true);
      }
    } catch (err: any) {
      setReservationError(
        err?.message || 'Failed to recheck stock for reservation. Some items may have gone out of stock.'
      );
    } finally {
      setIsRenewing(false);
    }
  };

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.fullName.trim()) errs.fullName = 'Full recipient name is required';

    const emailTrimmed = (formData.email || '').trim();
    if (!emailTrimmed) {
      errs.email = 'Email address is required for order confirmation and tracking';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      errs.email = 'Please enter a valid email address';
    }

    const cleanPhone = (formData.phone || '').replace(/[\s-]/g, '');
    if (!cleanPhone) {
      errs.phone = 'Mobile phone number is required';
    } else if (!/^(?:\+94|0)?7\d{8}$/.test(cleanPhone)) {
      errs.phone = 'Please enter a valid Sri Lankan mobile number (e.g. 0712345678 or +94712345678)';
    }

    if (!formData.addressLine1.trim()) errs.addressLine1 = 'Street address / line 1 is required';
    if (!formData.city.trim()) errs.city = 'City / Town is required';
    if (!formData.district) errs.district = 'Please select a district in Sri Lanka';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateForm()) {
      window.scrollTo({ top: 200, behavior: 'smooth' });
      return;
    }

    if (isExpired && reservation && reservation.stockAvailable === false) {
      setSubmitError(
        reservation.message ||
          'Sorry! Some of your selected items are no longer available in the requested quantities. Please update your cart.'
      );
      return;
    }

    if (!reservation) {
      setSubmitError('Stock reservation is required before placing an order.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Authoritative Server Total Verification & Stock Commitment (Phase 10 & Phase C)
      const prePayResult = await checkoutService.validatePrePay({
        reservationId: reservation.reservationId,
        deliveryAddress: formData,
        paymentMethod: selectedPaymentMethod,
        voucherCode: appliedDiscount?.code || null,
      });

      setAuthoritativeTotals(prePayResult.totals);

      // 2. Remember guest/customer email in session storage for tracking
      const effectiveEmail = (formData.email || '').trim();
      if (typeof window !== 'undefined' && effectiveEmail) {
        sessionStorage.setItem('last_order_email', effectiveEmail);
      }

      // 3. Process payment / Create authoritative order via backend
      const idempotencyKey = `${reservation.reservationId}-${Date.now()}`;
      const res = await checkoutService.processPayment({
        reservationId: reservation.reservationId,
        deliveryAddress: formData,
        paymentMethod: selectedPaymentMethod,
        voucherCode: appliedDiscount?.code || null,
        idempotencyKey,
      });

      const createdOrder = res.order;

      // 4. Phase A requirement: Remove only purchased items, keeping unselected items in cart
      removePurchasedItems(
        itemsToCheckout.map((i) => ({ productId: i.productId, variantId: i.variantId || null }))
      );

      // Clear checkout session ID so subsequent checkout sessions start fresh
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('dsl_checkout_session_id');
      }

      // 5. Navigate to authoritative result page with email query param
      router.push(
        `/checkout/result?orderId=${createdOrder.id || createdOrder.orderNumber}&email=${encodeURIComponent(
          effectiveEmail
        )}`
      );
    } catch (err: any) {
      setSubmitError(
        err?.message || 'Failed to place order. Please review your details and try again.'
      );
      window.scrollTo({ top: 200, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <RefreshCw className="w-8 h-8 text-[#0066CC] animate-spin mx-auto mb-3" />
        <p className="text-xs text-[#292525]/60">Initializing secure checkout session...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-[#292525] mb-2">Your Shopping Cart is Empty</h1>
        <p className="text-xs text-[#292525]/60 mb-6">
          Explore our quality stationery collection to add items before checking out.
        </p>
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 bg-[#0066CC] hover:bg-[#0052a3] text-white font-bold px-6 py-3 rounded-full text-xs shadow-sm transition-all"
        >
          <span>Browse Catalogue</span> <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  if (itemsToCheckout.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-[#292525] mb-2">No Items Selected for Checkout</h1>
        <p className="text-xs text-[#292525]/60 mb-6">
          You have items in your cart, but none are currently selected. Please select at least one
          product to proceed.
        </p>
        <Link
          href="/cart"
          className="inline-flex items-center gap-2 bg-[#0066CC] hover:bg-[#0052a3] text-white font-bold px-6 py-3 rounded-full text-xs shadow-sm transition-all"
        >
          <span>Return to Cart to Select Items</span> <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  // STEP 1: CHECKOUT GATEWAY (Phase B Gateway Screen)
  if (checkoutStep === 'gateway') {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        <CheckoutGateway
          selectedItemCount={itemsToCheckout.length}
          onContinueAsGuest={() => setCheckoutStep('details')}
          onAuthenticatedContinue={() => setCheckoutStep('details')}
        />
      </div>
    );
  }

  // STEP 2: DELIVERY DETAILS & PAYMENT
  const clientSubtotalCents = itemsToCheckout.reduce(
    (sum, item) => sum + item.product.priceCents * item.quantity,
    0
  );
  const clientDeliveryCents = clientSubtotalCents >= 500000 ? 0 : 35000;
  const clientTotalCents = clientSubtotalCents + clientDeliveryCents;

  const displaySubtotalCents = authoritativeTotals?.subtotalCents ?? clientSubtotalCents;
  const displayDiscountCents = authoritativeTotals?.discountCents ?? 0;
  const displayDeliveryCents = authoritativeTotals?.deliveryCents ?? clientDeliveryCents;
  const displayTotalCents = authoritativeTotals?.totalCents ?? clientTotalCents;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Header and Step Back */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#C6E7FF]/40 gap-4">
        <div>
          <button
            type="button"
            onClick={() => setCheckoutStep('gateway')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0066CC] hover:underline mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Change Checkout Mode (Customer / Guest)</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#292525]">Checkout &amp; Delivery</h1>
          <p className="text-xs text-[#292525]/60 mt-1">
            {currentUser ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Checking out as registered customer ({currentUser.email})
              </span>
            ) : (
              <span className="text-amber-800 font-medium">
                Checking out as Guest &bull; Fast, no account required
              </span>
            )}
          </p>
        </div>

        {/* Real-time stock hold countdown (Active reservation only) */}
        {reservation && !isExpired && reservation.status === 'ACTIVE' && (
          <div className="self-start sm:self-auto">
            <ReservationCountdown
              expiresAt={reservation.expiresAt}
              onExpired={handleReservationExpired}
              onRenew={handleRenewReservation}
              isRenewing={isRenewing}
            />
          </div>
        )}
      </div>

      {/* Expired Reservation State (Phase C - Scenario A vs Scenario B) */}
      {reservation && isExpired && reservation.stockAvailable !== false && (
        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-800 flex items-start gap-3 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-sm text-emerald-900">
              Your previous reservation has expired. We checked the latest stock availability, and your selected items are still available. You can continue with payment.
            </p>
            <p className="text-[11px] text-emerald-700/80 mt-0.5">
              Live warehouse stock was confirmed. Inventory will be secured when you proceed to payment.
            </p>
          </div>
        </div>
      )}

      {reservation && isExpired && reservation.stockAvailable === false && (
        <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 text-xs text-rose-800 flex flex-col gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-sm text-rose-900">
                Sorry! Some of your selected items are no longer available in the requested quantities.
              </p>
              <p className="text-[11px] text-rose-700/80 mt-0.5">
                Remaining stock was purchased by other customers after your previous reservation expired.
              </p>
            </div>
            <Link
              href="/cart"
              className="shrink-0 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs"
            >
              Update Cart &amp; Retry
            </Link>
          </div>

          {reservation.unavailableItems && reservation.unavailableItems.length > 0 && (
            <div className="bg-white/80 rounded-xl p-3 border border-rose-200/60 space-y-1.5">
              <p className="text-[11px] font-bold text-rose-900">Affected Stationery Items:</p>
              <ul className="space-y-1 text-[11px] text-rose-800">
                {reservation.unavailableItems.map((it) => (
                  <li key={`${it.productId}_${it.variantId || ''}`} className="flex items-center justify-between">
                    <span className="font-medium">• {it.productName}</span>
                    <span className="text-rose-600 font-bold">
                      Requested: {it.requestedQuantity} | Available: {it.availableQuantity}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Reservation Loading or Error Notification */}
      {isReserving && (
        <div className="p-4 bg-[#F0F7FF] rounded-2xl border border-[#C6E7FF] text-xs text-[#0066CC] flex items-center gap-3">
          <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
          <span>Reserving selected stationery inventory with the central warehouse...</span>
        </div>
      )}

      {reservationError && (
        <div className="p-4 bg-red-50 rounded-2xl border border-red-200 text-xs text-red-700 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong>Stock Hold Notice: </strong>
            <span>{reservationError}</span>
          </div>
          <button
            type="button"
            onClick={initReservation}
            className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 font-bold rounded-lg shrink-0"
          >
            Retry Hold
          </button>
        </div>
      )}

      {submitError && (
        <div className="p-4 bg-red-50 rounded-2xl border border-red-200 text-xs text-red-700 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong>Checkout Error: </strong>
            <span>{submitError}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 7 Columns: Delivery & Payment Details Form */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handlePlaceOrder} className="space-y-6">
            {/* Authenticated Customer Saved Addresses Picker */}
            {currentUser && addresses.length > 0 && (
              <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-[#292525] flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#0066CC]" />
                    <span>Saved Delivery Addresses</span>
                  </h2>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    {addresses.length} saved
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {addresses.map((addr: any) => {
                    const isSelected = !useCustomAddress && addr.id === selectedAddressId;
                    return (
                      <div
                        key={addr.id}
                        onClick={() => {
                          setUseCustomAddress(false);
                          setSelectedAddressId(addr.id);
                        }}
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#0066CC] bg-[#F0F7FF]/50 shadow-xs'
                            : 'border-stone-200 bg-white hover:border-stone-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-bold text-xs text-[#292525]">
                              {addr.label || 'Home'} &bull; {addr.recipientName || addr.fullName}
                            </span>
                            <p className="text-xs text-[#292525]/70 mt-0.5">
                              {addr.addressLine1}
                              {addr.addressLine2 ? `, ${addr.addressLine2}` : ''}, {addr.city},{' '}
                              {addr.district}
                            </p>
                            <span className="text-[11px] text-[#292525]/50 block mt-1">
                              Phone: {addr.phone}
                            </span>
                          </div>
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                              isSelected ? 'border-[#0066CC] bg-[#0066CC]' : 'border-stone-300'
                            }`}
                          >
                            {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Option to use custom address for this specific order */}
                  <div
                    onClick={() => setUseCustomAddress(true)}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      useCustomAddress
                        ? 'border-[#0066CC] bg-[#F0F7FF]/50 shadow-xs'
                        : 'border-dashed border-stone-300 bg-stone-50/50 hover:border-stone-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#292525]">
                        + Ship to a different address for this order
                      </span>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          useCustomAddress ? 'border-[#0066CC] bg-[#0066CC]' : 'border-stone-300'
                        }`}
                      >
                        {useCustomAddress && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                    </div>
                    <p className="text-[11px] text-[#292525]/50 mt-1">
                      Does not alter your saved profile addresses.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Delivery Location & Address Picker */}
            {(!currentUser || addresses.length === 0 || useCustomAddress) && (
              <DeliveryLocationPicker
                value={formData}
                onChange={setFormData}
                errors={errors}
              />
            )}

            {/* Payment Method Selector */}
            <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 sm:p-8 space-y-4 shadow-sm">
              <h2 className="text-base font-bold text-[#292525] flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#0066CC]" />
                <span>Select Payment Method</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* PayHere Online Gateway */}
                <div
                  onClick={() => setSelectedPaymentMethod('CARD_PAYHERE')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    selectedPaymentMethod === 'CARD_PAYHERE'
                      ? 'border-[#0066CC] bg-[#F0F7FF]/50 shadow-xs'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-xs text-[#292525]">
                        <CreditCard className="w-4 h-4 text-[#0066CC]" />
                        <span>PayHere Online Payment</span>
                      </div>
                      <p className="text-[11px] text-[#292525]/60 mt-1">
                        Visa, MasterCard, Genie, FriMi &amp; Internet Banking
                      </p>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        selectedPaymentMethod === 'CARD_PAYHERE'
                          ? 'border-[#0066CC] bg-[#0066CC]'
                          : 'border-stone-300'
                      }`}
                    >
                      {selectedPaymentMethod === 'CARD_PAYHERE' && (
                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Cash on Delivery */}
                <div
                  onClick={() => setSelectedPaymentMethod('CASH_ON_DELIVERY')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    selectedPaymentMethod === 'CASH_ON_DELIVERY'
                      ? 'border-[#0066CC] bg-[#F0F7FF]/50 shadow-xs'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-xs text-[#292525]">
                        <Banknote className="w-4 h-4 text-emerald-600" />
                        <span>Cash on Delivery (COD)</span>
                      </div>
                      <p className="text-[11px] text-[#292525]/60 mt-1">
                        Pay in cash upon doorstep delivery anywhere in Sri Lanka
                      </p>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        selectedPaymentMethod === 'CASH_ON_DELIVERY'
                          ? 'border-[#0066CC] bg-[#0066CC]'
                          : 'border-stone-300'
                      }`}
                    >
                      {selectedPaymentMethod === 'CASH_ON_DELIVERY' && (
                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Submit Button */}
            <div className="block lg:hidden">
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  isReserving ||
                  (isExpired && reservation?.stockAvailable === false)
                }
                className="w-full bg-[#0066CC] hover:bg-[#0052a3] text-white font-bold py-4 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Stock &amp; Payment...</span>
                  </>
                ) : isExpired && reservation?.stockAvailable === false ? (
                  <span>Item Unavailable (Update Cart)</span>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Pay {formatLKR(displayTotalCents)} Authoritatively</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right 5 Columns: Authoritative Order Summary (Phase A Selective Items Only) */}
        <div className="lg:col-span-5 sticky top-24 space-y-6">
          <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 sm:p-8 space-y-6 shadow-sm">
            <h2 className="text-base font-bold text-[#292525] border-b border-[#C6E7FF]/30 pb-3 flex items-center justify-between">
              <span>Order Summary</span>
              <span className="text-xs font-semibold text-[#0066CC] bg-[#F0F7FF] px-2.5 py-1 rounded-full border border-[#C6E7FF]">
                {itemsToCheckout.length} {itemsToCheckout.length === 1 ? 'item' : 'items'} selected
              </span>
            </h2>

            {/* Selected Item List */}
            <div className="divide-y divide-stone-100 max-h-64 overflow-y-auto pr-1">
              {itemsToCheckout.map((item) => (
                <div key={item.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                  <div className="flex-1">
                    <h4 className="font-bold text-[#292525]">{item.product.name}</h4>
                    {item.variantName && (
                      <p className="text-[11px] text-[#292525]/60">{item.variantName}</p>
                    )}
                    {item.bundleInfo && (
                      <span className="inline-block mt-1 text-[10px] font-bold text-[#0066CC] bg-[#C6E7FF]/40 px-2 py-0.5 rounded-full">
                        🎒 {item.bundleInfo.packName}
                      </span>
                    )}
                    <span className="text-[11px] text-[#292525]/50 block mt-0.5">
                      Qty: {item.quantity} × {formatLKR(item.product.priceCents)}
                    </span>
                  </div>
                  <span className="font-bold text-[#292525]">
                    {formatLKR(item.quantity * item.product.priceCents)}
                  </span>
                </div>
              ))}
            </div>

            {/* Calculations Breakdown */}
            <div className="border-t border-[#C6E7FF]/30 pt-4 space-y-2 text-xs">
              <div className="flex justify-between text-[#292525]/70">
                <span>Subtotal</span>
                <span className="font-medium text-[#292525]">{formatLKR(displaySubtotalCents)}</span>
              </div>

              {/* School Pack bundle savings breakdown */}
              {(authoritativeTotals?.bundleDiscountCents ?? 0) > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>School Pack Bundle Savings</span>
                  <span>- {formatLKR(authoritativeTotals?.bundleDiscountCents || 0)}</span>
                </div>
              )}

              {/* Voucher promo discount breakdown */}
              {(authoritativeTotals?.voucherDiscountCents ?? 0) > 0 && (
                <div className="flex justify-between text-[#0066CC] font-medium">
                  <span>
                    Promo Discount ({authoritativeTotals?.voucherApplied?.code || appliedDiscount?.code})
                  </span>
                  <span>- {formatLKR(authoritativeTotals?.voucherDiscountCents || 0)}</span>
                </div>
              )}

              {/* Delivery Fee line with free delivery breakdown */}
              <div className="flex justify-between text-[#292525]/70">
                <span>Islandwide Delivery</span>
                <span>
                  {displayDeliveryCents === 0 ? (
                    <span className="text-emerald-700 font-bold inline-flex items-center gap-1">
                      FREE
                      {(authoritativeTotals?.voucherApplied?.isFreeDelivery || authoritativeTotals?.voucherApplied?.discountType === 'FREE_DELIVERY') && (
                        <span className="text-[10px] text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded-full">
                          Coupon
                        </span>
                      )}
                    </span>
                  ) : (
                    formatLKR(displayDeliveryCents)
                  )}
                </span>
              </div>

              {displaySubtotalCents < 500000 && !authoritativeTotals?.voucherApplied?.isFreeDelivery && authoritativeTotals?.voucherApplied?.discountType !== 'FREE_DELIVERY' && (
                <p className="text-[10px] text-amber-700">
                  Tip: Add {formatLKR(500000 - displaySubtotalCents)} more for FREE islandwide delivery!
                </p>
              )}

              <div className="border-t border-[#C6E7FF]/30 pt-3 flex justify-between items-baseline">
                <div>
                  <strong className="text-sm font-bold text-[#292525]">Payable Total</strong>
                  <span className="block text-[10px] text-[#292525]/50">
                    Authoritative server total in LKR
                  </span>
                </div>
                <strong className="text-lg font-extrabold text-[#0066CC]">
                  {formatLKR(displayTotalCents)}
                </strong>
              </div>
            </div>

            {/* Desktop Place Order Button */}
            <div className="hidden lg:block pt-2">
              <button
                onClick={handlePlaceOrder}
                disabled={
                  isSubmitting ||
                  isReserving ||
                  (isExpired && reservation?.stockAvailable === false)
                }
                className="w-full bg-[#0066CC] hover:bg-[#0052a3] text-white font-bold py-3.5 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Stock &amp; Payment...</span>
                  </>
                ) : isExpired && reservation?.stockAvailable === false ? (
                  <span>Item Unavailable (Update Cart)</span>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Pay {formatLKR(displayTotalCents)}</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-center gap-2 text-[10px] text-[#292525]/60 pt-2 border-t border-stone-100">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>10-min reservation hold &bull; 100% verified server calculation</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
