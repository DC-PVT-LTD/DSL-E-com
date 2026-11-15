'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { HeroTrustRibbon } from './HeroTrustRibbon';

export const FirstHeroSlide: React.FC = () => {
  return (
    <div className="relative w-full h-full lg:h-[calc(100vh-102px)] lg:max-h-[640px] xl:max-h-[680px] flex flex-col justify-start lg:flex-row lg:items-center bg-white overflow-hidden select-none">
      {/* 
        AUTHENTIC HERO ATMOSPHERIC BACKGROUND:
        Flowing light-blue wave background artwork matching brand visual identity.
      */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none">
        <img
          src="/images/hero-bg-waves.jpg"
          alt=""
          className="w-full h-full object-cover object-center"
        />
      </div>

      {/* ========================================================= */}
      {/* DESKTOP VIEW (lg and up) - Preserved Unchanged            */}
      {/* ========================================================= */}
      <div className="hidden lg:flex relative w-full h-full max-w-[1720px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16 items-center justify-between">

        {/* LEFT COLUMN: Positioned with bold typography */}
        <div className="relative z-20 w-full max-w-2xl lg:max-w-3xl xl:max-w-4xl 2xl:max-w-[850px] flex flex-col items-start pl-6 sm:pl-10 lg:pl-14 xl:pl-20 -translate-y-3 lg:-translate-y-5 xl:-translate-y-7 pt-3 lg:pt-5 lg:translate-x-[1cm] lg:-translate-y-[calc(1.75rem+2cm)]">

          {/* Eyebrow Label with Electric Blue Bar */}
          <div className="inline-flex items-center gap-3.5 mb-4 lg:mb-5 font-fira">
            <span className="w-12 lg:w-16 h-1.5 bg-[#087BFF] rounded-full inline-block shadow-xs" />
            <span className="text-xs sm:text-sm lg:text-base font-extrabold text-[#102A5E] uppercase tracking-[0.24em]">
              Stationery Distribution
            </span>
          </div>

          {/* Main Headline - Rendered with uploaded Redaction 10 font, bold styling */}
          <h1 className="font-redaction text-5xl sm:text-6xl lg:text-[78px] xl:text-[92px] 2xl:text-[104px] tracking-tight leading-[0.92] text-[#102A5E]">
            <span className="block font-black">Supplies</span>
            <span className="block font-bold text-[#102A5E] tracking-normal my-0.5 lg:my-1">
              Without
            </span>
            <span className="relative inline-block font-black text-[#087BFF] mt-0.5 lg:mt-1">
              Limits.
              {/* Curved Electric Blue Swoosh matching Image 1 */}
              <svg
                className="absolute -bottom-3 sm:-bottom-3.5 lg:-bottom-4 left-0 w-full h-4 sm:h-5 lg:h-5.5 overflow-visible pointer-events-none"
                viewBox="0 0 160 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M 4 8 Q 80 22 156 4"
                  stroke="#087BFF"
                  strokeWidth="6.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>

          {/* Paragraph description */}
          <p className="font-fira text-[#102A5E]/85 text-sm sm:text-base lg:text-[17px] xl:text-lg font-normal leading-relaxed max-w-[500px] xl:max-w-[540px] mb-5 sm:mb-7 lg:mb-8 mt-4 sm:mt-5 lg:mt-6">
            School day favourites, creative essentials and office supplies,
            thoughtfully brought together for every big idea.
          </p>

          {/* Call-to-Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 lg:gap-5 w-full sm:w-auto font-fira">
            <Link
              href="/shop"
              className="inline-flex items-center justify-center gap-3 px-7 sm:px-9 lg:px-10 py-3.5 sm:py-4 lg:py-4.5 rounded-full bg-[#087BFF] hover:bg-[#005cd9] text-white font-bold text-sm sm:text-base lg:text-lg shadow-lg shadow-[#087BFF]/30 hover:shadow-xl hover:shadow-[#087BFF]/45 transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] cursor-pointer"
            >
              <span>Shop Catalogue</span>
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>

            <Link
              href="/brands"
              className="inline-flex items-center justify-center px-6 sm:px-8 lg:px-9 py-3.5 sm:py-4 lg:py-4.5 rounded-full bg-white hover:bg-slate-50 text-[#102A5E] font-bold text-sm sm:text-base lg:text-lg border-2 border-[#102A5E]/20 hover:border-[#102A5E]/40 shadow-xs hover:shadow-md transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              Our Brands
            </Link>
          </div>
        </div>

        {/* RIGHT LAYER: Immersive 16:9 Stage with HeroTrustRibbon */}
        <div className="absolute inset-0 w-full h-full pointer-events-none select-none z-10 flex items-center justify-end">
          <HeroTrustRibbon variant="desktop" />
        </div>

      </div>

      {/* ========================================================= */}
      {/* MOBILE & TABLET PORTRAIT VIEW (under lg)                  */}
      {/* Dedicated portrait composition matching DSL Reference    */}
      {/* ========================================================= */}
      <div className="lg:hidden relative z-10 w-full pt-3 sm:pt-5 pb-0 flex flex-col justify-between select-none">
        {/* Top & Middle Section: Left-aligned Headline + Right-anchored Boy & Ribbon */}
        <div className="relative w-full px-4 min-[375px]:px-5 sm:px-8 mb-2 sm:mb-4">
          {/* 1. Eyebrow: Left-aligned with blue bar */}
          <div className="inline-flex items-center gap-2 mb-2 sm:mb-3 font-fira">
            <span className="w-8 sm:w-10 h-1 bg-[#0866F5] rounded-full inline-block shadow-2xs" />
            <span className="text-[11px] min-[375px]:text-xs sm:text-sm font-extrabold text-[#092C68] uppercase tracking-[0.2em]">
              Stationery Distribution
            </span>
          </div>

          <div className="relative w-full flex items-start justify-between min-h-[175px] min-[375px]:min-h-[195px] sm:min-h-[220px]">
            {/* 2. Left Side: Headline & Short Subhead */}
            <div className="relative z-10 flex flex-col items-start max-w-[62%] min-[414px]:max-w-[64%]">
              <h1 className="font-redaction text-3xl min-[375px]:text-4xl sm:text-5xl font-black tracking-tight leading-[0.96] text-[#092C68]">
                <span className="block">Supplies</span>
                <span className="block text-[#092C68] font-bold my-0.5">Without</span>
                <span className="relative inline-block font-black text-[#0866F5] mt-0.5">
                  Limits.
                  {/* Matching curved electric swoosh */}
                  <svg
                    className="absolute -bottom-1.5 left-0 w-full h-3 overflow-visible pointer-events-none"
                    viewBox="0 0 120 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M 2 6 Q 60 16 118 2"
                      stroke="#0866F5"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </h1>

              <p className="font-fira text-[#092C68]/80 text-[11px] min-[375px]:text-xs sm:text-sm font-medium leading-relaxed mt-2.5 sm:mt-3 max-w-[210px] min-[375px]:max-w-[240px]">
                School essentials &amp; office supplies, thoughtfully brought together.
              </p>
            </div>

            {/* 3. Right Side: Smiling Boy with Blue Silk Ribbon */}
            <div className="relative w-[38%] min-[414px]:w-[36%] h-full flex items-end justify-end pointer-events-none -mt-4 min-[375px]:-mt-5 select-none">
              <div className="relative w-[130px] min-[375px]:w-[150px] sm:w-[190px] h-[180px] min-[375px]:h-[205px] sm:h-[250px] -mr-2 min-[375px]:-mr-3">
                <img
                  src="/images/hero-child-ribbon.png"
                  alt="Happy school student with blue ribbon"
                  className="w-full h-full object-contain object-bottom-right drop-shadow-md"
                  loading="eager"
                />
              </div>
            </div>
          </div>

          {/* 4. Action Buttons (Full width on mobile) */}
          <div className="mt-3.5 sm:mt-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full font-fira">
            <Link
              href="/shop"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[#0866F5] hover:bg-[#005cd9] text-white font-bold text-xs min-[375px]:text-sm shadow-md shadow-[#0866F5]/25 active:scale-[0.98] transition-all duration-200 cursor-pointer touch-target"
            >
              <span>Shop Catalogue</span>
              <ArrowRight className="w-3.5 h-3.5 min-[375px]:w-4 min-[375px]:h-4" />
            </Link>

            <Link
              href="/brands"
              className="inline-flex items-center justify-center px-5 py-2.5 sm:py-3 rounded-full bg-white/90 hover:bg-white text-[#092C68] font-bold text-xs min-[375px]:text-sm border border-[#092C68]/20 shadow-2xs active:scale-[0.98] transition-all duration-200 cursor-pointer touch-target"
            >
              Our Brands
            </Link>
          </div>
        </div>

        {/* 5. Mobile Trust Ribbon: Vibrant Royal Blue Banner Docked at Bottom */}
        <div className="w-full mt-2 font-fira">
          <div className="relative w-full bg-[#092C68] px-3 sm:px-6 py-3 sm:py-3.5 overflow-hidden shadow-inner">
            {/* Subtle glow / light wave accent behind badges */}
            <div className="absolute inset-0 bg-radial from-[#168BFF]/20 to-transparent pointer-events-none" />

            <div className="relative z-10 w-full max-w-lg mx-auto flex items-center justify-between gap-1 sm:gap-3">
              {/* Feature 1: 20,000+ Products */}
              <div className="flex flex-col items-center text-center px-1">
                <div className="w-7 h-7 sm:w-8 sm:h-8 mb-1.5 flex items-center justify-center text-white">
                  <svg
                    className="w-6 h-6 sm:w-7 sm:h-7"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path
                      d="m12.83 2.44 9.17 4.79v10.54L12 22 2 17.77V7.23z"
                      fill="rgba(8,102,245,0.4)"
                      stroke="#168BFF"
                      strokeWidth="2"
                    />
                    <path d="m22 7.23-10 5.27L2 7.23" stroke="white" strokeWidth="2.2" />
                    <path d="M12 12.5v9.5" stroke="white" strokeWidth="2.2" />
                  </svg>
                </div>
                <span className="text-xs sm:text-sm font-black text-white block leading-tight">
                  20,000+
                </span>
                <span className="text-[9px] sm:text-[11px] font-medium text-white/90 block leading-tight mt-0.5">
                  Products
                </span>
              </div>

              {/* Thin Divider */}
              <div className="h-8 w-[1px] bg-white/20 shrink-0" aria-hidden="true" />

              {/* Feature 2: Islandwide Delivery */}
              <div className="flex flex-col items-center text-center px-1">
                <div className="w-7 h-7 sm:w-8 sm:h-8 mb-1.5 flex items-center justify-center text-white">
                  <svg
                    className="w-6 h-6 sm:w-7 sm:h-7"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect
                      x="1"
                      y="3"
                      width="15"
                      height="13"
                      rx="2"
                      fill="rgba(8,102,245,0.4)"
                      stroke="#168BFF"
                      strokeWidth="2"
                    />
                    <polygon
                      points="16 8 20 8 23 11 23 16 16 16 16 8"
                      fill="rgba(8,102,245,0.4)"
                      stroke="#168BFF"
                      strokeWidth="2"
                    />
                    <circle cx="5.5" cy="18.5" r="2.5" fill="white" stroke="#092C68" strokeWidth="2" />
                    <circle cx="18.5" cy="18.5" r="2.5" fill="white" stroke="#092C68" strokeWidth="2" />
                  </svg>
                </div>
                <span className="text-xs sm:text-sm font-black text-white block leading-tight">
                  Islandwide
                </span>
                <span className="text-[9px] sm:text-[11px] font-medium text-white/90 block leading-tight mt-0.5">
                  Delivery
                </span>
              </div>

              {/* Thin Divider */}
              <div className="h-8 w-[1px] bg-white/20 shrink-0" aria-hidden="true" />

              {/* Feature 3: Trusted Partner */}
              <div className="flex flex-col items-center text-center px-1">
                <div className="w-7 h-7 sm:w-8 sm:h-8 mb-1.5 flex items-center justify-center text-white">
                  <svg
                    className="w-6 h-6 sm:w-7 sm:h-7"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                      fill="rgba(8,102,245,0.4)"
                      stroke="#168BFF"
                      strokeWidth="2.2"
                    />
                    <path d="m9 12 2 2 4-4" stroke="white" strokeWidth="2.4" />
                  </svg>
                </div>
                <span className="text-xs sm:text-sm font-black text-white block leading-tight">
                  Trusted
                </span>
                <span className="text-[9px] sm:text-[11px] font-medium text-white/90 block leading-tight mt-0.5">
                  Partner
                </span>
              </div>
            </div>

            {/* Bottom Royal Blue Flowing Wave Contour */}
            <div className="absolute bottom-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#0866F5] via-[#168BFF] to-[#0866F5]" />
          </div>
        </div>
      </div>
    </div>
  );
};
