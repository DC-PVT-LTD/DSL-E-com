'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  ShoppingCart,
  Heart,
  User,
  Menu,
  X,
  ChevronDown,
  Sparkles,
  Upload,
  ArrowRight,
  Sparkle,
} from 'lucide-react';
import { Logo } from './Logo';
import { useCartStore } from '@/services/cartStore';
import { useUserStore } from '@/services/userStore';
import { categoryService } from '@/services/categoryService';
import { productService } from '@/services/productService';
import { ProductCategory, Product } from '@/types/product';
import { formatLKR } from '@/lib/currency';

export const Navbar: React.FC = () => {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCatDropdownOpen, setIsCatDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const catDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  const items = useCartStore((state) => state.items);
  const setDrawerOpen = useCartStore((state) => state.setDrawerOpen);
  const currentUser = useUserStore((state) => state.currentUser);
  const logoutCustomer = useUserStore((state) => state.logoutCustomer);

  const cartItemCount = items.reduce((acc, item) => acc + item.quantity, 0);
  const wishlistCount = currentUser?.wishlistProductIds.length || 0;

  useEffect(() => {
    setIsMounted(true);
    setCategories(categoryService.getCategories());
    categoryService.fetchCategories();

    const unsubCat = categoryService.subscribe(() => {
      setCategories(categoryService.getCategories());
    });

    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
      if (catDropdownRef.current && !catDropdownRef.current.contains(e.target as Node)) {
        setIsCatDropdownOpen(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      unsubCat();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Update suggestions when typing in search
  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      const results = productService.getFilteredAndSorted({ query: searchQuery }, 'newest', 1, 5);
      setSuggestions(results.items);
    } else {
      setSuggestions([]);
    }
  }, [searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setIsSearchOpen(false);
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#FFFDF0]/95 backdrop-blur-md border-b border-[#C6E7FF]/50 transition-all">
      {/* Main Header Container */}
      <div className="w-full px-4 sm:px-8 lg:px-12 xl:px-16">
        <div className="flex items-center justify-between h-20 gap-4">
          {/* Left: Mobile Menu Trigger & Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 text-[#292525] hover:bg-[#C6E7FF]/30 rounded-full transition-colors"
              aria-label="Toggle navigation drawer"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Logo />
          </div>

          {/* Desktop Search Bar (Expandable or Inline) */}
          <div className="hidden md:flex flex-1 max-w-md mx-4 relative" ref={searchRef}>
            <form onSubmit={handleSearchSubmit} className="w-full relative">
              <input
                type="text"
                placeholder="Search pastel pens, planners, notebooks, school packs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchOpen(true)}
                className="w-full pl-10 pr-20 py-2 rounded-full bg-white border border-[#C6E7FF] text-[#292525] placeholder:text-[#292525]/40 focus:outline-none focus:ring-2 focus:ring-[#0066CC] text-xs transition-all shadow-xs"
              />
              <Search className="w-4 h-4 text-[#0066CC] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <button
                type="submit"
                className="absolute right-1 top-1/2 -translate-y-1/2 bg-[#0066CC] hover:bg-[#0052a3] text-white text-[11px] font-bold px-3 py-1 rounded-full transition-colors shadow-xs"
              >
                Search
              </button>
            </form>

            {/* Suggestions flyout */}
            {isSearchOpen && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-[#C6E7FF]/80 p-2 z-50 animate-fade-in">
                <div className="text-[10px] font-bold text-[#0066CC] uppercase tracking-wider px-3 py-1">
                  Suggested Stationery
                </div>
                {suggestions.map((p) => (
                  <Link
                    key={p.id}
                    href={`/products/${p.slug}`}
                    onClick={() => setIsSearchOpen(false)}
                    className="flex items-center justify-between p-2 hover:bg-[#FFFDF0] rounded-xl transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#EBD5FA]/40 flex items-center justify-center text-[#292525] font-bold text-xs shrink-0">
                        {p.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-[#292525] group-hover:text-[#0066CC] line-clamp-1">
                          {p.name}
                        </div>
                        <div className="text-[10px] text-[#292525]/50">{p.brandName} • {p.categoryName}</div>
                      </div>
                    </div>
                    <div className="text-xs font-bold text-[#0066CC] shrink-0 ml-2">
                      {formatLKR(p.priceCents)}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Right Action Icons: Search (mobile), Account, Wishlist, Cart */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Quick Find My Stationery Link */}
            <Link
              href="/find-my-stationery"
              className="hidden xl:inline-flex items-center gap-1.5 bg-[#FFF4C7] hover:bg-[#ffeaa7] text-[#292525] text-xs font-bold px-3 py-1.5 rounded-full border border-[#FFD84D] transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#0066CC]" />
              <span>Find My Stationery</span>
            </Link>

            {/* Upload List */}
            <Link
              href="/upload-list"
              className="hidden xl:inline-flex items-center gap-1.5 bg-[#B9D5FF]/30 hover:bg-[#B9D5FF]/50 text-[#292525] text-xs font-bold px-3 py-1.5 rounded-full border border-[#B9D5FF] transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-[#2563eb]" />
              <span>Upload List</span>
            </Link>

            {/* Account Icon Dropdown */}
            <div className="relative" ref={userDropdownRef}>
              <button
                onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                className="p-2 sm:p-2.5 rounded-full hover:bg-[#C6E7FF]/30 text-[#292525] transition-colors"
                aria-label="User Account"
                title="Account"
              >
                <User className="w-5 h-5 text-[#292525]" />
              </button>

              {isUserDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-[#C6E7FF]/80 py-2 z-50 animate-fade-in text-xs">
                  {currentUser ? (
                    <>
                      <div className="px-4 py-2 border-b border-[#C6E7FF]/30">
                        <div className="font-bold text-[#292525] truncate">{currentUser.name}</div>
                        <div className="text-[11px] text-[#292525]/60 truncate">{currentUser.email}</div>
                      </div>
                      <Link
                        href="/account"
                        onClick={() => setIsUserDropdownOpen(false)}
                        className="block px-4 py-2 text-[#292525] hover:bg-[#FFFDF0]"
                      >
                        Account Dashboard
                      </Link>
                      <Link
                        href="/account/orders"
                        onClick={() => setIsUserDropdownOpen(false)}
                        className="block px-4 py-2 text-[#292525] hover:bg-[#FFFDF0]"
                      >
                        My Orders
                      </Link>
                      <div className="border-t border-[#C6E7FF]/30 my-1" />
                      <button
                        onClick={() => {
                          logoutCustomer();
                          setIsUserDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-[#0066CC] hover:bg-rose-50 font-semibold"
                      >
                        Sign Out
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="px-4 py-2 text-[#292525]/70 border-b border-[#C6E7FF]/30">
                        Welcome to DSL Stationery!
                      </div>
                      <Link
                        href="/login"
                        onClick={() => setIsUserDropdownOpen(false)}
                        className="block px-4 py-2 text-[#292525] hover:bg-[#FFFDF0] font-semibold"
                      >
                        Sign In
                      </Link>
                      <Link
                        href="/register"
                        onClick={() => setIsUserDropdownOpen(false)}
                        className="block px-4 py-2 text-[#0066CC] hover:bg-[#FFFDF0] font-bold"
                      >
                        Create Account
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Wishlist Heart with Pink Counter */}
            <Link
              href="/account/wishlist"
              className="relative p-2 sm:p-2.5 rounded-full hover:bg-[#C6E7FF]/30 text-[#292525] transition-colors"
              aria-label="My Wishlist"
              title="My Wishlist"
            >
              <Heart className="w-5 h-5 text-[#292525]" />
              {isMounted && wishlistCount > 0 && (
                <span className="absolute top-1 right-1 bg-[#0066CC] text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                  {wishlistCount}
                </span>
              )}
            </Link>

            {/* Shopping Cart Drawer Trigger */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="relative p-2 sm:p-2.5 rounded-full hover:bg-[#C6E7FF]/30 text-[#292525] transition-colors"
              aria-label="Shopping Cart"
              title="Shopping Cart"
            >
              <ShoppingCart className="w-5 h-5 text-[#292525]" />
              {isMounted && cartItemCount > 0 && (
                <span className="absolute top-1 right-1 bg-[#0066CC] text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                  {cartItemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Navigation Horizontal Menu (Section 4 requirements) */}
      <nav className="hidden lg:block bg-[#FFFDF0] border-t border-[#C6E7FF]/40 text-xs text-[#292525] font-semibold">
        <div className="w-full px-4 sm:px-8 lg:px-12 xl:px-16 flex items-center justify-between py-2">
          <div className="flex items-center gap-1 xl:gap-2">
            <Link href="/home" className="px-3 py-1.5 rounded-full hover:bg-[#C6E7FF]/30 text-[#292525] hover:text-[#0066CC] transition-colors">
              Home
            </Link>

            <Link href="/shop" className="px-3 py-1.5 rounded-full hover:bg-[#C6E7FF]/30 text-[#292525] hover:text-[#0066CC] transition-colors">
              Shop All
            </Link>

            {/* Categories Dropdown */}
            <div className="relative" ref={catDropdownRef}>
              <button
                onClick={() => setIsCatDropdownOpen(!isCatDropdownOpen)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full hover:bg-[#C6E7FF]/30 text-[#292525] hover:text-[#0066CC] transition-colors"
              >
                <span>Categories</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#0066CC]" />
              </button>

              {isCatDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-2xl shadow-xl border border-[#C6E7FF] py-2 z-50 animate-fade-in">
                  <div className="px-3 py-1 text-[10px] font-bold text-[#0066CC] uppercase tracking-wider">
                    Stationery Collections
                  </div>
                  {categories.map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/categories/${cat.slug}`}
                      onClick={() => setIsCatDropdownOpen(false)}
                      className="flex items-center justify-between px-3.5 py-2 text-xs text-[#292525] hover:bg-[#FFFDF0] hover:text-[#0066CC] font-medium transition-colors"
                    >
                      <span>{cat.name}</span>
                      <span className="text-[10px] text-[#292525]/60 bg-[#C6E7FF]/30 px-1.5 py-0.2 rounded-full">
                        {cat.itemCount || 20}
                      </span>
                    </Link>
                  ))}
                  <div className="border-t border-[#C6E7FF]/30 mt-1 pt-1">
                    <Link
                      href="/categories"
                      onClick={() => setIsCatDropdownOpen(false)}
                      className="block px-3.5 py-1.5 text-xs font-bold text-[#0066CC] hover:underline"
                    >
                      View All Categories →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <Link href="/categories/school-stationery" className="px-3 py-1.5 rounded-full hover:bg-[#C6E7FF]/30 text-[#292525] hover:text-[#0066CC] transition-colors">
              School Supplies
            </Link>

            <Link href="/categories/office-desktop-supplies" className="px-3 py-1.5 rounded-full hover:bg-[#C6E7FF]/30 text-[#292525] hover:text-[#0066CC] transition-colors">
              Office Supplies
            </Link>

            <Link href="/categories/art-craft-materials" className="px-3 py-1.5 rounded-full hover:bg-[#C6E7FF]/30 text-[#292525] hover:text-[#0066CC] transition-colors">
              Art and Craft
            </Link>

            <Link href="/shop?filter=best-sellers" className="px-3 py-1.5 rounded-full hover:bg-[#C6E7FF]/30 text-[#292525] hover:text-[#0066CC] transition-colors">
              Bestsellers
            </Link>

            <Link href="/offers" className="px-3 py-1.5 rounded-full bg-[#EBD5FA]/50 hover:bg-[#EBD5FA] text-[#292525] font-bold transition-colors">
              Offers 🌸
            </Link>

            <Link href="/about" className="px-3 py-1.5 rounded-full hover:bg-[#C6E7FF]/30 text-[#292525] hover:text-[#0066CC] transition-colors">
              About Us
            </Link>

            <Link href="/contact" className="px-3 py-1.5 rounded-full hover:bg-[#C6E7FF]/30 text-[#292525] hover:text-[#0066CC] transition-colors">
              Contact
            </Link>
          </div>

          <div className="flex items-center gap-3 text-xs text-[#292525]/70">
            <span className="hidden xl:inline text-[#0066CC] font-bold">✨ Curated for Refined Living</span>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-[#FFFDF0] border-t border-[#C6E7FF]/60 px-5 py-5 space-y-4 shadow-xl animate-fade-in">
          {/* Mobile Search */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              placeholder="Search stationery..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-full bg-white border border-[#C6E7FF] text-xs text-[#292525]"
            />
            <Search className="w-4 h-4 text-[#0066CC] absolute left-3 top-1/2 -translate-y-1/2" />
          </form>

          {/* Nav Links */}
          <div className="flex flex-col space-y-2 text-sm font-semibold text-[#292525] pt-2">
            <Link href="/home" onClick={() => setIsMobileMenuOpen(false)} className="py-1.5 hover:text-[#0066CC]">
              Home
            </Link>
            <Link href="/shop" onClick={() => setIsMobileMenuOpen(false)} className="py-1.5 hover:text-[#0066CC]">
              Shop All
            </Link>
            <Link href="/categories" onClick={() => setIsMobileMenuOpen(false)} className="py-1.5 hover:text-[#0066CC]">
              Categories
            </Link>
            <Link href="/categories/school-stationery" onClick={() => setIsMobileMenuOpen(false)} className="py-1.5 hover:text-[#0066CC]">
              School Supplies
            </Link>
            <Link href="/categories/office-desktop-supplies" onClick={() => setIsMobileMenuOpen(false)} className="py-1.5 hover:text-[#0066CC]">
              Office Supplies
            </Link>
            <Link href="/categories/art-craft-materials" onClick={() => setIsMobileMenuOpen(false)} className="py-1.5 hover:text-[#0066CC]">
              Art and Craft
            </Link>
            <Link href="/shop?filter=best-sellers" onClick={() => setIsMobileMenuOpen(false)} className="py-1.5 hover:text-[#0066CC]">
              Bestsellers
            </Link>
            <Link href="/offers" onClick={() => setIsMobileMenuOpen(false)} className="py-1.5 text-[#0066CC] font-bold">
              Special Offers 🌸
            </Link>
            <Link href="/find-my-stationery" onClick={() => setIsMobileMenuOpen(false)} className="py-1.5 hover:text-[#0066CC]">
              Find My Stationery
            </Link>
            <Link href="/upload-list" onClick={() => setIsMobileMenuOpen(false)} className="py-1.5 hover:text-[#0066CC]">
              Upload Your List
            </Link>
            <Link href="/about" onClick={() => setIsMobileMenuOpen(false)} className="py-1.5 hover:text-[#0066CC]">
              About Us
            </Link>
            <Link href="/contact" onClick={() => setIsMobileMenuOpen(false)} className="py-1.5 hover:text-[#0066CC]">
              Contact
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

