'use client';

import React from 'react';
import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';

export const ScrapbookHero: React.FC = () => {
  return (
    <section className="relative w-full bg-[#A9DFFF] overflow-hidden select-none">
      {/* 
        Background Hero Composition:
        High-res 2x illustration canvas featuring:
        - Pastel-blue organic edges and flowing wavy bottom boundary
        - Upper-left: Blue stapler, paper sheets, sticky checklist, washi tape
        - Upper-right: Open sketchbook with creative doodles, loose paper, yellow pencil
        - Lower-left: Stationery checklist, pens, clips, and scrapbook card
        - Lower-right: Pencil case, cup of coloured pencils, sticky notes, eraser, clips, washi tape
      */}
      <div className="relative w-full max-w-[1920px] mx-auto">
        {/* Background Image on Desktop */}
        <div className="hidden lg:block relative w-full aspect-[1024/467]">
          <img
            src="/images/hero/hero_section_2x.png"
            alt="DSL Stationery Creative Scrapbook Desk with stationery supplies"
            className="w-full h-full object-cover object-center pointer-events-none"
            priority-attribute="true"
          />

          {/* Center Interactive Content Overlay (Aligned 1:1 with Reference) */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 px-4">
            <div className="max-w-2xl text-center flex flex-col items-center pointer-events-auto translate-y-[1cm]">
              {/* Main Heading with Yellow Accent Strokes on Left and Right */}
              <div className="relative inline-flex items-center justify-center gap-3 sm:gap-4 mb-3">
                {/* Left 3 Radiating Yellow Accent Strokes */}
                <svg
                  className="w-7 h-7 sm:w-9 sm:h-9 text-[#FFD84D] shrink-0"
                  viewBox="0 0 36 36"
                  fill="none"
                  aria-hidden="true"
                >
                  <line x1="28" y1="12" x2="6" y2="6" stroke="#FFD84D" strokeWidth="3.5" strokeLinecap="round" />
                  <line x1="30" y1="18" x2="4" y2="18" stroke="#FFD84D" strokeWidth="3.5" strokeLinecap="round" />
                  <line x1="28" y1="24" x2="6" y2="30" stroke="#FFD84D" strokeWidth="3.5" strokeLinecap="round" />
                </svg>

                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[50px] font-black text-[#10285D] tracking-tight leading-[1.12] text-center">
                  Everything You Need to <br />
                  Make Ideas Happen
                </h1>

                {/* Right 3 Radiating Yellow Accent Strokes */}
                <svg
                  className="w-7 h-7 sm:w-9 sm:h-9 text-[#FFD84D] shrink-0"
                  viewBox="0 0 36 36"
                  fill="none"
                  aria-hidden="true"
                >
                  <line x1="8" y1="12" x2="30" y2="6" stroke="#FFD84D" strokeWidth="3.5" strokeLinecap="round" />
                  <line x1="6" y1="18" x2="32" y2="18" stroke="#FFD84D" strokeWidth="3.5" strokeLinecap="round" />
                  <line x1="8" y1="24" x2="30" y2="30" stroke="#FFD84D" strokeWidth="3.5" strokeLinecap="round" />
                </svg>
              </div>

              {/* Centered Navy Subtitle (across ~2 lines) */}
              <p className="text-xs sm:text-sm lg:text-[14.5px] font-medium text-[#10285D]/85 leading-relaxed max-w-xl text-center px-4">
                Discover everyday stationery, school essentials, creative supplies, and office favourites —
                handpicked for you and delivered across Sri Lanka.
              </p>

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-3.5 mt-6">
                {/* Primary Button: Shop Now */}
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-2 bg-[#FF6B91] hover:bg-[#ff5580] text-white font-bold text-xs sm:text-sm px-7 sm:px-8 py-3 rounded-full shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 group"
                >
                  <ShoppingCart className="w-4 h-4 text-white group-hover:rotate-[-6deg] transition-transform" />
                  <span>Shop Now</span>
                </Link>

                {/* Secondary Button: Explore Collections */}
                <Link
                  href="/categories"
                  className="inline-flex items-center justify-center bg-white/40 hover:bg-white text-[#10285D] font-bold text-xs sm:text-sm px-6 sm:px-7 py-3 rounded-full border-2 border-[#10285D] shadow-xs hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  Explore Collections
                </Link>
              </div>
            </div>

            {/* Lower-Left Scrapbook Card Content Overlay */}
            <div className="absolute left-[1.5%] bottom-[4.5%] w-[24.5%] aspect-[245/180] flex flex-col justify-between p-3.5 sm:p-4 md:p-5 pointer-events-auto text-left select-none">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-sm sm:text-base">🌸</span>
                  <span className="font-extrabold text-xs sm:text-sm lg:text-[14.5px] text-[#10285D] tracking-tight">
                    Handmade with love!
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] lg:text-[11.5px] text-[#10285D]/80 leading-snug font-medium line-clamp-3">
                  Carefully packed book bundles, smooth gel pens, and joyful notebooks ready to inspire your study desk.
                </p>
              </div>

              <div className="pt-2 border-t border-[#10285D]/15 flex items-center justify-between text-[10px] sm:text-[11px]">
                <span className="font-extrabold text-[9px] sm:text-[10px] text-[#10285D] tracking-wider uppercase">
                  DSL STATIONERY
                </span>
                <Link
                  href="/shop"
                  className="font-bold text-[#10285D] hover:text-[#0066CC] flex items-center gap-1 group transition-colors"
                >
                  <span className="underline decoration-[#10285D]/40 underline-offset-2">Shop collection</span>
                  <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Responsive Mobile / Tablet Layout (screens < 1024px) */}
        <div className="lg:hidden relative bg-[#FFF8ED] px-6 pt-12 sm:pt-16 pb-12 sm:pb-16 text-center overflow-hidden">
          {/* Pastel blue organic wave accents top and bottom */}
          <div className="absolute top-0 left-0 right-0 h-4 bg-[#A9DFFF] rounded-b-3xl opacity-60" />

          {/* Heading with Yellow Accent Strokes */}
          <div className="relative inline-flex items-center justify-center gap-2 mb-3">
            <svg className="w-6 h-6 text-[#FFD84D] shrink-0" viewBox="0 0 36 36" fill="none">
              <line x1="28" y1="12" x2="6" y2="6" stroke="#FFD84D" strokeWidth="3" strokeLinecap="round" />
              <line x1="30" y1="18" x2="4" y2="18" stroke="#FFD84D" strokeWidth="3" strokeLinecap="round" />
              <line x1="28" y1="24" x2="6" y2="30" stroke="#FFD84D" strokeWidth="3" strokeLinecap="round" />
            </svg>

            <h1 className="text-2xl sm:text-4xl font-black text-[#10285D] tracking-tight leading-tight">
              Everything You Need to <br />
              Make Ideas Happen
            </h1>

            <svg className="w-6 h-6 text-[#FFD84D] shrink-0" viewBox="0 0 36 36" fill="none">
              <line x1="8" y1="12" x2="30" y2="6" stroke="#FFD84D" strokeWidth="3" strokeLinecap="round" />
              <line x1="6" y1="18" x2="32" y2="18" stroke="#FFD84D" strokeWidth="3" strokeLinecap="round" />
              <line x1="8" y1="24" x2="30" y2="30" stroke="#FFD84D" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>

          {/* Subtitle */}
          <p className="text-xs sm:text-sm font-medium text-[#10285D]/85 leading-relaxed max-w-md mx-auto mb-6">
            Discover everyday stationery, school essentials, creative supplies, and office favourites —
            handpicked for you and delivered across Sri Lanka.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 bg-[#FF6B91] hover:bg-[#ff5580] text-white font-bold text-xs sm:text-sm px-6 py-2.5 rounded-full shadow-md transition-all active:scale-95"
            >
              <ShoppingCart className="w-4 h-4 text-white" />
              <span>Shop Now</span>
            </Link>

            <Link
              href="/categories"
              className="inline-flex items-center justify-center bg-white text-[#10285D] font-bold text-xs sm:text-sm px-5 py-2.5 rounded-full border-2 border-[#10285D] shadow-xs transition-all active:scale-95"
            >
              Explore Collections
            </Link>
          </div>

          {/* Scrapbook Card for Mobile: Repositioned cleanly below buttons */}
          <div className="mt-10 max-w-sm mx-auto">
            <div className="relative bg-[#FFFDF0] p-5 rounded-2xl border border-[#FFD84D]/60 shadow-lg rotate-[-1deg] text-left">
              {/* Decorative Washi Tape on Top Left */}
              <div className="absolute -top-3 left-4 w-16 h-5 bg-[#A9DFFF] opacity-80 rotate-[-4deg] rounded-xs shadow-xs border border-white/50" />
              {/* Paper Clip on Top Right */}
              <div className="absolute -top-3 right-6 text-xl">📎</div>

              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🌸</span>
                <span className="font-extrabold text-base text-[#10285D]">Handmade with love!</span>
              </div>
              <p className="text-[11px] text-[#10285D]/80 leading-relaxed font-medium">
                Carefully packed book bundles, smooth gel pens, and joyful notebooks ready to inspire your study desk.
              </p>
              <div className="mt-3 pt-2.5 border-t border-[#10285D]/15 flex items-center justify-between text-xs">
                <span className="font-extrabold text-[10px] text-[#10285D] tracking-wider uppercase">
                  DSL STATIONERY
                </span>
                <Link
                  href="/shop"
                  className="font-bold text-[#10285D] hover:text-[#0066CC] flex items-center gap-1 group"
                >
                  <span>Shop collection</span>
                  <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Bottom pastel-blue flowing wave for mobile */}
          <div className="w-full mt-8 -mb-12 overflow-hidden leading-none">
            <svg
              className="w-full h-8 text-[#A9DFFF] fill-current block"
              viewBox="0 0 600 40"
              preserveAspectRatio="none"
            >
              <path d="M 0 20 Q 150 40 300 20 T 600 20 L 600 40 L 0 40 Z" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
};

