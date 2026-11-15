'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpDown,
  ChevronRight,
  PackageOpen,
  Sparkles,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { categoryService } from '@/services/categoryService';
import { productService } from '@/services/productService';
import { ProductCategory, Product } from '@/types/product';
import { SortOption } from '@/types/common';
import { ProductCard } from '@/components/products/ProductCard';

function CategorySkeleton() {
  return (
    <div className="max-w-[1720px] mx-auto px-3.5 sm:px-6 lg:px-12 xl:px-16 py-6 sm:py-12 space-y-6 animate-pulse">
      <div className="h-4 bg-slate-200 rounded-full w-48" />
      <div className="bg-white rounded-3xl border border-slate-200 p-8 h-40" />
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="aspect-square bg-slate-100 rounded-xl w-full" />
            <div className="h-4 bg-slate-200 rounded-full w-3/4" />
            <div className="h-3 bg-slate-100 rounded-full w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryDetailContent() {
  const params = useParams();
  const slug = params.slug as string;

  const [category, setCategory] = useState<ProductCategory | null | undefined>(undefined);
  const [products, setProducts] = useState<Product[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const cat = await categoryService.fetchCategoryBySlug(slug);
      setCategory(cat);

      if (cat) {
        const res = await productService.fetchProducts(
          { category: cat.slug || cat.id },
          sortBy,
          1,
          50
        );
        setProducts(res.items);
      }
    } catch (err: unknown) {
      console.error(`Error loading category "${slug}":`, err);
      setError(err instanceof Error ? err.message : 'Unable to connect to category service.');
    } finally {
      setIsLoading(false);
    }
  }, [slug, sortBy]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading) {
    return <CategorySkeleton />;
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-[#09285C]">Failed to load category</h1>
        <p className="text-xs text-red-700 max-w-md mx-auto">{error}</p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-1.5 bg-[#0866E8] hover:bg-[#09285C] text-white text-xs font-bold px-5 py-2.5 rounded-full shadow-xs cursor-pointer touch-target"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
          <Link
            href="/categories"
            className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-[#09285C] text-xs font-bold px-5 py-2.5 rounded-full shadow-xs touch-target"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Categories</span>
          </Link>
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-3">
        <h1 className="text-xl font-bold text-[#09285C]">Category Not Found</h1>
        <p className="text-xs text-[#64748B]">The category you are looking for does not exist in our catalogue.</p>
        <Link
          href="/categories"
          className="mt-4 inline-flex items-center gap-1.5 bg-[#09285C] hover:bg-[#0866E8] text-white text-xs font-bold px-5 py-2.5 rounded-full shadow-xs touch-target"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to All Categories</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1720px] mx-auto px-3.5 sm:px-6 lg:px-12 xl:px-16 py-6 sm:py-10 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-[#64748B] font-medium overflow-x-auto">
        <Link href="/home" className="hover:text-[#0866E8] whitespace-nowrap">Home</Link>
        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        <Link href="/categories" className="hover:text-[#0866E8] whitespace-nowrap">Categories</Link>
        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        <span className="text-[#09285C] font-bold whitespace-nowrap">{category.name}</span>
      </nav>

      {/* Category Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 shadow-xs">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-[#0866E8] bg-[#EAF4FF] px-3 py-1 rounded-full inline-block mb-2 border border-[#0866E8]/20">
            Collection
          </span>
          <h1 className="text-2xl sm:text-4xl font-black text-[#09285C] tracking-tight">
            {category.name}
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-2 max-w-2xl leading-relaxed">
            {category.description}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-[#09285C]/75 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
          <ArrowUpDown className="w-3.5 h-3.5 text-[#0866E8]" />
          <span>Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            aria-label="Sort products by"
            className="bg-[#F7FAFF] border border-slate-200 rounded-full px-3.5 py-1.5 text-xs font-bold text-[#09285C] focus:outline-hidden focus:border-[#0866E8] cursor-pointer"
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="rating">Top Rated</option>
          </select>
        </div>
      </div>

      {/* Products Grid: 2 columns on mobile, 4 on desktop */}
      {products.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-full bg-[#F7FAFF] border-2 border-dashed border-[#0866E8] flex items-center justify-center mx-auto text-[#0866E8] mb-4">
            <PackageOpen className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-[#09285C]">No products in this category yet</h3>
          <p className="text-xs text-[#64748B] mt-1">Check back soon or browse our full catalogue.</p>
          <Link
            href="/shop"
            className="mt-4 inline-flex items-center gap-1.5 bg-[#09285C] hover:bg-[#0866E8] text-white text-xs font-bold px-5 py-2.5 rounded-full shadow-xs touch-target"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Browse All Stationery</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CategoryDetailPage() {
  return (
    <Suspense fallback={<CategorySkeleton />}>
      <CategoryDetailContent />
    </Suspense>
  );
}
