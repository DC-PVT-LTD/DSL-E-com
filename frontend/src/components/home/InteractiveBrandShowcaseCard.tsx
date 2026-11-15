'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import SplitText from '@/components/common/SplitText';

// ============================================================================
// BRAND SHOWCASE DATA DEFINITION
// ============================================================================
export interface ShowcaseBrand {
  id: string;
  name: string;
  logo: string;
  slug: string;
  heading: string;
  description: string;
}

export const SHOWCASE_BRANDS: ShowcaseBrand[] = [
  {
    id: 'linc',
    name: 'LINC',
    logo: '/images/brands/linc.png',
    slug: 'linc',
    heading: 'Manufacturer and Distributor of:',
    description:
      'LINC is a trusted stationery brand offering quality writing instruments designed to deliver a smooth writing experience, reliability, and everyday performance.',
  },
  {
    id: 'doms',
    name: 'DOMS',
    logo: '/images/brands/doms.png',
    slug: 'doms',
    heading: 'Manufacturer and Distributor of:',
    description:
      'DOMS offers a diverse range of creative and educational stationery products, combining quality, innovation, and functionality for everyday learning and creativity.',
  },
  {
    id: 'speed',
    name: 'SPEED',
    logo: '/images/brands/speed.png',
    slug: 'speed',
    heading: 'Manufacturer and Distributor of:',
    description:
      'A trusted name in stationery, SPEED is committed to delivering quality, innovation, and performance through a wide range of products crafted for every writing and creative need.',
  },
  {
    id: 'flexoffice',
    name: 'flexoffice',
    logo: '/images/brands/flexoffice.png',
    slug: 'flexoffice',
    heading: 'Manufacturer and Distributor of:',
    description:
      'flexoffice provides quality pens and stationery products designed to support comfortable writing, everyday productivity, and reliable performance.',
  },
  {
    id: 'amico',
    name: 'amigo',
    logo: '/images/brands/amico.png',
    slug: 'amico',
    heading: 'Manufacturer and Distributor of:',
    description:
      'amigo offers practical and innovative stationery and office products designed to make everyday tasks easier and more efficient.',
  },
  {
    id: 'pentonic',
    name: 'pentonic',
    logo: '/images/brands/pentonic.png',
    slug: 'pentonic',
    heading: 'Manufacturer and Distributor of:',
    description:
      'pentonic brings modern writing instruments with stylish designs and smooth writing performance, combining functionality and contemporary style.',
  },
];

