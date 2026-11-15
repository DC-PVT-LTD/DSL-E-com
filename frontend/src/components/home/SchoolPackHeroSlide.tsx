'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export const SchoolPackHeroSlide: React.FC = () => {
  return (
    <div className="relative w-full h-full lg:h-[calc(100vh-102px)] lg:max-h-[640px] xl:max-h-[680px] flex flex-col justify-start lg:flex-row lg:items-center bg-gradient-to-r from-[#F6FAFF] via-[#FFFFFF] to-[#F4F8FE] overflow-hidden select-none">
      {/* ========================================================= */}
      {/* DESKTOP FULL-BLEED BACKGROUND GRAPHIC ASSET (lg and up)   */}
      {/* Covers edge-to-edge: Girl on left, Arc/Dots/Waves framing */}
      {/* Hidden on mobile to prevent double-rendering schoolgirl!   */}
      {/* ========================================================= */}
      <div className="hidden lg:block absolute inset-0 w-full h-full pointer-events-none select-none z-0">
        <picture className="w-full h-full block">
          <source
            media="(min-width: 1920px) or (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi)"
            srcSet="/images/DSL_School_Pack_Graphic_UltraHD_4x.png"
          />
          <img
            src="/images/DSL_School_Pack_Graphic_HD_2x.png"
            alt="DSL School Pack - Sri Lankan Schoolgirl with notebooks"
            className="w-full h-full object-cover object-center"
            loading="eager"
          />
        </picture>
      </div>

      {/* ========================================================= */}
      {/* DESKTOP & LAPTOP PROMOTIONAL CONTENT LAYER (lg and up)     */}
      {/* ========================================================= */}
      <div className="hidden lg:flex relative z-10 w-full h-full max-w-[1780px] mx-auto px-6 sm:px-10 lg:px-12 xl:px-16 2xl:px-20 items-center justify-end pointer-events-none">

        {/* Right Content Column: Naturally positioned in the open right half, shifted down comfortably */}
        <div className="w-full lg:w-[55%] xl:w-[52%] 2xl:w-[48%] flex flex-col items-start justify-center pl-4 lg:pl-8 xl:pl-12 pointer-events-auto translate-y-6 lg:translate-y-9 xl:translate-y-12 pt-2 lg:pt-4">

          {/* Small Heading: FIND YOUR + Radiating Accent Lines */}
          <div className="inline-flex items-center gap-3 mb-2 sm:mb-3">
            <span className="text-xs sm:text-sm lg:text-base xl:text-lg font-black text-[#102A5E] tracking-[0.16em] uppercase">
              FIND YOUR
            </span>
            {/* 3 Blue Burst Lines: \ | / */}
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5 text-[#087BFF]"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M10 3V8" />
              <path d="M4 6L8 9" />
              <path d="M16 6L12 9" />
            </svg>
          </div>

          {/* Main Heading: School Pack */}
          <h1 className="text-4xl sm:text-5xl lg:text-[64px] xl:text-[80px] 2xl:text-[92px] tracking-tight leading-[0.95] mb-3 sm:mb-4 lg:mb-5">
            <span className="font-black text-[#102A5E]">School </span>
            <span
              className="inline-block font-black text-white"
              style={{
                WebkitTextStroke: '2.5px #102A5E',
                paintOrder: 'stroke fill',
                textShadow: '0 0 1px #102A5E',
              }}
            >
              Pack
            </span>
          </h1>

          {/* Description */}
          <p className="text-[#102A5E]/85 text-sm sm:text-base lg:text-[17px] xl:text-lg font-normal leading-relaxed max-w-[500px] xl:max-w-[540px] mb-5 sm:mb-7 lg:mb-8">
            Get a ready-made stationery pack for your grade with all the essentials you need for a successful school year.
          </p>

          {/* Primary CTA Button: Explore School Packs -> */}
          <div className="mb-6 sm:mb-8 lg:mb-10">
            <Link
              href="/school-packs"
              className="inline-flex items-center gap-3 px-7 sm:px-9 lg:px-10 py-3.5 sm:py-4 lg:py-4.5 rounded-full bg-[#087BFF] hover:bg-[#005cd9] text-white font-bold text-sm sm:text-base lg:text-lg shadow-lg shadow-[#087BFF]/30 hover:shadow-xl hover:shadow-[#087BFF]/45 transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] cursor-pointer"
            >
              <span>Explore School Packs</span>
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>

          {/* Benefits Row: 3 Items with Thin Blue Dividers - Shifted left to clear background graphic dots */}
          <div className="flex items-center gap-2.5 sm:gap-4 lg:gap-4 xl:gap-5 pt-1 -translate-x-[2.2cm]">
            {/* Benefit 1: Grade Based Packs */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50/80 border border-blue-100/90 flex items-center justify-center shrink-0 text-[#102A5E]">
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6"
                  viewBox="0 0 32 32"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M16 4L4 10L16 16L28 10L16 4Z" />
                  <path d="M4 16L16 22L28 16" />
                  <path d="M4 22L16 28L28 22" />
                </svg>
              </div>
              <div className="leading-tight">
                <span className="text-xs sm:text-sm font-bold text-[#102A5E] block">
                  Grade
                </span>
                <span className="text-xs sm:text-sm font-bold text-[#102A5E] block">
                  Based Packs
                </span>
              </div>
            </div>

            {/* Vertical Thin Divider */}
            <div className="h-7 sm:h-8 w-[1.5px] bg-[#087BFF]/30 shrink-0" aria-hidden="true" />

            {/* Benefit 2: Essential Items Included */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50/80 border border-blue-100/90 flex items-center justify-center shrink-0 text-[#102A5E]">
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6"
                  viewBox="0 0 32 32"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 14L16 19L26 14M6 14L16 9L26 14M6 14V24L16 29L26 24V14" />
                  <path d="M6 14L2 10" />
                  <path d="M26 14L30 10" />
                  <path d="M16 4V7" />
                  <path d="M12 5L13.5 7.5" />
                  <path d="M20 5L18.5 7.5" />
                </svg>
              </div>
              <div className="leading-tight">
                <span className="text-xs sm:text-sm font-bold text-[#102A5E] block">
                  Essential
                </span>
                <span className="text-xs sm:text-sm font-bold text-[#102A5E] block">
                  Items Included
                </span>
              </div>
            </div>

            {/* Vertical Thin Divider */}
            <div className="h-7 sm:h-8 w-[1.5px] bg-[#087BFF]/30 shrink-0" aria-hidden="true" />

            {/* Benefit 3: Great Value */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50/80 border border-blue-100/90 flex items-center justify-center shrink-0 text-[#102A5E]">
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6"
                  viewBox="0 0 32 32"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M19 4L28 13L15 26C14.2 26.8 13.1 27.2 12 27.2C10.9 27.2 9.8 26.8 9 26L4 21C3.2 20.2 2.8 19.1 2.8 18C2.8 16.9 3.2 15.8 4 15L17 2L19 4Z" />
                  <circle cx="21" cy="9" r="1.5" fill="currentColor" />
                  <circle cx="10" cy="15" r="1" fill="currentColor" />
                  <circle cx="16" cy="21" r="1" fill="currentColor" />
                  <line x1="16" y1="15" x2="10" y2="21" strokeWidth="1.8" />
                </svg>
              </div>
              <div className="leading-tight">
                <span className="text-xs sm:text-sm font-bold text-[#102A5E] block">
                  Great
                </span>
                <span className="text-xs sm:text-sm font-bold text-[#102A5E] block">
                  Value
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================= */}
      {/* MOBILE & TABLET PORTRAIT VIEW (under lg)                  */}
      {/* Dedicated portrait composition matching Mobile Mockup     */}
      {/* ========================================================= */}
      <div className="lg:hidden relative z-10 w-full bg-gradient-to-b from-[#FFFFFF] via-[#F8FAFF] to-[#EFF6FF] px-4 min-[375px]:px-5 sm:px-8 pt-4 sm:pt-6 pb-2 flex flex-col items-center justify-between text-center overflow-hidden select-none">
        
        {/* Background Decorative Element: Top-Left Contour Lines */}
        <svg
          className="absolute -top-4 -left-4 w-32 h-32 min-[375px]:w-40 min-[375px]:h-40 text-[#168BFF]/20 pointer-events-none"
          viewBox="0 0 160 160"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M-10 30 C30 20, 60 40, 80 80 C95 110, 120 120, 160 120" />
          <path d="M-10 60 C40 50, 70 70, 90 110 C105 135, 130 145, 170 145" />
          <path d="M-10 90 C50 80, 80 100, 100 135 C115 155, 140 165, 180 165" />
        </svg>

        {/* Background Decorative Element: Top-Right Royal Blue Corner Arc */}
        <div className="absolute top-0 right-0 w-20 h-20 min-[375px]:w-24 min-[375px]:h-24 overflow-hidden pointer-events-none">
          <svg className="w-full h-full text-[#0866F5]" viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">
            <path d="M100 0 L40 0 C55 30, 80 55, 100 65 Z" />
          </svg>
        </div>

        {/* 1. Header Typography Area: Centered, Above Character */}
        <div className="w-full max-w-[340px] min-[375px]:max-w-[360px] sm:max-w-md flex flex-col items-center z-10">
          
          {/* Eyebrow: FIND YOUR with 3 Accent Burst Lines (Sunbeams) */}
          <div className="inline-flex items-center gap-2 mb-1.5">
            <span className="text-[11px] min-[375px]:text-xs font-black text-[#092C68] tracking-[0.2em] uppercase">
              FIND YOUR
            </span>
            <svg
              className="w-4 h-4 text-[#0866F5]"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M10 13V3" />
              <path d="M5 14L2 8" />
              <path d="M15 14L18 8" />
            </svg>
          </div>

          {/* Main Heading: School (Solid Navy) + Pack (Navy Outlined Typography) */}
          <h1 className="text-3xl min-[375px]:text-4xl sm:text-5xl font-black tracking-tight leading-[0.96] mb-2">
            <span className="text-[#092C68]">School </span>
            <span
              className="inline-block font-black text-transparent select-none"
              style={{
                WebkitTextStroke: '2.2px #092C68',
                paintOrder: 'stroke fill',
              }}
            >
              Pack
            </span>
          </h1>

          {/* Short Description */}
          <p className="text-[#092C68]/80 text-[11px] min-[375px]:text-xs sm:text-[13px] font-medium leading-relaxed max-w-[310px] min-[375px]:max-w-[330px] sm:max-w-sm mb-1 sm:mb-2">
            Get a ready-made stationery pack for your grade with all the essentials you need for a successful school year.
          </p>
        </div>

        {/* 2. Character Visual Stage: Smiling Schoolgirl in Royal-Blue Circle */}
        <div className="relative w-full max-w-[300px] min-[375px]:max-w-[330px] sm:max-w-[380px] flex items-center justify-center my-1">
          
          {/* Decorative Dot Grid (6 cols x 3 rows) on Upper-Right of Circle */}
          <div className="absolute top-2 right-2 min-[375px]:right-4 z-10 grid grid-cols-6 gap-1 sm:gap-1.5 pointer-events-none">
            {Array.from({ length: 18 }).map((_, i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-[#0866F5]"
              />
            ))}
          </div>

          {/* Schoolgirl in Royal Blue Circular Frame */}
          <div className="relative z-10 w-52 h-52 min-[375px]:w-60 min-[375px]:h-60 sm:w-72 sm:h-72">
            <img
              src="/images/hero-schoolgirl-perfect.png"
              alt="DSL School Pack - Smiling student with grade pack"
              className="w-full h-full object-contain pointer-events-none drop-shadow-md"
              loading="eager"
            />
          </div>

          {/* Flowing Organic Blue Waves Underneath Character */}
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-[115%] pointer-events-none z-20 overflow-visible">
            <svg
              viewBox="0 0 400 55"
              fill="none"
              className="w-full h-auto"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {/* Cyan / Light blue base wave */}
              <path
                d="M0 25 C80 45, 160 10, 240 32 C320 52, 360 20, 400 32 L400 55 L0 55 Z"
                fill="#93C5FD"
                opacity="0.65"
              />
              {/* Royal blue accent wave */}
              <path
                d="M0 32 C90 15, 170 48, 250 25 C320 10, 360 38, 400 28 L400 55 L0 55 Z"
                fill="#0866F5"
              />
              {/* Deep navy foreground wave */}
              <path
                d="M0 40 C100 26, 180 50, 260 35 C320 25, 360 45, 400 38 L400 55 L0 55 Z"
                fill="#092C68"
              />
            </svg>
          </div>
        </div>

        {/* 3. Primary CTA: Prominent Full-Width Blue Button */}
        <div className="w-full max-w-[320px] min-[375px]:max-w-[340px] sm:max-w-sm my-2 z-20">
          <Link
            href="/school-packs"
            className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 sm:py-4 rounded-full bg-[#0866F5] hover:bg-[#005cd9] text-white font-bold text-xs min-[375px]:text-sm sm:text-base shadow-lg shadow-[#0866F5]/25 active:scale-[0.98] transition-all duration-200 cursor-pointer touch-target"
          >
            <span>Explore School Packs</span>
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </Link>
        </div>

        {/* 4. Benefits Row: 3 Equally Spaced Benefits with Vertical Dividers */}
        <div className="w-full max-w-[340px] min-[375px]:max-w-[360px] sm:max-w-md pt-2 pb-1 flex items-center justify-between z-10">
          
          {/* Benefit 1: Grade Based Packs */}
          <div className="flex-1 flex flex-col items-center text-center px-1">
            <div className="w-7 h-7 sm:w-8 sm:h-8 mb-1 flex items-center justify-center text-[#092C68]">
              <svg
                className="w-6 h-6 sm:w-7 sm:h-7"
                viewBox="0 0 32 32"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M16 4L4 10L16 16L28 10L16 4Z" />
                <path d="M4 16L16 22L28 16" />
                <path d="M4 22L16 28L28 22" />
              </svg>
            </div>
            <span className="text-[10px] min-[375px]:text-[11px] sm:text-xs font-bold text-[#092C68] leading-tight block">
              Grade<br />Based Packs
            </span>
          </div>

          {/* Vertical Divider */}
          <div className="h-8 w-[1px] bg-slate-200 shrink-0" aria-hidden="true" />

          {/* Benefit 2: Essential Items Included */}
          <div className="flex-1 flex flex-col items-center text-center px-1">
            <div className="w-7 h-7 sm:w-8 sm:h-8 mb-1 flex items-center justify-center text-[#092C68]">
              <svg
                className="w-6 h-6 sm:w-7 sm:h-7"
                viewBox="0 0 32 32"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 14L16 19L26 14M6 14L16 9L26 14M6 14V24L16 29L26 24V14" />
                <path d="M6 14L2 10" />
                <path d="M26 14L30 10" />
                <path d="M16 4V7" />
                <path d="M12 5L13.5 7.5" />
                <path d="M20 5L18.5 7.5" />
              </svg>
            </div>
            <span className="text-[10px] min-[375px]:text-[11px] sm:text-xs font-bold text-[#092C68] leading-tight block">
              Essential<br />Items Included
            </span>
          </div>

          {/* Vertical Divider */}
          <div className="h-8 w-[1px] bg-slate-200 shrink-0" aria-hidden="true" />

          {/* Benefit 3: Great Value */}
          <div className="flex-1 flex flex-col items-center text-center px-1">
            <div className="w-7 h-7 sm:w-8 sm:h-8 mb-1 flex items-center justify-center text-[#092C68]">
              <svg
                className="w-6 h-6 sm:w-7 sm:h-7"
                viewBox="0 0 32 32"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M19 4L28 13L15 26C14.2 26.8 13.1 27.2 12 27.2C10.9 27.2 9.8 26.8 9 26L4 21C3.2 20.2 2.8 19.1 2.8 18C2.8 16.9 3.2 15.8 4 15L17 2L19 4Z" />
                <circle cx="21" cy="9" r="1.5" fill="currentColor" />
                <circle cx="10" cy="15" r="1" fill="currentColor" />
                <circle cx="16" cy="21" r="1" fill="currentColor" />
                <line x1="16" y1="15" x2="10" y2="21" strokeWidth="1.8" />
              </svg>
            </div>
            <span className="text-[10px] min-[375px]:text-[11px] sm:text-xs font-bold text-[#092C68] leading-tight block">
              Great<br />Value
            </span>
          </div>
        </div>

        {/* 5. Bottom Decorative Wave Ribbon (matching reference aesthetic) */}
        <div className="w-full h-5 sm:h-7 relative overflow-hidden pointer-events-none mt-2 -mb-2">
          <svg viewBox="0 0 400 28" fill="none" className="w-full h-full" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 14 C120 28, 260 2, 400 18 L400 28 L0 28 Z" fill="#0866F5" opacity="0.35" />
            <path d="M0 20 C140 8, 270 26, 400 14 L400 28 L0 28 Z" fill="#092C68" />
          </svg>
        </div>
      </div>
    </div>
  );
};
