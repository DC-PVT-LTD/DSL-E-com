'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Search,
  ShoppingCart,
  User,
  Heart,
  Menu,
  X,
  ChevronDown,
  ArrowRight,
  LogOut,
  Layers,
  Sparkles,
  Package,
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
    setIsMounted(true);
    setCategories(categoryService.getCategories());

    categoryService
      .fetchCategories()
      .then((cats) => setCategories(cats))
      .catch((err) => console.warn('Failed to fetch categories:', err));

    const unsubCat = categoryService.subscribe(() => {
      setCategories(categoryService.getCategories());
    });

    useUserStore.getState().fetchCurrentUser();

    return () => {
      unsubCat();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
      if (catDropdownRef.current && !catDropdownRef.current.contains(event.target as Node)) {
        setIsCatDropdownOpen(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setIsCatDropdownOpen(false);
        setIsUserDropdownOpen(false);
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setIsSearchOpen(false);
      setIsMobileMenuOpen(false);
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const isHomeActive = pathname === '/' || pathname === '/home';
  const isShopActive = pathname.startsWith('/shop') || pathname.startsWith('/categories');
  const isFindStationeryActive = pathname.startsWith('/find-my-stationery');
  const isSchoolPackActive = pathname.startsWith('/school-packs');
  const isBulkOrderActive = pathname.startsWith('/bulk-order');
  const isBrandsActive = pathname.startsWith('/brands');
  const isAboutActive = pathname.startsWith('/about');
  const isFaqActive = pathname.startsWith('/faq');
  const isWishlistActive = pathname.startsWith('/account/wishlist') || pathname === '/wishlist';

  const navItemClass = (isActive: boolean) =>
    `px-3.5 xl:px-4 py-1.5 rounded-full font-bold text-xs xl:text-sm transition-all duration-200 whitespace-nowrap ${
      isActive
        ? 'bg-[#09285C] text-white shadow-xs'
        : 'text-[#09285C] hover:text-[#0866E8] hover:bg-[#EAF4FF]/50'
    }`;

  return (
    <header className="sticky top-0 z-50 w-full select-none">
      {/* Subtle top brand accent line */}
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#09285C] via-[#0866E8] to-[#FFD84D] pointer-events-none z-20" />

      {/* Main Navbar Card with restrained glass styling */}
      <div className="relative z-10 w-full bg-white/95 backdrop-blur-md rounded-b-2xl sm:rounded-b-3xl shadow-[0_4px_20px_rgba(9,40,92,0.06)] border-b border-slate-100">
        <div className="w-full max-w-[1720px] mx-auto px-3.5 sm:px-6 lg:px-12 xl:px-16 py-2.5 sm:py-3.5 flex items-center justify-between gap-3 sm:gap-4">
          
          {/* LEFT: DSL ENTERPRISES BRAND LOGO */}
          <div className="shrink-0 flex items-center">
            <Logo href="/home" />
          </div>

          {/* CENTER: DESKTOP NAVIGATION LINKS */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-2 text-sm font-semibold">
            {/* 1. Home */}
            <Link href="/home" className={navItemClass(isHomeActive)}>
              Home
            </Link>

            {/* 2. Shop Dropdown */}
            <div
              className="relative"
              ref={catDropdownRef}
              onMouseEnter={() => setIsCatDropdownOpen(true)}
              onMouseLeave={() => setIsCatDropdownOpen(false)}
            >
              <Link
                href="/shop"
                className={`inline-flex items-center gap-1.5 ${navItemClass(isShopActive)}`}
              >
                <span>Shop</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isShopActive ? 'text-white' : 'text-[#09285C]/70'
                  } ${isCatDropdownOpen ? 'rotate-180' : ''}`}
                />
              </Link>

              {/* Dropdown Menu */}
              {isCatDropdownOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2.5 z-50 animate-fade-in text-xs text-[#09285C]">
                  <div className="px-3 py-2 text-[11px] font-bold text-[#09285C]/60 uppercase tracking-wider border-b border-slate-100">
                    Product Categories
                  </div>
                  <div className="py-1">
                    <Link
                      href="/shop"
                      onClick={() => setIsCatDropdownOpen(false)}
                      className="flex items-center justify-between px-3 py-2 rounded-xl text-[#09285C] hover:bg-[#F7FAFF] hover:text-[#0866E8] transition-colors font-medium"
                    >
                      <span>All Products</span>
                      <ArrowRight className="w-3 h-3 opacity-60" />
                    </Link>
                    {categories.map((cat) => (
                      <Link
                        key={cat.id}
                        href={`/categories/${cat.slug}`}
                        onClick={() => setIsCatDropdownOpen(false)}
                        className="flex items-center justify-between px-3 py-2 rounded-xl text-[#09285C] hover:bg-[#F7FAFF] hover:text-[#0866E8] transition-colors font-medium"
                      >
                        <span>{cat.name}</span>
                      </Link>
                    ))}
                    <div className="mt-1 pt-1 border-t border-slate-100">
                      <Link
                        href="/school-packs"
                        onClick={() => setIsCatDropdownOpen(false)}
                        className="flex items-center justify-between px-3 py-2 rounded-xl text-[#0866E8] font-bold hover:bg-[#EAF4FF] transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5" />
                          <span>School Stationery Packs</span>
                        </span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Find My Stationery (Bearista Finder) */}
            <Link
              href="/find-my-stationery"
              className={`inline-flex items-center gap-1.5 ${navItemClass(isFindStationeryActive)}`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#FFD84D]" />
              <span>Find My Stationery</span>
            </Link>

            {/* 4. School Packs */}
            <Link href="/school-packs" className={navItemClass(isSchoolPackActive)}>
              School Packs
            </Link>

            {/* 5. Bulk Order */}
            <Link href="/bulk-order" className={navItemClass(isBulkOrderActive)}>
              Bulk Order
            </Link>

            {/* 6. Brands */}
            <Link href="/brands" className={navItemClass(isBrandsActive)}>
              Brands
            </Link>

            {/* 7. About Us */}
            <Link href="/about" className={navItemClass(isAboutActive)}>
              About Us
            </Link>

            {/* 8. FAQ */}
            <Link href="/faq" className={navItemClass(isFaqActive)}>
              FAQ
            </Link>
          </nav>

          {/* RIGHT: SEARCH, USER/ACCOUNT, WISHLIST, DIVIDER & CART */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Desktop Search Button & Popover */}
            <div className="relative" ref={searchRef}>
              <button
                type="button"
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className="p-2 rounded-full text-[#09285C] hover:text-[#0866E8] hover:bg-[#EAF4FF] transition-colors cursor-pointer touch-target flex items-center justify-center"
                aria-label="Search products"
                title="Search products"
              >
                <Search className="w-5 h-5" />
              </button>

              {/* Quick Search Popover */}
              {isSearchOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 z-50 animate-fade-in text-[#09285C]">
                  <form onSubmit={handleSearchSubmit} className="relative">
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search stationery, pens, books..."
                      autoFocus
                      className="w-full bg-[#F7FAFF] border border-slate-200 rounded-full pl-10 pr-4 py-2.5 text-xs text-[#09285C] placeholder-slate-400 focus:outline-hidden focus:border-[#0866E8] focus:bg-white transition-colors"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  </form>

                  {/* Suggestions */}
                  {suggestions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-1">
                        Quick Matches
                      </span>
                      {suggestions.map((item) => (
                        <Link
                          key={item.id}
                          href={`/products/${item.slug}`}
                          onClick={() => setIsSearchOpen(false)}
                          className="flex items-center justify-between p-2 rounded-xl hover:bg-[#F7FAFF] text-xs text-[#09285C] transition-colors"
                        >
                          <div className="truncate font-medium">{item.name}</div>
                          <span className="text-[11px] font-bold text-[#0866E8] shrink-0 ml-2">
                            {formatLKR(item.priceCents)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Wishlist Link (Desktop) */}
            <Link
              href="/account/wishlist"
              className="relative p-2 rounded-full text-[#09285C] hover:text-[#0866E8] hover:bg-[#EAF4FF] transition-colors hidden sm:flex items-center justify-center touch-target"
              aria-label={`Wishlist with ${wishlistCount} items`}
              title="My Wishlist"
            >
              <Heart className="w-5 h-5" />
              {isMounted && wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                  {wishlistCount}
                </span>
              )}
            </Link>

            {/* Account Icon & Dropdown */}
            <div className="relative" ref={userDropdownRef}>
              <button
                type="button"
                onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                className="p-2 rounded-full text-[#09285C] hover:text-[#0866E8] hover:bg-[#EAF4FF] transition-colors cursor-pointer touch-target flex items-center justify-center"
                aria-label="User account"
                title={currentUser ? currentUser.name : 'Account'}
              >
                <User className="w-5 h-5" />
              </button>

              {isUserDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 animate-fade-in text-xs text-[#09285C]">
                  {currentUser ? (
                    <>
                      <div className="px-3 py-2 border-b border-slate-100">
                        <p className="font-bold text-[#09285C] truncate">{currentUser.name}</p>
                        <p className="text-[11px] text-slate-400 truncate">{currentUser.email}</p>
                      </div>
                      <div className="py-1">
                        <Link
                          href="/account"
                          onClick={() => setIsUserDropdownOpen(false)}
                          className="block px-3 py-2 rounded-xl text-[#09285C] hover:bg-[#F7FAFF] font-medium"
                        >
                          My Profile &amp; Addresses
                        </Link>
                        <Link
                          href="/account/orders"
                          onClick={() => setIsUserDropdownOpen(false)}
                          className="block px-3 py-2 rounded-xl text-[#09285C] hover:bg-[#F7FAFF] font-medium"
                        >
                          Order History
                        </Link>
                        <Link
                          href="/account/wishlist"
                          onClick={() => setIsUserDropdownOpen(false)}
                          className="flex items-center justify-between px-3 py-2 rounded-xl text-[#09285C] hover:bg-[#F7FAFF] font-medium"
                        >
                          <span>Wishlist</span>
                          {wishlistCount > 0 && (
                            <span className="text-[10px] font-bold bg-[#EAF4FF] text-[#0866E8] px-2 py-0.5 rounded-full">
                              {wishlistCount}
                            </span>
                          )}
                        </Link>
                      </div>
                      <div className="pt-1 border-t border-slate-100">
                        <button
                          onClick={async () => {
                            setIsUserDropdownOpen(false);
                            await logoutCustomer();
                            router.push('/home');
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-medium text-left"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="py-1">
                      <Link
                        href="/login"
                        onClick={() => setIsUserDropdownOpen(false)}
                        className="block px-3 py-2 rounded-xl font-bold text-[#0866E8] hover:bg-[#EAF4FF]"
                      >
                        Sign In
                      </Link>
                      <Link
                        href="/register"
                        onClick={() => setIsUserDropdownOpen(false)}
                        className="block px-3 py-2 rounded-xl text-[#09285C] hover:bg-[#F7FAFF] font-medium"
                      >
                        Create Account
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Shopping Cart Button */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="relative p-2 rounded-full text-[#09285C] hover:text-[#0866E8] hover:bg-[#EAF4FF] transition-colors cursor-pointer touch-target flex items-center justify-center"
              aria-label={`Cart with ${isMounted ? cartItemCount : 0} items`}
              title="Shopping Cart"
            >
              <ShoppingCart className="w-5 h-5" />
              {isMounted && cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#0866E8] text-white text-[10px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center shadow-xs">
                  {cartItemCount > 99 ? '99+' : cartItemCount}
                </span>
              )}
            </button>

            {/* Mobile Menu Toggle Button */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-[#09285C] hover:bg-[#EAF4FF] transition-colors ml-0.5 touch-target flex items-center justify-center"
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE NAVIGATION DRAWER */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-white/98 backdrop-blur-md border-b border-slate-100 px-5 py-5 space-y-4 animate-fade-in shadow-2xl text-[#09285C] max-h-[calc(100vh-64px)] overflow-y-auto">
          {/* Search Input in Mobile Drawer */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search stationery supplies..."
              className="w-full bg-[#F7FAFF] border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-base text-[#09285C] placeholder-slate-400 focus:outline-hidden focus:border-[#0866E8]"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          </form>

          {/* Quick Mascot Banner in Mobile Drawer */}
          <Link
            href="/find-my-stationery"
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-[#09285C] to-[#0866E8] text-white shadow-md active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-[#FFD84D]" />
              </div>
              <div>
                <div className="text-xs font-black">Find My Stationery</div>
                <div className="text-[11px] text-white/80">Find stationery curated for your grade</div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-white/80 shrink-0" />
          </Link>

          {/* Navigation Links */}
          <div className="flex flex-col space-y-1 pt-1">
            <Link
              href="/home"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
                isHomeActive ? 'bg-[#09285C] text-white' : 'text-[#09285C] hover:bg-[#F7FAFF]'
              }`}
            >
              Home
            </Link>
            <Link
              href="/shop"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`px-4 py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-between ${
                isShopActive ? 'bg-[#09285C] text-white' : 'text-[#09285C] hover:bg-[#F7FAFF]'
              }`}
            >
              <span>Shop All Products</span>
              <ArrowRight className={`w-4 h-4 ${isShopActive ? 'text-white' : 'text-slate-400'}`} />
            </Link>
            <Link
              href="/school-packs"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
                isSchoolPackActive ? 'bg-[#09285C] text-white' : 'text-[#09285C] hover:bg-[#F7FAFF]'
              }`}
            >
              School Packs
            </Link>
            <Link
              href="/bulk-order"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
                isBulkOrderActive ? 'bg-[#09285C] text-white' : 'text-[#09285C] hover:bg-[#F7FAFF]'
              }`}
            >
              Bulk Order
            </Link>
            <Link
              href="/brands"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
                isBrandsActive ? 'bg-[#09285C] text-white' : 'text-[#09285C] hover:bg-[#F7FAFF]'
              }`}
            >
              Authorised Brands
            </Link>
            <Link
              href="/about"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
                isAboutActive ? 'bg-[#09285C] text-white' : 'text-[#09285C] hover:bg-[#F7FAFF]'
              }`}
            >
              About DSL Enterprises
            </Link>
            <Link
              href="/faq"
              onClick={() => setIsMobileMenuOpen(false)}
              className={`px-4 py-3 rounded-xl text-sm font-bold transition-colors ${
                isFaqActive ? 'bg-[#09285C] text-white' : 'text-[#09285C] hover:bg-[#F7FAFF]'
              }`}
            >
              FAQ &amp; Help
            </Link>
            <Link
              href="/contact"
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-4 py-3 rounded-xl text-sm font-bold text-[#09285C] hover:bg-[#F7FAFF] transition-colors"
            >
              Contact Us
            </Link>
          </div>

          {/* User Account Quick Section */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            {currentUser ? (
              <div className="flex items-center justify-between w-full">
                <Link
                  href="/account"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="font-bold text-[#09285C] hover:underline"
                >
                  My Account ({currentUser.name.split(' ')[0]})
                </Link>
                <button
                  onClick={async () => {
                    setIsMobileMenuOpen(false);
                    await logoutCustomer();
                    router.push('/home');
                  }}
                  className="text-rose-600 font-bold"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 w-full">
                <Link
                  href="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex-1 py-2.5 text-center rounded-xl bg-[#0866E8] text-white font-bold"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex-1 py-2.5 text-center rounded-xl bg-[#F7FAFF] border border-slate-200 text-[#09285C] font-bold"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
