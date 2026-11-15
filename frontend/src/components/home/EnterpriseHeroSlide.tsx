'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Building2, PackageCheck, Truck, ShieldCheck } from 'lucide-react';

export const EnterpriseHeroSlide: React.FC = () => {
  return (
    <div className="relative w-full h-full min-h-[460px] sm:min-h-[500px] lg:h-[calc(100vh-102px)] lg:max-h-[640px] xl:max-h-[680px] flex items-center bg-gradient-to-br from-[#0B1E48] via-[#102A5E] to-[#0A2252] overflow-hidden select-none text-white">
      {/* Decorative Luminous Rings / Background Gradients */}
      <div
        className="absolute top-1/4 -right-24 w-[600px] h-[600px] rounded-full bg-[#087BFF]/20 blur-[120px] pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-32 -left-20 w-[500px] h-[500px] rounded-full bg-[#0052CC]/25 blur-[100px] pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative z-20 w-full h-full max-w-[1720px] mx-auto px-6 sm:px-10 lg:px-14 xl:px-20 grid grid-cols-1 lg:grid-cols-12 items-center gap-8 py-16 lg:py-0">
        {/* Left Column: Heading, Description, Actions, Benefits */}
        <div className="lg:col-span-7 flex flex-col items-start justify-center">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-3 mb-4">
            <span className="w-10 lg:w-14 h-1.5 bg-[#087BFF] rounded-full inline-block" />
            <span className="text-xs sm:text-sm font-extrabold uppercase tracking-[0.24em] text-cyan-300">
              Commercial &amp; Wholesale Supply
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-6xl lg:text-[72px] xl:text-[84px] font-black tracking-tight leading-[0.98] mb-5 text-white">
            <span>Supplies for </span>
            <span className="text-[#38BDF8] font-black">Business </span>
            <span className="block font-bold text-white/90">Without Limits.</span>
          </h1>

          {/* Description */}
          <p className="text-slate-200/90 text-base sm:text-lg lg:text-xl font-normal leading-relaxed max-w-[580px] mb-8">
            Partner with Sri Lanka&apos;s leading stationery distributor for schools, universities, offices, and retail networks. Direct access to 20,000+ genuine products.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-5 mb-10">
            <Link
              href="/shop"
              className="inline-flex items-center gap-3 px-8 lg:px-10 py-4 rounded-full bg-[#087BFF] hover:bg-[#0062E0] text-white font-bold text-base lg:text-lg shadow-xl shadow-[#087BFF]/30 transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
            >
              <span>Explore Catalogue</span>
              <ArrowRight className="w-5 h-5" />
            </Link>

            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-8 lg:px-9 py-4 rounded-full border-2 border-white/60 hover:border-white text-white font-bold text-base lg:text-lg bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all duration-200"
            >
              <span>Contact Wholesale</span>
            </Link>
          </div>

          {/* 3 Pillars */}
          <div className="flex flex-wrap items-center gap-6 sm:gap-8 pt-2 text-white/90">
            <div className="flex items-center gap-2.5">
              <Building2 className="w-5 h-5 text-cyan-400" />
              <span className="text-xs sm:text-sm font-bold">Direct B2B Rates</span>
            </div>
            <div className="h-4 w-px bg-white/20 hidden sm:block" />
            <div className="flex items-center gap-2.5">
              <Truck className="w-5 h-5 text-cyan-400" />
              <span className="text-xs sm:text-sm font-bold">Islandwide Dispatch</span>
            </div>
            <div className="h-4 w-px bg-white/20 hidden sm:block" />
            <div className="flex items-center gap-2.5">
              <PackageCheck className="w-5 h-5 text-cyan-400" />
              <span className="text-xs sm:text-sm font-bold">100% Genuine Brands</span>
            </div>
          </div>
        </div>

        {/* Right Column: Visual Stats Graphic Card */}
        <div className="lg:col-span-5 hidden lg:flex justify-end">
          <div className="relative w-full max-w-[480px] p-8 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl space-y-6">
            <div className="border-b border-white/15 pb-5">
              <span className="text-xs uppercase tracking-widest text-cyan-300 font-extrabold block">
                Distribution Network
              </span>
              <h3 className="text-2xl font-black text-white mt-1">
                Trusted by 5,000+ Institutions
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-3xl font-black text-[#38BDF8] block">20,000+</span>
                <span className="text-xs text-white/70 block mt-1">Active Catalog Lines</span>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-3xl font-black text-[#38BDF8] block">25</span>
                <span className="text-xs text-white/70 block mt-1">Districts Covered</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-600/30 to-cyan-600/20 border border-blue-400/30 flex items-center gap-4">
              <ShieldCheck className="w-8 h-8 text-cyan-400 shrink-0" />
              <div>
                <span className="text-sm font-bold text-white block">Official Distributor</span>
                <span className="text-xs text-white/75 block">Doms, Linc, Luxor, Speed, Wetex &amp; more</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

