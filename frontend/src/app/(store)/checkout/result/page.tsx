'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2,
  Package,
  ArrowRight,
  Clock,
  XCircle,
  RefreshCw,
  Sparkles,
  UserPlus,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  Check,
  KeyRound,
  Mail,
} from 'lucide-react';
import { orderService } from '@/services/orderService';
import { checkoutService } from '@/services/checkoutService';
import { useUserStore } from '@/services/userStore';
import { formatLKR } from '@/lib/currency';

function CheckoutResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const paymentQueryParam = searchParams.get('payment');
  const emailParam = searchParams.get('email');
  const tokenParam = searchParams.get('token');

  const currentUser = useUserStore((state) => state.currentUser);
  const registerCustomer = useUserStore((state) => state.registerCustomer);
  const verifyEmail = useUserStore((state) => state.verifyEmail);
  const resendVerificationOtp = useUserStore((state) => state.resendVerificationOtp);
  const loginCustomer = useUserStore((state) => state.loginCustomer);

  const [order, setOrder] = useState<any | null>(null);
  const [reconciledStatus, setReconciledStatus] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRechecking, setIsRechecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Optional Account Creation Form State
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [accountFormError, setAccountFormError] = useState<string | null>(null);
  const [accountCreatedSuccess, setAccountCreatedSuccess] = useState(false);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const [signInPassword, setSignInPassword] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [dismissAccountCard, setDismissAccountCard] = useState(false);

  // Phase B.1: OTP Verification State
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [otpSuccessMsg, setOtpSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let timer: any;
    if (otpCountdown > 0) {
      timer = setInterval(() => {
        setOtpCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [otpCountdown]);

  // Determine effective guest email
  const effectiveEmail =
    emailParam ||
    (typeof window !== 'undefined' ? sessionStorage.getItem('last_order_email') : null) ||
    undefined;

  const fetchAuthoritativeStatus = useCallback(async () => {
    if (!orderId) {
      setIsLoading(false);
      return;
    }

    if (tokenParam && typeof window !== 'undefined') {
      sessionStorage.setItem(`order_token_${orderId}`, tokenParam);
      sessionStorage.setItem('last_tracking_token', tokenParam);
    }

    try {
      // 1. Fetch live order details from backend (passing token if present)
      const fetchedOrder = await orderService.fetchOrderById(orderId, tokenParam || effectiveEmail);
      if (fetchedOrder) {
        setOrder(fetchedOrder);
      }

      // 2. Fetch authoritative payment reconciliation
      try {
        const status = await checkoutService.reconcilePaymentStatus(orderId);
        setReconciledStatus(status);
        if (status?.orderId && !fetchedOrder) {
          const reFetched = await orderService.fetchOrderById(status.orderId, tokenParam || effectiveEmail);
          if (reFetched) setOrder(reFetched);
        }
      } catch (recErr) {
        // Fallback to order status
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to verify order status with the server.');
    } finally {
      setIsLoading(false);
      setIsRechecking(false);
    }
  }, [orderId, effectiveEmail, tokenParam]);

  useEffect(() => {
    fetchAuthoritativeStatus();
  }, [fetchAuthoritativeStatus]);

  const handleManualRecheck = () => {
    setIsRechecking(true);
    fetchAuthoritativeStatus();
  };

  // Optional account creation handler
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    setAccountFormError(null);
    setOtpSuccessMsg(null);

    if (password.length < 8) {
      setAccountFormError('Password must be at least 8 characters long');
      return;
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      setAccountFormError('Password must include uppercase, lowercase, and numeric characters');
      return;
    }
    if (password !== confirmPassword) {
      setAccountFormError('Passwords do not match');
      return;
    }

    setIsCreatingAccount(true);

    try {
      const regRes = await registerCustomer(
        order.customerName,
        order.customerEmail,
        password,
        order.customerPhone,
        order.id
      );

      if (regRes.requiresVerification) {
        setIsVerifyingOtp(true);
        setOtpCountdown(60);
        setOtpSuccessMsg('A 6-digit verification code has been dispatched to your email.');
      } else {
        setAccountCreatedSuccess(true);
        await fetchAuthoritativeStatus();
      }
    } catch (err: any) {
      const msg = err?.message || '';
      if (
        msg.toLowerCase().includes('already') ||
        msg.toLowerCase().includes('duplicate') ||
        msg.toLowerCase().includes('exists')
      ) {
        setShowSignInPrompt(true);
        setAccountFormError(
          'An account with this email already exists. Sign in below to link this order to your account.'
        );
      } else {
        setAccountFormError(msg || 'Failed to create account.');
      }
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setAccountFormError(null);
    setOtpSuccessMsg(null);

    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setAccountFormError('Please enter a valid 6-digit numeric verification code.');
      return;
    }

    setIsCreatingAccount(true);
    try {
      const vRes = await verifyEmail(order.customerEmail, cleanOtp);
      if (vRes.success) {
        setIsVerifyingOtp(false);
        setAccountCreatedSuccess(true);
        await fetchAuthoritativeStatus();
      }
    } catch (err: any) {
      setAccountFormError(err?.message || 'Invalid or expired verification code. Please try again.');
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const handleResendOtp = async () => {
    if (!order || otpCountdown > 0 || isResendingOtp) return;
    setIsResendingOtp(true);
    setAccountFormError(null);
    try {
      await resendVerificationOtp(order.customerEmail);
      setOtpCountdown(60);
      setOtpSuccessMsg('A fresh verification code has been sent to your email.');
    } catch (err: any) {
      setAccountFormError(err?.message || 'Unable to resend verification code right now.');
    } finally {
      setIsResendingOtp(false);
    }
  };

  const handleLinkExistingAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !signInPassword) return;

    setIsSigningIn(true);
    setAccountFormError(null);

    try {
      const success = await loginCustomer(order.customerEmail, signInPassword);
      if (success) {
        setAccountCreatedSuccess(true);
        setShowSignInPrompt(false);
        await fetchAuthoritativeStatus();
      } else {
        setAccountFormError('Invalid password. Please check your credentials and try again.');
      }
    } catch (err: any) {
      setAccountFormError(err?.message || 'Unable to sign in. Please try again.');
    } finally {
      setIsSigningIn(false);
    }
  };

  // Determine authoritative payment status from backend
  const paymentStatus =
    order?.paymentStatus ||
    reconciledStatus?.paymentStatus ||
    (paymentQueryParam === 'cancelled' ? 'FAILED' : 'PENDING');
  const isPaid = paymentStatus === 'PAID' || paymentStatus === 'succeeded' || paymentStatus === 'SUCCEEDED';
  const isPending =
    paymentStatus === 'PENDING' || paymentStatus === 'processing' || paymentStatus === 'PROCESSING';
  const isFailed =
    paymentStatus === 'FAILED' || paymentStatus === 'failed' || paymentStatus === 'CANCELLED';

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto my-24 p-8 bg-white rounded-3xl border border-[#C6E7FF]/60 text-center space-y-4 shadow-sm">
        <RefreshCw className="w-8 h-8 text-[#0066CC] animate-spin mx-auto" />
        <h2 className="text-base font-bold text-[#292525]">Verifying Order Status</h2>
        <p className="text-xs text-[#292525]/70">
          Retrieving authoritative order and payment verification from the DSL Stationery backend...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 text-center space-y-8">
      {/* Status Badges */}
      {isPaid && (
        <>
          <div className="w-20 h-20 rounded-full bg-[#EBD5FA] text-[#8629B3] flex items-center justify-center mx-auto shadow-sm border border-[#CFA6E8]">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8629B3] bg-[#EBD5FA]/60 px-4 py-1.5 rounded-full inline-flex items-center gap-1.5 border border-[#CFA6E8]/40">
              <Sparkles className="w-3.5 h-3.5" /> Payment Verified &amp; Order Confirmed
            </span>
            <h1 className="text-3xl sm:text-4xl font-black text-[#292525] tracking-tight">
              Thank you for choosing DSL Stationery!
            </h1>
            <p className="text-sm text-[#292525]/70 max-w-md mx-auto">
              Your payment has been authoritatively verified. Your stationery items are being prepared for dispatch.
            </p>
          </div>
        </>
      )}

      {isPending && (
        <>
          <div className="w-20 h-20 rounded-full bg-[#FFF9D2] text-[#B38A00] flex items-center justify-center mx-auto shadow-sm border border-[#FFD84D]">
            <Clock className="w-10 h-10 animate-pulse" />
          </div>
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#B38A00] bg-[#FFF9D2] px-4 py-1.5 rounded-full inline-flex items-center gap-1.5 border border-[#FFD84D]">
              <Clock className="w-3.5 h-3.5" /> Order Received — Pending Fulfilment
            </span>
            <h1 className="text-3xl sm:text-4xl font-black text-[#292525] tracking-tight">
              Order Placed Successfully!
            </h1>
            <p className="text-sm text-[#292525]/70 max-w-md mx-auto">
              We received your order. If you selected Cash on Delivery, our team will dispatch your
              stationery soon. For bank transfers, verification takes up to 24 hours.
            </p>
            <div>
              <button
                onClick={handleManualRecheck}
                disabled={isRechecking}
                className="inline-flex items-center gap-2 bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold px-5 py-2.5 rounded-full transition-all shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRechecking ? 'animate-spin' : ''}`} />
                <span>{isRechecking ? 'Checking Status...' : 'Re-check Order Status'}</span>
              </button>
            </div>
          </div>
        </>
      )}

      {isFailed && (
        <>
          <div className="w-20 h-20 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto shadow-sm border border-red-200">
            <XCircle className="w-10 h-10" />
          </div>
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-red-700 bg-red-100 px-4 py-1.5 rounded-full inline-flex items-center gap-1.5 border border-red-200">
              Payment Not Completed
            </span>
            <h1 className="text-3xl sm:text-4xl font-black text-[#292525] tracking-tight">
              Payment Was Cancelled or Declined
            </h1>
            <p className="text-sm text-[#292525]/70 max-w-md mx-auto">
              Your payment was not completed. If your 10-minute reservation has not expired, you can return to checkout to retry or select Cash on Delivery.
            </p>
            <div className="pt-2">
              <Link
                href="/checkout"
                className="inline-flex items-center gap-2 bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold px-6 py-3 rounded-full transition-all shadow-sm"
              >
                <span>Return to Checkout</span> <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </>
      )}

      {/* Order Details Card */}
      {order && (
        <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 sm:p-8 text-left space-y-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between pb-4 border-b border-[#C6E7FF]/30 gap-2">
            <div>
              <span className="text-[10px] text-[#292525]/50 block uppercase font-mono">Order Number</span>
              <span className="text-lg font-black text-[#0066CC] font-mono">{order.orderNumber}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[#292525]/50 block uppercase">Authoritative Status</span>
              <span className="text-xs font-bold font-mono bg-[#FFFDF0] px-2.5 py-1 rounded-full border border-[#C6E7FF]/40 text-[#292525]">
                {order.orderStatus || 'CONFIRMED'} &bull; {order.paymentStatus || 'PAID'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <strong className="block text-[#292525]/50 uppercase text-[10px] mb-1">Customer Details</strong>
              <div className="font-bold text-[#292525]">{order.customerName}</div>
              <div className="text-[#292525]/70">{order.customerEmail}</div>
              <div className="text-[#292525]/70">{order.customerPhone}</div>
            </div>

            <div>
              <strong className="block text-[#292525]/50 uppercase text-[10px] mb-1">Shipping Destination</strong>
              <div className="text-[#292525] font-medium">
                {order.addressSnapshot?.addressLine1 || order.shippingAddress?.addressLine1},{' '}
                {order.addressSnapshot?.city || order.shippingAddress?.city},{' '}
                {order.addressSnapshot?.district || order.shippingAddress?.district}
              </div>
            </div>
          </div>

          {/* Ordered items breakdown */}
          <div className="pt-4 border-t border-[#C6E7FF]/30">
            <h3 className="text-xs font-bold text-[#292525] mb-3">Order Items</h3>
            <div className="space-y-2">
              {order.items?.map((i: any) => (
                <div key={i.id} className="flex justify-between text-xs py-1.5 border-b border-stone-100">
                  <span className="text-[#292525]/80">
                    {i.quantity}x {i.productName || i.product?.name}
                    {i.variantName ? ` (${i.variantName})` : ''}
                  </span>
                  <span className="font-bold text-[#292525]">
                    {formatLKR(i.totalPriceCents || i.unitPriceCents * i.quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 space-y-1.5 text-xs">
            {order.discountCents > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Bundle &amp; Voucher Savings</span>
                <span>-{formatLKR(order.discountCents)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-[#292525] pt-1">
              <span>Total Payable Amount</span>
              <span className="text-lg font-black text-[#0066CC]">{formatLKR(order.totalCents)}</span>
            </div>
          </div>
        </div>
      )}

      {/* OPTIONAL ACCOUNT CREATION PROMPT (Phase B Section 4) */}
      {order && !order.userId && !currentUser && !dismissAccountCard && (
        <div className="bg-gradient-to-br from-[#F0F7FF] via-[#FFFDF0] to-white rounded-3xl border-2 border-[#0066CC]/40 p-6 sm:p-8 text-left space-y-5 shadow-sm animate-in fade-in duration-300">
          {accountCreatedSuccess ? (
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-800 text-xs flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <strong>Account Created &amp; Linked!</strong>
                <p className="mt-0.5">
                  Your new DSL Stationery account has been activated and this order is now linked to your
                  profile.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 bg-[#C6E7FF]/40 text-[#0066CC] px-3 py-1 rounded-full text-xs font-bold">
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Optional: Save Your Details</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-[#292525]">
                    Create an account to track this order and speed up future purchases
                  </h3>
                  <p className="text-xs text-[#292525]/70 max-w-lg">
                    We&apos;ve pre-filled your information from this order. Just choose a password to
                    activate your registered customer account.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setDismissAccountCard(true)}
                  className="text-xs text-[#292525]/40 hover:text-[#292525] underline shrink-0 ml-2"
                >
                  Dismiss
                </button>
              </div>

              {/* Benefits list */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-2 text-xs">
                <div className="flex items-center gap-2 text-[#292525]/80">
                  <div className="w-5 h-5 rounded-full bg-white border border-[#C6E7FF] flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-[#0066CC]" />
                  </div>
                  <span>Real-time delivery tracking</span>
                </div>
                <div className="flex items-center gap-2 text-[#292525]/80">
                  <div className="w-5 h-5 rounded-full bg-white border border-[#C6E7FF] flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-[#0066CC]" />
                  </div>
                  <span>Save multiple delivery addresses</span>
                </div>
                <div className="flex items-center gap-2 text-[#292525]/80">
                  <div className="w-5 h-5 rounded-full bg-white border border-[#C6E7FF] flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-[#0066CC]" />
                  </div>
                  <span>Faster 1-click checkout</span>
                </div>
              </div>

              {/* Error Alert */}
              {accountFormError && (
                <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{accountFormError}</span>
                </div>
              )}

              {/* Sign in mode if email already exists */}
              {isVerifyingOtp ? (
                <form onSubmit={handleVerifyOtp} className="space-y-4 pt-2">
                  <div className="bg-[#EBF5FF] border border-[#C6E7FF] rounded-2xl p-4 text-xs text-[#292525]">
                    <div className="font-bold text-[#0066CC] flex items-center gap-1.5 mb-1">
                      <Mail className="w-4 h-4" />
                      <span>Verification Code Sent</span>
                    </div>
                    <p>
                      Please enter the 6-digit verification code sent to{' '}
                      <span className="font-bold text-[#0066CC]">{order.customerEmail}</span> to confirm your email and link your order.
                    </p>
                  </div>

                  {otpSuccessMsg && (
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                      <span>{otpSuccessMsg}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-[#292525] mb-1">
                      Enter 6-Digit Code
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        className="w-full text-center tracking-[0.4em] font-mono font-bold text-lg py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#0066CC] bg-stone-50"
                      />
                      <KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <button
                      type="submit"
                      disabled={isCreatingAccount || otp.length !== 6}
                      className="bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold px-6 py-2.5 rounded-full transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                    >
                      {isCreatingAccount ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5" />
                      )}
                      <span>Verify Code &amp; Complete</span>
                    </button>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={otpCountdown > 0 || isResendingOtp}
                        className="text-xs text-[#0066CC] font-bold disabled:text-stone-400 hover:underline flex items-center gap-1"
                      >
                        {isResendingOtp && <RefreshCw className="w-3 h-3 animate-spin" />}
                        <span>
                          {otpCountdown > 0
                            ? `Resend in ${otpCountdown}s`
                            : 'Resend code'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsVerifyingOtp(false)}
                        className="text-xs text-[#292525]/60 hover:underline"
                      >
                        Back
                      </button>
                    </div>
                  </div>
                </form>
              ) : showSignInPrompt ? (
                <form onSubmit={handleLinkExistingAccount} className="space-y-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-[#292525] mb-1">
                      Enter Password for {order.customerEmail}
                    </label>
                    <input
                      type="password"
                      value={signInPassword}
                      onChange={(e) => setSignInPassword(e.target.value)}
                      placeholder="Your account password"
                      className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={isSigningIn}
                      className="bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold px-5 py-2.5 rounded-full transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isSigningIn ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <LogIn className="w-3.5 h-3.5" />
                      )}
                      <span>Sign In &amp; Link Order</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSignInPrompt(false)}
                      className="text-xs text-[#292525]/60 hover:underline"
                    >
                      Back to registration
                    </button>
                  </div>
                </form>
              ) : (
                /* Registration form */
                <form onSubmit={handleCreateAccount} className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-[#292525]/70 mb-1">Name</label>
                      <input
                        type="text"
                        disabled
                        value={order.customerName}
                        className="w-full px-3.5 py-2 rounded-xl border border-stone-200 bg-stone-100 text-xs text-[#292525]/70"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#292525]/70 mb-1">Email</label>
                      <input
                        type="email"
                        disabled
                        value={order.customerEmail}
                        className="w-full px-3.5 py-2 rounded-xl border border-stone-200 bg-stone-100 text-xs text-[#292525]/70"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#292525] mb-1">
                        Create Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Min 8 characters with numbers &amp; letters"
                          className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#0066CC] pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-600"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#292525] mb-1">
                        Confirm Password <span className="text-red-500">*</span>
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={isCreatingAccount}
                      className="bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold px-6 py-2.5 rounded-full transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                    >
                      {isCreatingAccount ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UserPlus className="w-3.5 h-3.5" />
                      )}
                      <span>Create Account &amp; Link Order</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDismissAccountCard(true)}
                      className="text-xs text-[#292525]/60 hover:text-[#292525] hover:underline"
                    >
                      No thanks, continue without account
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      )}

      {/* Next Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
        {order && (
          <Link
            href={`/orders/${order.id || order.orderNumber}${
              typeof window !== 'undefined' && sessionStorage.getItem(`order_token_${order.id}`)
                ? `?token=${encodeURIComponent(sessionStorage.getItem(`order_token_${order.id}`) || '')}`
                : tokenParam
                ? `?token=${encodeURIComponent(tokenParam)}`
                : ''
            }`}
            className="bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold px-6 py-3 rounded-full transition-all shadow-md flex items-center gap-2"
          >
            <Package className="w-4 h-4" />
            <span>Track Order Status</span>
          </Link>
        )}

        <Link
          href="/shop"
          className="bg-white hover:bg-[#FFFDF0] text-[#292525] border border-[#C6E7FF] text-xs font-bold px-6 py-3 rounded-full transition-all shadow-xs flex items-center gap-1.5"
        >
          Continue Shopping <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutResultPage() {
  return (
    <Suspense
      fallback={<div className="p-12 text-center text-xs text-[#292525]/50">Loading order result...</div>}
    >
      <CheckoutResultContent />
    </Suspense>
  );
}
