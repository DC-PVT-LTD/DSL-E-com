'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { bannerService } from '@/services/bannerService';
import { HomepageBanner } from '@/types/banner';
import { ScrapbookHero } from './ScrapbookHero';

export const DynamicHeroBanners: React.FC = () => {
  const [banners, setBanners] = useState<HomepageBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let isMounted = true;
    bannerService
      .getHomepageBanners()
      .then((data) => {
        if (isMounted) {
          setBanners(data || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch dynamic hero banners, using default:', err);
        if (isMounted) {
          setBanners([]);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Auto-advance banner every 6 seconds if multiple banners and not paused
  useEffect(() => {
    if (banners.length <= 1 || isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 6000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [banners.length, isPaused]);

  // Clean fallback: If no active banners, render default ScrapbookHero
  if (!loading && banners.length === 0) {
    return <ScrapbookHero />;
  }

  // If loading and no banners yet, render ScrapbookHero to avoid layout shifts
  if (loading && banners.length === 0) {
    return <ScrapbookHero />;
  }

  const currentBanner = banners[currentIndex];
  if (!currentBanner) {
    return <ScrapbookHero />;
  }

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  };

  return (
    <section
      className="relative w-full overflow-hidden select-none bg-slate-900"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-roledescription="carousel"
      aria-label="Homepage Promotional Banners"
    >
      <div className="relative w-full max-w-[1920px] mx-auto min-h-[380px] sm:min-h-[460px] md:min-h-[520px] lg:aspect-[1920/800] flex items-center justify-center">
        {/* Banner Imagery with Responsive Picture Element */}
        <picture className="absolute inset-0 w-full h-full">
          {currentBanner.mobileImage && (
            <source media="(max-width: 768px)" srcSet={currentBanner.mobileImage} />
          )}
          <img
            src={currentBanner.desktopImage}
            alt={currentBanner.imageAltText || currentBanner.title}
            className="w-full h-full object-cover object-center transition-opacity duration-700 ease-in-out"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/images/hero/hero_section_2x.png';
            }}
          />
        </picture>

        {/* Soft Contrast Gradient Overlay to guarantee readable text */}
        <div className="absolute inset-0 bg-linear-to-r from-black/75 via-black/35 to-transparent z-10" />

        {/* Content Box */}
        <div className="relative z-20 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 py-12 flex flex-col justify-center">
          <div className="max-w-xl text-left space-y-4">
            {/* Subtitle / Badge */}
            {currentBanner.subtitle && (
              <span className="inline-block px-3 py-1 rounded-full bg-[#FFD84D] text-[#10285D] text-xs font-black uppercase tracking-wider shadow-md">
                {currentBanner.subtitle}
              </span>
            )}

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight drop-shadow-md">
              {currentBanner.title}
            </h1>

            {/* Description */}
            {currentBanner.description && (
              <p className="text-sm sm:text-base text-slate-200 line-clamp-3 leading-relaxed drop-shadow-sm font-medium">
                {currentBanner.description}
              </p>
            )}

            {/* Call to Action Button */}
            {currentBanner.buttonText && currentBanner.buttonLink && (
              <div className="pt-2">
                <Link
                  href={currentBanner.buttonLink}
                  className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-[#FFD84D] hover:bg-[#FFE37A] text-[#10285D] font-black text-sm shadow-xl transition-all hover:scale-105 active:scale-95"
                >
                  <span>{currentBanner.buttonText}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Arrows (if more than 1 banner) */}
        {banners.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-xs transition-colors"
              aria-label="Previous Banner"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-xs transition-colors"
              aria-label="Next Banner"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Pagination Indicators */}
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-black/40 backdrop-blur-xs px-3 py-1.5 rounded-full">
              {banners.map((b, idx) => (
                <button
                  key={b.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-2 rounded-full transition-all ${
                    idx === currentIndex ? 'w-6 bg-[#FFD84D]' : 'w-2 bg-white/50 hover:bg-white/80'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
};