export const InteractiveBrandShowcaseCard: React.FC = () => {
  // SPEED must ALWAYS be the default selected brand
  const [selectedBrandId, setSelectedBrandId] = useState<string>('speed');
  const prefersReducedMotion = useReducedMotion();

  const selectedBrand =
    SHOWCASE_BRANDS.find((b) => b.id === selectedBrandId) ?? SHOWCASE_BRANDS[2];

  const handleSelectBrand = (brandId: string) => {
    if (selectedBrandId === brandId) return;
    setSelectedBrandId(brandId);
  };

  return (
    <div className="relative w-full h-full min-h-[380px] sm:min-h-[420px] lg:min-h-[460px] flex items-center justify-center p-5 sm:p-8 lg:p-12 overflow-hidden select-none">
      {/* Ambient Radial Floor Glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[320px] bg-[#0066FF]/10 rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      {/* Main Content Grid: Left (Selected Info) + Right (Fixed 3x2 Grid) */}
      <div className="relative z-10 w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 lg:gap-12 items-center">
        {/* ========================================================= */}
        {/* LEFT SIDE: DYNAMIC SELECTED BRAND INFORMATION            */}
        {/* ========================================================= */}
        <div className="md:col-span-5 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedBrand.id}
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="flex flex-col items-start"
            >
              {/* Selected Brand Official Logo */}
              <div className="h-14 sm:h-16 md:h-18 max-w-[200px] mb-3 sm:mb-4 flex items-center justify-start">
                {selectedBrand.id === 'speed' ? (
                  <img
                    src={selectedBrand.logo}
                    alt={`${selectedBrand.name} logo`}
                    className="max-h-full max-w-full object-contain filter drop-shadow-md select-none"
                    draggable={false}
                  />
                ) : (
                  <div className="h-full px-3.5 py-1.5 rounded-xl bg-white/95 backdrop-blur-sm flex items-center justify-center shadow-md">
                    <img
                      src={selectedBrand.logo}
                      alt={`${selectedBrand.name} logo`}
                      className="max-h-full max-w-full object-contain select-none"
                      draggable={false}
                    />
                  </div>
                )}
              </div>

              {/* Small Yellow Accent Detail */}
              <div
                className="w-12 sm:w-16 h-1 sm:h-1.5 bg-[#FFD84D] rounded-full mb-3 sm:mb-4 shadow-[0_0_12px_rgba(255,216,77,0.45)]"
                aria-hidden="true"
              />

              {/* Heading: Manufacturer and Distributor of: */}
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-black text-white leading-tight tracking-tight">
                <SplitText
                  key={`head-${selectedBrand.id}`}
                  text="Manufacturer and Distributor of:"
                  tag="span"
                  effect="rise"
                  splitType="words, chars"
                  delay={30}
                  duration={0.9}
                  trigger="load"
                  textAlign="left"
                  className="text-white inline-block"
                />
              </h3>

              {/* Brand Description */}
              <div className="mt-3 sm:mt-4 max-w-md">
                <SplitText
                  key={`desc-${selectedBrand.id}`}
                  text={selectedBrand.description}
                  tag="p"
                  effect="fade"
                  splitType="words"
                  delay={18}
                  duration={0.7}
                  trigger="load"
                  textAlign="left"
                  className="text-blue-100/90 text-sm sm:text-base md:text-lg leading-relaxed font-normal"
                />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ========================================================= */}
        {/* RIGHT SIDE: FIXED 3x2 BRAND LOGO COLLECTION               */}
        {/* ========================================================= */}
        <div className="md:col-span-7 w-full">
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5 md:gap-4 lg:gap-5 w-full items-stretch">
            {SHOWCASE_BRANDS.map((brand) => {
              const isSelected = selectedBrandId === brand.id;
              const isSpeed = brand.id === 'speed';

              // When SPEED is selected, use dark glass background with cyan glow matching reference design.
              // Other cards use white background with glowing cyan border when selected.
              const cardBgClass =
                isSelected && isSpeed
                  ? 'bg-[#071d47]/85 backdrop-blur-sm'
                  : 'bg-white';

              const cardBorderClass = isSelected
                ? 'ring-2 sm:ring-[3px] ring-[#00D0FF] shadow-[0_0_24px_rgba(0,208,255,0.75),inset_0_0_12px_rgba(0,208,255,0.25)] scale-[1.02]'
                : 'border border-white/60 shadow-md hover:shadow-lg hover:scale-[1.02] hover:border-blue-300/80';

              return (
                <button
                  key={brand.id}
                  type="button"
                  onClick={() => handleSelectBrand(brand.id)}
                  className={`group/card relative w-full h-20 sm:h-24 md:h-28 lg:h-32 rounded-2xl flex items-center justify-center p-2.5 sm:p-3.5 md:p-4.5 transition-all duration-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#00D0FF] ${cardBgClass} ${cardBorderClass}`}
                  aria-label={`Select ${brand.name} brand information`}
                  aria-pressed={isSelected}
                >
                  {/* Subtle top specular sheen */}
                  <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/20 to-transparent pointer-events-none rounded-t-2xl" />

                  {/* Brand Logo */}
                  <img
                    src={brand.logo}
                    alt={`${brand.name} Logo`}
                    className="max-h-full max-w-full object-contain select-none transition-transform duration-300 group-hover/card:scale-105"
                    draggable={false}
                  />

                  {/* Cyan Glowing Corner Indicator when Selected */}
                  {isSelected && (
                    <div
                      className="absolute -top-1 -right-1 w-3 h-3 bg-[#00D0FF] rounded-full blur-[2px] pointer-events-none"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

