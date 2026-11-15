'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Grid,
  Search,
  Heart,
  ShoppingCart,
  X,
  ArrowRight,
} from 'lucide-react';
import { useCartStore } from '@/services/cartStore';
import { useWishlistStore } from '@/services/wishlistStore';
import { productService } from '@/services/productService';
import { Product } from '@/types/product';
import { formatLKR } from '@/lib/currency';

export const MobileBottomNav: React.FC = () => {
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);
  const [isSearchSheetOpen, setIsSearchSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Product[]>([]);

  const items = useCartStore((state) => state.items);
  const setDrawerOpen = useCartStore((state) => state.setDrawerOpen);
  const cartItemCount = items.reduce((acc, item) => acc + item.quantity, 0);
  const wishlistCount = useWishlistStore((state) => state.itemCount);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      const q = searchQuery.trim().toLowerCase();
      const results = productService
        .getAll()
        .filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.brandName.toLowerCase().includes(q) ||
            p.categoryName.toLowerCase().includes(q)
        )
        .slice(0, 5);
      setSuggestions(results);
    } else {
      setSuggestions([]);
    }
  }, [searchQuery]);

  // Don't show bottom nav on checkout to avoid distraction, or on welcome splash
  if (pathname === '/welcome' || pathname === '/checkout') {
    return null;
  }

  const isHome = pathname === '/' || pathname === '/home';
  const isCategories = pathname.startsWith('/categories') || pathname.startsWith('/shop');
  const isWishlist = pathname.startsWith('/account/wishlist') || pathname === '/wishlist';
  const isCart = pathname === '/cart';

  return (
    <>
      {/* Mobile Search Bottom Sheet / Modal */}
      {isSearchSheetOpen && (
        <div className="fixed inset-0 z-50 bg-[#09285C]/60 backdrop-blur-xs flex flex-col justify-end lg:hidden animate-fade-in">
          <div className="bg-white rounded-t-3xl border-t border-slate-200 p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto pb-safe">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#09285C]">Quick Search</span>
              <button
                type="button"
                onClick={() => setIsSearchSheetOpen(false)}
                className="p-2 text-slate-400 hover:text-[#09285C] rounded-full hover:bg-slate-100 transition-colors"
                aria-label="Close search"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (searchQuery.trim()) {
                  setIsSearchSheetOpen(false);
                  window.location.href = `/search?q=${encodeURIComponent(searchQuery.trim())}`;
                }
              }}
              className="relative"
            >
              <input
                type="search"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search stationery, pens, books..."
                className="w-full bg-[#F7FAFF] border border-[#EAF4FF] rounded-2xl pl-11 pr-4 py-3 text-base text-[#09285C] placeholder-slate-400 focus:outline-hidden focus:border-[#0866E8] focus:bg-white transition-all shadow-inner"
              />
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
            </form>

            {suggestions.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block px-1">
                  Products Found
                </span>
                {suggestions.map((item) => (
                  <Link
                    key={item.id}
                    href={`/products/${item.slug}`}
                    onClick={() => setIsSearchSheetOpen(false)}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-[#F7FAFF] border border-transparent hover:border-slate-100 text-sm text-[#09285C] transition-colors"
                  >
                    <div className="truncate font-semibold">{item.name}</div>
                    <span className="text-xs font-bold text-[#0866E8] shrink-0 ml-2">
                      {formatLKR(item.priceCents)}
                    </span>
                  </Link>
                ))}
              </div>
            )}

            <div className="pt-2 flex justify-between items-center text-xs text-slate-500">
              <Link
                href="/shop"
                onClick={() => setIsSearchSheetOpen(false)}
                className="text-[#0866E8] font-bold hover:underline"
              >
                Browse All Catalogue
              </Link>
              <Link
                href="/find-my-stationery"
                onClick={() => setIsSearchSheetOpen(false)}
                className="text-[#0866E8] font-bold hover:underline flex items-center gap-1"
              >
                <span>Find My Stationery</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Floating Modern iOS Bottom Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-white/92 backdrop-blur-xl border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(9,40,92,0.06)] pb-safe transition-all"
      >
        <div className="grid grid-cols-5 h-16 max-w-md mx-auto items-center px-1">
          {/* 1. Home */}
          <Link
            href="/home"
            className={`flex flex-col items-center justify-center py-1 transition-all rounded-xl touch-target ${
              isHome
                ? 'text-[#0866E8] font-bold scale-105'
                : 'text-slate-500 hover:text-[#09285C]'
            }`}
          >
            <Home className="w-5 h-5 mb-0.5" strokeWidth={isHome ? 2.5 : 2} />
            <span className="text-[10px] tracking-tight">Home</span>
          </Link>

          {/* 2. Categories */}
          <Link
            href="/categories"
            className={`flex flex-col items-center justify-center py-1 transition-all rounded-xl touch-target ${
              isCategories
                ? 'text-[#0866E8] font-bold scale-105'
                : 'text-slate-500 hover:text-[#09285C]'
            }`}
          >
            <Grid className="w-5 h-5 mb-0.5" strokeWidth={isCategories ? 2.5 : 2} />
            <span className="text-[10px] tracking-tight">Categories</span>
          </Link>

          {/* 3. Search */}
          <button
            type="button"
            onClick={() => setIsSearchSheetOpen(true)}
            className="flex flex-col items-center justify-center py-1 text-slate-500 hover:text-[#0866E8] transition-all rounded-xl touch-target cursor-pointer"
            aria-label="Open search"
          >
            <Search className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Search</span>
          </button>

          {/* 4. Wishlist */}
          <Link
            href="/account/wishlist"
            className={`flex flex-col items-center justify-center py-1 transition-all rounded-xl relative touch-target ${
              isWishlist
                ? 'text-[#0866E8] font-bold scale-105'
                : 'text-slate-500 hover:text-[#09285C]'
            }`}
          >
            <div className="relative">
              <Heart className="w-5 h-5 mb-0.5" strokeWidth={isWishlist ? 2.5 : 2} />
              {isMounted && wishlistCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                  {wishlistCount > 9 ? '9+' : wishlistCount}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight">Wishlist</span>
          </Link>

          {/* 5. Cart */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className={`flex flex-col items-center justify-center py-1 transition-all rounded-xl relative touch-target cursor-pointer ${
              isCart
                ? 'text-[#0866E8] font-bold scale-105'
                : 'text-slate-500 hover:text-[#09285C]'
            }`}
            aria-label="Open cart drawer"
          >
            <div className="relative">
              <ShoppingCart className="w-5 h-5 mb-0.5" strokeWidth={isCart ? 2.5 : 2} />
              {isMounted && cartItemCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-[#0866E8] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                  {cartItemCount > 99 ? '99+' : cartItemCount}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight">Cart</span>
          </button>
        </div>
      </nav>
    </>
  );
};

