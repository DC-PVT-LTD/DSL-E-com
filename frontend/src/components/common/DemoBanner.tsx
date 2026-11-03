'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ShieldCheck, RotateCcw, Check } from 'lucide-react';
import { resetAllDemoData } from '@/services/resetDemoService';

const ANNOUNCEMENT_MESSAGES = [
  'Free Islandwide Delivery On Orders Over Rs. 5,000! 🚚',
  '🌸 New Term & School Essentials Collection Now Live!',
  'Save up to 15% on All Grade-Specific School Stationery Packs ✏️',
  '100% Genuine Brands • Atlas, Faber-Castell, Promate, Nataraj ✨',
];

export const DemoBanner: React.FC = () => {
  const [resetSuccess, setResetSuccess] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);

  const handleReset = () => {
    resetAllDemoData();
    setResetSuccess(true);
    setTimeout(() => {
      setResetSuccess(false);
      window.location.reload();
    }, 800);
  };

  const handlePrev = () => {
    setCurrentIdx((prev) => (prev === 0 ? ANNOUNCEMENT_MESSAGES.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIdx((prev) => (prev === ANNOUNCEMENT_MESSAGES.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="bg-[#0066CC] text-white text-[11px] sm:text-xs font-semibold py-1.5 px-4 sm:px-8 lg:px-12 xl:px-16 select-none transition-colors">
      <div className="w-full flex items-center justify-between gap-2">
        {/* Left spacer / admin badge */}
        <div className="hidden lg:flex items-center gap-2">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide transition-colors"
            title="Switch to Store Admin Backoffice"
          >
            <ShieldCheck className="w-3 h-3" />
            <span>Admin Portal</span>
          </Link>
        </div>

        {/* Center: Slim coral announcement with controls matching screenshot */}
        <div className="flex-1 flex items-center justify-center gap-2 text-center text-white">
          <button
            onClick={handlePrev}
            className="p-0.5 hover:bg-white/20 rounded-full transition-colors text-white/90 hover:text-white"
            aria-label="Previous announcement"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <span className="tracking-wide font-medium">
            {ANNOUNCEMENT_MESSAGES[currentIdx]}
          </span>

          <button
            onClick={handleNext}
            className="p-0.5 hover:bg-white/20 rounded-full transition-colors text-white/90 hover:text-white"
            aria-label="Next announcement"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Quick Demo Reset & Currency notice */}
        <div className="hidden sm:flex items-center gap-2.5">
          <button
            onClick={handleReset}
            disabled={resetSuccess}
            className="text-white/90 hover:text-white flex items-center gap-1 text-[10px] font-medium bg-black/10 hover:bg-black/20 px-2 py-0.5 rounded-full transition-colors"
            title="Reset mock products and cart state"
          >
            {resetSuccess ? (
              <>
                <Check className="w-3 h-3 text-emerald-200" />
                <span className="text-emerald-100">Reset!</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-3 h-3" />
                <span>Reset Demo</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

