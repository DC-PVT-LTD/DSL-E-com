'use client';

import React, { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { useReducedMotion } from 'framer-motion';
import SplitText from '@/components/common/SplitText';

// ============================================================================
// DISTRIBUTOR BRAND CARDS SPEC (FRAME 1 LIVE CODED BACKGROUND)
// ============================================================================
interface DistributorBrand {
  id: string;
  name: string;
  logo: string;
  slug: string;
  isGolden?: boolean;
}

const DISTRIBUTOR_BRANDS: DistributorBrand[] = [
  {
    id: 'linc-pentonic',
    name: 'LINC & Pentonic',
    logo: '/images/brands/card2_linc-pentonic_clean.png',
    slug: 'linc',
    isGolden: false,
  },
  {
    id: 'doms',
    name: 'DOMS',
    logo: '/images/brands/card2_doms_clean.png',
    slug: 'doms',
    isGolden: false,
  },
  {
    id: 'flexoffice',
    name: 'FlexOffice',
    logo: '/images/brands/card2_flexoffice_clean.png',
    slug: 'flexoffice',
    isGolden: true,
  },
  {
    id: 'amico',
    name: 'Amico',
    logo: '/images/brands/card2_amico_clean.png',
    slug: 'amico',
    isGolden: true,
  },
];

// ============================================================================
// ASSET DEFINITIONS & PRODUCT CARD SPECS
// ============================================================================
interface CardSpec {
  id: string;
  name: string;
  brand: string;
  category: string;
  slug: string;
  image: string;
  zIndex: number;
  // Frame 1 -> Frame 2: Entrance direction and window
  enterWindow: [number, number]; // [eStart, eEnd]
  entryFrom: { x: number; y: number; rotate: number; scale: number };
  // Frame 2: Floating scattered positions (matching frame 2.png)
  frame2: { x: number; y: number; rotate: number; scale: number };
  // Frame 3: Converged layered stack (matching frame 3.png)
  frame3: { x: number; y: number; rotate: number; scale: number };
  isFrontCard?: boolean;
}

// 6 Cards in strict order matching visual reference:
// Card 1: pentonic (brand 6.png) - enters from upper-left
// Card 2: SPEED (brand 4.png) - enters from upper-right
// Card 3: flexoffice (brand 1 (1).png) - enters from the left
// Card 4: DOMS (brand 1 (3).png) - enters from the right
// Card 5: LINC (brand 1 (2).png) - enters from bottom-left
// Card 6: Amigo Calculator (brand 5.png) - enters from bottom-right (Frontmost Card)
const PRODUCT_CARDS: CardSpec[] = [
  {
    id: 'pentonic',
    name: 'Pentonic Premium Writing',
    brand: 'Pentonic',
    category: 'Premium Writing',
    slug: 'pentonic',
    image: '/images/distributor/brand 6.png',
    zIndex: 10,
    enterWindow: [0.20, 0.36],
    entryFrom: { x: -350, y: -220, rotate: -22, scale: 0.65 },
    frame2: { x: -135, y: -18, rotate: -8, scale: 0.85 },
    frame3: { x: -105, y: -5, rotate: -5, scale: 0.94 },
  },
  {
    id: 'speed',
    name: 'SPEED Everyday Pens',
    brand: 'Speed',
    category: 'Writing Instruments',
    slug: 'speed',
    image: '/images/distributor/brand 4.png',
    zIndex: 20,
    enterWindow: [0.23, 0.39],
    entryFrom: { x: 320, y: -220, rotate: 18, scale: 0.65 },
    frame2: { x: 50, y: -78, rotate: -3, scale: 0.88 },
    frame3: { x: -63, y: -3, rotate: -3, scale: 0.96 },
  },
  {
    id: 'flexoffice',
    name: 'Flexoffice Files & Organization',
    brand: 'FlexOffice',
    category: 'Files & Organization',
    slug: 'flexoffice',
    image: '/images/distributor/brand 1 (1).png',
    zIndex: 30,
    enterWindow: [0.26, 0.42],
    entryFrom: { x: -380, y: 0, rotate: -15, scale: 0.65 },
    frame2: { x: 240, y: -60, rotate: 6, scale: 0.85 },
    frame3: { x: -21, y: -1, rotate: -1, scale: 0.98 },
  },
  {
    id: 'doms',
    name: 'DOMS Art & Creative',
    brand: 'Doms',
    category: 'Art & Creative',
    slug: 'doms',
    image: '/images/distributor/brand 1 (3).png',
    zIndex: 40,
    enterWindow: [0.29, 0.45],
    entryFrom: { x: 380, y: 0, rotate: 16, scale: 0.65 },
    frame2: { x: 155, y: -95, rotate: 2, scale: 0.90 },
    frame3: { x: 21, y: 1, rotate: 1, scale: 1.00 },
  },
  {
    id: 'linc',
    name: 'LINC Writing Instruments',
    brand: 'Linc',
    category: 'Writing Instruments',
    slug: 'linc',
    image: '/images/distributor/brand 1 (2).png',
    zIndex: 50,
    enterWindow: [0.32, 0.48],
    entryFrom: { x: -320, y: 220, rotate: -18, scale: 0.65 },
    frame2: { x: -60, y: 60, rotate: -3, scale: 0.88 },
    frame3: { x: 63, y: 3, rotate: 3, scale: 1.02 },
  },
  {
    id: 'amigo',
    name: 'Amigo Desk & Scientific Calculators',
    brand: 'Amigo',
    category: 'Calculators & Electronics',
    slug: 'amigo',
    image: '/images/distributor/brand 5.png',
    zIndex: 60,
    enterWindow: [0.35, 0.51],
    entryFrom: { x: 320, y: 240, rotate: 20, scale: 0.65 },
    frame2: { x: 225, y: 55, rotate: 4, scale: 0.92 },
    frame3: { x: 105, y: 5, rotate: 2, scale: 1.06 },
    isFrontCard: true,
  },
];

// Helper: smooth cubic ease-in-out interpolation
const smoothInterp = (t: number): number => t * t * (3 - 2 * t);

const interp = (p: number, p0: number, p1: number, v0: number, v1: number): number => {
  if (p <= p0) return v0;
  if (p >= p1) return v1;
  const t = (p - p0) / (p1 - p0);
  return v0 + (v1 - v0) * smoothInterp(t);
};

export const AuthorizedBrandsStackCard: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const initialSlotTopRef = useRef<number | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [scaleFactor, setScaleFactor] = useState(1);
  const prefersReducedMotion = useReducedMotion();

  // 1. Calculate responsive scale factor
  useEffect(() => {
    const handleResize = () => {
      if (!stageRef.current) return;
      const width = stageRef.current.clientWidth;
      if (width < 640) {
        setScaleFactor(0.44);
      } else if (width < 1024) {
        setScaleFactor(0.72);
      } else if (width < 1440) {
        setScaleFactor(0.88);
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
        const pinTop = Number.isFinite(stickyTopParsed) ? stickyTopParsed : contHeight * 0.15 + 24;
        const pinScroll = baseSlotTop - pinTop;

        // Card 2 arrives into place as the second card with 100% sharp background (Frame 1).
        // The transformation starts AFTER Card 2 has arrived into place, then animates through Frame 2 and Frame 3.
        const startScroll = pinScroll + 20;
        const endScroll = pinScroll + 340; // 320px scroll runway: smooth, fluid, responsive

        if (endScroll <= startScroll) return;

        const currentScroll = container.scrollTop;
        const raw = (currentScroll - startScroll) / (endScroll - startScroll);
        const clamped = Math.max(0, Math.min(1, raw));
        setScrollProgress(clamped);
      } else {
        // Fallback for window scroll: trigger after Card 2 arrives in position
        const rect = rootRef.current.getBoundingClientRect();
        const targetY = window.innerHeight * 0.15 + 24;
        const distPastPin = targetY - rect.top;
        const raw = distPastPin / 280;
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

  // 3. Compute background animation values
  // Frame 1: 0 to 0.20 (blur 0px, brightness 1.0)
  // Frame 2: 0.20 to 0.50 (blur smoothly to 10px, brightness to 0.72)
  // Frame 3: 0.50 to 1.00 (stays blurred at 10px, brightness 0.72)
  const bgBlur = interp(scrollProgress, 0.20, 0.48, 0, 10);
  const bgBrightness = interp(scrollProgress, 0.20, 0.48, 1.0, 0.72);
  const overlayOpacity = interp(scrollProgress, 0.20, 0.48, 0, 0.35);

  // 4. Compute each card's dynamic transform and opacity
  const getCardTransform = (card: CardSpec) => {
    if (prefersReducedMotion) {
      return {
        x: card.frame3.x * scaleFactor,
        y: card.frame3.y * scaleFactor,
        rotate: card.frame3.rotate,
        scale: card.frame3.scale,
        opacity: 1,
      };
    }

    const [eStart, eEnd] = card.enterWindow;
    const p = scrollProgress;

    // Phase 1: Not yet entered (hidden)
    if (p <= eStart) {
      return {
        x: card.entryFrom.x * scaleFactor,
        y: card.entryFrom.y * scaleFactor,
        rotate: card.entryFrom.rotate,
        scale: card.entryFrom.scale,
        opacity: 0,
      };
    }

    // Phase 2A: Entering from offscreen to Frame 2 scattered position
    if (p < eEnd) {
      const enterP = (p - eStart) / (eEnd - eStart);
      const ease = smoothInterp(enterP);
      return {
        x: (card.entryFrom.x + (card.frame2.x - card.entryFrom.x) * ease) * scaleFactor,
        y: (card.entryFrom.y + (card.frame2.y - card.entryFrom.y) * ease) * scaleFactor,
        rotate: card.entryFrom.rotate + (card.frame2.rotate - card.entryFrom.rotate) * ease,
        scale: card.entryFrom.scale + (card.frame2.scale - card.entryFrom.scale) * ease,
        opacity: Math.min(1, enterP * 1.5),
      };
    }

    // Phase 2B: Floating in Frame 2 scattered position
    if (p <= 0.55) {
      return {
        x: card.frame2.x * scaleFactor,
        y: card.frame2.y * scaleFactor,
        rotate: card.frame2.rotate,
        scale: card.frame2.scale,
        opacity: 1,
      };
    }

    // Phase 3A: Converging from Frame 2 scattered into Frame 3 stacked
    if (p < 0.80) {
      const stackP = (p - 0.55) / (0.80 - 0.55);
      const ease = smoothInterp(stackP);
      return {
        x: (card.frame2.x + (card.frame3.x - card.frame2.x) * ease) * scaleFactor,
        y: (card.frame2.y + (card.frame3.y - card.frame2.y) * ease) * scaleFactor,
        rotate: card.frame2.rotate + (card.frame3.rotate - card.frame2.rotate) * ease,
        scale: card.frame2.scale + (card.frame3.scale - card.frame2.scale) * ease,
        opacity: 1,
      };
    }

    // Phase 3B: Settled in Frame 3 overlapping stack
    return {
      x: card.frame3.x * scaleFactor,
      y: card.frame3.y * scaleFactor,
      rotate: card.frame3.rotate,
      scale: card.frame3.scale,
      opacity: 1,
    };
  };

  return (
    <div
      ref={rootRef}
      className="relative w-full flex-1 min-h-[380px] sm:min-h-[420px] lg:min-h-[460px] flex items-center justify-center overflow-hidden bg-[#071836] select-none"
    >
      {/* Aspect-Ratio Preserving Inner Stage */}
      <div
        ref={stageRef}
        className="relative w-full h-full min-h-[380px] sm:min-h-[420px] lg:min-h-[460px] flex items-center justify-center overflow-hidden self-stretch"
      >
        {/* ========================================================= */}
        {/* 1. CODED DISTRIBUTOR BACKGROUND BANNER (FRAME 1)           */}
        {/* Pure React / Tailwind / CSS - NOT a flattened photo!      */}
        {/* ========================================================= */}
        <div
          className="absolute inset-0 w-full h-full will-change-transform flex flex-col justify-center gap-6 sm:gap-10 py-6 sm:py-8 px-4 sm:px-6 md:px-8 select-none"
          style={{
            filter: `blur(${bgBlur}px) brightness(${bgBrightness})`,
            transform: bgBlur > 0.5 ? 'scale(1.02)' : 'scale(1.0)',
            transition: 'transform 0.15s ease-out',
          }}
        >
          {/* Header Block matching reference */}
          <div className="text-center w-full max-w-3xl mx-auto">
            {/* Top Label: — OUR BRANDS — */}
            <div className="inline-flex items-center justify-center gap-3 sm:gap-4 mb-2 sm:mb-2.5">
              <span className="h-[1px] w-8 sm:w-16 bg-gradient-to-r from-transparent via-blue-400/50 to-blue-400" />
              <SplitText
                text="OUR BRANDS"
                tag="span"
                className="text-[10px] sm:text-xs font-black tracking-[0.28em] text-[#60A5FA] uppercase select-none inline-block"
                effect="fade"
                splitType="chars"
                delay={30}
                duration={0.8}
                trigger="view"
              />
              <span className="h-[1px] w-8 sm:w-16 bg-gradient-to-l from-transparent via-blue-400/50 to-blue-400" />
            </div>

            {/* Main Heading: and Authorized Distributor for Sri Lanka: */}
            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-[34px] font-black tracking-tight text-white leading-tight flex items-center justify-center flex-wrap gap-x-2">
              <SplitText
                text="and Authorized Distributor for"
                tag="span"
                effect="rise"
                splitType="words, chars"
                delay={35}
                duration={1.0}
                trigger="view"
                className="text-white inline-block"
              />
              <span className="relative inline-block text-[#FFD84D] italic font-black">
                <SplitText
                  text="Sri Lanka:"
                  tag="span"
                  effect="rise"
                  splitType="chars"
                  delay={45}
                  duration={1.0}
                  trigger="view"
                  className="text-[#FFD84D] inline-block"
                />
                {/* Curved yellow underline matching reference */}
                <svg
                  className="absolute -bottom-2 sm:-bottom-2.5 left-0 w-full h-2.5 sm:h-3.5 overflow-visible pointer-events-none"
                  viewBox="0 0 100 14"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M 2 4 Q 50 14 98 4"
                    stroke="#FFD84D"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h2>
          </div>

          {/* 4 Brand Glass Cards in One Row */}
          <div className="w-full max-w-4xl mx-auto my-auto pt-3 sm:pt-5 pb-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-5 w-full items-stretch">
              {DISTRIBUTOR_BRANDS.map((brand) => (
                <div key={brand.id} className="relative flex flex-col items-center">
                  <Link
                    href={`/brands/${brand.slug}`}
                    className={`card2-brand-glass group/card relative w-full h-24 sm:h-28 md:h-32 rounded-2xl flex items-center justify-center p-2.5 sm:p-3 transition-all duration-300 cursor-pointer overflow-hidden ${brand.isGolden ? 'is-golden' : ''
                      }`}
                    aria-label={`Explore ${brand.name} Products`}
                  >
                    {/* Golden edge highlight accent on selected cards */}
                    {brand.isGolden && (
                      <div className="golden-edge-highlight absolute top-0 inset-x-3 h-[2px] bg-gradient-to-r from-transparent via-[#FFD84D] to-transparent rounded-full pointer-events-none z-10" />
                    )}

                    {/* Subtle top specular sheen */}
                    <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none rounded-t-2xl" />

                    {/* Inner Logo Capsule / Bed */}
                    <div className="relative z-10 w-full h-full flex items-center justify-center rounded-xl overflow-hidden shadow-sm group-hover/card:shadow-md transition-all duration-300">
                      <img
                        src={brand.logo}
                        alt={`${brand.name} Logo`}
                        className="w-full h-full object-contain select-none transition-transform duration-300 group-hover/card:scale-105 rounded-xl"
                        draggable={false}
                      />
                    </div>
                  </Link>

                  {/* Realistic reflection beneath each card */}
                  <div
                    className="card2-reflection absolute -bottom-7 sm:-bottom-8 inset-x-2 h-6 sm:h-7 pointer-events-none select-none overflow-hidden opacity-30 group-hover/card:opacity-45 transition-opacity"
                    aria-hidden="true"
                  >
                    <div className="w-full h-full rounded-xl flex items-center justify-center p-0.5">
                      <img
                        src={brand.logo}
                        alt=""
                        className="max-h-full w-auto object-contain opacity-50 brightness-110 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Soft electric blue floor glow ellipse */}
                  <div
                    className="absolute -bottom-2 inset-x-4 h-1.5 bg-gradient-to-r from-transparent via-[#2672E8]/40 to-transparent blur-xs rounded-full pointer-events-none"
                    aria-hidden="true"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. CINEMATIC BACKGROUND OVERLAY (FRAME 2 & 3)             */}
        {/* ========================================================= */}
        <div
          className="absolute inset-0 w-full h-full bg-gradient-to-t from-[#011640]/60 via-[#011640]/20 to-[#011640]/60 pointer-events-none"
          style={{
            opacity: overlayOpacity,
            transition: 'opacity 0.15s ease-out',
          }}
          aria-hidden="true"
        />

        {/* Subtle Ambient Radial Glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#00B4FF]/15 rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        {/* ========================================================= */}
        {/* 3. SIX PRODUCT CARDS LAYER (FRAMES 1 -> 2 -> 3)           */}
        {/* ========================================================= */}
        <div className="absolute inset-0 w-full h-full pointer-events-none flex items-center justify-center">
          {PRODUCT_CARDS.map((card) => {
            const transform = getCardTransform(card);

            return (
              <div
                key={card.id}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{
                  zIndex: card.zIndex,
                  pointerEvents: transform.opacity > 0.1 ? 'auto' : 'none',
                }}
              >
                <div
                  className="w-[108px] sm:w-[142px] md:w-[176px] lg:w-[208px] origin-center will-change-transform"
                  style={{
                    transform: `translate3d(${transform.x}px, ${transform.y}px, 0) rotate(${transform.rotate}deg) scale(${transform.scale})`,
                    opacity: transform.opacity,
                    transition: prefersReducedMotion ? 'none' : 'transform 0.12s ease-out, opacity 0.12s ease-out',
                  }}
                >
                  <Link
                    href={`/brands/${card.slug}`}
                    aria-label={card.name}
                    className="block group/card cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#00B4FF] rounded-2xl"
                  >
                    <div className="relative transform-gpu transition-all duration-300 group-hover/card:scale-105 group-hover/card:-translate-y-2">
                      {/* Main Card Image */}
                      <img
                        src={card.image}
                        alt={card.name}
                        className={`w-full h-auto object-contain select-none transition-all duration-300 ${card.isFrontCard
                          ? 'drop-shadow-[0_20px_45px_rgba(0,180,255,0.5)]'
                          : 'drop-shadow-[0_12px_26px_rgba(0,0,0,0.55)] group-hover/card:drop-shadow-[0_18px_36px_rgba(0,180,255,0.4)]'
                          }`}
                        draggable={false}
                      />

                      {/* Interactive Specular Sheen Glow on hover */}
                      <div className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 bg-gradient-to-t from-transparent via-[#00B4FF]/10 to-white/20" />
                    </div>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .card2-brand-glass {
          background: linear-gradient(180deg, rgba(22, 58, 117, 0.45) 0%, rgba(14, 39, 93, 0.6) 100%);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(59, 130, 246, 0.35);
          box-shadow: 0 8px 30px rgba(2, 10, 32, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.15);
          animation: card2GentleGlow 4.5s ease-in-out infinite;
        }

        .card2-brand-glass:hover {
          border-color: rgba(96, 165, 250, 0.85);
          box-shadow: 0 12px 35px rgba(2, 10, 35, 0.6), 0 0 20px rgba(38, 114, 232, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.25);
          transform: translateY(-2px);
        }

        .card2-brand-glass.is-golden {
          border-color: rgba(255, 216, 77, 0.45);
          box-shadow: 0 8px 30px rgba(2, 10, 32, 0.45), 0 0 15px rgba(255, 216, 77, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.2);
        }

        .card2-brand-glass.is-golden:hover {
          border-color: rgba(255, 216, 77, 0.85);
          box-shadow: 0 12px 35px rgba(2, 10, 35, 0.6), 0 0 25px rgba(255, 216, 77, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.3);
        }

        .card2-reflection {
          transform: scaleY(-1);
          mask-image: linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0) 80%);
          -webkit-mask-image: linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0) 80%);
          filter: blur(1.5px);
        }

        @keyframes card2GentleGlow {
          0%, 100% {
            border-color: rgba(59, 130, 246, 0.35);
            box-shadow: 0 8px 30px rgba(2, 10, 32, 0.45), 0 0 12px rgba(38, 114, 232, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.15);
          }
          50% {
            border-color: rgba(96, 165, 250, 0.6);
            box-shadow: 0 8px 30px rgba(2, 10, 32, 0.45), 0 0 22px rgba(38, 114, 232, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.25);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .card2-brand-glass {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
};
