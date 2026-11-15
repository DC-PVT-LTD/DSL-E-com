'use client';

import React, { useState } from 'react';
import { Mail, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
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
  const [consent, setConsent] = useState(false);
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
        'Please tick the consent box to confirm you agree to receive communications.'
      );
      return;
    }

    setLoading(true);

    try {
      const res = await newsletterService.subscribe(trimmedEmail, consent, source);
      setSuccessMessage(
        res.message ||
          'Thank you! A verification link has been sent to confirm your subscription.'
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
        <div className="flex items-center gap-2 text-xs font-bold text-[#006DEB] uppercase tracking-wider">
          <Mail className="w-3.5 h-3.5" />
          <span>Newsletter &amp; Offers</span>
        </div>
        <p className="text-xs text-white/75 leading-relaxed font-medium">
          Receive syllabus updates, stock releases, and enterprise promotional allocations.
        </p>

        {successMessage ? (
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-300 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Verification link sent</p>
              <p className="text-[11px] text-emerald-300/80 mt-0.5">{successMessage}</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-2.5">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                required
                placeholder="Enter work or personal email..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                aria-label="Email address for newsletter"
                className="flex-1 px-4 py-2.5 rounded-full border border-white/20 bg-white/10 text-xs text-white placeholder:text-white/40 focus:outline-hidden focus:border-[#006DEB]"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-[#006DEB] hover:bg-[#005ac2] text-white text-xs font-bold px-6 py-2.5 rounded-full transition-all shadow-sm shrink-0 flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer"
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

            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                disabled={loading}
                className="mt-0.5 w-3.5 h-3.5 rounded border-white/30 text-[#006DEB] focus:ring-[#006DEB] cursor-pointer"
              />
              <span className="text-[10px] text-white/60 leading-normal">
                I agree to receive communications from DSL Distributors. I can unsubscribe at any time.
              </span>
            </label>

            {errorMessage && (
              <div className="flex items-center gap-1.5 text-[11px] text-rose-400 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </form>
        )}
      </div>
    );
  }

  // Card Variant
  return (
    <div className={`space-y-3.5 ${className}`}>
      {successMessage ? (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl max-w-lg mx-auto text-left flex items-start gap-3 text-xs text-emerald-800 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Verification link sent!</p>
            <p className="text-emerald-700 leading-relaxed">{successMessage}</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="max-w-lg mx-auto space-y-3">
          {/* Two-Tone Pill Input & Button Bar */}
          <div className="relative flex items-center bg-white rounded-full border border-slate-200/90 shadow-md p-1 pl-3 sm:pl-4 focus-within:border-[#006DEB] focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <Mail className="w-4 h-4 text-slate-400 shrink-0 mr-1.5 sm:mr-2" />
            <input
              type="email"
              required
              placeholder="Enter your email address..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              aria-label="Email address for distribution updates"
              className="flex-1 bg-transparent border-none text-[11px] sm:text-xs md:text-sm text-[#09285C] placeholder:text-slate-400 placeholder:text-[11px] sm:placeholder:text-xs md:placeholder:text-sm focus:outline-hidden py-1.5 sm:py-2 min-w-0 pr-1"
            />
            <button
              type="submit"
              disabled={loading}
              aria-label="Subscribe"
              className="inline-flex items-center rounded-full overflow-hidden shadow-xs transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 cursor-pointer p-0 shrink-0 select-none group"
            >
              <span className="bg-[#006DEB] hover:bg-[#005ac2] text-white text-[11px] sm:text-xs md:text-sm font-bold pl-3.5 sm:pl-5 pr-2 sm:pr-3 py-2 sm:py-2.5 flex items-center transition-colors">
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    <span className="hidden sm:inline">Sending...</span>
                  </>
                ) : (
                  <span>Subscribe</span>
                )}
              </span>
              <span className="bg-[#FFD84D] hover:bg-[#F2C736] text-[#594300] px-2.5 sm:px-3 py-2 sm:py-2.5 flex items-center justify-center transition-colors">
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
              </span>
            </button>
          </div>

          <div className="text-left px-3 sm:px-4">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                disabled={loading}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#006DEB] focus:ring-[#006DEB] cursor-pointer shrink-0"
              />
              <span className="text-[11px] text-[#09285C]/75 leading-relaxed font-medium">
                I agree to receive distribution updates and communications from DSL Distributors.
              </span>
            </label>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-left flex items-center gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}
        </form>
      )}
    </div>
  );
};
