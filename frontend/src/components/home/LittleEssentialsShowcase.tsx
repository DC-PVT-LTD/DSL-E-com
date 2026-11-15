'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

export const LittleEssentialsShowcase: React.FC = () => {
  return (
    <section
      aria-labelledby="little-essentials-heading"
      className="w-full max-w-[1720px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16"
    >
      <div className="relative w-full rounded-3xl overflow-hidden border border-blue-100/70 bg-gradient-to-br from-[#EBF5FF]/70 via-[#FFFFFF] to-[#EFF6FF]/80 shadow-lg shadow-blue-950/5">
        {/* Soft Ambient Radial Accents */}
        <div
          className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-[#CBE6FF]/35 blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full bg-[#DCEEFF]/40 blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        {/* Compact, balanced inner grid with tight vertical padding */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center px-6 py-6 sm:px-8 sm:py-7 lg:px-10 lg:py-8 xl:px-14 xl:py-9">
          {/* ========================================================= */}
          {/* LEFT: CHARACTER & STATIONERY SCENE (Proportional & Compact) */}
          {/* ========================================================= */}
          <div className="lg:col-span-5 xl:col-span-5 flex items-center justify-center order-1">
            <div className="relative w-full max-w-[420px] sm:max-w-[460px] lg:max-w-[480px] aspect-[16/11] flex items-end justify-center select-none">
              {/* Cheerful Burst Accent 1 (Above Books / Left Hand) */}
              <svg
                className="absolute top-6 left-6 sm:left-10 w-7 h-7 sm:w-8 sm:h-8 text-[#087BFF]/80 pointer-events-none z-10"
                viewBox="0 0 36 36"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path d="M18 4V10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                <path d="M8 12L13 15" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                <path d="M28 12L23 15" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>

              {/* Cheerful Burst Accent 2 (Above Waving Hand / Right) */}
              <svg
                className="absolute top-2 right-8 sm:right-12 w-7 h-7 sm:w-8 sm:h-8 text-[#087BFF]/80 pointer-events-none z-10"
                viewBox="0 0 36 36"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path d="M26 6L22 11" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                <path d="M32 16L26 17" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                <path d="M18 4L18 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>

              {/* Girl Character */}
              <div className="absolute inset-0 z-10 flex items-end justify-center">
                <div className="relative w-[58%] sm:w-[56%] lg:w-[60%] h-[92%] sm:h-[94%] transition-transform duration-300 ease-out hover:scale-[1.02]">
                  <Image
                    src="/images/little-essentials/girl.png"
                    alt="DSL Little Essentials Girl Mascot"
                    fill
                    priority
                    sizes="(max-width: 640px) 240px, (max-width: 1024px) 300px, 360px"
                    className="object-contain object-bottom drop-shadow-[0_6px_14px_rgba(16,42,94,0.12)]"
                  />
                </div>
              </div>

              {/* Stationery Items (Books, Pencil Pot, Washi Tapes, Pencil Case) */}
              <div className="absolute inset-x-0 bottom-0 z-20 h-[46%] sm:h-[48%] pointer-events-none flex items-end justify-center">
                <div className="relative w-full h-full">
                  <Image
                    src="/images/little-essentials/stationery.png"
                    alt="Stationery essentials including notebooks, colored pencils, washi tapes, and pencil pouch"
                    fill
                    priority
                    sizes="(max-width: 640px) 420px, (max-width: 1024px) 460px, 480px"
                    className="object-contain object-bottom drop-shadow-[0_8px_16px_rgba(16,42,94,0.14)]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* RIGHT: TEXT CONTENT & ACTION BUTTON                       */}
          {/* ========================================================= */}
          <div className="lg:col-span-7 xl:col-span-7 flex flex-col items-start justify-center space-y-3 sm:space-y-4 lg:space-y-5 order-2 lg:pl-2 xl:pl-6">
            {/* Small Label with Decorative Line & Diamonds */}
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-block w-8 sm:w-10 h-[2px] bg-[#087BFF]" />
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#087BFF]/40 bg-white/80 backdrop-blur-sm text-[11px] sm:text-xs font-bold tracking-widest text-[#102A5E] uppercase shadow-xs">
                <span className="text-[#087BFF] text-[8px]" aria-hidden="true">&#9670;</span>
                <span>CURATED ESSENTIALS FOR REFINED LIVING</span>
                <span className="text-[#087BFF] text-[8px]" aria-hidden="true">&#9670;</span>
              </div>
            </div>

            {/* Main Heading: Little Essentials. Big Ideas. */}
            <h2
              id="little-essentials-heading"
              className="font-['Times_New_Roman',_Times,_serif] text-3xl sm:text-4xl md:text-5xl lg:text-[46px] xl:text-[50px] font-extrabold tracking-tight text-[#102A5E] leading-[1.12]"
            >
              Little Essentials.{' '}
              <span className="relative inline-block text-[#087BFF] whitespace-nowrap">
                Big Ideas.
                {/* Curved Royal Blue Underline Swoosh */}
                <svg
                  className="absolute -bottom-2 sm:-bottom-2.5 left-0 w-full h-3 sm:h-3.5 text-[#087BFF]"
                  viewBox="0 0 240 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M3 11C45 4 140 3 237 13"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h2>

            {/* Description */}
            <p className="text-slate-600 text-sm sm:text-base lg:text-[15px] xl:text-[16px] leading-relaxed max-w-xl font-normal">
              We&apos;re a modern stationery store offering everyday essentials, simple finds, and quality products designed to make studying, working, planning, and creating effortless and joyful. We handpick items you truly love — practical, affordable, and stylish.
            </p>

            {/* CTA Button: Know More -> */}
            <div className="pt-1">
              <Link
                href="/about"
                className="group inline-flex items-center gap-3 px-7 py-3 sm:px-8 sm:py-3.5 rounded-full bg-[#102A5E] hover:bg-[#087BFF] text-white text-sm sm:text-base font-bold shadow-md shadow-[#102A5E]/20 hover:shadow-lg hover:shadow-[#087BFF]/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Know More</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
