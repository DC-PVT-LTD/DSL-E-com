'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import TextType from '@/components/common/TextType';
import FadeContent from '@/components/common/FadeContent';

export const FirstHeroSlide: React.FC = () => {
  const prefersReducedMotion = useReducedMotion();
  const [slideActive, setSlideActive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;

    const check = () => {
      const isVisible =
        !parent.classList.contains('opacity-0') &&
        parent.getAttribute('aria-hidden') !== 'true';
      setSlideActive(isVisible);
    };

    check();

    const observer = new MutationObserver(check);
    observer.observe(parent, { attributes: true, attributeFilter: ['class', 'aria-hidden'] });
    return () => observer.disconnect();
  }, []);

  // Subtle professional entrance animations as specified in requirements:
  // - Background: static
  // - Back ribbon: gentle slide-in
  // - Children: smooth fade-in with a slight upward movement
  // - Products: gentle upward entrance
  // - Product shadow: fade in beneath products
  // - Front ribbon: smooth slide-in from the bottom
  // - Heading and buttons: staggered fade-in
  const easeCurve = [0.16, 1, 0.3, 1] as const;

  const backRibbonVariants: Variants = {
    hidden: prefersReducedMotion ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, x: 40, y: -20 },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { duration: 1.05, ease: easeCurve, delay: 0.15 },
    },
  };

  const childrenVariants: Variants = {
    hidden: prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 35 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.95, ease: easeCurve, delay: 0.3 },
    },
  };

  const shadowVariants: Variants = {
    hidden: prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.94 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.9, ease: 'easeOut', delay: 0.35 },
    },
  };

  const productsVariants: Variants = {
    hidden: prefersReducedMotion ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 40, scale: 0.96 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.95, ease: easeCurve, delay: 0.4 },
    },
  };

  const frontRibbonVariants: Variants = {
    hidden: prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 45 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 1.05, ease: easeCurve, delay: 0.5 },
    },
  };

  const contentVariants: Variants = {
    hidden: prefersReducedMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.9, ease: easeCurve, delay: 0.25 },
    },
  };

  const handleOurBrandsClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const brandsSection = document.getElementById('our-brands');
    if (brandsSection) {
      e.preventDefault();
      brandsSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none flex items-center justify-center"
    >
      {/* ========================================================= */}
      {/* LAYER 1: MAIN BACKGROUND (TRUE FULL-BLEED EDGE-TO-EDGE)   */}
      {/* ========================================================= */}
      <div className="absolute inset-0 w-full h-full z-0 pointer-events-none">
        <img
          src="/images/hero 2/hero-background.png"
          alt="DSL Stationery Distribution Background"
          className="w-full h-full object-cover object-center pointer-events-none select-none"
          draggable={false}
        />
      </div>

      {/* ========================================================= */}
      {/* RESPONSIVE LAYER STAGE                                    */}
      {/* Enlarged layers to fill screen without large empty spaces */}
      {/* ========================================================= */}
      <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
        <div
          className="relative h-full flex items-center justify-center"
          style={{
            aspectRatio: '2560 / 1440',
            maxHeight: '100%',
          }}
        >
          {/* ======================================================= */}
          {/* RIGHT GROUP: RIBBONS & CHILDREN                         */}
          {/* Shifted right by an additional ~1.5cm                    */}
          {/* ======================================================= */}
          <div
            className="absolute inset-0 w-full h-full pointer-events-none origin-bottom-right transition-transform duration-300"
            style={{
              transform: 'scale(1.15) translate(clamp(80px, 9vw, 180px), 0px)',
            }}
          >
            {/* LAYER 2: BACK RIBBON (GENTLE SLIDE-IN) */}
            <motion.div
              className="absolute inset-0 w-full h-full z-10 pointer-events-none"
              initial="hidden"
              animate="visible"
              variants={backRibbonVariants}
            >
              <img
                src="/images/hero 2/back-ribbon.png"
                alt=""
                className="w-full h-full object-contain pointer-events-none"
                draggable={false}
                aria-hidden="true"
              />
            </motion.div>

            {/* LAYER 3: CHILDREN (SMOOTH FADE-IN + UPWARD) */}
            <motion.div
              className="absolute inset-0 w-full h-full z-20 pointer-events-none"
              initial="hidden"
              animate="visible"
              variants={childrenVariants}
            >
              <FadeContent
                key={slideActive ? 'children-active' : 'children-idle'}
                trigger="mount"
                effect="focus"
                duration={1.2}
                delay={0.2}
                blur={12}
                ease="power2.out"
                className="w-full h-full"
                style={{ width: '100%', height: '100%' }}
              >
                <img
                  src="/images/hero 2/children.png"
                  alt="Smiling school students with backpacks and books"
                  className="w-full h-full object-contain pointer-events-none"
                  draggable={false}
                />
              </FadeContent>
            </motion.div>

            {/* LAYER 6: FRONT RIBBON (SMOOTH SLIDE-IN FROM BOTTOM) */}
            <motion.div
              className="absolute inset-0 w-full h-full z-40 pointer-events-none"
              initial="hidden"
              animate="visible"
              variants={frontRibbonVariants}
            >
              <img
                src="/images/hero 2/front-ribbon.png"
                alt=""
                className="w-full h-full object-contain pointer-events-none"
                draggable={false}
                aria-hidden="true"
              />
            </motion.div>
          </div>

          {/* ======================================================= */}
          {/* LEFT GROUP: PRODUCTS & STUDIO LIGHTING                  */}
          {/* Enlarged prominently for bold, clear retail visibility  */}
          {/* ======================================================= */}
          <div
            className="absolute inset-0 w-full h-full pointer-events-none origin-bottom-left transition-transform duration-300"
            style={{
              transform: 'scale(1.50) translate(-35px, 35px)',
            }}
          >
            {/* PRODUCT HIGHLIGHT BACK-GLOW (Studio Pedestal Lighting - Shifted Left) */}
            <div
              className="absolute pointer-events-none z-22 rounded-full blur-2xl opacity-75 -translate-x-10 sm:-translate-x-16 md:-translate-x-20 lg:-translate-x-24 xl:-translate-x-28"
              style={{
                left: '2%',
                bottom: '10%',
                width: '46%',
                height: '30%',
                background:
                  'radial-gradient(ellipse at center, rgba(56, 189, 248, 0.45) 0%, rgba(8, 102, 232, 0.18) 45%, transparent 75%)',
              }}
              aria-hidden="true"
            />

            {/* LAYER 4: PRODUCT SHADOW (UNDERNEATH PRODUCT COLLECTION - SHIFTED LEFT) */}
            <motion.div
              className="absolute inset-0 w-full h-full z-25 pointer-events-none origin-bottom-center -translate-x-10 sm:-translate-x-16 md:-translate-x-20 lg:-translate-x-24 xl:-translate-x-28"
              initial="hidden"
              animate="visible"
              variants={shadowVariants}
            >
              <img
                src="/images/hero 2/product-shadow.png"
                alt=""
                className="w-full h-full object-contain pointer-events-none opacity-95 filter drop-shadow-[0_14px_28px_rgba(8,24,64,0.22)]"
                draggable={false}
                aria-hidden="true"
              />
            </motion.div>

            {/* LAYER 5: PRODUCT COLLECTION (HIGHLIGHTED HERO PIECE - SHIFTED LEFT) */}
            <motion.div
              className="absolute inset-0 w-full h-full z-30 pointer-events-none origin-bottom-center -translate-x-10 sm:-translate-x-16 md:-translate-x-20 lg:-translate-x-24 xl:-translate-x-28"
              initial="hidden"
              animate="visible"
              variants={productsVariants}
            >
              <FadeContent
                key={slideActive ? 'products-active' : 'products-idle'}
                trigger="mount"
                effect="focus"
                duration={1.2}
                delay={0.35}
                blur={12}
                ease="power2.out"
                className="w-full h-full"
                style={{ width: '100%', height: '100%' }}
              >
                <img
                  src="/images/hero 2/product-set.png"
                  alt="DSL Stationery Product Collection"
                  className="w-full h-full object-contain pointer-events-none transition-transform duration-300 filter drop-shadow-[0_18px_32px_rgba(8,102,232,0.18)]"
                  draggable={false}
                />
              </FadeContent>
            </motion.div>
          </div>

          {/* ======================================================= */}
          {/* HEADING GROUP: HERO CONTENT & CTA BUTTONS               */}
          {/* Enhanced with React Bits <TextType /> typing animation  */}
          {/* ======================================================= */}
          <motion.div
            className="absolute z-50 pointer-events-none left-[3.5%] top-[1.8%] w-[36%]"
            initial="hidden"
            animate="visible"
            variants={contentVariants}
            style={{
              aspectRatio: '1774 / 887',
            }}
          >
            <div className="relative w-full h-full">
              {/* LAYER 7: HERO CONTENT FRAME (Preserved Badge & Buttons Artwork) */}
              <img
                src="/images/hero 2/hero-content-frame.png"
                alt="Stationery Distribution"
                className="w-full h-full object-contain pointer-events-none select-none drop-shadow-[0_8px_20px_rgba(8,102,232,0.08)]"
                draggable={false}
              />

              {/* REACT BITS <TextType /> TYPING ANIMATION FOR THE WORDING */}
              <div className="absolute top-[22%] left-[3%] w-[94%] h-[50%] flex items-center justify-center text-center pointer-events-auto">
                <TextType
                  as="h1"
                  text={[
                    'Supplies Without Limits.',
                    'School Essentials.',
                    'Office Stationery.',
                    'Direct Distribution.',
                  ]}
                  typingSpeed={75}
                  pauseDuration={1800}
                  deletingSpeed={45}
                  deleteMode="backspace"
                  typeEffect="fade"
                  mistakes={0.15}
                  cursorStyle="bar"
                  cursorGlide
                  showCursor
                  cursorColor="#087BFF"
                  className="font-fredoka font-bold text-[#081B43] tracking-tight leading-[1.05] text-[clamp(20px,3.1vw,46px)]"
                />
              </div>

              {/* LAYER 8: INTERACTIVE ACCESSIBLE CTA BUTTON OVERLAYS */}
              {/* Pixel-perfect transparent clickable areas over the visual buttons */}
              <div className="absolute inset-0 w-full h-full pointer-events-auto">
                {/* Button 1: Shop Catalogue */}
                <Link
                  href="/shop"
                  aria-label="Shop Catalogue"
                  className="absolute rounded-full transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] cursor-pointer focus:outline-none focus:ring-4 focus:ring-blue-400/50"
                  style={{
                    left: '12.57%',
                    top: '77.57%',
                    width: '40.19%',
                    height: '15.90%',
                  }}
                />

                {/* Button 2: Our Brands */}
                <Link
                  href="/#our-brands"
                  onClick={handleOurBrandsClick}
                  aria-label="Explore Our Brands"
                  className="absolute rounded-full transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] cursor-pointer focus:outline-none focus:ring-4 focus:ring-blue-400/50"
                  style={{
                    left: '54.40%',
                    top: '77.90%',
                    width: '33.03%',
                    height: '15.78%',
                  }}
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
