'use client';

import React, { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';

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
  // Frame 1 -> Frame 2: Entrance trajectories from offscreen
  // [startProgress, endProgress]
  enterWindow: [number, number];
  entryFrom: { x: number; y: number; rotate: number };
  // Frame 2: Floating scattered positions (matching frame 2.png)
  frame2: { x: number; y: number; rotate: number; scale: number };
  // Frame 3: Converged layered stack (matching frame 3.png)
  frame3: { x: number; y: number; rotate: number; scale: number };
  isFrontCard?: boolean;
}

// 6 Cards in order from back to front:
// 1. pentonic (brand 6.png)
// 2. SPEED (brand 4.png)
// 3. flexoffice (brand 1 (1).png)
// 4. DOMS (brand 1 (3).png)
// 5. LINC (brand 1 (2).png)
// 6. amico calculator (brand 5.png) - Frontmost Prominent Card
const PRODUCT_CARDS: CardSpec[] = [
  {
    id: 'pentonic',
    name: 'Pentonic Premium Writing',
    brand: 'Pentonic',
    category: 'Premium Writing',
    slug: 'pentonic',
    image: '/images/distributor/brand 6.png',
    zIndex: 10,
    enterWindow: [0.18, 0.36],
    entryFrom: { x: -380, y: -240, rotate: -20 },
    frame2: { x: 140, y: 10, rotate: -7, scale: 0.88 },
    frame3: { x: -125, y: -6, rotate: -5, scale: 0.94 },
  },
  {
    id: 'speed',
    name: 'SPEED Everyday Pens',
    brand: 'Speed',
    category: 'Writing Instruments',
    slug: 'speed',
    image: '/images/distributor/brand 4.png',
    zIndex: 20,
    enterWindow: [0.22, 0.40],
    entryFrom: { x: 60, y: -340, rotate: -12 },
    frame2: { x: 120, y: -115, rotate: -4, scale: 0.90 },
    frame3: { x: -75, y: -4, rotate: -3, scale: 0.96 },
  },
  {
    id: 'flexoffice',
    name: 'Flexoffice Files & Organization',
    brand: 'FlexOffice',
    category: 'Files & Organization',
    slug: 'flexoffice',
    image: '/images/distributor/brand 1 (1).png',
    zIndex: 30,
    enterWindow: [0.26, 0.44],
    entryFrom: { x: 440, y: -280, rotate: 16 },
    frame2: { x: 380, y: -90, rotate: 6, scale: 0.88 },
    frame3: { x: -25, y: -2, rotate: -1, scale: 0.98 },
  },
  {
    id: 'doms',
    name: 'DOMS Art & Creative',
    brand: 'Doms',
    category: 'Art & Creative',
    slug: 'doms',
    image: '/images/distributor/brand 1 (3).png',
    zIndex: 40,
    enterWindow: [0.30, 0.48],
    entryFrom: { x: 480, y: 20, rotate: 10 },
    frame2: { x: 260, y: -130, rotate: 2, scale: 0.92 },
    frame3: { x: 25, y: 0, rotate: 1.5, scale: 1.0 },
  },
  {
    id: 'linc',
    name: 'LINC Writing Instruments',
    brand: 'Linc',
    category: 'Writing Instruments',
    slug: 'linc',
    image: '/images/distributor/brand 1 (2).png',
    zIndex: 50,
    enterWindow: [0.34, 0.52],
    entryFrom: { x: 80, y: 340, rotate: -14 },
    frame2: { x: 235, y: 70, rotate: -3, scale: 0.92 },
    frame3: { x: 75, y: 2, rotate: 3, scale: 1.02 },
  },
  {
    id: 'amigo',
    name: 'Amigo Desk & Scientific Calculators',
    brand: 'Amigo',
    category: 'Calculators & Electronics',
    slug: 'amigo',
    image: '/images/distributor/brand 5.png',
    zIndex: 60,
    enterWindow: [0.38, 0.56],
    entryFrom: { x: 450, y: 320, rotate: 15 },
    frame2: { x: 370, y: 80, rotate: 4, scale: 0.96 },
    frame3: { x: 130, y: 5, rotate: 2, scale: 1.06 },
    isFrontCard: true,
  },
];

// Preload all 7 images on browser mount
const PRELOAD_ASSETS = [
  '/images/distributor/background,frame 1.png',
  '/images/distributor/brand 6.png',
  '/images/distributor/brand 4.png',
  '/images/distributor/brand 1 (1).png',
  '/images/distributor/brand 1 (3).png',
  '/images/distributor/brand 1 (2).png',
  '/images/distributor/brand 5.png',
];

// ============================================================================
// SINGLE PRODUCT CARD COMPONENT
// ============================================================================
interface AnimatedProductCardProps {
  card: CardSpec;
  scrollYProgress: any;
  scaleFactor: number;
  prefersReducedMotion: boolean | null;
}

