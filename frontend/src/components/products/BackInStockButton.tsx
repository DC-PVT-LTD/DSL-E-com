'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Bell, Check, Loader2, AlertCircle } from 'lucide-react';
import { backInStockService } from '@/services/backInStockService';
import { useUserStore } from '@/services/userStore';

interface BackInStockButtonProps {
  productId: string;
  productName: string;
  className?: string;
  onSubscribed?: () => void;
}

export const BackInStockButton: React.FC<BackInStockButtonProps> = ({
  productId,
  productName,
  className = '',
  onSubscribed,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const currentUser = useUserStore((state) => state.currentUser);

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Check initial subscription status if user is authenticated
  useEffect(() => {
    let mounted = true;
    if (!currentUser || !productId) return;

    const checkStatus = async () => {
      setIsCheckingStatus(true);
      try {
        const res = await backInStockService.getStatus(productId);
        if (mounted && res?.isSubscribed) {
          setIsSubscribed(true);
        }
      } catch {
        // Soft fail if status check fails
      } finally {
        if (mounted) setIsCheckingStatus(false);
      }
    };

    checkStatus();
    return () => {
      mounted = false;
    };
  }, [currentUser, productId]);

  const handleSubscribe = async () => {
    setFeedback(null);

    // 1. Check authentication
    if (!currentUser) {
      const redirectUrl = encodeURIComponent(pathname || `/products/${productId}`);
      router.push(`/login?redirect=${redirectUrl}`);
      return;
    }

    if (isSubscribed || isLoading) return;

    setIsLoading(true);
    try {
      const res = await backInStockService.subscribe(productId);
      setIsSubscribed(true);
      setFeedback({
        type: 'success',
        message: res.isAlreadySubscribed
          ? "You're already subscribed to alerts for this product."
          : `We'll email you at ${currentUser.email} as soon as this item is back in stock!`,
      });
      onSubscribed?.();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Unable to subscribe to back-in-stock alerts. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingStatus) {
    return (
      <div className={`flex items-center justify-center py-3.5 px-6 rounded-full bg-slate-50 border border-slate-200 text-slate-400 text-xs font-bold ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        <span>Checking alert status...</span>
      </div>
    );
  }

  return (
    <div className="space-y-2 w-full">
      <button
        type="button"
        onClick={handleSubscribe}
        disabled={isLoading || isSubscribed}
        className={`w-full py-3.5 px-6 rounded-full font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
          isSubscribed
            ? 'bg-emerald-50 border border-emerald-300 text-emerald-700 cursor-default'
            : isLoading
            ? 'bg-[#0066CC]/80 text-white cursor-wait opacity-80'
            : 'bg-[#0066CC] hover:bg-[#0052a3] text-white hover:scale-101 active:scale-99'
        } ${className}`}
        aria-label={
          isSubscribed
            ? "You're subscribed to back-in-stock alerts"
            : `Notify me when ${productName} is available`
        }
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Subscribing...</span>
          </>
        ) : isSubscribed ? (
          <>
            <Check className="w-4 h-4 text-emerald-600" />
            <span>You&apos;re Subscribed to Alerts</span>
          </>
        ) : (
          <>
            <Bell className="w-4 h-4" />
            <span>Notify Me When Available</span>
          </>
        )}
      </button>

      {feedback && (
        <div
          className={`p-3 rounded-2xl text-xs flex items-start gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <span className="leading-relaxed">{feedback.message}</span>
        </div>
      )}
    </div>
  );
};

