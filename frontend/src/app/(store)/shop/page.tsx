'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Filter,
  SlidersHorizontal,
  ArrowUpDown,
  RotateCcw,
  PackageOpen,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { productService } from '@/services/productService';
import { categoryService } from '@/services/categoryService';
import { brandService } from '@/services/brandService';
import { Product, ProductCategory, Brand } from '@/types/product';
import { FilterParams, SortOption } from '@/types/common';
import { ProductCard } from '@/components/products/ProductCard';
import { ProductFilters } from '@/components/products/ProductFilters';

function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-4 space-y-4 shadow-xs animate-pulse">
      <div className="aspect-square bg-stone-100 rounded-2xl w-full" />
      <div className="space-y-2">
        <div className="h-3 bg-stone-200 rounded-full w-1/3" />
        <div className="h-4 bg-stone-200 rounded-full w-4/5" />
        <div className="h-3 bg-stone-100 rounded-full w-full" />
      </div>
      <div className="pt-2 flex items-center justify-between">
        <div className="h-5 bg-stone-200 rounded-full w-1/3" />
        <div className="h-8 bg-stone-200 rounded-full w-24" />
      </div>
    </div>
  );
}

function ShopContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize filters from URL params
  const [filters, setFilters] = useState<FilterParams>({
    category: searchParams.get('category') || undefined,
    brand: searchParams.get('brand') || undefined,
    query: searchParams.get('q') || undefined,
    featured: searchParams.get('featured') === 'true',
    onSale: searchParams.get('sale') === 'true',
    inStockOnly: searchParams.get('inStock') === 'true',
    minPrice: searchParams.get('min') ? Number(searchParams.get('min')) * 100 : undefined,
    maxPrice: searchParams.get('max') ? Number(searchParams.get('max')) * 100 : undefined,
  });

  const [sortBy, setSortBy] = useState<SortOption>(
    (searchParams.get('sort') as SortOption) || 'newest'
  );

  // Load filter options (categories & brands)
  useEffect(() => {
    let isMounted = true;
    Promise.all([
      categoryService.fetchCategories(),
      brandService.fetchBrands(),
    ]).then(([cats, brs]) => {
      if (isMounted) {
        setCategories(cats);
        setBrands(brs);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch paginated products from backend API
  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await productService.fetchProducts(filters, sortBy, currentPage, 12);
      setProducts(res.items);
      setTotalCount(res.total);
      setTotalPages(res.totalPages);
    } catch (err: unknown) {
      console.error('Error fetching shop products:', err);
      setError(err instanceof Error ? err.message : 'Unable to connect to catalogue service.');
    } finally {
      setIsLoading(false);
    }
  }, [filters, sortBy, currentPage]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleFilterChange = (newFilters: FilterParams) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setFilters({});
    setSortBy('newest');
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen">
      <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16 py-8 sm:py-12">
        {/* Page Title & Breadcrumb */}
        <div className="mb-8">
          <div className="text-xs font-bold text-[#0066CC] uppercase tracking-wider mb-1">
            Browse Catalogue
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-[#292525] tracking-tight">
            Stationery Collection
          </h1>
          <p className="text-xs sm:text-sm text-[#292525]/60 mt-1">
            {isLoading
              ? 'Loading products from catalogue...'
              : `Showing ${totalCount} authentic school, office, and creative stationery items`}
          </p>
        </div>

        {/* Main Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Desktop Sidebar Filters */}
          <div className="hidden lg:col-span-1 lg:block">
            <div className="sticky top-28">
              <ProductFilters
                categories={categories}
                brands={brands}
                filters={filters}
                onFilterChange={handleFilterChange}
                onReset={handleResetFilters}
              />
            </div>
          </div>

          {/* Products Listing Area */}
          <div className="space-y-6 lg:col-span-3">
            {/* Top Controls Bar: Mobile filter button, Search active tag, Sorting */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[#C6E7FF]/60 bg-white p-4 shadow-xs">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setIsMobileFilterOpen(true)}
                  className="flex items-center gap-1.5 rounded-full bg-[#0066CC] px-3.5 py-2 text-xs font-bold text-white shadow-xs lg:hidden"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>Filters</span>
                </button>

                {filters.query && (
                  <span className="rounded-full border border-[#C6E7FF] bg-[#C6E7FF]/40 px-3 py-1 text-xs font-semibold text-[#08275E]">
                    Search: &ldquo;{filters.query}&rdquo;
                  </span>
                )}

                {filters.category && (
                  <span className="rounded-full border border-[#C6E7FF] bg-[#FFFDF0] px-3 py-1 text-xs font-semibold text-[#292525]">
                    Category:{' '}
                    {categories.find(
                      (c) => c.id === filters.category || c.slug === filters.category
                    )?.name || filters.category}
                  </span>
                )}

                {filters.brand && (
                  <span className="rounded-full border border-[#C6E7FF] bg-[#FFFDF0] px-3 py-1 text-xs font-semibold text-[#292525]">
                    Brand:{' '}
                    {brands.find(
                      (b) => b.id === filters.brand || b.slug === filters.brand
                    )?.name || filters.brand}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold text-[#292525]/70">
                <ArrowUpDown className="h-3.5 w-3.5 text-[#0066CC]" />
                <span>Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  aria-label="Sort products by"
                  className="rounded-full border border-[#C6E7FF] bg-[#FFFDF0] px-3.5 py-1.5 text-xs font-bold text-[#292525] focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                >
                  <option value="newest">Newest Arrivals</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="name_asc">Name: A to Z</option>
                  <option value="name_desc">Name: Z to A</option>
                  <option value="rating">Highest Rated</option>
                </select>
              </div>
            </div>

            {/* Error State */}
            {error && !isLoading && (
              <div className="rounded-3xl border border-red-200 bg-red-50/70 p-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-red-900">Failed to load products</h3>
                <p className="mx-auto mt-1 max-w-md text-xs text-red-700">{error}</p>
                <button
                  onClick={loadProducts}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#0066CC] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#0052a3]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Try Again</span>
                </button>
              </div>
            )}

            {/* Loading Skeletons */}
            {isLoading && (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            )}

            {/* Product Grid or Empty State */}
            {!isLoading && !error && products.length === 0 && (
              <div className="rounded-3xl border border-[#C6E7FF]/60 bg-white p-12 text-center shadow-xs">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#C6E7FF] bg-[#FFFDF0] text-[#0066CC]">
                  <PackageOpen className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-bold text-[#292525]">No products found</h3>
                <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-[#292525]/60">
                  We couldn&apos;t find any stationery matching your current filter selection. Try adjusting or resetting your filters.
                </p>
                <button
                  onClick={handleResetFilters}
                  className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#0066CC] px-5 py-2.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-[#0052a3]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset All Filters</span>
                </button>
              </div>
            )}

            {!isLoading && !error && products.length > 0 && (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            {!isLoading && totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-6">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="rounded-full border border-[#C6E7FF] bg-[#FFFDF0] px-4 py-2 text-xs font-bold text-[#292525] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pageNum = idx + 1;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`h-9 w-9 rounded-full text-xs font-bold transition-colors ${
                        currentPage === pageNum
                          ? 'bg-[#0066CC] text-white shadow-xs'
                          : 'border border-[#C6E7FF] bg-white text-[#292525] hover:bg-[#FFFDF0]'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-full border border-[#C6E7FF] bg-[#FFFDF0] px-4 py-2 text-xs font-bold text-[#292525] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Filter Modal */}
        {isMobileFilterOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
              onClick={() => setIsMobileFilterOpen(false)}
            />
            <div className="relative ml-auto h-full w-full max-w-xs overflow-y-auto bg-[#FFFDF0] p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between border-b border-[#C6E7FF] pb-4">
                <span className="text-sm font-bold text-[#292525]">Filter Products</span>
                <button
                  onClick={() => setIsMobileFilterOpen(false)}
                  className="p-1 text-xs font-bold text-[#0066CC]"
                >
                  Close
                </button>
              </div>
              <ProductFilters
                categories={categories}
                brands={brands}
                filters={filters}
                onFilterChange={(newF) => {
                  handleFilterChange(newF);
                  setIsMobileFilterOpen(false);
                }}
                onReset={() => {
                  handleResetFilters();
                  setIsMobileFilterOpen(false);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-[#292525]/60">Loading catalogue...</div>}>
      <ShopContent />
    </Suspense>
  );
}
