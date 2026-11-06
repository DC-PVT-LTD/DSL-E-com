'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { UserCheck, Sparkles, X, ArrowRight } from 'lucide-react';
import { useUserStore } from '@/services/userStore';

export default function GuestSignInPrompt() {
  const currentUser = useUserStore((state) => state.currentUser);
  const [dismissed, setDismissed] = useState(false);

  // If user is already signed in or user dismissed prompt, don't display
  if (currentUser || dismissed) {
    return null;
  }

  return (
    <div className="bg-[#FFFDF0] border border-[#C6E7FF] rounded-2xl p-4 shadow-xs relative flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-[#C6E7FF]/70 text-[#0066CC] flex items-center justify-center shrink-0 mt-0.5">
        <Sparkles className="w-4 h-4" />
      </div>

      <div className="flex-1 text-xs">
        <h4 className="font-bold text-[#292525]">Get updates on your order</h4>
        <p className="text-[11px] text-[#292525]/70 mt-0.5 leading-relaxed">
          Sign in to manage your orders and keep track of your purchases across all your devices. Your entered delivery details and cart items will be preserved.
        </p>

        <div className="flex items-center gap-3 mt-2.5">
          <Link
            href="/login?redirect=/checkout"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-[#0066CC] hover:bg-[#0052a3] px-3.5 py-1.5 rounded-full transition-colors shadow-2xs"
          >
            <span>Sign In or Register</span>
            <ArrowRight className="w-3 h-3" />
          </Link>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-[11px] font-semibold text-stone-500 hover:text-stone-800 transition-colors"
          >
            Continue as Guest
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-stone-400 hover:text-stone-600 p-1 rounded-lg"
        title="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

