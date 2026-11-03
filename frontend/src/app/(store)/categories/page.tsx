'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { BookOpen, ArrowRight, Sparkles, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import { categoryService } from '@/services/categoryService';
import { ProductCategory } from '@/types/product';

function CategorySkeleton() {
  return (
    <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-7 shadow-xs flex flex-col justify-between animate-pulse">
      <div>
        <div className="w-14 h-14 rounded-2xl bg-stone-100 mb-5" />
        <div className="h-5 bg-stone-200 rounded-full w-2/3 mb-2" />
        <div className="h-3 bg-stone-100 rounded-full w-full mb-1.5" />
        <div className="h-3 bg-stone-100 rounded-full w-4/5" />
      </div>
      <div className="mt-6 pt-4 border-t border-[#C6E7FF]/30 flex items-center justify-between">
        <div className="h-3 bg-stone-200 rounded-full w-20" />
        <div className="h-4 w-4 bg-stone-200 rounded-full" />
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      <div className="max-w-2xl mb-12">
        <div className="inline-flex items-center gap-1.5 bg-[#C6E7FF]/40 text-[#0066CC] text-xs font-bold px-3.5 py-1 rounded-full uppercase tracking-wider mb-3 border border-[#C6E7FF]/50">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Product Collections</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-[#292525] tracking-tight">
          Explore Stationery by Category
        </h1>
        <p className="text-sm text-[#292525]/70 mt-2.5 leading-relaxed">
          From cheerful pastel notebooks and gel pens to school packs and desk organisers,
          explore all our stationery collections arranged for effortless shopping.
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
            onClick={loadCategories}
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
            <CategorySkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && categories.length === 0 && (
        <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-[#FFFDF0] border border-[#C6E7FF] flex items-center justify-center mx-auto text-[#0066CC] mb-4">
            <Layers className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-[#292525]">No categories found</h3>
          <p className="text-xs text-[#292525]/60 max-w-sm mx-auto mt-1 leading-relaxed">
            There are currently no stationery collections available.
          </p>
          <button
            onClick={loadCategories}
            className="mt-5 inline-flex items-center gap-1.5 bg-[#0066CC] text-white text-xs font-bold px-5 py-2.5 rounded-full shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      )}

      {/* Category Grid */}
      {!isLoading && !error && categories.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((cat, index) => {
            const bgColors = ['bg-[#C6E7FF]/20', 'bg-[#EBD5FA]/30', 'bg-[#FFF9D2]', 'bg-[#B9D5FF]/20'];
            const iconColors = ['text-[#0066CC]', 'text-[#8629B3]', 'text-[#B38A00]', 'text-[#2B6CB0]'];
            const bgChosen = bgColors[index % bgColors.length];
            const iconChosen = iconColors[index % iconColors.length];

            return (
              <Link
                key={cat.id}
                href={`/categories/${cat.slug}`}
                className="group bg-white rounded-3xl border border-[#C6E7FF]/60 hover:border-[#0066CC] p-7 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className={`w-14 h-14 rounded-2xl ${bgChosen} ${iconChosen} group-hover:scale-105 flex items-center justify-center transition-all duration-300 mb-5 shadow-2xs border border-white`}>
                    <BookOpen className="w-7 h-7" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg font-bold text-[#292525] group-hover:text-[#0066CC] transition-colors">
                      {cat.name}
                    </h2>
                    {cat.itemCount !== undefined && cat.itemCount > 0 && (
                      <span className="text-[10px] font-bold text-[#0066CC] bg-[#C6E7FF]/40 px-2 py-0.5 rounded-full">
                        {cat.itemCount} items
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#292525]/60 mt-2 leading-relaxed">
                    {cat.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-[#C6E7FF]/30 flex items-center justify-between text-xs font-bold text-[#0066CC]">
                  <span>View Products</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
