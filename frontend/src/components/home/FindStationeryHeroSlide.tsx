'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles, CheckCircle2, Sliders, ShoppingBag, ShieldCheck } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

export const FindStationeryHeroSlide: React.FC = () => {
  const prefersReducedMotion = useReducedMotion();

  const purposes = [
    { label: 'School (Grades 1-13)', icon: '/images/find-my-stationery/school_student.png', bg: 'from-amber-400/20 to-orange-500/20' },
    { label: 'University & College', icon: '/images/find-my-stationery/university.png', bg: 'from-sky-400/20 to-blue-600/20' },
    { label: 'Art & Design Craft', icon: '/images/find-my-stationery/art_craft.png', bg: 'from-fuchsia-400/20 to-pink-500/20' },
    { label: 'Office & Business', icon: '/images/find-my-stationery/office_business.png', bg: 'from-emerald-400/20 to-teal-600/20' },
  ];

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-gradient-to-br from-[#06183B] via-[#0B255E] to-[#081B43] flex items-center justify-center text-white">
      {/* Decorative Atmospheric Glows */}
      <div className="absolute -top-32 -left-20 w-[550px] h-[550px] rounded-full bg-[#087BFF]/20 blur-[130px] pointer-events-none" />
      <div className="absolute -bottom-28 right-0 w-[600px] h-[600px] rounded-full bg-[#FFD84D]/15 blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[850px] h-[450px] bg-[#0066FF]/10 rounded-full blur-[160px] pointer-events-none" />

      {/* Grid Canvas Content */}
      <div className="relative z-10 w-full px-5 sm:px-8 lg:px-14 xl:px-20 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center py-6 lg:py-0">
        
        {/* ========================================================= */}
        {/* LEFT COLUMN: HERO HEADLINE & PURPOSE SELECTORS             */}
        {/* ========================================================= */}
        <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left">
          
          {/* Eyebrow Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-xs mb-3.5 sm:mb-4">
            <Sparkles className="w-4 h-4 text-[#FFD84D] animate-pulse" />
            <span className="text-[11px] sm:text-xs font-black tracking-widest text-[#FFD84D] uppercase">
              Smart Stationery Finder
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[56px] xl:text-[64px] font-black tracking-tight leading-[1.04] mb-3 sm:mb-4">
            <span>Find Your Exact Stationery </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#50C8FF] via-[#7DD3FC] to-[#FFD84D]">
              In 30 Seconds.
            </span>
          </h1>

          {/* Description */}
          <p className="text-slate-200/90 text-sm sm:text-base lg:text-lg font-normal leading-relaxed max-w-[560px] mb-5 sm:mb-6">
            Tell us your grade, study field, or office needs. Our smart recommender bundles all required notebooks, writing pens, and craft essentials within your budget.
          </p>

          {/* Quick Purpose Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 w-full max-w-[620px] mb-6 sm:mb-8">
            {purposes.map((p, idx) => (
              <Link
                key={idx}
                href="/find-my-stationery"
                className="group relative flex items-center gap-2 p-2 sm:p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 hover:border-cyan-400/60 backdrop-blur-md transition-all duration-200 text-left hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0 p-1">
                  <img src={p.icon} alt="" className="w-full h-full object-contain" />
                </div>
                <span className="text-[11px] sm:text-xs font-bold text-white/95 group-hover:text-cyan-300 leading-tight">
                  {p.label}
                </span>
              </Link>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3.5 sm:gap-4">
            <Link
              href="/find-my-stationery"
              className="inline-flex items-center gap-2.5 px-6 sm:px-8 py-3.5 sm:py-4 rounded-full bg-gradient-to-r from-[#087BFF] to-[#0062E0] hover:from-[#006DF0] hover:to-[#0050B8] text-white font-extrabold text-sm sm:text-base shadow-xl shadow-blue-500/30 transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
            >
              <span>Launch Stationery Finder</span>
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </Link>

            <Link
              href="/school-packs"
              className="inline-flex items-center gap-2 px-5 sm:px-7 py-3.5 sm:py-4 rounded-full border border-white/30 hover:border-white text-white font-bold text-sm sm:text-base bg-white/5 hover:bg-white/15 backdrop-blur-md transition-all duration-200"
            >
              <ShoppingBag className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#FFD84D]" />
              <span>Browse Grade Packs</span>
            </Link>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: INTERACTIVE FINDER TEASER CARD              */}
        {/* ========================================================= */}
        <div className="hidden lg:flex lg:col-span-5 items-center justify-center relative">
          
          {/* Main Glass Card Preview */}
          <div className="relative w-full max-w-[460px] rounded-3xl bg-white/10 backdrop-blur-2xl border border-white/30 p-6 shadow-[0_25px_60px_rgba(0,0,0,0.5)] overflow-hidden">
            
            {/* Top Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/15 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#087BFF] to-[#0052CC] flex items-center justify-center text-white shadow-md">
                  <Sliders className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">Interactive Pack Builder</h4>
                  <p className="text-[11px] text-slate-300">Fast 3-step recommendation</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[10px] font-black text-emerald-300 uppercase tracking-wider">
                Instant
              </span>
            </div>

            {/* Step Previews */}
            <div className="space-y-3">
              {/* Step 1: Grade Selection */}
              <div className="p-3 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-400/20 flex items-center justify-center p-1">
                    <img src="/images/find-my-stationery/grade_3_9.png" alt="" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold text-cyan-300 block uppercase">Step 1 • Target Grade</span>
                    <span className="text-xs font-bold text-white">Primary School (Grades 3 - 5)</span>
                  </div>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>

              {/* Step 2: Essential Products Matched */}
              <div className="p-3 rounded-2xl bg-white/10 border border-white/15">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-extrabold text-cyan-300 uppercase">Step 2 • Bundle Contents</span>
                  <span className="text-[10px] font-bold text-[#FFD84D]">12 Items Included</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="flex flex-col items-center p-1.5 rounded-xl bg-white/10 text-center">
                    <img src="/images/find-my-stationery/product_books.png" alt="" className="w-7 h-7 object-contain mb-1" />
                    <span className="text-[9px] font-semibold text-white/90 truncate w-full">Exercise Bks</span>
                  </div>
                  <div className="flex flex-col items-center p-1.5 rounded-xl bg-white/10 text-center">
                    <img src="/images/find-my-stationery/product_pens.png" alt="" className="w-7 h-7 object-contain mb-1" />
                    <span className="text-[9px] font-semibold text-white/90 truncate w-full">Speed Pens</span>
                  </div>
                  <div className="flex flex-col items-center p-1.5 rounded-xl bg-white/10 text-center">
                    <img src="/images/find-my-stationery/product_geometry.png" alt="" className="w-7 h-7 object-contain mb-1" />
                    <span className="text-[9px] font-semibold text-white/90 truncate w-full">DOMS Math</span>
                  </div>
                  <div className="flex flex-col items-center p-1.5 rounded-xl bg-white/10 text-center">
                    <img src="/images/find-my-stationery/product_craft.png" alt="" className="w-7 h-7 object-contain mb-1" />
                    <span className="text-[9px] font-semibold text-white/90 truncate w-full">Colour Set</span>
                  </div>
                </div>
              </div>

              {/* Step 3: 1-Click Cart Ready */}
              <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-600/30 to-indigo-600/30 border border-blue-400/40 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold text-slate-300 block">Total Bundle Value</span>
                  <span className="text-base font-black text-white">Rs. 4,850 <span className="text-[11px] font-normal text-emerald-400 line-through">Rs. 5,600</span></span>
                </div>
                <Link
                  href="/find-my-stationery"
                  className="px-4 py-2 rounded-xl bg-[#087BFF] hover:bg-[#0062E0] text-xs font-black text-white shadow-md transition-transform hover:scale-105 active:scale-95"
                >
                  Customise &rarr;
                </Link>
              </div>
            </div>

            {/* Bottom Trust Row */}
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                100% Genuine Brands
              </span>
              <span className="text-[#FFD84D] font-bold">Free Islandwide Delivery over Rs. 5,000</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