const AnimatedProductCard: React.FC<AnimatedProductCardProps> = ({
  card,
  scrollYProgress,
  scaleFactor,
  prefersReducedMotion,
}) => {
  const [eStart, eEnd] = card.enterWindow;

  // Frame 1: 0% to eStart (hidden)
  // Transition to Frame 2: eStart to eEnd (enter from offscreen)
  // Frame 2 (Floating): eEnd to 0.65
  // Transition to Frame 3: 0.65 to 0.85 (converge to stack)
  // Frame 3 (Layered Stack): 0.85 to 1.00
  const progressTimeline = [0, eStart, eEnd, 0.65, 0.85, 1.0];

  // Responsive scaled positions
  const xValues = [
    card.entryFrom.x * scaleFactor,
    card.entryFrom.x * scaleFactor,
    card.frame2.x * scaleFactor,
    card.frame2.x * scaleFactor,
    card.frame3.x * scaleFactor,
    card.frame3.x * scaleFactor,
  ];

  const yValues = [
    card.entryFrom.y * scaleFactor,
    card.entryFrom.y * scaleFactor,
    card.frame2.y * scaleFactor,
    card.frame2.y * scaleFactor,
    card.frame3.y * scaleFactor,
    card.frame3.y * scaleFactor,
  ];

  const rotateValues = [
    card.entryFrom.rotate,
    card.entryFrom.rotate,
    card.frame2.rotate,
    card.frame2.rotate,
    card.frame3.rotate,
    card.frame3.rotate,
  ];

  const scaleValues = [
    0.65,
    0.65,
    card.frame2.scale,
    card.frame2.scale,
    card.frame3.scale,
    card.frame3.scale,
  ];

  const x = useTransform(scrollYProgress, progressTimeline, xValues);
  const y = useTransform(scrollYProgress, progressTimeline, yValues);
  const rotate = useTransform(scrollYProgress, progressTimeline, rotateValues);
  const scale = useTransform(scrollYProgress, progressTimeline, scaleValues);
  const opacity = useTransform(scrollYProgress, (v: number) => {
    if (v < eStart) return 0;
    if (v >= eEnd) return 1;
    return (v - eStart) / (eEnd - eStart);
  });

  if (prefersReducedMotion) {
    return (
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140px] sm:w-[190px] md:w-[230px] lg:w-[270px] pointer-events-auto transition-transform duration-300 hover:scale-105"
        style={{
          transform: `translate(calc(-50% + ${card.frame3.x * scaleFactor}px), calc(-50% + ${card.frame3.y * scaleFactor}px)) rotate(${card.frame3.rotate}deg) scale(${card.frame3.scale})`,
          zIndex: card.zIndex,
        }}
      >
        <Link href={`/brands/${card.slug}`} aria-label={card.name} className="block group/card">
          <img
            src={card.image}
            alt={card.name}
            className={`w-full h-auto object-contain select-none transition-shadow duration-300 ${card.isFrontCard
                ? 'drop-shadow-[0_20px_45px_rgba(0,180,255,0.45)]'
                : 'drop-shadow-[0_12px_28px_rgba(0,0,0,0.5)]'
              }`}
            draggable={false}
          />
        </Link>
      </div>
    );
  }

  return (
    <div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
      style={{
        zIndex: card.zIndex,
      }}
    >
      <motion.div
        className="w-[140px] sm:w-[190px] md:w-[230px] lg:w-[270px] origin-center will-change-transform"
        style={{
          x,
          y,
          rotate,
          scale,
          opacity,
          pointerEvents: useTransform(opacity, (o: number) => (o > 0.1 ? 'auto' : 'none')),
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
                  ? 'drop-shadow-[0_24px_50px_rgba(0,180,255,0.5)]'
                  : 'drop-shadow-[0_14px_30px_rgba(0,0,0,0.55)] group-hover/card:drop-shadow-[0_20px_40px_rgba(0,180,255,0.4)]'
                }`}
              draggable={false}
            />

            {/* Interactive Specular Glow on hover */}
            <div className="absolute inset-0 rounded-3xl pointer-events-none opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 bg-gradient-to-t from-transparent via-[#00B4FF]/10 to-white/20" />
          </div>
        </Link>
      </motion.div>
    </div>
  );
};

// ============================================================================
// MAIN DISTRIBUTOR ANIMATION SECTION
// ============================================================================
export const DistributorAnimationSection: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scaleFactor, setScaleFactor] = useState(1);
  const prefersReducedMotion = useReducedMotion();

  // Preload all assets in the background
  useEffect(() => {
    PRELOAD_ASSETS.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // Compute responsive scale factor based on stage viewport width
  useEffect(() => {
    const handleResize = () => {
      if (!stageRef.current) return;
      const width = stageRef.current.clientWidth;
      if (width < 640) {
        // Mobile (360px - 640px)
        setScaleFactor(0.42);
      } else if (width < 1024) {
        // Tablet (640px - 1024px)
        setScaleFactor(0.72);
      } else if (width < 1440) {
        // Standard Laptop (1024px - 1440px)
        setScaleFactor(0.88);
      } else {
        // Large Desktop / Ultra-wide
        setScaleFactor(1.0);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Track scroll progression through the section
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Background Banner Animation Values
  // Frame 1: sharp (blur 0px, brightness 1, scale 1)
  // Frame 2 & 3: smooth blur to 10px, brightness 0.72, scale 1.025
  const bgBlur = useTransform(scrollYProgress, [0.18, 0.45], [0, 10]);
  const bgBrightness = useTransform(scrollYProgress, [0.18, 0.45], [1.0, 0.72]);
  const bgScale = useTransform(scrollYProgress, [0.18, 0.45], [1.0, 1.03]);

  // Dark Cinematic Overlay Opacity (Frame 2 & 3)
  const overlayOpacity = useTransform(scrollYProgress, [0.18, 0.45], [0, 0.38]);

  // Scroll Pill Indicator: visible only during Frame 1, fades out smoothly
  const indicatorOpacity = useTransform(scrollYProgress, [0.05, 0.18], [1, 0]);

  return (
    <section
      ref={containerRef}
      aria-label="Authorized Distributor Product Showcase"
      className="relative w-full h-[280vh] bg-[#011D51] select-none"
    >
      {/* Sticky Viewport Stage (100dvh) */}
      <div className="sticky top-0 w-full h-screen min-h-[500px] flex items-center justify-center overflow-hidden bg-[#011D51]">
        {/* Aspect-Ratio Preserving Stage Container */}
        <div
          ref={stageRef}
          className="relative w-full max-w-[1720px] aspect-[2171/724] min-h-[380px] sm:min-h-[460px] md:min-h-[520px] lg:min-h-[620px] flex items-center justify-center overflow-hidden"
        >
          {/* ========================================================= */}
          {/* 1. DISTRIBUTOR BACKGROUND BANNER (FRAME 1)                 */}
          {/* ========================================================= */}
          <motion.div
            className="absolute inset-0 w-full h-full will-change-transform"
            style={{
              filter: prefersReducedMotion
                ? 'blur(8px) brightness(0.75)'
                : undefined,
              scale: prefersReducedMotion ? 1.02 : bgScale,
            }}
          >
            {/* Background image rendered with motion filter */}
            {!prefersReducedMotion ? (
              <motion.img
                src="/images/distributor/background,frame 1.png"
                alt="DSL Authorized Distributor for Sri Lanka"
                className="w-full h-full object-contain select-none pointer-events-none"
                style={{
                  filter: useTransform(
                    [bgBlur, bgBrightness],
                    ([b, br]) => `blur(${b}px) brightness(${br})`
                  ),
                }}
                draggable={false}
              />
            ) : (
              <img
                src="/images/distributor/background,frame 1.png"
                alt="DSL Authorized Distributor for Sri Lanka"
                className="w-full h-full object-contain select-none pointer-events-none filter blur-[8px] brightness-[0.75]"
                draggable={false}
              />
            )}
          </motion.div>

          {/* ========================================================= */}
          {/* 2. CINEMATIC BACKGROUND OVERLAY (FRAME 2 & 3)             */}
          {/* ========================================================= */}
          <motion.div
            className="absolute inset-0 w-full h-full bg-gradient-to-t from-[#011640]/60 via-[#011640]/25 to-[#011640]/60 pointer-events-none"
            style={{
              opacity: prefersReducedMotion ? 0.35 : overlayOpacity,
            }}
            aria-hidden="true"
          />

          {/* Subtle Ambient Radial Glows */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-[#00B4FF]/12 rounded-full blur-3xl pointer-events-none"
            aria-hidden="true"
          />

          {/* ========================================================= */}
          {/* 3. PRODUCT CARDS LAYER (FRAMES 1 -> 2 -> 3)               */}
          {/* ========================================================= */}
          <div className="absolute inset-0 w-full h-full pointer-events-none flex items-center justify-center">
            {PRODUCT_CARDS.map((card) => (
              <AnimatedProductCard
                key={card.id}
                card={card}
                scrollYProgress={scrollYProgress}
                scaleFactor={scaleFactor}
                prefersReducedMotion={prefersReducedMotion}
              />
            ))}
          </div>

          {/* ========================================================= */}
          {/* 4. FRAME 1 SCROLL PROMPT INDICATOR                        */}
          {/* ========================================================= */}
          <motion.div
            className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 pointer-events-none z-30"
            style={{ opacity: prefersReducedMotion ? 0 : indicatorOpacity }}
            aria-hidden="true"
          >
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white/90 text-[11px] sm:text-xs font-semibold shadow-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FFD84D] animate-ping" />
              <span>Scroll to explore product collections</span>
              <span className="text-[#FFD84D]">↓</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
