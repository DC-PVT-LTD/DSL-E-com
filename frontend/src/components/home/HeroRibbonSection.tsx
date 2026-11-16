'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SpeedWriteHeroSlide } from './SpeedWriteHeroSlide';
import { FirstHeroSlide } from './FirstHeroSlide';
import { SchoolPackHeroSlide } from './SchoolPackHeroSlide';
import { FindStationeryHeroSlide } from './FindStationeryHeroSlide';

export const HeroRibbonSection: React.FC = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const totalSlides = 4; // 1: Speed, 2: Supplies Without Limits, 3: School Pack, 4: Find My Stationery

  // Autoplay: slide transition every 6.5s, pauses on hover
  useEffect(() => {
    if (isPaused) return;

    const timer = setTimeout(() => {
      setCurrentSlide((prev) => (prev + 1) % totalSlides);
    }, 6500);

    return () => clearTimeout(timer);
  }, [currentSlide, totalSlides, isPaused]);

  const handlePrev = () => {
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  const handleNext = () => {
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  };

  const handleGoTo = (idx: number) => {
    setCurrentSlide(idx);
  };

  // Touch swipe tracking
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchEndX.current = null;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (distance > minSwipeDistance) {
      handleNext();
    } else if (distance < -minSwipeDistance) {
      handlePrev();
    }
  };

  return (
    <section
      aria-label="Homepage Hero Carousel"
      className="relative w-full h-[535px] sm:h-[580px] md:h-[632px] lg:h-[calc(100vh_-_102px)] lg:max-h-[640px] xl:max-h-[680px] overflow-hidden select-none"
      style={{
        maxHeight: '640px',
      }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* ========================================================= */}
      {/* 4 FULL-SCREEN HERO SLIDES CONTAINER (EDGE-TO-EDGE)        */}
      {/* 1: Speed | 2: Supplies Without Limits | 3: School Pack | 4: Find Stationery */}
      {/* ========================================================= */}
      <div className="relative w-full h-full overflow-hidden">
        {/* Slide 1: Speed (Write Beyond Limits) */}
        <div
          className={`w-full h-full transition-opacity duration-700 ease-in-out ${
            currentSlide === 0
              ? 'opacity-100 relative z-10 pointer-events-auto'
              : 'opacity-0 absolute inset-0 z-0 pointer-events-none'
          }`}
          aria-hidden={currentSlide !== 0}
        >
          <SpeedWriteHeroSlide />
        </div>

        {/* Slide 2: Supplies Without Limits (7 Photopea Layers) */}
        <div
          className={`w-full h-full transition-opacity duration-700 ease-in-out ${
            currentSlide === 1
              ? 'opacity-100 relative z-10 pointer-events-auto'
              : 'opacity-0 absolute inset-0 z-0 pointer-events-none'
          }`}
          aria-hidden={currentSlide !== 1}
        >
          <FirstHeroSlide />
        </div>

        {/* Slide 3: School Pack (Find Your School Pack) */}
        <div
          className={`w-full h-full transition-opacity duration-700 ease-in-out ${
            currentSlide === 2
              ? 'opacity-100 relative z-10 pointer-events-auto'
              : 'opacity-0 absolute inset-0 z-0 pointer-events-none'
          }`}
          aria-hidden={currentSlide !== 2}
        >
          <SchoolPackHeroSlide />
        </div>

        {/* Slide 4: Find My Stationery */}
        <div
          className={`w-full h-full transition-opacity duration-700 ease-in-out ${
            currentSlide === 3
              ? 'opacity-100 relative z-10 pointer-events-auto'
              : 'opacity-0 absolute inset-0 z-0 pointer-events-none'
          }`}
          aria-hidden={currentSlide !== 3}
        >
          <FindStationeryHeroSlide />
        </div>
      </div>

      {/* ========================================================= */}
      {/* NAVIGATION CONTROLS: PREVIOUS & NEXT ARROWS               */}
      {/* ========================================================= */}
      <button
        type="button"
        onClick={handlePrev}
        aria-label="Previous Hero Slide"
        className="hidden sm:flex absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-30 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/85 hover:bg-[#102A5E] text-[#102A5E] hover:text-white backdrop-blur-md shadow-lg shadow-blue-950/10 border border-slate-200/60 items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer"
      >
        <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>

      <button
        type="button"
        onClick={handleNext}
        aria-label="Next Hero Slide"
        className="hidden sm:flex absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-30 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/85 hover:bg-[#102A5E] text-[#102A5E] hover:text-white backdrop-blur-md shadow-lg shadow-blue-950/10 border border-slate-200/60 items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer"
      >
        <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>

      {/* ========================================================= */}
      {/* UNIFIED CONTROLS PILL (4 SLIDE INDICATOR DOTS)            */}
      {/* ========================================================= */}
      <div className="flex absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 items-center gap-2 bg-white/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-200/80 shadow-md shadow-blue-950/10">
        <button
          type="button"
          onClick={handlePrev}
          aria-label="Previous Hero Slide"
          className="flex sm:hidden items-center justify-center w-5 h-5 text-[#102A5E] hover:text-[#087BFF] active:scale-90"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {Array.from({ length: totalSlides }, (_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleGoTo(idx)}
            aria-label={`Go to slide ${idx + 1}`}
            className={`transition-all duration-300 rounded-full cursor-pointer ${
              currentSlide === idx
                ? 'w-6 sm:w-8 h-2 sm:h-2.5 bg-[#087BFF]'
                : 'w-2 sm:w-2.5 h-2 sm:h-2.5 bg-slate-300 hover:bg-slate-400'
            }`}
          />
        ))}

        <button
          type="button"
          onClick={handleNext}
          aria-label="Next Hero Slide"
          className="flex sm:hidden items-center justify-center w-5 h-5 text-[#102A5E] hover:text-[#087BFF] active:scale-90"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </section>
  );
};
