'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, ArrowRight, PackageOpen, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { productService } from '@/services/productService';
import { Product } from '@/types/product';
import { ProductCard } from '@/components/products/ProductCard';

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  const [products, setProducts] = useState<Product[]>([]);
  const [searchInput, setSearchInput] = useState(query);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const performSearch = useCallback(async (searchQuery: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await productService.fetchProducts(
        searchQuery.trim() ? { query: searchQuery.trim() } : {},
        'newest',
        1,
        50
      );
      setProducts(res.items);
    } catch (err: unknown) {
      console.error('Error during search fetch:', err);
      setError(err instanceof Error ? err.message : 'Unable to connect to search service.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setSearchInput(query);
    performSearch(query);
  }, [query, performSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchInput.trim())}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-8">
      {/* Search Header */}
      <div className="max-w-2xl">
        <span className="text-xs font-bold uppercase tracking-wider text-[#0066CC] bg-[#C6E7FF]/30 px-3.5 py-1 rounded-full inline-block mb-3 border border-[#C6E7FF]/40">
          Search Storefront
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-[#292525] tracking-tight">
          Find Your Stationery
        </h1>
        {query ? (
          <p className="text-sm text-[#292525]/70 mt-2">
            {isLoading
              ? 'Searching catalogue...'
              : `Found ${products.length} stationery items matching "${query}"`}
          </p>
        ) : (
          <p className="text-sm text-[#292525]/70 mt-2">
            Browse our curated stationery collection or search by name, brand, or SKU below:
          </p>
        )}
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="max-w-xl flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search notebooks, pens, highlighters, planners..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-full bg-white border border-[#C6E7FF] text-sm text-[#292525] focus:outline-none focus:ring-2 focus:ring-[#C6E7FF] shadow-2xs"
          />
          <Search className="w-4 h-4 text-[#0066CC] absolute left-4 top-1/2 -translate-y-1/2" />
        </div>
        <button
          type="submit"
          className="bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold px-6 py-3 rounded-full transition-all shadow-sm"
        >
          Search
        </button>
      </form>

      {/* Error State */}
      {error && !isLoading && (
        <div className="rounded-3xl border border-red-200 bg-red-50/70 p-8 text-center max-w-lg mx-auto">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-red-900">Failed to search products</h3>
          <p className="mx-auto mt-1 max-w-md text-xs text-red-700">{error}</p>
          <button
            onClick={() => performSearch(query)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#0066CC] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#0052a3]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-4 space-y-4 animate-pulse">
              <div className="aspect-square bg-stone-100 rounded-2xl w-full" />
              <div className="h-4 bg-stone-200 rounded-full w-3/4" />
              <div className="h-3 bg-stone-100 rounded-full w-1/2" />
              <div className="h-8 bg-stone-200 rounded-full w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Results Grid or Empty State */}
      {!isLoading && !error && products.length === 0 ? (
        <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-12 text-center max-w-lg mx-auto shadow-sm">
          <div className="w-16 h-16 rounded-full bg-[#FFFDF0] border-2 border-dashed border-[#0066CC] flex items-center justify-center mx-auto text-[#0066CC] mb-4">
            <PackageOpen className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-[#292525]">No matching products found</h2>
          <p className="text-xs text-[#292525]/60 mt-1.5 leading-relaxed">
            Check your spelling or try searching for general stationery terms like &ldquo;Speed&rdquo;, &ldquo;Pen&rdquo;, or &ldquo;Amigo&rdquo;.
          </p>
          <Link
            href="/shop"
            className="mt-5 inline-flex items-center gap-1.5 bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold px-5 py-2.5 rounded-full shadow-sm"
          >
            <span>View All Stationery Items</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        !isLoading &&
        !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-[#292525]/50">Loading search...</div>}>
      <SearchPageContent />
    </Suspense>
  );
}
