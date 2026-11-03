import React from 'react';
import { Sparkles } from 'lucide-react';

export default function GlobalLoading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#FFFDF0] text-[#292525] select-none">
      {/* Playful Floating Badge */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full bg-white border-2 border-[#C6E7FF] shadow-md flex items-center justify-center animate-bounce">
          <img
            src="/dsl-logo-clean.png"
            alt="DSL Stationery"
            className="h-10 w-auto object-contain"
          />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#FFD84D] text-[#594300] flex items-center justify-center shadow-xs animate-spin-slow">
          <Sparkles className="w-3.5 h-3.5 fill-[#594300]" />
        </div>
      </div>

      {/* Brand Title */}
      <div className="text-center space-y-2">
        <span className="font-heylowitch text-3xl sm:text-4xl text-[#0066CC] block tracking-wide">
          DSL Stationery
        </span>
        <p className="text-xs font-bold uppercase tracking-widest text-[#292525]/60">
          Little Essentials &bull; Big Ideas
        </p>
      </div>

      {/* Pastel Progress Bar */}
      <div className="mt-8 w-48 h-2 bg-[#C6E7FF]/40 rounded-full overflow-hidden p-0.5 border border-[#C6E7FF]/60">
        <div className="h-full bg-linear-to-r from-[#0066CC] via-[#FFD84D] to-[#B9D5FF] rounded-full animate-loading-pulse" />
      </div>

      <span className="mt-3 text-[11px] font-medium text-[#292525]/50 animate-pulse">
        Opening your stationery world...
      </span>
    </div>
  );
}
