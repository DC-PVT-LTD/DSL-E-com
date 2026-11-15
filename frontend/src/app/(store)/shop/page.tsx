'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  SlidersHorizontal,
  ArrowUpDown,
  RotateCcw,
  PackageOpen,
  AlertCircle,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { productService } from '@/services/productService';
import { categoryService, deduplicateCategories } from '@/services/categoryService';
import { brandService, deduplicateBrands } from '@/services/brandService';
import { Product, ProductCategory, Brand } from '@/types/product';
import { FilterParams, SortOption } from '@/types/common';
import { ProductCard } from '@/components/products/ProductCard';
import { ProductFilters } from '@/components/products/ProductFilters';

function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-4 space-y-3 shadow-xs animate-pulse">
      <div className="aspect-square bg-slate-100 rounded-xl w-full" />
      <div className="space-y-1.5">
        <div className="h-2.5 bg-slate-200 rounded-full w-1/3" />
        <div className="h-3.5 bg-slate-200 rounded-full w-4/5" />
        <div className="h-2.5 bg-slate-100 rounded-full w-full" />
      </div>
      <div className="pt-2 flex items-center justify-between">
        <div className="h-4 bg-slate-200 rounded-full w-1/3" />
        <div className="h-7 bg-slate-200 rounded-full w-20" />
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

  const [searchInput, setSearchInput] = useState(filters.query || '');

  // Keep filters in sync when URL search params change (e.g., clicking categories from homepage)
  useEffect(() => {
    const urlCategory = searchParams.get('category') || undefined;
    const urlBrand = searchParams.get('brand') || undefined;
    const urlQuery = searchParams.get('q') || undefined;
    const urlFeatured = searchParams.get('featured') === 'true';
    const urlSale = searchParams.get('sale') === 'true';
    const urlInStock = searchParams.get('inStock') === 'true';
    const urlMin = searchParams.get('min') ? Number(searchParams.get('min')) * 100 : undefined;
    const urlMax = searchParams.get('max') ? Number(searchParams.get('max')) * 100 : undefined;

    setFilters({
      category: urlCategory,
      brand: urlBrand,
      query: urlQuery,
      featured: urlFeatured,
      onSale: urlSale,
      inStockOnly: urlInStock,
      minPrice: urlMin,
      maxPrice: urlMax,
    });
    setCurrentPage(1);
  }, [searchParams]);

  // Keep searchInput in sync when external filters change
  useEffect(() => {
    setSearchInput(filters.query || '');
  }, [filters.query]);

  // Debounced live search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentQuery = filters.query || '';
      const trimmed = searchInput.trim();
      if (trimmed !== currentQuery) {
        setFilters((prev) => ({
          ...prev,
          query: trimmed || undefined,
        }));
        setCurrentPage(1);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput, filters.query]);

  // Load filter options (categories & brands)
  useEffect(() => {
    let isMounted = true;
    Promise.all([
      categoryService.fetchCategories(),
      brandService.fetchBrands(),
    ]).then(([cats, brs]) => {
      if (isMounted) {
        setCategories(deduplicateCategories(cats));
        setBrands(deduplicateBrands(brs));
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
    <div className="min-h-screen bg-[#F7FAFF]/50">
      <div className="w-full max-w-[1720px] mx-auto px-3.5 sm:px-6 lg:px-12 xl:px-16 py-6 sm:py-10 space-y-6">
        {/* Page Title & Breadcrumb */}
        <div>
          <div className="text-xs font-black text-[#0866E8] uppercase tracking-wider mb-1">
            Browse Catalogue
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-[#09285C] tracking-tight">
            Stationery Collection
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-1">
            {isLoading
              ? 'Loading products from catalogue...'
              : `Showing ${totalCount} authentic school, office, and creative stationery items`}
          </p>
        </div>

        {/* Main Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
          {/* Desktop Pinned Sticky Sidebar Filters - stays visible while scrolling */}
          <div className="hidden lg:col-span-1 lg:block">
            <div className="sticky top-24 max-h-[calc(100vh-6.5rem)] overflow-y-auto pr-1 pb-4 scrollbar-thin">
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
          <div className="space-y-5 lg:col-span-3">
            {/* Top Controls Bar: Search Bar, Mobile filter trigger, and Sorting */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-3 sm:p-4 shadow-xs">
              {/* Left & Center: Filter Button & Search Bar */}
              <div className="flex items-center gap-2 flex-1 max-w-2xl">
                <button
                  type="button"
                  onClick={() => setIsMobileFilterOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-[#09285C] hover:bg-[#0866E8] px-3.5 py-2.5 text-xs font-bold text-white shadow-xs lg:hidden shrink-0 touch-target cursor-pointer"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span>Filters</span>
                </button>

                {/* Direct Integrated Search Bar */}
                <div className="relative flex-1">
                  <input
                    type="search"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search pens, books, calculators..."
                    aria-label="Search catalogue products"
                    className="w-full bg-[#F7FAFF] border border-slate-200 focus:border-[#0866E8] rounded-xl sm:rounded-full pl-9 pr-8 py-2 text-xs sm:text-sm text-[#09285C] placeholder-slate-400 focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-[#0866E8]/20 transition-all font-medium"
                  />
                  <Search className="w-4 h-4 text-[#0866E8] absolute left-3 top-2.5 sm:top-3 pointer-events-none" />
                  {searchInput && (
                    <button
                      type="button"
                      onClick={() => setSearchInput('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full transition-colors cursor-pointer"
                      aria-label="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Right: Sort selector */}
              <div className="flex items-center justify-between sm:justify-end gap-2 text-xs font-semibold text-[#09285C]/75 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                <div className="flex items-center gap-1.5">
                  <ArrowUpDown className="h-3.5 w-3.5 text-[#0866E8]" />
                  <span>Sort by:</span>
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  aria-label="Sort products by"
                  className="rounded-xl sm:rounded-full border border-slate-200 bg-[#F7FAFF] px-3 py-1.5 text-xs font-bold text-[#09285C] focus:outline-hidden focus:ring-2 focus:ring-[#0866E8] cursor-pointer"
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

            {/* Active Filter Pills */}
            {(filters.query || filters.category || filters.brand) && (
              <div className="flex flex-wrap items-center gap-2 px-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Active Filters:
                </span>
                {filters.query && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#0866E8]/20 bg-[#EAF4FF] px-3 py-1 text-xs font-semibold text-[#0866E8]">
                    <span>Search: &ldquo;{filters.query}&rdquo;</span>
                    <button
                      onClick={() => setSearchInput('')}
                      className="hover:text-rose-600 transition-colors"
                      aria-label="Remove search filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {filters.category && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-[#09285C]">
                    <span>Category: {categories.find((c) => c.id.toLowerCase() === filters.category?.toLowerCase() || c.slug?.toLowerCase() === filters.category?.toLowerCase() || c.id.toLowerCase().replace(/^cat-/, '') === filters.category?.toLowerCase())?.name || filters.category}</span>
                    <button
                      onClick={() => handleFilterChange({ ...filters, category: undefined })}
                      className="hover:text-rose-600 transition-colors cursor-pointer"
                      aria-label="Remove category filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {filters.brand && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-[#09285C]">
                    <span>Brand: {brands.find((b) => b.id === filters.brand || b.slug === filters.brand)?.name || filters.brand}</span>
                    <button
                      onClick={() => handleFilterChange({ ...filters, brand: undefined })}
                      className="hover:text-rose-600 transition-colors"
                      aria-label="Remove brand filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-xs font-bold text-[#0866E8] hover:underline ml-2 cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            )}

            {/* Error State */}
            {error && !isLoading && (
              <div className="rounded-3xl border border-red-200 bg-red-50/70 p-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-red-900">Failed to load products</h3>
                <p className="mx-auto mt-1 max-w-md text-xs text-red-700">{error}</p>
                <button
                  type="button"
                  onClick={loadProducts}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#0866E8] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#09285C] cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Try Again</span>
                </button>
              </div>
            )}

            {/* Loading Skeletons */}
            {isLoading && (
              <div className="grid grid-cols-2 gap-3 sm:gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            )}

            {/* Product Grid or Empty State */}
            {!isLoading && !error && products.length === 0 && (
              <div className="rounded-3xl border border-slate-200/80 bg-white p-8 sm:p-14 text-center shadow-xs">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-[#F7FAFF] text-[#0866E8]">
                  <PackageOpen className="h-8 w-8" />
                </div>
                {filters.category && filters.query ? (
                  <div className="space-y-3 max-w-md mx-auto">
                    <h3 className="text-lg font-bold text-[#09285C]">
                      No products in &ldquo;{categories.find((c) => c.id.toLowerCase() === filters.category?.toLowerCase() || c.slug?.toLowerCase() === filters.category?.toLowerCase() || c.id.toLowerCase().replace(/^cat-/, '') === filters.category?.toLowerCase())?.name || filters.category}&rdquo; matching &ldquo;{filters.query}&rdquo;
                    </h3>
                    <p className="text-xs text-[#64748B] leading-relaxed">
                      You are currently filtering inside &ldquo;{categories.find((c) => c.id.toLowerCase() === filters.category?.toLowerCase() || c.slug?.toLowerCase() === filters.category?.toLowerCase() || c.id.toLowerCase().replace(/^cat-/, '') === filters.category?.toLowerCase())?.name || filters.category}&rdquo;. Items matching &ldquo;{filters.query}&rdquo; may exist in other categories.
                    </p>
                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleFilterChange({ ...filters, category: undefined })}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#0866E8] hover:bg-[#09285C] px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all cursor-pointer"
                      >
                        <Search className="h-3.5 w-3.5" />
                        <span>Search &ldquo;{filters.query}&rdquo; in All Categories</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-bold text-[#09285C] shadow-xs transition-colors cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Reset Filters</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h3 className="text-lg font-bold text-[#09285C]">No products found</h3>
                    <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-[#64748B]">
                      We couldn&apos;t find any stationery matching your current filter selection. Try adjusting or resetting your filters.
                    </p>
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#09285C] hover:bg-[#0866E8] px-5 py-2.5 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Reset All Filters</span>
                    </button>
                  </>
                )}
              </div>
            )}

            {!isLoading && !error && products.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            {!isLoading && totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-6">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-[#09285C] transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 touch-target flex items-center justify-center"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pageNum = idx + 1;
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`h-9 w-9 rounded-full text-xs font-bold transition-colors touch-target flex items-center justify-center ${
                        currentPage === pageNum
                          ? 'bg-[#09285C] text-white shadow-xs'
                          : 'border border-slate-200 bg-white text-[#09285C] hover:bg-[#F7FAFF]'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-[#09285C] transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 touch-target flex items-center justify-center"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Filter Sheet / Modal */}
        {isMobileFilterOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden animate-fade-in">
            <div
              className="fixed inset-0 bg-[#09285C]/60 backdrop-blur-xs"
              onClick={() => setIsMobileFilterOpen(false)}
            />
            <div className="relative ml-auto h-full w-full max-w-xs overflow-y-auto bg-white p-5 shadow-2xl flex flex-col justify-between pb-safe">
              <div>
                <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-sm font-black text-[#09285C]">Filter Products</span>
                  <button
                    type="button"
                    onClick={() => setIsMobileFilterOpen(false)}
                    className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-[#09285C] transition-colors"
                  >
                    <X className="w-5 h-5" />
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
          </div>
        )}
      </div>
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-[#64748B]">Loading catalogue...</div>}>
      <ShopContent />
    </Suspense>
  );
}
