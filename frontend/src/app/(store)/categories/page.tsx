'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { BookOpen, ArrowRight, Sparkles, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import { categoryService } from '@/services/categoryService';
import { ProductCategory } from '@/types/product';

function CategorySkeleton() {
  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 p-4 sm:p-7 shadow-xs flex flex-col justify-between animate-pulse">
      <div>
        <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-slate-100 mb-3 sm:mb-5" />
        <div className="h-4 bg-slate-200 rounded-full w-2/3 mb-2" />
        <div className="h-2.5 bg-slate-100 rounded-full w-full mb-1.5" />
        <div className="h-2.5 bg-slate-100 rounded-full w-4/5" />
      </div>
      <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-100 flex items-center justify-between">
        <div className="h-3 bg-slate-200 rounded-full w-16" />
        <div className="h-3.5 w-3.5 bg-slate-200 rounded-full" />
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const cats = await categoryService.fetchCategories();
      setCategories(cats);
    } catch (err: unknown) {
      console.error('Error loading categories:', err);
      setError(err instanceof Error ? err.message : 'Unable to connect to catalogue categories.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  return (
    <div className="max-w-[1720px] mx-auto px-3.5 sm:px-6 lg:px-12 xl:px-16 py-6 sm:py-12">
      <div className="max-w-2xl mb-8 sm:mb-12">
        <div className="inline-flex items-center gap-1.5 bg-[#EAF4FF] text-[#0866E8] text-xs font-black px-3.5 py-1 rounded-full uppercase tracking-wider mb-2.5 border border-[#0866E8]/20">
          <Sparkles className="w-3.5 h-3.5 text-[#FFD84D]" />
          <span>Product Collections</span>
        </div>
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-[#09285C] tracking-tight">
          Explore by Category
        </h1>
        <p className="text-xs sm:text-sm text-[#64748B] mt-2 leading-relaxed">
          From curriculum-aligned exercise books and ballpoint pens to art supplies and student school kits,
          explore all our collections tailored for schools, universities, and commercial workplaces.
        </p>
      </div>

      {/* Error state */}
      {error && !isLoading && (
        <div className="rounded-3xl border border-red-200 bg-red-50/70 p-8 text-center my-6">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-red-900">Failed to load categories</h3>
          <p className="mx-auto mt-1 max-w-md text-xs text-red-700">{error}</p>
          <button
            type="button"
            onClick={loadCategories}
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
            <CategorySkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && categories.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-[#F7FAFF] border border-slate-200 flex items-center justify-center mx-auto text-[#0866E8] mb-4">
            <Layers className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-[#09285C]">No categories found</h3>
          <p className="text-xs text-[#64748B] max-w-sm mx-auto mt-1 leading-relaxed">
            There are currently no stationery collections available.
          </p>
          <button
            type="button"
            onClick={loadCategories}
            className="mt-5 inline-flex items-center gap-1.5 bg-[#09285C] hover:bg-[#0866E8] text-white text-xs font-bold px-5 py-2.5 rounded-full shadow-xs cursor-pointer touch-target"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      )}

      {/* Category Grid: 2 columns on mobile, 4 on desktop */}
      {!isLoading && !error && categories.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {categories.map((cat) => {
            return (
              <Link
                key={cat.id}
                href={`/categories/${cat.slug}`}
                className="group bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 hover:border-[#0866E8]/50 p-4 sm:p-7 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-[#EAF4FF] text-[#0866E8] group-hover:bg-[#0866E8] group-hover:text-white flex items-center justify-center transition-all duration-300 mb-3 sm:mb-5 shadow-2xs border border-[#0866E8]/20">
                    <BookOpen className="w-5 h-5 sm:w-7 sm:h-7" />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <h2 className="text-sm sm:text-base lg:text-lg font-black text-[#09285C] group-hover:text-[#0866E8] transition-colors line-clamp-1">
                      {cat.name}
                    </h2>
                    {cat.itemCount !== undefined && cat.itemCount > 0 && (
                      <span className="text-[9px] sm:text-[10px] font-bold text-[#0866E8] bg-[#EAF4FF] px-2 py-0.5 rounded-full w-fit">
                        {cat.itemCount} items
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] sm:text-xs text-[#64748B] mt-1.5 leading-relaxed line-clamp-2">
                    {cat.description}
                  </p>
                </div>

                <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#0866E8]">
                  <span>View Products</span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-1.5 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
