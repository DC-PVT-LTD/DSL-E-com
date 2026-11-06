'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
} from 'lucide-react';
import { Logo } from './Logo';
import { useCartStore } from '@/services/cartStore';
import { useWishlistStore } from '@/services/wishlistStore';
import { useUserStore } from '@/services/userStore';
import { categoryService } from '@/services/categoryService';
import { productService } from '@/services/productService';
import { ProductCategory, Product } from '@/types/product';
import { formatLKR } from '@/lib/currency';

export const Navbar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCatDropdownOpen, setIsCatDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const catDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  const items = useCartStore((state) => state.items);
  const setDrawerOpen = useCartStore((state) => state.setDrawerOpen);
  const currentUser = useUserStore((state) => state.currentUser);
  const logoutCustomer = useUserStore((state) => state.logoutCustomer);

  const cartItemCount = items.reduce((acc, item) => acc + item.quantity, 0);
  const wishlistCount = useWishlistStore((state) => state.itemCount);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMounted(true);
    setCategories(categoryService.getCategories());
    categoryService.fetchCategories();
    useUserStore.getState().fetchCurrentUser();
    useWishlistStore.getState().fetchWishlist();

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

  const isHomeActive = pathname === '/home' || pathname === '/';
  const isFindStationeryActive = pathname === '/find-my-stationery';

  return (
    <header
      className={`sticky top-0 z-40 w-full select-none transition-all duration-200 ${
        isHomeActive
          ? isScrolled
            ? 'bg-[#FFF8ED]/95 backdrop-blur-md shadow-xs border-b border-[#10285D]/10'
            : 'bg-transparent'
          : 'bg-[#FFF8ED] border-b border-[#10285D]/10'
      }`}
    >
      {/* Main Single Navbar Bar */}
      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-12 flex items-center justify-between h-16 sm:h-[68px]">
        {/* Left: Brand Logo & Mobile Menu Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-1.5 -ml-1 text-[#10285D] hover:bg-[#FFEECB] rounded-lg transition-colors"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <Logo href="/home" />
        </div>

        {/* Center: Navigation Links (Desktop) */}
        <nav className="hidden lg:flex items-center gap-4 xl:gap-6 text-sm font-semibold text-[#10285D]">
          {/* 1. Home (active with small yellow underline) */}
          <Link
            href="/home"
            className="relative py-1 group transition-colors hover:text-[#0066CC]"
          >
            <span className={isHomeActive ? 'text-[#10285D] font-bold' : 'text-[#10285D]'}>
              Home
            </span>
            {isHomeActive && (
              <svg
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-7 h-2 overflow-visible pointer-events-none"
                viewBox="0 0 28 6"
                fill="none"
              >
                <path
                  d="M 1 2 Q 14 5.5 27 2"
                  stroke="#FFD84D"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </Link>

          {/* 2. Shop (with category dropdown) */}
          <div
            className="relative py-1"
            ref={catDropdownRef}
            onMouseEnter={() => setIsCatDropdownOpen(true)}
            onMouseLeave={() => setIsCatDropdownOpen(false)}
          >
            <button
              onClick={() => setIsCatDropdownOpen(!isCatDropdownOpen)}
              className="flex items-center gap-1 hover:text-[#0066CC] transition-colors cursor-pointer"
            >
              <span>Shop</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#10285D]" />
            </button>

            {/* Dropdown Menu */}
            {isCatDropdownOpen && (
              <div className="absolute top-full -left-4 mt-2 w-64 bg-[#FFF8ED] rounded-2xl shadow-xl border border-[#FFD84D]/40 p-2 z-50 animate-fade-in text-xs">
                <div className="px-3 py-1.5 text-[10px] font-bold text-[#10285D]/60 uppercase tracking-wider">
                  Product Categories
                </div>
                {categories.length > 0 ? (
                  categories.map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/categories/${cat.slug}`}
                      onClick={() => setIsCatDropdownOpen(false)}
                      className="flex items-center justify-between px-3 py-2 rounded-xl text-[#10285D] hover:bg-white/80 hover:text-[#0066CC] font-medium transition-colors"
                    >
                      <span>{cat.name}</span>
                      <span className="text-[10px] text-[#10285D]/60 bg-[#A9DFFF]/30 px-2 py-0.5 rounded-full font-bold">
                        {cat.itemCount || 12}
                      </span>
                    </Link>
                  ))
                ) : (
                  <>
                    <Link
                      href="/shop"
                      onClick={() => setIsCatDropdownOpen(false)}
                      className="block px-3 py-2 rounded-xl text-[#10285D] hover:bg-white/80 font-medium"
                    >
                      All Stationery Products
                    </Link>
                    <Link
                      href="/school-packs"
                      onClick={() => setIsCatDropdownOpen(false)}
                      className="block px-3 py-2 rounded-xl text-[#10285D] hover:bg-white/80 font-medium"
                    >
                      School Essentials Packs
                    </Link>
                    <Link
                      href="/categories"
                      onClick={() => setIsCatDropdownOpen(false)}
                      className="block px-3 py-2 rounded-xl text-[#10285D] hover:bg-white/80 font-medium"
                    >
                      Art &amp; Craft Materials
                    </Link>
                  </>
                )}
                <div className="border-t border-[#10285D]/10 mt-1 pt-1.5 space-y-1">
                  <Link
                    href="/find-my-stationery"
                    onClick={() => setIsCatDropdownOpen(false)}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-[#10285D] hover:text-[#0066CC]"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#FFB800]" />
                    <span>Find My Stationery Quiz →</span>
                  </Link>
                  <Link
                    href="/upload-list"
                    onClick={() => setIsCatDropdownOpen(false)}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-[#10285D] hover:text-[#0066CC]"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#0066CC]" />
                    <span>Upload Your Booklist →</span>
                  </Link>
                  <Link
                    href="/shop"
                    onClick={() => setIsCatDropdownOpen(false)}
                    className="block px-3 py-1.5 text-xs font-bold text-[#10285D] hover:text-[#0066CC]"
                  >
                    View All Products →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* 3. School Essentials */}
          <Link
            href="/school-packs"
            className="py-1 hover:text-[#0066CC] transition-colors"
          >
            School Essentials
          </Link>

          {/* 4. Art & Craft */}
          <Link
            href="/categories/art-craft-materials"
            className="py-1 hover:text-[#0066CC] transition-colors"
          >
            Art &amp; Craft
          </Link>

          {/* 5. Find My Stationery */}
          <Link
            href="/find-my-stationery"
            className={
              isFindStationeryActive
                ? 'px-3 py-1 bg-[#FFE79A] text-[#17234B] rounded-full font-extrabold flex items-center gap-1.5 shadow-xs transition-all'
                : 'py-1 flex items-center gap-1.5 hover:text-[#0066CC] transition-colors'
            }
          >
            <Sparkles className="w-3.5 h-3.5 text-[#FFB800]" />
            <span>Find My Stationery</span>
          </Link>

          {/* 6. Upload Your List */}
          <Link
            href="/upload-list"
            className="py-1 flex items-center gap-1.5 hover:text-[#0066CC] transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-[#0066CC]" />
            <span>Upload List</span>
          </Link>

          {/* 7. Offers (soft pastel-pink pill with decorative flower icon) */}
          <Link
            href="/offers"
            className="inline-flex items-center gap-1.5 bg-[#FF6B91] hover:bg-[#ff5580] text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-xs hover:shadow transition-all duration-150 hover:scale-105"
          >
            <span>Offers</span>
            {/* Small decorative flower icon */}
            <svg
              className="w-3.5 h-3.5 text-white fill-white"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <circle cx="12" cy="7" r="3" />
              <circle cx="17" cy="10" r="3" />
              <circle cx="16" cy="16" r="3" />
              <circle cx="8" cy="16" r="3" />
              <circle cx="7" cy="10" r="3" />
              <circle cx="12" cy="12" r="2.5" fill="#FFD84D" />
            </svg>
          </Link>

          {/* 8. About Us */}
          <Link
            href="/about"
            className="py-1 hover:text-[#0066CC] transition-colors"
          >
            About Us
          </Link>
        </nav>

        {/* Right: Search, Account, Wishlist, Cart */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Search Trigger & Popover */}
          <div className="relative" ref={searchRef}>
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="p-2 text-[#10285D] hover:bg-[#FFEECB] rounded-full transition-colors"
              aria-label="Search Stationery"
              title="Search"
            >
              <Search className="w-5 h-5 stroke-[2.2]" />
            </button>

            {isSearchOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-[#FFD84D]/40 p-3 z-50 animate-fade-in">
                <form onSubmit={handleSearchSubmit} className="relative">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Search pens, notebooks, school packs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-16 py-2 text-xs rounded-full border border-[#10285D]/20 focus:outline-none focus:ring-2 focus:ring-[#10285D] bg-[#FFF8ED]"
                  />
                  <Search className="w-4 h-4 text-[#10285D] absolute left-3 top-1/2 -translate-y-1/2" />
                  <button
                    type="submit"
                    className="absolute right-1 top-1/2 -translate-y-1/2 bg-[#10285D] text-white text-[10px] font-bold px-2.5 py-1 rounded-full hover:bg-[#0066CC] transition-colors"
                  >
                    Go
                  </button>
                </form>

                {suggestions.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-[#10285D]/10 space-y-1">
                    {suggestions.map((p) => (
                      <Link
                        key={p.id}
                        href={`/products/${p.slug}`}
                        onClick={() => setIsSearchOpen(false)}
                        className="flex items-center justify-between p-1.5 hover:bg-[#FFF8ED] rounded-xl text-xs text-[#10285D]"
                      >
                        <span className="truncate max-w-[160px] font-medium">{p.name}</span>
                        <span className="font-bold text-[#0066CC] text-[11px] shrink-0">
                          {formatLKR(p.priceCents)}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Account Icon */}
          <div className="relative" ref={userDropdownRef}>
            <button
              onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
              className="p-2 text-[#10285D] hover:bg-[#FFEECB] rounded-full transition-colors"
              aria-label="User Account"
              title="Account"
            >
              <User className="w-5 h-5 stroke-[2.2]" />
            </button>

            {isUserDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-[#FFD84D]/40 py-2 z-50 animate-fade-in text-xs">
                {currentUser ? (
                  <>
                    <div className="px-4 py-2 border-b border-[#10285D]/10">
                      <div className="font-bold text-[#10285D] truncate">{currentUser.name}</div>
                      <div className="text-[11px] text-[#10285D]/60 truncate">{currentUser.email}</div>
                    </div>
                    <Link
                      href="/account"
                      onClick={() => setIsUserDropdownOpen(false)}
                      className="block px-4 py-2 text-[#10285D] hover:bg-[#FFF8ED]"
                    >
                      Account Dashboard
                    </Link>
                    <Link
                      href="/account/orders"
                      onClick={() => setIsUserDropdownOpen(false)}
                      className="block px-4 py-2 text-[#10285D] hover:bg-[#FFF8ED]"
                    >
                      My Orders
                    </Link>
                    <Link
                      href="/saved-lists"
                      onClick={() => setIsUserDropdownOpen(false)}
                      className="block px-4 py-2 text-[#10285D] hover:bg-[#FFF8ED]"
                    >
                      Saved Stationery Lists
                    </Link>
                    <div className="border-t border-[#10285D]/10 my-1" />
                    <button
                      onClick={() => {
                        logoutCustomer();
                        setIsUserDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-[#FF6B91] hover:bg-rose-50 font-semibold"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <div className="px-4 py-2 text-[#10285D]/70 border-b border-[#10285D]/10">
                      Welcome to DSL Stationery!
                    </div>
                    <Link
                      href="/login"
                      onClick={() => setIsUserDropdownOpen(false)}
                      className="block px-4 py-2 text-[#10285D] hover:bg-[#FFF8ED] font-semibold"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => setIsUserDropdownOpen(false)}
                      className="block px-4 py-2 text-[#0066CC] hover:bg-[#FFF8ED] font-bold"
                    >
                      Create Account
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Wishlist Icon */}
          <Link
            href="/wishlist"
            className="relative p-2 text-[#10285D] hover:bg-[#FFEECB] rounded-full transition-colors"
            aria-label="Wishlist"
            title="Wishlist"
          >
            <Heart className="w-5 h-5 stroke-[2.2]" />
            {isMounted && wishlistCount > 0 && (
              <span className="absolute top-1 right-1 bg-[#FF6B91] text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                {wishlistCount}
              </span>
            )}
          </Link>

          {/* Shopping Cart Trigger with Yellow Badge */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="relative p-2 text-[#10285D] hover:bg-[#FFEECB] rounded-full transition-colors cursor-pointer"
            aria-label="Shopping Cart"
            title="Shopping Cart"
          >
            <ShoppingCart className="w-5 h-5 stroke-[2.2]" />
            {isMounted && (
              <span className="absolute -top-0.5 -right-0.5 bg-[#FFD84D] text-[#10285D] font-extrabold text-[10px] w-4 h-4 rounded-full flex items-center justify-center shadow-xs ring-1 ring-white">
                {cartItemCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Irregular Torn-Paper Bottom Edge */}
      <div className="w-full overflow-hidden leading-none pointer-events-none select-none">
        <img
          src="/images/hero/natural_torn_edge.svg"
          alt=""
          aria-hidden="true"
          className="w-full h-3 sm:h-4 md:h-5 object-cover object-top block"
        />
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-[#FFF8ED] border-b border-[#FFD84D]/40 px-6 py-5 space-y-4 shadow-xl animate-fade-in text-sm font-semibold text-[#10285D]">
          <Link
            href="/home"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 border-b border-[#10285D]/10"
          >
            Home
          </Link>
          <Link
            href="/shop"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 border-b border-[#10285D]/10"
          >
            Shop
          </Link>
          <Link
            href="/school-packs"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 border-b border-[#10285D]/10"
          >
            School Essentials
          </Link>
          <Link
            href="/categories/art-craft-materials"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 border-b border-[#10285D]/10"
          >
            Art &amp; Craft
          </Link>
          <Link
            href="/find-my-stationery"
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex items-center gap-2 py-2 border-b border-[#10285D]/10"
          >
            <Sparkles className="w-4 h-4 text-[#FFB800]" />
            <span>Find My Stationery</span>
          </Link>
          <Link
            href="/upload-list"
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex items-center gap-2 py-2 border-b border-[#10285D]/10"
          >
            <Upload className="w-4 h-4 text-[#0066CC]" />
            <span>Upload Your List</span>
          </Link>
          <Link
            href="/offers"
            onClick={() => setIsMobileMenuOpen(false)}
            className="inline-flex items-center gap-1.5 bg-[#FF6B91] text-white text-xs font-bold px-3 py-1.5 rounded-full"
          >
            <span>Offers</span>
            <span>🌸</span>
          </Link>
          <Link
            href="/about"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block py-2 border-t border-[#10285D]/10"
          >
            About Us
          </Link>
        </div>
      )}
    </header>
  );
};
