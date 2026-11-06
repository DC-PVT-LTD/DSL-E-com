'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Mail,
  ArrowRight,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';
import { newsletterService } from '@/services/newsletterService';

function NewsletterVerifyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'LOADING' | 'SUCCESS' | 'ERROR'>('LOADING');
  const [message, setMessage] = useState<string>('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!token) {
      setStatus('ERROR');
      setMessage('No verification token provided. Please click the link received in your confirmation email.');
      return;
    }

    const doVerify = async () => {
      try {
        const res = await newsletterService.verify(token);
        if (mounted) {
          setStatus('SUCCESS');
          setMessage(res.message);
        }
      } catch (err: unknown) {
        if (mounted) {
          setStatus('ERROR');
          const msg = err instanceof Error ? err.message : 'Invalid or expired verification link.';
          setMessage(msg);
        }
      }
    };

    doVerify();

    return () => {
      mounted = false;
    };
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setResendError(null);
    setResendSuccess(null);

    const emailTrimmed = resendEmail.trim();
    if (!emailTrimmed) {
      setResendError('Please enter your email address.');
      return;
    }

    setResendLoading(true);
    try {
      const res = await newsletterService.resendVerification(emailTrimmed);
      setResendSuccess(res.message);
      setResendEmail('');
    } catch (err: unknown) {
      setResendError(err instanceof Error ? err.message : 'Unable to resend verification link.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-16 sm:py-24">
      <div className="bg-white rounded-3xl border border-[#C6E7FF] p-8 sm:p-12 shadow-sm text-center space-y-6">
        {status === 'LOADING' && (
          <div className="space-y-4 py-8">
            <Loader2 className="w-12 h-12 text-[#0066CC] animate-spin mx-auto" />
            <h2 className="text-xl sm:text-2xl font-black text-[#292525]">
              Verifying Subscription...
            </h2>
            <p className="text-xs sm:text-sm text-[#292525]/70">
              Please wait while we confirm your email address with DSL Stationery.
            </p>
          </div>
        )}

        {status === 'SUCCESS' && (
          <div className="space-y-5 animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-extrabold text-emerald-600 uppercase tracking-wider">
                Double Opt-in Verified
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-[#292525] tracking-tight">
                Subscription Confirmed!
              </h1>
              <p className="text-xs sm:text-sm text-[#292525]/75 max-w-md mx-auto leading-relaxed">
                {message ||
                  'Your email address has been successfully verified! You are now officially subscribed to the DSL Stationery newsletter.'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#FFFDF0] border border-[#FFD84D]/60 text-xs text-[#292525]/80 space-y-1 text-left">
              <p className="font-bold text-[#292525]">What happens next?</p>
              <p className="text-[11px]">
                You will be the first to know about school pack bundles, coupon drops, and new stationery stock. You can unsubscribe at any time from the link at the bottom of any email.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/shop"
                className="inline-flex items-center justify-center gap-2 bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold px-6 py-3 rounded-full transition-all shadow-xs"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Start Shopping</span>
              </Link>
              <Link
                href="/home"
                className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-[#C6E7FF] text-[#0066CC] text-xs font-bold px-6 py-3 rounded-full transition-all"
              >
                <span>Back to Homepage</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {status === 'ERROR' && (
          <div className="space-y-5 animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
              <AlertCircle className="w-9 h-9" />
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-extrabold text-rose-600 uppercase tracking-wider">
                Verification Issue
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-[#292525] tracking-tight">
                Unable to Verify
              </h1>
              <p className="text-xs sm:text-sm text-[#292525]/75 max-w-md mx-auto leading-relaxed">
                {message}
              </p>
            </div>

            {/* Resend Link Form */}
            <div className="pt-2 border-t border-[#C6E7FF]/60 text-left space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#0066CC]">
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Request a New Verification Link</span>
              </div>
              <p className="text-[11px] text-[#292525]/70">
                Verification links expire after 24 hours. Enter your email below to receive a fresh confirmation link:
              </p>

              {resendSuccess ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{resendSuccess}</span>
                </div>
              ) : (
                <form onSubmit={handleResend} className="space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="email"
                      required
                      placeholder="Enter your email address..."
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      disabled={resendLoading}
                      className="flex-1 px-3.5 py-2 rounded-xl border border-[#C6E7FF] text-xs text-[#292525] focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                    />
                    <button
                      type="submit"
                      disabled={resendLoading}
                      className="bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-xs shrink-0 flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer"
                    >
                      {resendLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : (
                        <span>Send Link</span>
                      )}
                    </button>
                  </div>
                  {resendError && (
                    <p className="text-[11px] text-rose-600 font-medium">{resendError}</p>
                  )}
                </form>
              )}
            </div>

            <div className="pt-2">
              <Link
                href="/home"
                className="text-xs text-[#0066CC] font-bold hover:underline"
              >
                ← Return to Homepage
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NewsletterVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-xl mx-auto px-4 py-24 text-center">
          <Loader2 className="w-8 h-8 text-[#0066CC] animate-spin mx-auto" />
        </div>
      }
    >
      <NewsletterVerifyContent />
    </Suspense>
  );
}

