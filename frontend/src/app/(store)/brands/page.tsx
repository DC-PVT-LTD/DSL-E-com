'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowRight, Award, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { brandService } from '@/services/brandService';
import { Brand } from '@/types/product';

function BrandSkeleton() {
  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-4 sm:p-7 shadow-xs flex flex-col justify-between animate-pulse">
      <div>
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-slate-100" />
          <div className="h-3.5 w-12 bg-slate-100 rounded-full" />
        </div>
        <div className="h-4 bg-slate-200 rounded-full w-2/3 mb-2" />
        <div className="h-2.5 bg-slate-100 rounded-full w-full mb-1.5" />
        <div className="h-2.5 bg-slate-100 rounded-full w-4/5" />
      </div>
      <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-100 flex items-center justify-between">
        <div className="h-3 bg-slate-200 rounded-full w-20" />
        <div className="h-3.5 w-3.5 bg-slate-200 rounded-full" />
      </div>
    </div>
  );
}

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBrands = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const brs = await brandService.fetchBrands();
      setBrands(brs);
    } catch (err: unknown) {
      console.error('Error loading brands:', err);
      setError(err instanceof Error ? err.message : 'Unable to connect to catalogue brands.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  return (
    <div className="max-w-[1720px] mx-auto px-3.5 sm:px-6 lg:px-12 xl:px-16 py-6 sm:py-12">
      <div className="max-w-2xl mb-8 sm:mb-12">
        <div className="inline-flex items-center gap-1.5 bg-[#EAF4FF] text-[#0866E8] text-xs font-black px-3.5 py-1 rounded-full uppercase tracking-wider mb-2.5 border border-[#0866E8]/20">
          <Sparkles className="w-3.5 h-3.5 text-[#FFD84D]" />
          <span>Authorised Stationery Brands</span>
        </div>
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-[#09285C] tracking-tight">
          Partnered National Brands
        </h1>
        <p className="text-xs sm:text-sm text-[#64748B] mt-2 leading-relaxed">
          DSL Enterprises partners directly with manufacturers and verified distributors to ensure 100% genuine
          stationery, non-toxic art mediums, and durable exercise books across Sri Lanka.
        </p>
      </div>

      {/* Error state */}
      {error && !isLoading && (
        <div className="rounded-3xl border border-red-200 bg-red-50/70 p-8 text-center my-6">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-red-900">Failed to load brands</h3>
          <p className="mx-auto mt-1 max-w-md text-xs text-red-700">{error}</p>
          <button
            type="button"
            onClick={loadBrands}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#0866E8] px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#09285C] cursor-pointer touch-target"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <BrandSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && brands.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-[#F7FAFF] border border-slate-200 flex items-center justify-center mx-auto text-[#0866E8] mb-4">
            <Award className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-[#09285C]">No brands found</h3>
          <p className="text-xs text-[#64748B] max-w-sm mx-auto mt-1 leading-relaxed">
            There are currently no stationery brand listings available.
          </p>
          <button
            type="button"
            onClick={loadBrands}
            className="mt-5 inline-flex items-center gap-1.5 bg-[#09285C] text-white text-xs font-bold px-5 py-2.5 rounded-full shadow-xs cursor-pointer touch-target"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      )}

      {/* Brand 2-Line Continuous Moving Showcase */}
      {!isLoading && !error && brands.length > 0 && (() => {
        // Resolve logo if not explicitly set
        const enrichedBrands = brands.map((b) => {
          const knownSlug = b.slug.toLowerCase();
          const autoLogo = ['speed', 'doms', 'amigo', 'linc', 'pentonic', 'accumate', 'geommy', 'flexoffice'].includes(knownSlug)
            ? `/images/brands/${knownSlug}.svg`
            : b.logo;
          return { ...b, logo: autoLogo };
        });

        const line1 = enrichedBrands.filter((_, i) => i % 2 === 0);
        const line2 = enrichedBrands.filter((_, i) => i % 2 === 1);

        // Duplicate each line to provide seamless infinite looping
        const ribbon1 = [...line1, ...line1];
        const ribbon2 = [...line2, ...line2];

        return (
          <div className="space-y-6">
            {/* Line 1: Continuous movement to the LEFT */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#0866E8] uppercase tracking-wider px-1">
                <span>Featured Partners</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#0866E8]" />
                <span className="text-slate-400 font-normal">Continuous Ribbon 01</span>
              </div>
              <div className="relative overflow-hidden py-2 group">
                <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 sm:w-20 bg-gradient-to-r from-white to-transparent z-10" />
                <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 sm:w-20 bg-gradient-to-l from-white to-transparent z-10" />

                <div className="animate-marquee-left flex gap-4 sm:gap-6 items-center">
                  {ribbon1.map((brand, idx) => (
                    <Link
                      key={`b-line1-${brand.id || brand.slug}-${idx}`}
                      href={`/brands/${brand.slug}`}
                      className="w-[280px] sm:w-[320px] shrink-0 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 hover:border-[#0866E8] p-4 sm:p-5 shadow-xs hover:shadow-xl transition-all duration-300 flex items-center gap-3.5 group cursor-pointer"
                    >
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#F7FAFF] border border-slate-100 flex items-center justify-center p-2.5 shrink-0 shadow-2xs group-hover:scale-105 transition-transform duration-300 overflow-hidden">
                        {brand.logo ? (
                          <img
                            src={brand.logo}
                            alt={brand.name}
                            className="max-h-8 max-w-full object-contain"
                          />
                        ) : (
                          <span className="text-[#0866E8] font-black text-sm">
                            {brand.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h2 className="text-sm sm:text-base font-black text-[#09285C] group-hover:text-[#0866E8] transition-colors truncate">
                            {brand.name}
                          </h2>
                          <span className="text-[9px] font-bold text-[#64748B] bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                            {brand.originCountry}
                          </span>
                        </div>
                        <p className="text-[11px] sm:text-xs text-[#64748B] font-medium line-clamp-1 mt-0.5">
                          {brand.description}
                        </p>
                      </div>

                      <div className="w-7 h-7 rounded-full bg-[#F7FAFF] group-hover:bg-[#0866E8] text-slate-400 group-hover:text-white flex items-center justify-center transition-all ml-auto shrink-0 shadow-2xs">
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Line 2: Continuous movement to the RIGHT */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#0866E8] uppercase tracking-wider px-1">
                <span>Distributor Network</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#0866E8]" />
                <span className="text-slate-400 font-normal">Continuous Ribbon 02</span>
              </div>
              <div className="relative overflow-hidden py-2 group">
                <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 sm:w-20 bg-gradient-to-r from-white to-transparent z-10" />
                <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 sm:w-20 bg-gradient-to-l from-white to-transparent z-10" />

                <div className="animate-marquee-right flex gap-4 sm:gap-6 items-center">
                  {ribbon2.map((brand, idx) => (
                    <Link
                      key={`b-line2-${brand.id || brand.slug}-${idx}`}
                      href={`/brands/${brand.slug}`}
                      className="w-[280px] sm:w-[320px] shrink-0 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 hover:border-[#0866E8] p-4 sm:p-5 shadow-xs hover:shadow-xl transition-all duration-300 flex items-center gap-3.5 group cursor-pointer"
                    >
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#F7FAFF] border border-slate-100 flex items-center justify-center p-2.5 shrink-0 shadow-2xs group-hover:scale-105 transition-transform duration-300 overflow-hidden">
                        {brand.logo ? (
                          <img
                            src={brand.logo}
                            alt={brand.name}
                            className="max-h-8 max-w-full object-contain"
                          />
                        ) : (
                          <span className="text-[#0866E8] font-black text-sm">
                            {brand.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h2 className="text-sm sm:text-base font-black text-[#09285C] group-hover:text-[#0866E8] transition-colors truncate">
                            {brand.name}
                          </h2>
                          <span className="text-[9px] font-bold text-[#64748B] bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                            {brand.originCountry}
                          </span>
                        </div>
                        <p className="text-[11px] sm:text-xs text-[#64748B] font-medium line-clamp-1 mt-0.5">
                          {brand.description}
                        </p>
                      </div>

                      <div className="w-7 h-7 rounded-full bg-[#F7FAFF] group-hover:bg-[#0866E8] text-slate-400 group-hover:text-white flex items-center justify-center transition-all ml-auto shrink-0 shadow-2xs">
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
