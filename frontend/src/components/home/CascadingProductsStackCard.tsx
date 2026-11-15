'use client';

import React, { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { useReducedMotion } from 'framer-motion';

// ============================================================================
// PRODUCT CARD SPECIFICATION (THIRD SECTION SCROLLSTACK CARD)
// ============================================================================
interface CascadingCardSpec {
  id: string;
  name: string;
  brand: string;
  category: string;
  slug: string;
  image: string;
  zIndex: number;
  isGolden?: boolean;
  // Entrance window [start, end] in normalized scroll progress (0.0 to 1.0)
  enterWindow: [number, number];
  // Entrance offset & rotation (relative to resting position)
  entryFrom: { x: number; y: number; rotate: number; scale: number };
  // Final resting position in percentage of container (Desktop / Tablet)
  desktopPos: { left: number; top: number; rotate: number };
  // Final resting position in percentage of container (Mobile)
  mobilePos: { left: number; top: number; rotate: number };
}

// Order matching visual reference (media_1794686212678_ba911b28.png):
// Card 1: DOMS Art & Creative (brand 1 (3).png) - Enters from upper-left (Golden highlight)
// Card 2: FlexOffice Files & Organization (brand 1 (1).png) - Enters from upper-right
// Card 3: Amico Desk & Scientific Calculators (brand 5.png) - Enters from left
// Card 4: LINC Writing Instruments (brand 1 (2).png) - Enters from right
// Card 5: SPEED Everyday Pens (brand 4.png) - Enters from lower-left
// Card 6: Pentonic Premium Writing (brand 6.png) - Enters from lower-right
const CASCADING_CARDS: CascadingCardSpec[] = [
  {
    id: 'doms',
    name: 'DOMS Art & Creative',
    brand: 'DOMS',
    category: 'Art & Creative',
    slug: 'doms',
    image: '/images/third-section/brand 1 (3).png',
    zIndex: 10,
    isGolden: true,
    enterWindow: [0.04, 0.28],
    entryFrom: { x: -360, y: -260, rotate: -18, scale: 0.65 },
    desktopPos: { left: 8.5, top: 25.5, rotate: 0 },
    mobilePos: { left: 28, top: 22, rotate: -2 },
  },
  {
    id: 'flexoffice',
    name: 'FlexOffice Files & Organization',
    brand: 'FlexOffice',
    category: 'Files & Organization',
    slug: 'flexoffice',
    image: '/images/third-section/brand 1 (1).png',
    zIndex: 20,
    enterWindow: [0.14, 0.38],
    entryFrom: { x: 360, y: -260, rotate: 18, scale: 0.65 },
    desktopPos: { left: 25.0, top: 37.5, rotate: 0 },
    mobilePos: { left: 72, top: 28, rotate: 2 },
  },
  {
    id: 'amico',
    name: 'Amico Calculators & Electronics',
    brand: 'Amico',
    category: 'Calculators & Electronics',
    slug: 'amico',
    image: '/images/third-section/brand 5.png',
    zIndex: 30,
    enterWindow: [0.24, 0.48],
    entryFrom: { x: -420, y: 0, rotate: -14, scale: 0.65 },
    desktopPos: { left: 42.5, top: 48.0, rotate: 0 },
    mobilePos: { left: 28, top: 50, rotate: -1 },
  },
  {
    id: 'linc',
    name: 'LINC Writing Instruments',
    brand: 'LINC',
    category: 'Writing Instruments',
    slug: 'linc',
    image: '/images/third-section/brand 1 (2).png',
    zIndex: 40,
    enterWindow: [0.34, 0.58],
    entryFrom: { x: 420, y: 0, rotate: 14, scale: 0.65 },
    desktopPos: { left: 59.8, top: 55.0, rotate: 0 },
    mobilePos: { left: 72, top: 56, rotate: 2 },
  },
  {
    id: 'speed',
    name: 'SPEED Everyday Pens',
    brand: 'Speed',
    category: 'Writing Instruments',
    slug: 'speed',
    image: '/images/third-section/brand 4.png',
    zIndex: 50,
    enterWindow: [0.42, 0.64],
    entryFrom: { x: -360, y: 280, rotate: -16, scale: 0.65 },
    desktopPos: { left: 76.8, top: 64.5, rotate: 0 },
    mobilePos: { left: 28, top: 76, rotate: -2 },
  },
  {
    id: 'pentonic',
    name: 'Pentonic Premium Writing',
    brand: 'Pentonic',
    category: 'Premium Writing',
    slug: 'pentonic',
    image: '/images/third-section/brand 6.png',
    zIndex: 60,
    enterWindow: [0.50, 0.70],
    entryFrom: { x: 360, y: 280, rotate: 16, scale: 0.65 },
    desktopPos: { left: 92.5, top: 74.0, rotate: 0 },
    mobilePos: { left: 72, top: 82, rotate: 2 },
  },
];

// Helper: smooth Hermite cubic ease-in-out
const smoothInterp = (t: number): number => t * t * (3 - 2 * t);

export const CascadingProductsStackCard: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const initialSlotTopRef = useRef<number | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [scaleFactor, setScaleFactor] = useState(1);
  const prefersReducedMotion = useReducedMotion();

  // 1. Responsive layout & scale detection
  useEffect(() => {
    const handleResize = () => {
      if (!stageRef.current) return;
      const width = stageRef.current.clientWidth;
      setIsMobile(width < 640);

      if (width < 640) {
        setScaleFactor(0.68);
      } else if (width < 1024) {
        setScaleFactor(0.80);
      } else if (width < 1440) {
        setScaleFactor(0.92);
      } else {
        setScaleFactor(1.0);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 2. Track container scroll progress inside ScrollStack
  useEffect(() => {
    if (prefersReducedMotion) {
      setScrollProgress(1);
      return;
    }

    const computeProgress = () => {
      if (!rootRef.current) return;
      const cardSlot = rootRef.current.closest('[data-stack-slot]') as HTMLElement | null;
      const container = rootRef.current.closest('.scroll-stack--contained') as HTMLElement | null;

      if (container && cardSlot) {
        if (!cardSlot.offsetTop) {
          setScrollProgress(0);
          return;
        }

        if (initialSlotTopRef.current === null && cardSlot.offsetTop > 0) {
          initialSlotTopRef.current = cardSlot.offsetTop;
        }
        const baseSlotTop = initialSlotTopRef.current ?? cardSlot.offsetTop;
        const contHeight = container.clientHeight || 600;
        const stickyTopParsed = parseFloat(getComputedStyle(cardSlot).top);
        const pinTop = Number.isFinite(stickyTopParsed) ? stickyTopParsed : contHeight * 0.15 + 48;
        const pinScroll = baseSlotTop - pinTop;

        // Card 3 arrives into place as the third card with empty background (Stage 1).
        // The cascading entrance (Stage 2) occurs as the user continues scrolling.
        // Stage 3 holds the final diagonal arrangement.
        const startScroll = pinScroll + 20;
        const endScroll = pinScroll + 360; // 340px scroll runway: smooth, fluid cascade

        if (endScroll <= startScroll) return;

        const currentScroll = container.scrollTop;
        const raw = (currentScroll - startScroll) / (endScroll - startScroll);
        const clamped = Math.max(0, Math.min(1, raw));
        setScrollProgress(clamped);
      } else {
        // Fallback for window scroll
        const rect = rootRef.current.getBoundingClientRect();
        const targetY = window.innerHeight * 0.15 + 48;
        const distPastPin = targetY - rect.top;
        const raw = distPastPin / 350;
        const clamped = Math.max(0, Math.min(1, raw));
        setScrollProgress(clamped);
      }
    };

    computeProgress();

    const scrollContainer = rootRef.current?.closest('.scroll-stack--contained') || window;
    const onScroll = () => computeProgress();

    scrollContainer.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    const timer = setTimeout(computeProgress, 120);

    return () => {
      clearTimeout(timer);
      scrollContainer.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [prefersReducedMotion]);

  // 3. Compute dynamic transform & opacity for each card
  const getCardTransform = (card: CascadingCardSpec) => {
    if (prefersReducedMotion) {
      return {
        dx: 0,
        dy: 0,
        rotate: 0,
        scale: 1,
        opacity: 1,
      };
    }

    const [eStart, eEnd] = card.enterWindow;
    const p = scrollProgress;

    // Stage 1: Card has not entered yet (Hidden)
    if (p <= eStart) {
      return {
        dx: card.entryFrom.x * scaleFactor,
        dy: card.entryFrom.y * scaleFactor,
        rotate: card.entryFrom.rotate,
        scale: card.entryFrom.scale,
        opacity: 0,
      };
    }

    // Stage 2: Card enters along its trajectory towards resting position
    if (p < eEnd) {
      const enterP = (p - eStart) / (eEnd - eStart);
      const ease = smoothInterp(enterP);
      return {
        dx: card.entryFrom.x * (1 - ease) * scaleFactor,
        dy: card.entryFrom.y * (1 - ease) * scaleFactor,
        rotate: card.entryFrom.rotate * (1 - ease),
        scale: card.entryFrom.scale + (1.0 - card.entryFrom.scale) * ease,
        opacity: Math.min(1, enterP * 1.5),
      };
    }

    // Stage 3: Card settled in final cascading diagonal position
    return {
      dx: 0,
      dy: 0,
      rotate: 0,
      scale: 1.0,
      opacity: 1,
    };
  };

  return (
    <div
      ref={rootRef}
      className="relative w-full flex-1 min-h-[380px] sm:min-h-[420px] lg:min-h-[460px] flex items-center justify-center overflow-hidden bg-[#071836] select-none rounded-[28px]"
    >
      {/* Aspect-Ratio Preserving Inner Stage */}
      <div
        ref={stageRef}
        className="relative w-full h-full min-h-[380px] sm:min-h-[420px] lg:min-h-[460px] flex items-center justify-center overflow-hidden self-stretch rounded-[28px]"
      >
        {/* ========================================================= */}
        {/* 1. DARK NAVY BLUE GLOSSY BACKGROUND                       */}
        {/* ========================================================= */}
        <img
          src="/images/third-section/background image.png"
          alt="DSL Stationery Brands Collection"
          className="absolute inset-0 w-full h-full object-cover object-center select-none pointer-events-none rounded-[28px]"
          draggable={false}
        />

        {/* Ambient Radial Floor Glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[350px] bg-[#0066FF]/10 rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        {/* ========================================================= */}
        {/* 2. SIX INDIVIDUAL PRODUCT CARDS (STAGGERED CASCADE)       */}
        {/* ========================================================= */}
        <div className="absolute inset-0 w-full h-full pointer-events-none">
          {CASCADING_CARDS.map((card) => {
            const transform = getCardTransform(card);
            const pos = isMobile ? card.mobilePos : card.desktopPos;

            return (
              <div
                key={card.id}
                className="absolute origin-center will-change-transform pointer-events-none"
                style={{
                  left: `${pos.left}%`,
                  top: `${pos.top}%`,
                  zIndex: card.zIndex,
                  pointerEvents: transform.opacity > 0.1 ? 'auto' : 'none',
                }}
              >
                <div
                  className="w-[94px] sm:w-[130px] md:w-[155px] lg:w-[175px] origin-center will-change-transform"
                  style={{
                    transform: `translate(-50%, -50%) translate3d(${transform.dx}px, ${transform.dy}px, 0) rotate(${pos.rotate + transform.rotate}deg) scale(${transform.scale})`,
                    opacity: transform.opacity,
                    transition: prefersReducedMotion
                      ? 'none'
                      : 'transform 0.12s ease-out, opacity 0.12s ease-out',
                  }}
                >
                  <Link
                    href={`/brands/${card.slug}`}
                    aria-label={`Explore ${card.name}`}
                    className="block group/card cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#00B4FF] rounded-2xl"
                  >
                    <div className="relative transform-gpu transition-all duration-300 group-hover/card:scale-105 group-hover/card:-translate-y-2">
                      {/* Product Card Artwork with Built-in Glowing Border */}
                      <img
                        src={card.image}
                        alt={card.name}
                        className={`w-full h-auto object-contain select-none transition-all duration-300 ${card.isGolden
                            ? 'drop-shadow-[0_0_22px_rgba(255,216,77,0.45)] group-hover/card:drop-shadow-[0_0_32px_rgba(255,216,77,0.7)]'
                            : 'drop-shadow-[0_0_18px_rgba(0,180,255,0.4)] group-hover/card:drop-shadow-[0_0_28px_rgba(0,180,255,0.65)]'
                          }`}
                        draggable={false}
                      />

                      {/* Interactive Specular Glow on hover */}
                      <div className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 bg-gradient-to-t from-transparent via-[#00B4FF]/10 to-white/15" />
                    </div>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
