'use client';

import React, { useState } from 'react';
import { Mail, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { newsletterService } from '@/services/newsletterService';

interface NewsletterSubscriptionFormProps {
  source?: string;
  variant?: 'card' | 'footer';
  className?: string;
}

export const NewsletterSubscriptionForm: React.FC<NewsletterSubscriptionFormProps> = ({
  source = 'WEBSITE_FOOTER',
  variant = 'card',
  className = '',
}) => {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false); // Unchecked by default
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (!consent) {
      setErrorMessage(
        'Please tick the consent box to confirm you agree to receive promotional emails.'
      );
      return;
    }

    setLoading(true);

    try {
      const res = await newsletterService.subscribe(trimmedEmail, consent, source);
      setSuccessMessage(
        res.message ||
          'Thank you! If your email is valid, a verification link has been sent to confirm your subscription.'
      );
      setEmail('');
      setConsent(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to complete subscription. Please try again.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  if (variant === 'footer') {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="flex items-center gap-2 text-xs font-bold text-[#0066CC] uppercase tracking-wider">
          <Mail className="w-3.5 h-3.5" />
          <span>Newsletter &amp; Offers</span>
        </div>
        <p className="text-xs text-[#292525]/75 leading-relaxed font-medium">
          Get exclusive stationery deals, school booklist alerts, and new brand arrivals delivered to your inbox.
        </p>

        {successMessage ? (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-800 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Subscription confirmation sent!</p>
              <p className="text-[11px] text-emerald-700 mt-0.5">{successMessage}</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-2.5">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                required
                placeholder="Enter your email address..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                aria-label="Email address for newsletter"
                className="flex-1 px-3.5 py-2 rounded-xl border border-[#C6E7FF] bg-white text-xs text-[#292525] placeholder:text-[#292525]/40 focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-xs shrink-0 flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <span>Subscribe</span>
                )}
              </button>
            </div>

            {/* Explicit affirmative consent checkbox - unchecked by default */}
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                disabled={loading}
                className="mt-0.5 w-3.5 h-3.5 rounded border-[#C6E7FF] text-[#0066CC] focus:ring-[#0066CC] cursor-pointer"
              />
              <span className="text-[10px] text-[#292525]/70 leading-normal">
                I agree to receive promotional emails, offers and updates from DSL Stationery. I understand that I can unsubscribe at any time.
              </span>
            </label>

            {errorMessage && (
              <div className="flex items-center gap-1.5 text-[11px] text-rose-600 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </form>
        )}
      </div>
    );
  }

  // Card Variant (for Homepage or standalone sections)
  return (
    <div className={`bg-white rounded-3xl border border-[#C6E7FF] p-8 sm:p-12 text-center shadow-sm space-y-4 relative overflow-hidden max-w-4xl mx-auto ${className}`}>
      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0066CC] uppercase tracking-wider">
        <Mail className="w-4 h-4" />
        <span>Join our stationery lovers club</span>
      </div>

      <h3 className="text-2xl sm:text-3xl font-black text-[#292525] tracking-tight">
        Stay in the Loop &amp; Get 10% Off
      </h3>

      <p className="text-xs sm:text-sm text-[#292525]/70 max-w-md mx-auto leading-relaxed">
        Subscribe for exclusive coupon drops, back-to-school bundle announcements, and new pastel stationery releases.
      </p>

      {successMessage ? (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl max-w-md mx-auto text-left flex items-start gap-3 text-xs text-emerald-800 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Almost there! Verification link sent.</p>
            <p className="text-emerald-700 leading-relaxed">{successMessage}</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              required
              placeholder="Enter your email address..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              aria-label="Email address for newsletter subscription"
              className="flex-1 px-4 py-2.5 rounded-full border border-[#C6E7FF] text-xs text-[#292525] focus:outline-none focus:ring-2 focus:ring-[#0066CC] bg-[#FFFDF0]"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold px-6 py-2.5 rounded-full shadow-xs transition-colors shrink-0 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Subscribing...</span>
                </>
              ) : (
                <span>Subscribe</span>
              )}
            </button>
          </div>

          {/* Explicit affirmative consent checkbox - unchecked by default */}
          <div className="text-left px-1">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                disabled={loading}
                className="mt-0.5 w-4 h-4 rounded border-[#C6E7FF] text-[#0066CC] focus:ring-[#0066CC] cursor-pointer shrink-0"
              />
              <span className="text-[11px] text-[#292525]/75 leading-relaxed">
                I agree to receive promotional emails, offers and updates from DSL Stationery. I understand that I can unsubscribe at any time.
              </span>
            </label>
          </div>

          {errorMessage && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-left flex items-center gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}
        </form>
      )}
    </div>
  );
};

