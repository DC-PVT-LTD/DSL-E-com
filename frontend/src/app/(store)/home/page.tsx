'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ShieldCheck,
  Truck,
  RotateCcw,
  Check,
  Package,
  Layers,
  Sparkles,
  Copy,
  Award,
} from 'lucide-react';
import { productService } from '@/services/productService';
import { categoryService } from '@/services/categoryService';
import { schoolPackService } from '@/services/schoolPackService';
import { bannerService } from '@/services/bannerService';
import { Product, ProductCategory } from '@/types/product';
import { SchoolPack } from '@/types/school-pack';
import { HomepageBanner } from '@/types/banner';
import { ProductCard } from '@/components/products/ProductCard';
import { HeroRibbonSection } from '@/components/home/HeroRibbonSection';
import ScrollStack, { ScrollStackItem } from '@/components/common/ScrollStack';
import { TrustedBrandsStackCard } from '@/components/home/TrustedBrandsStackCard';
import { AuthorizedBrandsStackCard } from '@/components/home/AuthorizedBrandsStackCard';
import { CascadingProductsStackCard } from '@/components/home/CascadingProductsStackCard';
import { InteractiveBrandShowcaseCard } from '@/components/home/InteractiveBrandShowcaseCard';
import { LittleEssentialsShowcase } from '@/components/home/LittleEssentialsShowcase';
import { ShopByCollectionSection } from '@/components/home/ShopByCollectionSection';
import { PromotionalWaveRibbon } from '@/components/home/PromotionalWaveRibbon';
import { SpeedHeroSlide } from '@/components/home/SpeedHeroSlide';
import { formatLKR } from '@/lib/currency';
import { NewsletterSubscriptionForm } from '@/components/newsletter/NewsletterSubscriptionForm';
import { WelcomeSplashLoader } from '@/components/common/WelcomeSplashLoader';
import { MOCK_BEST_SELLERS, MOCK_NEW_ARRIVALS } from '@/mocks/products';

