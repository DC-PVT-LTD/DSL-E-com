'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  MailCheck,
  ShieldAlert,
  ArrowRight,
  Home,
} from 'lucide-react';
import { newsletterService } from '@/services/newsletterService';
import { UnsubscribeInfo } from '@/types/newsletter';

function NewsletterUnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState<UnsubscribeInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unsubscribed, setUnsubscribed] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!token) {
      setLoading(false);
      setError('No unsubscribe token provided. Please use the unsubscribe link provided in your promotional email.');
      return;
    }

    const fetchInfo = async () => {
      try {
        const res = await newsletterService.getUnsubscribeInfo(token);
        if (mounted) {
          setInfo(res);
          if (res.isUnsubscribed) {
            setUnsubscribed(true);
            setSuccessMessage('This email address has already been unsubscribed from our newsletter.');
          }
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Invalid or expired unsubscribe link.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchInfo();

    return () => {
      mounted = false;
    };
  }, [token]);

  const handleConfirmUnsubscribe = async () => {
    if (!token) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await newsletterService.unsubscribe(token);
      setUnsubscribed(true);
      setSuccessMessage(res.message);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to complete unsubscribe request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-16 sm:py-24">
      <div className="bg-white rounded-3xl border border-[#C6E7FF] p-8 sm:p-12 shadow-sm text-center space-y-6">
        {loading ? (
          <div className="space-y-4 py-8">
            <Loader2 className="w-12 h-12 text-[#0066CC] animate-spin mx-auto" />
            <h2 className="text-xl sm:text-2xl font-black text-[#292525]">
              Loading Preferences...
            </h2>
          </div>
        ) : unsubscribed ? (
          <div className="space-y-5 animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center mx-auto shadow-xs">
              <MailCheck className="w-9 h-9" />
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                Subscription Updated
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-[#292525] tracking-tight">
                You're Unsubscribed
              </h1>
              <p className="text-xs sm:text-sm text-[#292525]/75 max-w-md mx-auto leading-relaxed">
                {successMessage ||
                  'You have been successfully unsubscribed from DSL Stationery promotional emails. You will no longer receive newsletter offers or marketing campaigns.'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1 text-left">
              <p className="font-bold text-slate-800">Important Note:</p>
              <p className="text-[11px]">
                You will still receive critical transactional emails (such as order confirmations, tracking notices, and password resets) when you place orders on DSL Stationery.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/home"
                className="inline-flex items-center justify-center gap-2 bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold px-6 py-3 rounded-full transition-all shadow-xs"
              >
                <Home className="w-4 h-4" />
                <span>Return to Store</span>
              </Link>
            </div>
          </div>
        ) : error ? (
          <div className="space-y-5 animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
              <AlertCircle className="w-9 h-9" />
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-extrabold text-rose-600 uppercase tracking-wider">
                Unsubscribe Link Error
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-[#292525] tracking-tight">
                Invalid Link
              </h1>
              <p className="text-xs sm:text-sm text-[#292525]/75 max-w-md mx-auto leading-relaxed">
                {error}
              </p>
            </div>

            <div className="pt-4">
              <Link
                href="/home"
                className="text-xs text-[#0066CC] font-bold hover:underline"
              >
                ← Return to Homepage
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-5 animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-xs">
              <ShieldAlert className="w-9 h-9" />
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-extrabold text-amber-600 uppercase tracking-wider">
                Consent Management
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-[#292525] tracking-tight">
                Confirm Unsubscribe
              </h1>
              <p className="text-xs sm:text-sm text-[#292525]/75 max-w-md mx-auto leading-relaxed">
                Are you sure you want to stop receiving promotional emails, coupon drops, and stationery updates for{' '}
                <strong className="text-[#292525] font-bold">{info?.maskedEmail}</strong>?
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={handleConfirmUnsubscribe}
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-6 py-3 rounded-full transition-all shadow-xs cursor-pointer disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Unsubscribing...</span>
                  </>
                ) : (
                  <span>Unsubscribe from Newsletter</span>
                )}
              </button>
              <Link
                href="/home"
                className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-[#C6E7FF] text-[#0066CC] text-xs font-bold px-6 py-3 rounded-full transition-all"
              >
                <span>Keep Subscription</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NewsletterUnsubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-xl mx-auto px-4 py-24 text-center">
          <Loader2 className="w-8 h-8 text-[#0066CC] animate-spin mx-auto" />
        </div>
      }
    >
      <NewsletterUnsubscribeContent />
    </Suspense>
  );
}

