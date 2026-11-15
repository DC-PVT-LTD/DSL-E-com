'use client';

import React, { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

export interface CategoryCardItem {
  id: string;
  name: string;
  image: string;
  link: string;
}

const POPULAR_CATEGORIES: CategoryCardItem[] = [
  {
    id: 'erasers',
    name: 'Erasers',
    image: '/images/categories/erasers.png',
    link: '/shop?category=erasers',
  },
  {
    id: 'pens',
    name: 'Pens & Writing',
    image: '/images/categories/pens.png',
    link: '/shop?category=pens',
  },
  {
    id: 'markers',
    name: 'Markers',
    image: '/images/categories/markers.png',
    link: '/shop?category=markers',
  },
  {
    id: 'sharpeners',
    name: 'Sharpeners',
    image: '/images/categories/sharpeners.png',
    link: '/shop?category=sharpeners',
  },
  {
    id: 'highlighters',
    name: 'Highlighters',
    image: '/images/categories/highlighters.png',
    link: '/shop?category=highlighters',
  },
  {
    id: 'pencils',
    name: 'Pencils',
    image: '/images/categories/pencils.png',
    link: '/shop?category=pencils',
  },
  {
    id: 'rulers',
    name: 'Rulers',
    image: '/images/categories/rulers.png',
    link: '/shop?category=rulers',
  },
  {
    id: 'calculators',
    name: 'Calculators',
    image: '/images/categories/calculators.png',
    link: '/shop?category=calculators',
  },
  {
    id: 'exercise-books',
    name: 'Exercise & Books',
    image: '/images/categories/exercise-books.png',
    link: '/shop?category=books',
  },
  {
    id: 'art-craft',
    name: 'Art & Craft',
    image: '/images/categories/art-craft.png',
    link: '/shop?category=art',
  },
  {
    id: 'tapes-adhesives',
    name: 'Tapes & Adhesives',
    image: '/images/categories/tapes-adhesives.png',
    link: '/shop?category=tapes',
  },
  {
    id: 'correction-pens',
    name: 'Correction Pens',
    image: '/images/categories/correction-pens.png',
    link: '/shop?category=pens',
  },
  {
    id: 'school-stationery',
    name: 'School Stationery',
    image: '/images/categories/school-stationery.png',
    link: '/shop?category=books',
  },
];

export const ShopByCollectionSection: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, []);

  const handleScroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = direction === 'left' ? -320 : 320;
    scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  return (
    <section
      aria-label="Popular Categories"
      className="w-full max-w-[1720px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16 py-2 select-none bg-white relative"
    >
      {/* 1. HEADER: Clean "Popular Categories" with View All */}
      <div className="flex items-center justify-between mb-4 sm:mb-6 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <span className="w-2 sm:w-2.5 h-6 sm:h-7 bg-[#0866E8] rounded-full inline-block" />
          <h2 className="text-xl sm:text-2xl lg:text-[28px] font-black text-[#102A5E] tracking-tight">
            Popular Categories
          </h2>
        </div>

        <Link
          href="/categories"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#0866E8] hover:text-[#09285C] transition-colors group"
        >
          <span>View All Categories</span>
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      {/* 2. HORIZONTAL SCROLLING TRACK WITH SIDE CONTROLS */}
      <div className="relative group py-2">
        {/* Left Scroll Button */}
        <button
          type="button"
          onClick={() => handleScroll('left')}
          disabled={!canScrollLeft}
          aria-label="Scroll categories left"
          className={`absolute left-0 sm:left-1 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/95 border border-slate-200/90 shadow-md hover:shadow-xl text-[#09285C] hover:text-[#0866E8] flex items-center justify-center transition-all duration-200 cursor-pointer backdrop-blur-sm ${
            canScrollLeft ? 'opacity-100 hover:scale-110 active:scale-95' : 'opacity-0 pointer-events-none'
          }`}
        >
          <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
        </button>

        {/* Right Scroll Button */}
        <button
          type="button"
          onClick={() => handleScroll('right')}
          disabled={!canScrollRight}
          aria-label="Scroll categories right"
          className={`absolute right-0 sm:right-1 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/95 border border-slate-200/90 shadow-md hover:shadow-xl text-[#09285C] hover:text-[#0866E8] flex items-center justify-center transition-all duration-200 cursor-pointer backdrop-blur-sm ${
            canScrollRight ? 'opacity-100 hover:scale-110 active:scale-95' : 'opacity-0 pointer-events-none'
          }`}
        >
          <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
        </button>

        {/* Soft edge fade masks */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 sm:w-12 bg-gradient-to-r from-white to-transparent z-10" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 sm:w-12 bg-gradient-to-l from-white to-transparent z-10" />

        {/* Scrollable Container */}
        <div
          ref={scrollRef}
          className="flex gap-4 sm:gap-6 items-center overflow-x-auto scroll-smooth py-3 px-3 scrollbar-none select-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {POPULAR_CATEGORIES.map((cat) => (
            <div key={cat.id} className="shrink-0">
              <Link
                href={cat.link}
                className="group/item flex flex-col items-center select-none cursor-pointer focus:outline-none"
              >
                {/* Round Avatar Disc Container */}
                <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 lg:w-36 lg:h-36 rounded-full bg-gradient-to-b from-[#F9FAFB] to-[#F1F4F9] border-2 border-slate-200/70 group-hover/item:border-[#0866E8] group-hover/item:shadow-lg group-hover/item:shadow-[#0866E8]/15 transition-all duration-300 flex items-center justify-center p-3 sm:p-4.5 overflow-hidden relative">
                  <div className="absolute inset-0 bg-blue-50/0 group-hover/item:bg-blue-50/40 rounded-full transition-colors duration-300 pointer-events-none" />
                  <img
                    src={cat.image}
                    alt={cat.name}
                    className="w-full h-full object-contain transition-transform duration-300 ease-out group-hover/item:scale-110 drop-shadow-xs"
                    loading="lazy"
                  />
                </div>

                {/* Category Title */}
                <span className="mt-3 text-center text-xs sm:text-sm lg:text-[14px] font-bold text-[#102A5E] group-hover/item:text-[#0866E8] transition-colors leading-snug line-clamp-2 max-w-[105px] sm:max-w-[130px]">
                  {cat.name}
                </span>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ShopByCollectionSection;
