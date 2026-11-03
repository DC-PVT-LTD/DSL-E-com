'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowRight, Award, Sparkles, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import { brandService } from '@/services/brandService';
import { Brand } from '@/types/product';

function BrandSkeleton() {
  return (
    <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-7 shadow-xs flex flex-col justify-between animate-pulse">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 rounded-2xl bg-stone-100" />
          <div className="h-4 w-16 bg-stone-100 rounded-full" />
        </div>
        <div className="h-5 bg-stone-200 rounded-full w-2/3 mb-2" />
        <div className="h-3 bg-stone-100 rounded-full w-full mb-1.5" />
        <div className="h-3 bg-stone-100 rounded-full w-4/5" />
      </div>
      <div className="mt-6 pt-4 border-t border-[#C6E7FF]/30 flex items-center justify-between">
        <div className="h-3 bg-stone-200 rounded-full w-24" />
        <div className="h-4 w-4 bg-stone-200 rounded-full" />
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      <div className="max-w-2xl mb-12">
        <div className="inline-flex items-center gap-1.5 bg-[#C6E7FF]/40 text-[#0066CC] text-xs font-bold px-3.5 py-1 rounded-full uppercase tracking-wider mb-3 border border-[#C6E7FF]/50">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Authentic Stationery Brands</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-[#292525] tracking-tight">
          Sri Lankan &amp; Global Trusted Brands
        </h1>
        <p className="text-sm text-[#292525]/70 mt-2.5 leading-relaxed">
          DSL Stationery partners directly with manufacturers and verified distributors to ensure 100% genuine
          products, certified non-toxic art mediums, and durable school exercise books.
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
            onClick={loadBrands}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#0066CC] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#0052a3]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <BrandSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && brands.length === 0 && (
        <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-[#FFFDF0] border border-[#C6E7FF] flex items-center justify-center mx-auto text-[#0066CC] mb-4">
            <Award className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-[#292525]">No brands found</h3>
          <p className="text-xs text-[#292525]/60 max-w-sm mx-auto mt-1 leading-relaxed">
            There are currently no stationery brand partners available.
          </p>
          <button
            onClick={loadBrands}
            className="mt-5 inline-flex items-center gap-1.5 bg-[#0066CC] text-white text-xs font-bold px-5 py-2.5 rounded-full shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      )}

      {/* Brand Grid */}
      {!isLoading && !error && brands.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {brands.map((b) => (
            <Link
              key={b.id}
              href={`/shop?brand=${b.slug || b.id}`}
              className="group bg-white rounded-3xl border border-[#C6E7FF]/60 hover:border-[#0066CC] p-7 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#FFFDF0] border-2 border-[#0066CC] text-[#0066CC] flex items-center justify-center font-black text-lg shadow-2xs">
                    {b.name.charAt(0)}
                  </div>
                  {b.originCountry && (
                    <span className="text-[10px] font-bold text-[#292525]/60 uppercase tracking-widest bg-[#FFFDF0] border border-[#C6E7FF]/50 px-2.5 py-0.5 rounded-full">
                      {b.originCountry}
                    </span>
                  )}
                </div>
                <h2 className="text-base font-bold text-[#292525] group-hover:text-[#0066CC] transition-colors">
                  {b.name}
                </h2>
                <p className="text-xs text-[#292525]/60 mt-2 leading-relaxed">
                  {b.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#C6E7FF]/30 flex items-center justify-between text-xs font-bold text-[#0066CC]">
                <span>View Brand Catalog</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
