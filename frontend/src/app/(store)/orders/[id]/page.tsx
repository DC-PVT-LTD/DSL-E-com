'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Package,
  CheckCircle2,
  Clock,
  Truck,
  ArrowLeft,
  XCircle,
  AlertCircle,
  MapPin,
  Calendar,
  Mail,
  ShieldCheck,
  RefreshCw,
  Repeat,
  Loader2,
  KeyRound,
  Building2,
  PhoneCall,
  AlertTriangle,
} from 'lucide-react';
import { orderService } from '@/services/orderService';
import { useCartStore } from '@/services/cartStore';
import { useUserStore } from '@/services/userStore';
import { Order, OrderStatus, BuyAgainResponse } from '@/types/order';
import { formatLKR } from '@/lib/currency';
import { BuyAgainModal } from '@/components/orders/BuyAgainModal';

const STATUS_STEPS: { key: OrderStatus; label: string }[] = [
  { key: 'confirmed', label: 'Order Confirmed' },
  { key: 'processing', label: 'Packing in Warehouse' },
  { key: 'shipped', label: 'Dispatched to Courier' },
  { key: 'delivered', label: 'Delivered' },
];

function OrderTrackingContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const tokenParam = searchParams.get('token');

  const currentUser = useUserStore((state) => state.currentUser);
  const addBuyAgainBatch = useCartStore((state) => state.addBuyAgainBatch);

  const [order, setOrder] = useState<any | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const [verifyStep, setVerifyStep] = useState<'EMAIL' | 'OTP'>('EMAIL');
  const [enteredEmail, setEnteredEmail] = useState('');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [emailVerifyError, setEmailVerifyError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  // Buy Again State
  const [isReordering, setIsReordering] = useState(false);
  const [buyAgainResult, setBuyAgainResult] = useState<BuyAgainResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const loadOrder = useCallback(
    async (tokenOrEmail?: string) => {
      setIsLoading(true);
      setEmailVerifyError(null);

      // Save token if passed in URL
      if (tokenParam && typeof window !== 'undefined') {
        sessionStorage.setItem(`order_token_${id}`, tokenParam);
        sessionStorage.setItem('last_tracking_token', tokenParam);
      }

      const activeToken =
        tokenOrEmail ||
        tokenParam ||
        (typeof window !== 'undefined' ? sessionStorage.getItem(`order_token_${id}`) : null) ||
        (typeof window !== 'undefined' ? sessionStorage.getItem('last_tracking_token') : null);

      try {
        const fetched = await orderService.fetchOrderById(id, activeToken || undefined);
        if (fetched) {
          setOrder(fetched);
          setNeedsEmailVerification(false);
        } else {
          setNeedsEmailVerification(true);
        }
      } catch (err: any) {
        setNeedsEmailVerification(true);
        if (err?.response?.status === 403 || err?.status === 403) {
          setEmailVerifyError('Access requires email verification code or valid tracking link.');
        }
      } finally {
        setIsLoading(false);
        setIsVerifying(false);
      }
    },
    [id, tokenParam]
  );

  useEffect(() => {
    loadOrder();

    const unsub = orderService.subscribe(() => {
      loadOrder();
    });
    return () => {
      unsub();
    };
  }, [loadOrder]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = enteredEmail.trim();
    if (!clean || !clean.includes('@')) {
      setEmailVerifyError('Please enter a valid email address.');
      return;
    }
    setIsVerifying(true);
    setEmailVerifyError(null);
    setSuccessMsg(null);
    try {
      await orderService.requestTrackingOtp(id, clean);
      setVerifyStep('OTP');
      setResendCooldown(60);
      setSuccessMsg('If this email matches our records, a 6-digit access code was sent.');
    } catch (err: any) {
      setEmailVerifyError(err?.message || 'Failed to send verification code.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = enteredOtp.trim();
    if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setEmailVerifyError('Please enter the 6-digit verification code.');
      return;
    }
    setIsVerifying(true);
    setEmailVerifyError(null);
    try {
      const res = await orderService.verifyTrackingOtp(id, enteredEmail.trim(), cleanOtp);
      if (res?.trackingToken) {
        await loadOrder(res.trackingToken);
      }
    } catch (err: any) {
      setEmailVerifyError(err?.message || 'Invalid or expired verification code.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isResending) return;
    setIsResending(true);
    setEmailVerifyError(null);
    try {
      await orderService.requestTrackingOtp(id, enteredEmail.trim());
      setResendCooldown(60);
      setSuccessMsg('A new access code has been dispatched.');
    } catch (err: any) {
      setEmailVerifyError(err?.message || 'Failed to resend code.');
    } finally {
      setIsResending(false);
    }
  };

  const handleBuyAgain = async () => {
    if (!order) return;
    setIsReordering(true);
    try {
      const res = await orderService.buyAgain(order.id);

      // Add eligible in-stock items to existing cart
      const availableItems = res.items
        .filter((it) => it.availableQuantity > 0 && it.product)
        .map((it) => ({
          product: it.product,
          variant: it.variant,
          quantity: it.availableQuantity,
          bundleInfo: it.bundleInfo,
        }));

      if (availableItems.length > 0) {
        await addBuyAgainBatch(availableItems);
      }

      setBuyAgainResult(res);
      setIsModalOpen(true);
    } catch (err: any) {
      alert(err?.message || 'Unable to reorder products from this order. Please try again.');
    } finally {
      setIsReordering(false);
    }
  };

  if (isLoading && !order) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <RefreshCw className="w-8 h-8 text-[#0066CC] animate-spin mx-auto mb-3" />
        <p className="text-xs text-[#292525]/50">Loading order details from server...</p>
      </div>
    );
  }

  // Guest Email / OTP Verification Required (Phase B.1)
  if (!order && needsEmailVerification) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 sm:py-24 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-[#F0F7FF] text-[#0066CC] flex items-center justify-center mx-auto border border-[#C6E7FF]">
          {verifyStep === 'EMAIL' ? <Mail className="w-8 h-8" /> : <ShieldCheck className="w-8 h-8" />}
        </div>
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-bold text-[#292525]">
            {verifyStep === 'EMAIL' ? 'Guest Order Verification Required' : 'Enter Order Access Code'}
          </h1>
          <p className="text-xs text-[#292525]/60">
            {verifyStep === 'EMAIL' ? (
              <>
                To protect customer order information for order <span className="font-mono font-bold text-[#0066CC]">#{id}</span>, please enter the email address used during checkout to receive an access code.
              </>
            ) : (
              <>
                A 6-digit access code was sent to <span className="font-bold text-[#0066CC]">{enteredEmail}</span>. Enter the code below to view your order.
              </>
            )}
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 space-y-4 shadow-sm text-left">
          {emailVerifyError && (
            <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{emailVerifyError}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {verifyStep === 'EMAIL' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#292525] mb-1">
                  Customer Email Address
                </label>
                <input
                  type="email"
                  value={enteredEmail}
                  onChange={(e) => setEnteredEmail(e.target.value)}
                  placeholder="e.g. yourname@example.com"
                  required
                  disabled={isVerifying}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                />
              </div>

              <button
                type="submit"
                disabled={isVerifying}
                className="w-full bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold py-3 rounded-full transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending Code...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-3.5 h-3.5" />
                    <span>Send Access Code</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#292525] mb-1 text-center">
                  6-Digit Access Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={enteredOtp}
                    onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    required
                    disabled={isVerifying}
                    className="w-full text-center tracking-[0.4em] font-mono font-bold text-lg py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#0066CC] bg-stone-50"
                  />
                  <KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" />
                </div>
                <p className="text-[11px] text-[#292525]/60 text-center mt-2">
                  Code expires in 10 minutes.
                </p>
              </div>

              <button
                type="submit"
                disabled={isVerifying || enteredOtp.length !== 6}
                className="w-full bg-[#0866E8] hover:bg-[#09285C] text-white text-xs font-bold py-3 rounded-full transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Confirm Code &amp; View Order</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => setVerifyStep('EMAIL')}
                  className="text-slate-500 hover:text-slate-800 underline p-1"
                >
                  Change email
                </button>

                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || isResending}
                  className="font-bold text-[#0866E8] disabled:text-slate-400 hover:underline flex items-center gap-1 p-1"
                >
                  {isResending ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                  <span>
                    {resendCooldown > 0
                      ? `Resend in ${resendCooldown}s`
                      : 'Resend code'}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>

        <div>
          <Link
            href="/shop"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0866E8] hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Shop</span>
          </Link>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-[#09285C]">Order Not Found</h1>
        <p className="text-xs text-slate-500 mt-2">Could not find any order with ID {id}.</p>
        <Link
          href="/shop"
          className="mt-4 inline-flex items-center gap-1.5 bg-[#0866E8] hover:bg-[#09285C] text-white text-xs font-bold px-5 py-2.5 rounded-full shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Shop</span>
        </Link>
      </div>
    );
  }

  const normalizedStatus = (order.orderStatus || '').toLowerCase();
  const currentStepIdx = STATUS_STEPS.findIndex((s) => s.key === normalizedStatus);
  const isCancelled = normalizedStatus === 'cancelled';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-14 space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
        <div>
          <Link
            href="/account/orders"
            className="text-xs font-bold text-[#0866E8] hover:underline flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Orders</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black text-[#09285C] tracking-tight">
            Order #{order.orderNumber}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Placed on{' '}
            {new Date(order.createdAt).toLocaleDateString('en-LK', { dateStyle: 'long' })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Phase 15.3: Buy Again Action */}
          <button
            type="button"
            onClick={handleBuyAgain}
            disabled={isReordering}
            className="bg-white hover:bg-blue-50 text-[#0866E8] border border-blue-200 text-xs font-bold px-4 py-2 rounded-full transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50 touch-target"
            title="Reorder available products from this order"
          >
            {isReordering ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Checking Stock...</span>
              </>
            ) : (
              <>
                <Repeat className="w-3.5 h-3.5" />
                <span>Buy Again</span>
              </>
            )}
          </button>

          <span
            className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider ${
              isCancelled
                ? 'bg-rose-100 text-rose-800'
                : normalizedStatus === 'delivered'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-[#F7FAFF] text-[#09285C] border border-blue-100'
            }`}
          >
            {normalizedStatus.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Tracking Stepper */}
      {!isCancelled ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-5 sm:p-8 shadow-xs">
          <h2 className="text-sm font-bold text-[#09285C] mb-6 flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#0866E8]" />
            <span>Live Delivery Timeline</span>
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {STATUS_STEPS.map((step, idx) => {
              const isCompleted = idx <= currentStepIdx;
              const isCurrent = idx === currentStepIdx;
              return (
                <div key={step.key} className="relative flex flex-col items-center text-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs mb-2 transition-all ${
                      isCompleted
                        ? 'bg-[#0866E8] text-white shadow-xs'
                        : 'bg-[#F7FAFF] text-slate-400 border border-slate-200'
                    } ${isCurrent ? 'ring-4 ring-blue-100' : ''}`}
                  >
                    {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                  </div>
                  <span
                    className={`text-xs ${
                      isCompleted ? 'font-bold text-[#09285C]' : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#0866E8]" />
              <span>
                Estimated Delivery:{' '}
                <strong className="text-[#09285C]">
                  {order.estimatedDeliveryDate || '2-3 Business Days'}
                </strong>
              </span>
            </div>
            <div>
              Courier Tracking:{' '}
              <strong className="font-mono text-[#09285C] bg-[#F7FAFF] px-2 py-0.5 rounded border border-blue-100">
                {order.trackingNumber || 'Assigned upon dispatch'}
              </strong>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 flex items-center gap-3 text-xs text-rose-800">
          <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>This order was cancelled and inventory has been returned to stock.</span>
        </div>
      )}

      {/* Bank Transfer Payment Verification Status (Stage 3.3) */}
      {(order.paymentMethod === 'BANK_TRANSFER' || order.paymentMethod === 'bank_transfer_mock') && (
        <div className="bg-white rounded-3xl border border-slate-100 p-5 sm:p-6 shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Building2 className="w-4 h-4 text-[#0866E8]" />
            <h3 className="text-sm font-bold text-[#09285C]">Bank Transfer Payment Status</h3>
          </div>

          {/* If Rejected */}
          {order.bankDepositSubmissions?.[0]?.status === 'REJECTED' || (isCancelled && (order.paymentStatus === 'FAILED' || order.paymentStatus === 'failed')) ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wide text-rose-700">
                    Your Bank Transfer payment was rejected.
                  </h4>
                  <p className="text-xs mt-1 text-rose-800">
                    {order.bankDepositSubmissions?.[0]?.rejectionReason || 'The deposit verification was declined by our accounts team.'}
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-rose-200/60 text-xs flex flex-wrap items-center justify-between gap-2">
                <span className="text-rose-800">
                  Please contact our customer support hotline for assistance with your order:
                </span>
                <a
                  href="tel:+94114963069"
                  className="inline-flex items-center gap-1.5 font-bold text-[#0866E8] bg-white px-3 py-1.5 rounded-full border border-rose-200 shadow-xs hover:bg-rose-100"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>+94 114 963 069</span>
                </a>
              </div>
            </div>
          ) : order.bankDepositSubmissions?.[0]?.status === 'VERIFIED' || order.paymentStatus === 'PAID' || order.paymentStatus === 'paid' ? (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-black uppercase tracking-wide text-emerald-700">
                  Your Bank Transfer payment has been verified.
                </h4>
                <p className="text-xs mt-0.5 text-emerald-800">
                  Your deposit has been reconciled and your order is confirmed for processing.
                </p>
                {order.bankDepositSubmissions?.[0]?.referenceNumber && (
                  <p className="text-[11px] text-emerald-700 font-mono mt-1">
                    Reference: {order.bankDepositSubmissions[0].referenceNumber}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5">
              <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-black uppercase tracking-wide text-amber-800">
                  Your Bank Transfer receipt has been submitted and is awaiting verification.
                </h4>
                <p className="text-xs mt-0.5 text-amber-800">
                  Our accounts team verifies deposits during regular banking hours. You will receive an update once verified.
                </p>
                {order.bankDepositSubmissions?.[0]?.referenceNumber && (
                  <p className="text-[11px] text-amber-700 font-mono mt-1">
                    Reference: {order.bankDepositSubmissions[0].referenceNumber}
                    {order.bankDepositSubmissions[0].depositDate ? ` • Deposit Date: ${order.bankDepositSubmissions[0].depositDate}` : ''}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Items & Shipping Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-3xl border border-slate-100 p-5 sm:p-7 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 className="text-sm font-bold text-[#09285C]">
              Package Contents ({order.items?.length || 0} items)
            </h2>
            <button
              type="button"
              onClick={handleBuyAgain}
              disabled={isReordering}
              className="text-xs font-bold text-[#0866E8] hover:underline flex items-center gap-1 disabled:opacity-50 touch-target"
            >
              <Repeat className="w-3 h-3" />
              <span>Buy Items Again</span>
            </button>
          </div>

          <div className="space-y-3">
            {order.items?.map((item: any) => (
              <div
                key={item.id}
                className="flex justify-between items-center py-2 border-b border-slate-100 text-xs gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-[#09285C] truncate">
                    {item.product?.name || item.productName}
                  </div>
                  {item.variantName && (
                    <div className="text-[#0866E8] font-semibold text-[11px] mt-0.5">
                      {item.variantName}
                    </div>
                  )}
                  <div className="text-slate-400">
                    Qty: {item.quantity} × {formatLKR(item.unitPriceCents)}
                  </div>
                </div>
                <div className="font-bold text-[#09285C] shrink-0">
                  {formatLKR(item.totalPriceCents || item.unitPriceCents * item.quantity)}
                </div>
              </div>
            ))}
          </div>

          {order.schoolPacksSnapshot && order.schoolPacksSnapshot.length > 0 && (
            <div className="p-3 bg-[#F7FAFF] rounded-2xl border border-blue-100 text-xs space-y-1">
              <span className="font-bold text-[#0866E8] flex items-center gap-1">
                🎒 School Pack Bundles Applied:
              </span>
              {order.schoolPacksSnapshot.map((pack: any) => (
                <div
                  key={pack.packId}
                  className="text-[11px] text-slate-700 flex justify-between"
                >
                  <span>
                    {pack.packName} ({pack.savingsPercentage}% Bundle Savings)
                  </span>
                  <span className="font-semibold text-emerald-700">
                    Saved {formatLKR(pack.bundleDiscountCents)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="pt-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{formatLKR(order.subtotalCents)}</span>
            </div>
            {order.discountCents > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount</span>
                <span>-{formatLKR(order.discountCents)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>Delivery</span>
              <span>
                {order.deliveryCents === 0 ? (
                  <span className="text-emerald-600 font-bold">FREE</span>
                ) : (
                  formatLKR(order.deliveryCents)
                )}
              </span>
            </div>
            <div className="flex justify-between text-sm font-bold text-[#09285C] pt-2 border-t border-slate-100">
              <span>Total Payable</span>
              <span className="text-base font-black text-[#0866E8]">
                {formatLKR(order.totalCents)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 p-5 sm:p-7 space-y-4 shadow-xs text-xs">
          <h2 className="text-sm font-bold text-[#09285C] pb-2 border-b border-slate-100">
            Shipping Destination
          </h2>
          <div>
            <strong className="block text-[#09285C] font-bold">{order.customerName}</strong>
            <p className="text-slate-600 mt-1 leading-relaxed">
              {order.shippingAddress?.addressLine1 || order.addressSnapshot?.addressLine1}
              {(order.shippingAddress?.addressLine2 || order.addressSnapshot?.addressLine2) && (
                <>, {order.shippingAddress?.addressLine2 || order.addressSnapshot?.addressLine2}</>
              )}
              <br />
              {order.shippingAddress?.city || order.addressSnapshot?.city},{' '}
              {order.shippingAddress?.district || order.addressSnapshot?.district}
              {(order.shippingAddress?.postalCode || order.addressSnapshot?.postalCode) && (
                <> - {order.shippingAddress?.postalCode || order.addressSnapshot?.postalCode}</>
              )}
            </p>
            <p className="text-slate-600 mt-2">Phone: {order.customerPhone}</p>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">
              Payment Method
            </span>
            <span className="font-bold text-[#09285C] capitalize mt-0.5 block">
              {(order.paymentMethod || '').replace('_', ' ')}
            </span>
          </div>
        </div>
      </div>

      {/* Buy Again Summary Modal */}
      <BuyAgainModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        result={buyAgainResult}
      />
    </div>
  );
}

export default function OrderTrackingPage() {
  return (
    <Suspense
      fallback={<div className="p-12 text-center text-xs text-[#292525]/50">Loading order tracking...</div>}
    >
      <OrderTrackingContent />
    </Suspense>
  );
}