export default function HomeStorefrontPage() {
  const [bestSellers, setBestSellers] = useState<Product[]>(MOCK_BEST_SELLERS);
  const [newArrivals, setNewArrivals] = useState<Product[]>(MOCK_NEW_ARRIVALS);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [schoolPacks, setSchoolPacks] = useState<SchoolPack[]>([]);
  const [copiedCode, setCopiedCode] = useState(false);
  const [midPromoBanner, setMidPromoBanner] = useState<HomepageBanner | null>(null);

  useEffect(() => {
    // Initial sync load from local cached products or mock data
    const all = productService.getAll();
    const localBest = all.filter((p) => p.isBestSeller && p.images && p.images.length > 0 && p.images[0]);
    const localNew = all.filter((p) => (p.isNewArrival || p.tags.includes('new')) && p.images && p.images.length > 0 && p.images[0]);

    setBestSellers(localBest.length >= 6 ? localBest.slice(0, 8) : MOCK_BEST_SELLERS);
    setNewArrivals(localNew.length >= 6 ? localNew.slice(0, 8) : MOCK_NEW_ARRIVALS);
    setCategories(categoryService.getCategories().slice(0, 6));
    setSchoolPacks(schoolPackService.getAll().slice(0, 3));

    // Asynchronously fetch real backend database data
    let isMounted = true;
    Promise.all([
      productService.fetchProducts({}, 'newest', 1, 100),
      categoryService.fetchCategories(),
      schoolPackService.getPacks({ limit: 4 }),
      bannerService.getHomepageBanners('MID_PAGE_PROMO'),
    ])
      .then(([productRes, catList, packsRes, promoBanners]) => {
        if (isMounted) {
          const items = productRes.items;
          const apiBest = items.filter((p) => p.isBestSeller && p.images && p.images.length > 0 && p.images[0]);
          const apiNew = items.filter((p) => (p.isNewArrival || p.tags.includes('new')) && p.images && p.images.length > 0 && p.images[0]);

          setBestSellers(apiBest.length >= 6 ? apiBest.slice(0, 8) : MOCK_BEST_SELLERS);
          setNewArrivals(apiNew.length >= 6 ? apiNew.slice(0, 8) : MOCK_NEW_ARRIVALS);
          setCategories(catList.slice(0, 6));
          if (packsRes?.items) {
            setSchoolPacks(packsRes.items.slice(0, 3));
          }
          if (promoBanners && promoBanners.length > 0) {
            setMidPromoBanner(promoBanners[0]);
          }
        }
      })
      .catch((err) => {
        console.warn('Home storefront API fetch error, using fallback mock dataset for best sellers & new arrivals:', err);
        if (isMounted) {
          setBestSellers(MOCK_BEST_SELLERS);
          setNewArrivals(MOCK_NEW_ARRIVALS);
        }
      });

    const unsubProduct = productService.subscribe(() => {
      const updated = productService.getAll();
      const updatedBest = updated.filter((p) => p.isBestSeller && p.images && p.images.length > 0 && p.images[0]);
      const updatedNew = updated.filter((p) => (p.isNewArrival || p.tags.includes('new')) && p.images && p.images.length > 0 && p.images[0]);
      setBestSellers(updatedBest.length >= 6 ? updatedBest.slice(0, 8) : MOCK_BEST_SELLERS);
      setNewArrivals(updatedNew.length >= 6 ? updatedNew.slice(0, 8) : MOCK_NEW_ARRIVALS);
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
    <>
      <WelcomeSplashLoader durationSeconds={4} />
      <div className="bg-white text-[#102C60] space-y-[1.5cm] pb-16 overflow-hidden w-full select-none pt-0">

      {/* ========================================================= */}
      {/* 1. HERO SECTION WITH 3D RIBBON & TRANSPARENT CHILD         */}
      {/* ========================================================= */}
      <HeroRibbonSection />

      {/* ========================================================= */}
      {/* FEATURE HIGHLIGHTS (SCROLL STACK SECTION)                 */}
      {/* Full-width blue background spreading across whole section */}
      {/* ========================================================= */}
      <section
        id="our-brands"
        className="w-full relative z-20 -mt-6 sm:-mt-10 lg:-mt-14 bg-gradient-to-b from-[#081838] via-[#0a2048] to-[#06142e] py-10 sm:py-14 lg:py-16 shadow-[0_25px_60px_rgba(2,8,24,0.45)] border-y border-blue-500/20 overflow-hidden"
        aria-label="Feature Highlights Stack"
      >
        {/* Ambient lighting glows across the full-width blue section */}
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#0066FF]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-[#FFD84D]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Centered container for the ScrollStack cards */}
        <div className="w-full max-w-[1240px] mx-auto px-3 sm:px-6 lg:px-8 relative z-10">
          <div style={{ height: 530 }} className="relative w-full">
            <ScrollStack
              itemDistance={220}
              itemStackDistance={16}
              stackPosition="2%"
              holdDistance={320}
              itemScale={0.015}
              dimAmount={0.04}
              blurAmount={0}
            >
              {/* ScrollStack Card 1: Trusted by the Best (Our Brands) */}
              <ScrollStackItem
                itemClassName="!h-auto min-h-[410px] sm:min-h-[430px] lg:min-h-[450px] !p-0 !rounded-[28px] overflow-hidden flex flex-col justify-center relative !bg-transparent border border-white/70 shadow-[0_30px_70px_-15px_rgba(2,8,24,0.6),0_10px_25px_rgba(0,0,0,0.2),inset_0_2px_3px_rgba(255,255,255,0.95),inset_0_-2px_4px_rgba(8,24,56,0.15)] backdrop-blur-2xl"
              >
                <TrustedBrandsStackCard />
              </ScrollStackItem>

              {/* ScrollStack Card 2: Authorized Brand Logos */}
              <ScrollStackItem
                distance={360}
                itemClassName="!h-auto min-h-[410px] sm:min-h-[430px] lg:min-h-[450px] !p-0 !rounded-[28px] overflow-hidden flex flex-col justify-center relative !bg-transparent border border-white/70 shadow-[0_30px_70px_-15px_rgba(2,8,24,0.6),0_10px_25px_rgba(0,0,0,0.2),inset_0_2px_3px_rgba(255,255,255,0.95),inset_0_-2px_4px_rgba(8,24,56,0.15)] backdrop-blur-2xl"
              >
                <AuthorizedBrandsStackCard />
              </ScrollStackItem>

              {/* ScrollStack Card 3: Cascading Product Cards */}
              <ScrollStackItem
                distance={460}
                itemClassName="!h-auto min-h-[410px] sm:min-h-[430px] lg:min-h-[450px] !p-0 !rounded-[28px] overflow-hidden flex flex-col justify-center relative !bg-transparent border border-white/70 shadow-[0_30px_70px_-15px_rgba(2,8,24,0.6),0_10px_25px_rgba(0,0,0,0.2),inset_0_2px_3px_rgba(255,255,255,0.95),inset_0_-2px_4px_rgba(8,24,56,0.15)] backdrop-blur-2xl"
              >
                <CascadingProductsStackCard />
              </ScrollStackItem>

              {/* ScrollStack Card 4: Interactive Brand Showcase */}
              <ScrollStackItem
                distance={460}
                itemClassName="!h-auto min-h-[410px] sm:min-h-[430px] lg:min-h-[450px] !p-0 !rounded-[28px] overflow-hidden flex flex-col justify-center relative !bg-transparent border border-white/70 shadow-[0_30px_70px_-15px_rgba(2,8,24,0.6),0_10px_25px_rgba(0,0,0,0.2),inset_0_2px_3px_rgba(255,255,255,0.95),inset_0_-2px_4px_rgba(8,24,56,0.15)] backdrop-blur-2xl"
              >
                <InteractiveBrandShowcaseCard />
              </ScrollStackItem>
            </ScrollStack>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 2. CATEGORIES: SHOP BY COLLECTION CAROUSEL                 */}
      {/* ========================================================= */}
      <ShopByCollectionSection />

      {/* ========================================================= */}
      {/* 3. PROMOTIONAL BLUE WAVE RIBBON                           */}
      {/* ========================================================= */}
      <PromotionalWaveRibbon />

      {/* ========================================================= */}
      {/* 4. BEST SELLERS (CONTINUOUS RIGHT-MOVING MARQUEE)         */}
      {/* ========================================================= */}
      <section className="w-full max-w-[1720px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <span className="w-2 sm:w-2.5 h-6 sm:h-7 bg-[#0866E8] rounded-full inline-block" />
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-[#102C60] tracking-tight">
              Best Sellers
            </h2>
          </div>
          <Link
            href="/shop?filter=best-sellers"
            className="text-xs sm:text-sm font-bold text-[#0866E8] hover:text-[#09285C] transition-colors flex items-center gap-1.5 group"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Continuous Right-Moving Product Track with Hover-Pause */}
        <div className="relative overflow-hidden py-3 group">
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-r from-white to-transparent z-10" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-l from-white to-transparent z-10" />

          <div className="animate-marquee-right flex gap-4 sm:gap-6 items-stretch">
            {[...bestSellers, ...bestSellers].map((product, idx) => (
              <div key={`best-${product.id}-${idx}`} className="w-[200px] sm:w-[240px] md:w-[260px] shrink-0">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 5. ABOUT US SHOWCASE - "LITTLE ESSENTIALS. BIG IDEAS."    */}
      {/* ========================================================= */}
      <LittleEssentialsShowcase />

      {/* ========================================================= */}
      {/* 6. NEW ARRIVALS (CONTINUOUS LEFT-MOVING MARQUEE)          */}
      {/* ========================================================= */}
      <section className="w-full max-w-[1720px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <span className="w-2 sm:w-2.5 h-6 sm:h-7 bg-[#16A34A] rounded-full inline-block" />
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-[#102C60] tracking-tight">
              New Arrivals
            </h2>
          </div>
          <Link
            href="/shop?filter=new-arrivals"
            className="text-xs sm:text-sm font-bold text-[#0866E8] hover:text-[#09285C] transition-colors flex items-center gap-1.5 group"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Continuous Left-Moving Product Track with Hover-Pause */}
        <div className="relative overflow-hidden py-3 group">
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-r from-white to-transparent z-10" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-l from-white to-transparent z-10" />

          <div className="animate-marquee-left flex gap-4 sm:gap-6 items-stretch">
            {[...newArrivals, ...newArrivals].map((product, idx) => (
              <div key={`new-${product.id}-${idx}`} className="w-[200px] sm:w-[240px] md:w-[260px] shrink-0">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 7. SPEED PROMOTION                                       */}
      {/* ========================================================= */}
      <SpeedHeroSlide />

      {/* ========================================================= */}
      {/* 8. AUTHORISED BRANDS (ONE BIGGER SINGLE ROW)              */}
      {/* ========================================================= */}
      <section className="w-full max-w-[1720px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <span className="w-2 sm:w-2.5 h-6 sm:h-7 bg-[#FFD84D] rounded-full inline-block" />
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-[#102C60] tracking-tight">
              Authorised Brands
            </h2>
          </div>
          <Link
            href="/brands"
            className="text-xs sm:text-sm font-bold text-[#0866E8] hover:text-[#09285C] transition-colors flex items-center gap-1.5 group"
          >
            <span>View All Brands</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* 1 Single Continuous Moving Row with Bigger Premium Brand Cards (Moving Right) */}
        <div className="relative overflow-hidden py-3 group">
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-r from-white to-transparent z-10" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-l from-white to-transparent z-10" />

          <div className="animate-marquee-right flex gap-4 sm:gap-6 items-center">
            {[
              { name: 'Speed', slug: 'speed', desc: 'Pens, Adhesives & Correction', origin: 'Sri Lanka', logo: '/images/brands/speed.svg' },
              { name: 'Doms', slug: 'doms', desc: 'Colour Pencils, Clay & Art Kits', origin: 'India', logo: '/images/brands/doms.svg' },
              { name: 'Amigo', slug: 'amigo', desc: 'Scientific & Desk Calculators', origin: 'Sri Lanka', logo: '/images/brands/amigo.svg' },
              { name: 'Linc', slug: 'linc', desc: 'Pentonic Smooth Ball & Gel Pens', origin: 'India', logo: '/images/brands/linc.svg' },
              { name: 'Pentonic', slug: 'pentonic', desc: 'Featherlite Pastel Matte Pens', origin: 'India', logo: '/images/brands/pentonic.svg' },
              { name: 'Accumate', slug: 'accumate', desc: 'Precision Geometry Instrument Boxes', origin: 'Sri Lanka', logo: '/images/brands/accumate.svg' },
              { name: 'Geommy', slug: 'geommy', desc: 'High-Precision Compasses & Rulers', origin: 'Sri Lanka', logo: '/images/brands/geommy.svg' },
              { name: 'FlexOffice', slug: 'flexoffice', desc: 'Highlighters, Tapes & Stationery', origin: 'Global', logo: '/images/brands/flexoffice.svg' },
              // Duplicate set for seamless continuous marquee loop
              { name: 'Speed', slug: 'speed', desc: 'Pens, Adhesives & Correction', origin: 'Sri Lanka', logo: '/images/brands/speed.svg' },
              { name: 'Doms', slug: 'doms', desc: 'Colour Pencils, Clay & Art Kits', origin: 'India', logo: '/images/brands/doms.svg' },
              { name: 'Amigo', slug: 'amigo', desc: 'Scientific & Desk Calculators', origin: 'Sri Lanka', logo: '/images/brands/amigo.svg' },
              { name: 'Linc', slug: 'linc', desc: 'Pentonic Smooth Ball & Gel Pens', origin: 'India', logo: '/images/brands/linc.svg' },
              { name: 'Pentonic', slug: 'pentonic', desc: 'Featherlite Pastel Matte Pens', origin: 'India', logo: '/images/brands/pentonic.svg' },
              { name: 'Accumate', slug: 'accumate', desc: 'Precision Geometry Instrument Boxes', origin: 'Sri Lanka', logo: '/images/brands/accumate.svg' },
              { name: 'Geommy', slug: 'geommy', desc: 'High-Precision Compasses & Rulers', origin: 'Sri Lanka', logo: '/images/brands/geommy.svg' },
              { name: 'FlexOffice', slug: 'flexoffice', desc: 'Highlighters, Tapes & Stationery', origin: 'Global', logo: '/images/brands/flexoffice.svg' },
            ].map((brand, i) => (
              <Link
                key={`single-row-${brand.slug}-${i}`}
                href={`/brands/${brand.slug}`}
                className="w-[310px] sm:w-[350px] md:w-[380px] shrink-0 bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-slate-200/90 hover:border-[#0866E8] shadow-xs hover:shadow-xl transition-all duration-300 p-4 sm:p-5 flex items-center gap-4 group cursor-pointer"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#F7FAFF] border border-slate-100 flex items-center justify-center p-2.5 sm:p-3 shrink-0 shadow-2xs group-hover:scale-105 transition-transform duration-300 overflow-hidden">
                  <img
                    src={brand.logo}
                    alt={`${brand.name} Logo`}
                    className="max-h-9 sm:max-h-11 max-w-full object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base sm:text-lg font-black text-[#09285C] group-hover:text-[#0866E8] transition-colors whitespace-nowrap">
                      {brand.name}
                    </span>
                    <span className="text-[10px] font-bold text-[#0866E8] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full shrink-0">
                      {brand.origin}
                    </span>
                  </div>
                  <p className="text-xs sm:text-[13px] text-[#64748B] font-medium truncate mt-1">
                    {brand.desc}
                  </p>
                </div>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#F7FAFF] group-hover:bg-[#0866E8] text-slate-400 group-hover:text-white flex items-center justify-center transition-all ml-auto shrink-0 shadow-2xs">
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 9. ADVERTISEMENT SECTION: HIGH-IMPACT PROMOTIONS          */}
      {/* ========================================================= */}
      {(() => {
        const isMidPromoGraphic =
          midPromoBanner &&
          (midPromoBanner.subtitle === '__GRAPHIC_ONLY__' ||
            (!midPromoBanner.subtitle && !midPromoBanner.description && !midPromoBanner.buttonText));

        if (isMidPromoGraphic && midPromoBanner?.desktopImage) {
          return (
            <section className="w-full max-w-[1720px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16">
              {midPromoBanner.buttonLink ? (
                <Link href={midPromoBanner.buttonLink} className="block group">
                  <div className="relative rounded-3xl overflow-hidden shadow-xl border border-slate-200 transition-all group-hover:shadow-2xl bg-slate-900">
                    <picture className="w-full h-auto block">
                      {midPromoBanner.mobileImage && (
                        <source media="(max-width: 768px)" srcSet={midPromoBanner.mobileImage} />
                      )}
                      <img
                        src={midPromoBanner.desktopImage}
                        alt={midPromoBanner.imageAltText || midPromoBanner.title}
                        className="w-full h-auto min-h-[160px] sm:min-h-[220px] object-cover transition-transform duration-500 group-hover:scale-[1.01]"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (!target.dataset.retried && target.src.includes('/uploads/')) {
                            target.dataset.retried = 'true';
                            target.src = `http://localhost:4000${midPromoBanner.desktopImage.startsWith('/') ? '' : '/'}${midPromoBanner.desktopImage}`;
                          }
                        }}
                      />
                    </picture>
                  </div>
                </Link>
              ) : (
                <div className="relative rounded-3xl overflow-hidden shadow-xl border border-slate-200 bg-slate-900">
                  <picture className="w-full h-auto block">
                    {midPromoBanner.mobileImage && (
                      <source media="(max-width: 768px)" srcSet={midPromoBanner.mobileImage} />
                    )}
                    <img
                      src={midPromoBanner.desktopImage}
                      alt={midPromoBanner.imageAltText || midPromoBanner.title}
                      className="w-full h-auto min-h-[160px] sm:min-h-[220px] object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (!target.dataset.retried && target.src.includes('/uploads/')) {
                          target.dataset.retried = 'true';
                          target.src = `http://localhost:4000${midPromoBanner.desktopImage.startsWith('/') ? '' : '/'}${midPromoBanner.desktopImage}`;
                        }
                      }}
                    />
                  </picture>
                </div>
              )}
            </section>
          );
        }

        return (
          <section className="w-full max-w-[1720px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16">
            <div className="relative rounded-3xl bg-[#102C60] text-white p-8 sm:p-12 lg:p-16 overflow-hidden shadow-xl border border-[#102C60]">
              {/* Subtle electric blue ambient glows */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-[#006DEB]/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-72 h-72 bg-[#006DEB]/15 rounded-full blur-2xl pointer-events-none" />

              {/* Optional background image if uploaded by admin */}
              {midPromoBanner?.desktopImage && (
                <img
                  src={midPromoBanner.desktopImage}
                  alt={midPromoBanner.imageAltText || ''}
                  className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
                />
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
                {/* Left Content */}
                <div className="lg:col-span-8 space-y-4">
                  <span className="inline-block bg-[#006DEB] text-white text-xs font-bold px-3.5 py-1.5 rounded-full uppercase tracking-wider shadow-sm">
                    {midPromoBanner?.subtitle || 'Distribution Partner Promotion'}
                  </span>

                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
                    {midPromoBanner?.title || (
                      <>
                        Equip Classrooms &amp; Workplaces <br className="hidden sm:inline" />
                        With Wholesale Confidence.
                      </>
                    )}
                  </h2>

                  <p className="text-xs sm:text-sm text-white/80 max-w-2xl leading-relaxed">
                    {midPromoBanner?.description || 'Direct distribution agreements with Atlas, Promate, and Faber-Castell guarantee authentic supplies at authoritative distributor pricing.'}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 pt-4">
                    <button
                      onClick={() => handleCopyCode(midPromoBanner?.buttonText ? midPromoBanner.buttonText.replace(/^COPY CODE:\s*/i, '') : '20OFF')}
                      className="bg-[#006DEB] hover:bg-[#005ac2] text-white font-bold text-xs sm:text-sm px-7 py-3.5 rounded-full shadow-lg shadow-[#006DEB]/25 transition-all hover:scale-105 flex items-center gap-2 cursor-pointer"
                    >
                      <Copy className="w-4 h-4" />
                      <span>
                        {copiedCode
                          ? `Code Copied: ${midPromoBanner?.buttonText ? midPromoBanner.buttonText.replace(/^COPY CODE:\s*/i, '') : '20OFF'}!`
                          : (midPromoBanner?.buttonText ? `COPY CODE: ${midPromoBanner.buttonText.replace(/^COPY CODE:\s*/i, '')}` : 'COPY CODE: 20OFF')}
                      </span>
                    </button>

                    <Link
                      href={midPromoBanner?.buttonLink || '/offers'}
                      className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm px-7 py-3.5 rounded-full border border-white/20 transition-all hover:scale-105"
                    >
                      Browse Promotional Offers
                    </Link>
                  </div>
                </div>

                {/* Right Stat Highlight */}
                <div className="lg:col-span-4 flex justify-center lg:justify-end">
                  <div className="bg-white/10 backdrop-blur-md p-6 sm:p-8 rounded-3xl border border-white/15 max-w-sm w-full text-center space-y-3 shadow-xl">
                    <span className="text-[11px] font-bold text-[#006DEB] uppercase tracking-widest block bg-white/10 px-3 py-1 rounded-full w-fit mx-auto">
                      Seasonal Bulk Benefit
                    </span>
                    <div className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                      SAVE 20%
                    </div>
                    <p className="text-xs text-white/75 font-medium leading-relaxed">
                      Applies automatically to bulk stationery orders and curriculum packs during the back-to-school season.
                    </p>
                    <div className="pt-2">
                      <Link
                        href="/shop?filter=new-arrivals"
                        className="inline-block bg-white text-[#102C60] hover:bg-slate-100 text-xs font-bold px-6 py-2.5 rounded-full shadow-sm transition-all hover:scale-105"
                      >
                        Shop New Releases
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* ========================================================= */}
      {/* 10. NEWSLETTER SUBSCRIPTION (CHECKERED GINGHAM PATTERN)   */}
      {/* ========================================================= */}
      <section
        className="relative w-full py-10 sm:py-16 md:py-20 px-3 sm:px-6 lg:px-8 xl:px-12 bg-cover bg-center overflow-hidden"
        style={{
          backgroundImage: "url('/images/newsletter-checkered-bg.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="relative z-10 max-w-6xl mx-auto rounded-[28px] sm:rounded-[36px] md:rounded-[44px] bg-white/75 sm:bg-white/80 backdrop-blur-md border-2 border-white/90 p-6 sm:p-10 md:p-14 shadow-[0_20px_50px_rgba(9,40,92,0.1)] overflow-hidden">
          {/* Corner Ambient Golden-Yellow Glows */}
          <div
            className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-amber-300/35 blur-3xl pointer-events-none"
            aria-hidden="true"
          />
          <div
            className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-amber-300/35 blur-3xl pointer-events-none"
            aria-hidden="true"
          />

          {/* Floating Blue Square Shape Background Elements (Left Cluster) */}
          <div
            className="absolute top-6 left-6 sm:left-10 w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-[#087BFF]/15 border border-[#087BFF]/25 rotate-12 pointer-events-none"
            aria-hidden="true"
          />
          <div
            className="absolute top-14 left-12 sm:left-16 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#006DEB]/20 border border-[#006DEB]/25 -rotate-6 pointer-events-none"
            aria-hidden="true"
          />
          <div
            className="absolute bottom-8 left-8 sm:left-12 w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-blue-300/25 border border-blue-400/20 rotate-45 pointer-events-none"
            aria-hidden="true"
          />

          {/* Floating Blue Square Shape Background Elements (Right Cluster) */}
          <div
            className="absolute bottom-6 right-8 sm:right-14 w-28 h-28 sm:w-36 sm:h-36 rounded-3xl bg-[#087BFF]/15 border border-[#087BFF]/25 -rotate-12 pointer-events-none"
            aria-hidden="true"
          />
          <div
            className="absolute bottom-14 right-20 sm:right-28 w-18 h-18 sm:w-22 sm:h-22 rounded-2xl bg-[#006DEB]/20 border border-[#006DEB]/25 rotate-12 pointer-events-none"
            aria-hidden="true"
          />

          {/* Floating Little Blue Stars */}
          <span
            className="absolute top-10 left-1/4 text-blue-400/50 text-xl pointer-events-none select-none"
            aria-hidden="true"
          >
            ★
          </span>
          <span
            className="absolute bottom-10 right-1/4 text-blue-400/50 text-lg pointer-events-none select-none"
            aria-hidden="true"
          >
            ★
          </span>
          <span
            className="absolute top-16 right-1/6 text-blue-300/60 text-sm pointer-events-none select-none"
            aria-hidden="true"
          >
            ✦
          </span>
          <span
            className="absolute bottom-16 left-1/6 text-blue-300/60 text-sm pointer-events-none select-none"
            aria-hidden="true"
          >
            ✦
          </span>

          {/* Content */}
          <div className="relative z-10 max-w-4xl mx-auto text-center space-y-3 mb-6 sm:mb-8">
            <span className="text-[11px] sm:text-xs font-black text-[#006DEB] uppercase tracking-wider bg-white/95 py-1 px-4 sm:px-5 rounded-full inline-block border-2 border-[#006DEB] shadow-2xs">
              STAY INFORMED
            </span>

            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-[32px] xl:text-[34px] font-black text-[#09285C] tracking-tight leading-tight">
              Subscribe for Distribution Updates &amp; Term{' '}
              <span className="relative inline-block whitespace-nowrap">
                Offers
                {/* Yellow 3-sparkle burst next to Offers */}
                <span
                  className="absolute -top-3 sm:-top-3.5 -right-5 sm:-right-6 text-[#FFB800] select-none pointer-events-none"
                  aria-hidden="true"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none">
                    <path d="M14 9L21 4" stroke="#FFB800" strokeWidth="3" strokeLinecap="round" />
                    <path d="M11 7L12 1" stroke="#FFB800" strokeWidth="3" strokeLinecap="round" />
                    <path d="M15 12L22 12" stroke="#FFB800" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </span>
                {/* Yellow playful wavy underline beneath Offers */}
                <svg
                  className="absolute -bottom-1 sm:-bottom-1.5 left-0 w-full h-2.5 sm:h-3 text-[#FFB800]"
                  viewBox="0 0 100 12"
                  fill="none"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 7C25 11 65 11 98 4"
                    stroke="#FFB800"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h2>

            <p className="text-xs sm:text-sm text-[#09285C]/75 leading-relaxed font-medium max-w-xl mx-auto">
              Receive verified syllabus lists, seasonal stock allocations, and distributor discount codes straight to your inbox.
            </p>
          </div>

          <div className="relative z-10 max-w-lg mx-auto">
            <NewsletterSubscriptionForm variant="card" source="HOMEPAGE" />
          </div>
        </div>
      </section>

    </div>
    </>
  );
}
