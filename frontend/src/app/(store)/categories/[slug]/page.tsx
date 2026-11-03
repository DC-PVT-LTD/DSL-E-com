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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8 animate-pulse">
      <div className="h-4 bg-stone-200 rounded-full w-48" />
      <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-8 h-40" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-4 space-y-4">
            <div className="aspect-square bg-stone-100 rounded-2xl w-full" />
            <div className="h-4 bg-stone-200 rounded-full w-3/4" />
            <div className="h-3 bg-stone-100 rounded-full w-1/2" />
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
        // Fetch products in this category from the backend
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
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-[#292525]">Failed to load category</h1>
        <p className="text-xs text-red-700 mt-1 max-w-md mx-auto">{error}</p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            onClick={loadData}
            className="inline-flex items-center gap-1.5 bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold px-5 py-2.5 rounded-full shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
          <Link
            href="/categories"
            className="inline-flex items-center gap-1.5 bg-white border border-[#C6E7FF] text-[#292525] text-xs font-bold px-5 py-2.5 rounded-full shadow-xs"
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
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-[#292525]">Category Not Found</h1>
        <p className="text-xs text-[#292525]/60 mt-2">The category you are looking for does not exist in our catalogue.</p>
        <Link
          href="/categories"
          className="mt-4 inline-flex items-center gap-1.5 bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold px-5 py-2.5 rounded-full shadow-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to All Categories</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-[#292525]/50 mb-6 font-medium">
        <Link href="/home" className="hover:text-[#0066CC]">Home</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link href="/categories" className="hover:text-[#0066CC]">Categories</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-[#292525] font-bold">{category.name}</span>
      </nav>

      {/* Category Header */}
      <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 sm:p-8 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#0066CC] bg-[#C6E7FF]/30 px-3 py-1 rounded-full inline-block mb-2 border border-[#C6E7FF]/40">
            Collection
          </span>
          <h1 className="text-2xl sm:text-4xl font-black text-[#292525] tracking-tight">
            {category.name}
          </h1>
          <p className="text-xs sm:text-sm text-[#292525]/70 mt-2 max-w-2xl leading-relaxed">
            {category.description}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-[#292525]/70 shrink-0">
          <ArrowUpDown className="w-3.5 h-3.5 text-[#0066CC]" />
          <span>Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            aria-label="Sort products by"
            className="bg-[#FFFDF0] border border-[#C6E7FF] rounded-full px-3.5 py-1.5 text-xs font-bold text-[#292525] focus:outline-none focus:ring-1 focus:ring-[#0066CC]"
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="rating">Top Rated</option>
          </select>
        </div>
      </div>

      {/* Products Grid */}
      {products.length === 0 ? (
        <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-full bg-[#FFFDF0] border-2 border-dashed border-[#0066CC] flex items-center justify-center mx-auto text-[#0066CC] mb-4">
            <PackageOpen className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-[#292525]">No products in this category yet</h3>
          <p className="text-xs text-[#292525]/60 mt-1">Check back soon or browse our full catalogue.</p>
          <Link
            href="/shop"
            className="mt-4 inline-flex items-center gap-1.5 bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold px-5 py-2.5 rounded-full shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Browse All Stationery</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
