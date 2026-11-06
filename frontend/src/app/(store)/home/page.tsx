'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Truck,
  RotateCcw,
  Star,
  CheckCircle2,
  Check,
  Package,
  Layers,
  Heart,
  ShoppingCart,
  Copy,
  Mail,
  ChevronRight,
} from 'lucide-react';
import { productService } from '@/services/productService';
import { categoryService } from '@/services/categoryService';
import { schoolPackService } from '@/services/schoolPackService';
import { Product, ProductCategory } from '@/types/product';
import { SchoolPack } from '@/types/school-pack';
import { ProductCard } from '@/components/products/ProductCard';
import { ScrapbookHero } from '@/components/home/ScrapbookHero';
import { DynamicHeroBanners } from '@/components/home/DynamicHeroBanners';
import InteractiveAboutSection from '@/components/home/InteractiveAboutSection';
import { formatLKR } from '@/lib/currency';
import { NewsletterSubscriptionForm } from '@/components/newsletter/NewsletterSubscriptionForm';

export default function HomeStorefrontPage() {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [bestSellers, setBestSellers] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [schoolPacks, setSchoolPacks] = useState<SchoolPack[]>([]);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    // Initial sync load from cache
    const all = productService.getAll();
    setFeaturedProducts(all.filter((p) => p.isFeatured).slice(0, 5));
    setBestSellers(all.filter((p) => p.isBestSeller).slice(0, 5));
    setNewArrivals(all.filter((p) => p.isNewArrival || p.tags.includes('new')).slice(0, 5));
    setCategories(categoryService.getCategories().slice(0, 6));
    setSchoolPacks(schoolPackService.getAll().slice(0, 3));

    // Asynchronously fetch real backend data
    let isMounted = true;
    Promise.all([
      productService.fetchProducts({}, 'newest', 1, 50),
      categoryService.fetchCategories(),
      schoolPackService.getPacks({ limit: 4 }),
    ]).then(([productRes, catList, packsRes]) => {
      if (isMounted) {
        const items = productRes.items;
        setFeaturedProducts(items.filter((p) => p.isFeatured).slice(0, 5));
        setBestSellers(items.filter((p) => p.isBestSeller).slice(0, 5));
        setNewArrivals(items.filter((p) => p.isNewArrival || p.tags.includes('new')).slice(0, 5));
        setCategories(catList.slice(0, 6));
        if (packsRes?.items) {
          setSchoolPacks(packsRes.items.slice(0, 4));
        }
      }
    }).catch((err) => {
      console.warn('Home storefront API fetch error, using local dataset:', err);
    });

    const unsubProduct = productService.subscribe(() => {
      const updated = productService.getAll();
      setFeaturedProducts(updated.filter((p) => p.isFeatured).slice(0, 5));
      setBestSellers(updated.filter((p) => p.isBestSeller).slice(0, 5));
      setNewArrivals(updated.filter((p) => p.isNewArrival || p.tags.includes('new')).slice(0, 5));
    });

    const unsubCat = categoryService.subscribe(() => {
      setCategories(categoryService.getCategories().slice(0, 6));
    });

    return () => {
      isMounted = false;
      unsubProduct();
      unsubCat();
    };
  }, []);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="bg-[#FFF8ED] text-[#10285D] space-y-16 sm:space-y-24 pb-20 overflow-hidden w-full">
      {/* SECTION A: DYNAMIC HERO BANNER WITH SCRAPBOOK FALLBACK */}
      <div className="lg:-mt-[68px]">
        <DynamicHeroBanners />
      </div>

      {/* SECTION B: REDESIGNED INTERACTIVE ABOUT SECTION */}
      <InteractiveAboutSection />

      {/* SECTION C: SHOP BY COLLECTION / CATEGORY (FULL-WIDTH EXPANDED GRID) */}
      <section className="w-full max-w-[1720px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16 space-y-8">
        <div className="text-center">
          <h2 className="text-xl sm:text-2xl font-black text-[#292525] tracking-tight">
            — Shop by collection —
          </h2>
          <p className="text-xs text-[#292525]/60 mt-1">
            Browse our favourite everyday stationery categories
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6">
          {[
            {
              title: 'NEW IN',
              slug: 'shop?filter=new-arrivals',
              color: 'bg-[#C6E7FF]/30',
              borderColor: 'border-[#C6E7FF]',
              badge: 'Fresh drops',
              initial: '✦',
            },
            {
              title: 'BESTSELLERS',
              slug: 'shop?filter=best-sellers',
              color: 'bg-[#FFD84D]/25',
              borderColor: 'border-[#FFD84D]',
              badge: 'Top rated',
              initial: '★',
            },
            {
              title: 'SCHOOL PACKS',
              slug: 'school-packs',
              color: 'bg-[#B9D5FF]/30',
              borderColor: 'border-[#B9D5FF]',
              badge: 'Grades 1-13',
              initial: '📚',
            },
            {
              title: 'CR BOOKS & PAPER',
              slug: 'categories/exercise-books',
              color: 'bg-[#EBD5FA]/40',
              borderColor: 'border-[#EBD5FA]',
              badge: 'Hardcover & Spiral',
              initial: '📖',
            },
            {
              title: 'PENS & WRITING',
              slug: 'categories/pens-and-writing',
              color: 'bg-[#C6E7FF]/30',
              borderColor: 'border-[#C6E7FF]',
              badge: 'Gel & Ballpoint',
              initial: '✏️',
            },
            {
              title: 'ART & CRAFT',
              slug: 'categories/art-and-drawing',
              color: 'bg-[#FFD84D]/25',
              borderColor: 'border-[#FFD84D]',
              badge: 'Pencils & Paints',
              initial: '🎨',
            },
          ].map((col, idx) => (
            <Link
              key={idx}
              href={`/${col.slug}`}
              className="group flex flex-col items-center text-center space-y-2.5 transition-all"
            >
              <div
                className={`w-full aspect-square rounded-2xl ${col.color} border ${col.borderColor} flex flex-col items-center justify-center p-4 transition-transform duration-300 group-hover:scale-105 group-hover:shadow-md relative overflow-hidden`}
              >
                <span className="text-3xl mb-1">{col.initial}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#292525]/60 bg-white/70 px-2 py-0.5 rounded-full">
                  {col.badge}
                </span>
              </div>
              <span className="text-xs font-bold text-[#292525] group-hover:text-[#0066CC] transition-colors flex items-center gap-1">
                <span>{col.title}</span>
                <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* SECTION D: FEATURED PROMOTIONAL BANNER */}
      <section className="w-full max-w-[1720px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16">
        <div className="relative rounded-3xl bg-lavender-daisy p-8 sm:p-12 lg:p-16 border border-[#EBD5FA] shadow-sm overflow-hidden">
          {/* Subtle floral accents */}
          <div className="absolute top-4 right-8 text-4xl opacity-40 select-none">🌸</div>
          <div className="absolute bottom-6 left-12 text-3xl opacity-30 select-none">🌼</div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-4">
              <span className="inline-block bg-white text-[#6b21a8] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-xs">
                New Collection Dropped Today! 🌸
              </span>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#292525] tracking-tight leading-tight">
                Your Next Favourite <br className="hidden sm:inline" />
                Stationery Essentials Are Here.
              </h2>

              <p className="text-xs sm:text-sm text-[#292525]/70 max-w-lg leading-relaxed">
                We’re a small stationery store built on the belief that study and work tools should be
                fun, beautiful, and filled with things that make you smile.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href="/shop?filter=new-arrivals"
                  className="bg-[#0066CC] hover:bg-[#0052a3] text-white font-bold text-xs px-6 py-3 rounded-full shadow-md transition-all duration-200 hover:scale-105"
                >
                  NEW IN
                </Link>
                <Link
                  href="/shop?filter=best-sellers"
                  className="bg-white hover:bg-[#FFFDF0] text-[#292525] font-bold text-xs px-6 py-3 rounded-full border border-white/80 shadow-xs transition-all duration-200 hover:scale-105"
                >
                  BESTSELLERS
                </Link>
              </div>
            </div>

            {/* Right Quote Card Inspired by reference */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <div className="bg-white p-6 sm:p-8 rounded-3xl border-2 border-white shadow-xl max-w-sm w-full text-center space-y-3 transform rotate-1 hover:rotate-0 transition-transform">
                <div className="font-heylowitch text-2xl sm:text-3xl text-[#292525] leading-snug">
                  &ldquo;A pretty planner is going to solve all of my problems.&rdquo;
                </div>
                <p className="text-xs text-[#292525]/60 font-medium">
                  — Every stationery enthusiast, ever
                </p>
                <div className="pt-2">
                  <Link
                    href="/categories/exercise-books"
                    className="inline-block bg-[#FAF7EE] text-[#292525] hover:bg-[#C6E7FF]/30 text-xs font-bold px-4 py-1.5 rounded-full border border-[#292525]/20"
                  >
                    Browse Planners &amp; Books
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION E: BESTSELLING PRODUCTS */}
      <section className="w-full max-w-[1720px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-[#292525] tracking-tight">
              — Shop our bestsellers —
            </h2>
            <p className="text-xs text-[#292525]/60 mt-0.5">
              Top requested stationery items loved by students and offices
            </p>
          </div>
          <Link
            href="/shop?filter=best-sellers"
            className="text-xs font-bold text-[#0066CC] hover:underline flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {bestSellers.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* SECTION F: SPECIAL OFFERS */}
      <section className="w-full max-w-[1720px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16">
        <div className="rounded-3xl p-4 sm:p-6 bg-gingham-yellow border-2 border-[#FFD84D] shadow-sm">
          <div className="bg-[#EBD5FA] rounded-2xl p-6 sm:p-10 border border-white flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
            {/* Left Decorative Element */}
            <div className="hidden md:flex flex-col items-center justify-center w-36 h-36 rounded-2xl bg-white/80 p-3 shadow-md border border-white">
              <span className="text-4xl mb-1">🎁</span>
              <span className="text-[10px] font-bold uppercase text-[#292525]/70">Curated Pack</span>
            </div>

            {/* Center Content */}
            <div className="space-y-3 max-w-md mx-auto">
              <span className="text-xs font-bold uppercase tracking-widest text-[#292525]/60 block">
                This Week&apos;s Feature
              </span>
              <h3 className="text-3xl sm:text-4xl font-black text-[#292525] tracking-tight">
                SAVE 20% OFF
              </h3>
              <p className="text-xs text-[#292525]/70 font-medium">
                Use our seasonal coupon code at checkout to enjoy 20% off all Atlas CR notebooks and pen sets.
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-3">
                <button
                  onClick={() => handleCopyCode('20OFF')}
                  className="bg-[#292525] hover:bg-black text-white font-bold text-xs px-5 py-2.5 rounded-full shadow-md transition-all flex items-center gap-2"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedCode ? 'Code Copied!' : 'USE CODE: 20OFF'}</span>
                </button>

                <Link
                  href="/offers"
                  className="bg-white hover:bg-[#FFFDF0] text-[#292525] font-semibold text-xs px-5 py-2.5 rounded-full border border-[#292525] transition-all"
                >
                  Explore Eligible Items
                </Link>
              </div>
            </div>

            {/* Right Decorative Element */}
            <div className="hidden md:flex flex-col items-center justify-center w-36 h-36 rounded-2xl bg-white/80 p-3 shadow-md border border-white">
              <span className="text-4xl mb-1">✨</span>
              <span className="text-[10px] font-bold uppercase text-[#292525]/70">Save 20%</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION G: FRESH NEW ARRIVALS */}
      <section className="w-full max-w-[1720px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-[#292525] tracking-tight">
              — Fresh New Arrivals —
            </h2>
            <p className="text-xs text-[#292525]/60 mt-0.5">
              Recently added stationery supplies and creative gear
            </p>
          </div>
          <Link
            href="/shop?filter=new-arrivals"
            className="text-xs font-bold text-[#0066CC] hover:underline flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {newArrivals.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* SECTION: CURATED SCHOOL PACKS */}
      {schoolPacks.length > 0 && (
        <section className="w-full max-w-[1720px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16 space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-[#FFD84D] text-[#594300] text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider mb-1 shadow-2xs">
                <span>🎒 Sri Lankan Syllabus Approved</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[#292525] tracking-tight">
                — School Stationery Bundles —
              </h2>
              <p className="text-xs text-[#292525]/60 mt-0.5">
                Save up to 18% with pre-packed grade kits for primary, junior, O/L and A/L
              </p>
            </div>
            <Link
              href="/school-packs"
              className="text-xs font-bold text-[#0066CC] hover:underline flex items-center gap-1"
            >
              <span>Explore All Packs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {schoolPacks.slice(0, 3).map((pack) => (
              <div
                key={pack.id}
                className="bg-white rounded-3xl border border-[#C6E7FF]/60 hover:border-[#0066CC] p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold text-[#292525] bg-[#FFFDF0] border border-[#C6E7FF] px-2.5 py-0.5 rounded-full">
                      {pack.grade}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#594300] bg-[#FFD84D] px-2.5 py-0.5 rounded-full shadow-2xs">
                      {pack.tier} Tier • Save {pack.savingsPercentage}%
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-[#292525] leading-snug">
                    {pack.name}
                  </h3>
                  <p className="text-xs text-[#292525]/60 mt-1.5 line-clamp-2 leading-relaxed">
                    {pack.description}
                  </p>

                  <div className="mt-4 pt-3 border-t border-[#C6E7FF]/30 space-y-1.5">
                    {pack.items.slice(0, 3).map((item) => (
                      <div key={item.id} className="flex items-center gap-2 text-xs text-[#292525]/80">
                        <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span className="truncate">
                          {item.defaultQuantity}x {item.productName || item.product?.name}
                        </span>
                      </div>
                    ))}
                    {pack.items.length > 3 && (
                      <span className="text-[10px] text-[#0066CC] font-bold pl-5 block">
                        +{pack.items.length - 3} more items included
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#C6E7FF]/30 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-[#292525]/50 uppercase block">Bundle Total</span>
                    <span className="text-xl font-black text-[#0066CC]">
                      {formatLKR(pack.totalPriceCents)}
                    </span>
                  </div>

                  <Link
                    href={`/school-packs/${pack.slug || pack.id}`}
                    className="bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold px-4 py-2 rounded-full transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <span>Customize</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SECTION H: WHY SHOP WITH US? */}
      <section className="w-full max-w-[1720px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-[#B9D5FF]/25 border border-[#B9D5FF]/60 rounded-3xl p-6 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center mx-auto text-xl shadow-xs">
              🛍️
            </div>
            <h4 className="text-sm font-bold text-[#292525]">Convenient Shopping</h4>
            <p className="text-xs text-[#292525]/70 leading-relaxed font-medium">
              Order complete booklists or single pens with ease from anywhere in Sri Lanka.
            </p>
          </div>

          <div className="bg-[#C6E7FF]/30 border border-[#C6E7FF]/70 rounded-3xl p-6 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center mx-auto text-xl shadow-xs">
              📚
            </div>
            <h4 className="text-sm font-bold text-[#292525]">Everything in One Place</h4>
            <p className="text-xs text-[#292525]/70 leading-relaxed font-medium">
              CR books, geometry sets, art materials, and office files ready to ship.
            </p>
          </div>

          <div className="bg-[#FFD84D]/25 border border-[#FFD84D]/70 rounded-3xl p-6 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center mx-auto text-xl shadow-xs">
              🏷️
            </div>
            <h4 className="text-sm font-bold text-[#292525]">100% Genuine Brands</h4>
            <p className="text-xs text-[#292525]/70 leading-relaxed font-medium">
              Direct authorized stock from Atlas, Promate, Faber-Castell, Nataraj &amp; more.
            </p>
          </div>

          <div className="bg-[#EBD5FA]/40 border border-[#EBD5FA]/70 rounded-3xl p-6 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center mx-auto text-xl shadow-xs">
              🚚
            </div>
            <h4 className="text-sm font-bold text-[#292525]">Fast Islandwide Delivery</h4>
            <p className="text-xs text-[#292525]/70 leading-relaxed font-medium">
              Prompt dispatch to all 25 districts with free shipping on qualifying orders.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION I: NEWSLETTER SUBSCRIPTION */}
      <section className="w-full max-w-[1720px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16">
        <NewsletterSubscriptionForm variant="card" source="HOMEPAGE" />
      </section>
    </div>
  );
}
