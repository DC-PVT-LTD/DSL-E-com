'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import SplitText from '@/components/common/SplitText';
import LightCardWavesBackground from '@/components/common/LightCardWavesBackground';
import ChromaGrid from '@/components/common/ChromaGrid';

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
    <div className="relative w-full h-full min-h-[380px] sm:min-h-[420px] lg:min-h-[460px] flex items-center justify-center p-5 sm:p-8 lg:p-12 overflow-hidden rounded-[28px] bg-transparent select-none">
      {/* Light Silk Waves Background matching uploaded reference */}
      <LightCardWavesBackground />

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
                <img
                  src={selectedBrand.logo}
                  alt={`${selectedBrand.name} logo`}
                  className="max-h-full max-w-full object-contain filter drop-shadow-sm select-none"
                  draggable={false}
                />
              </div>

              {/* Small Yellow Accent Detail */}
              <div
                className="w-12 sm:w-16 h-1 sm:h-1.5 bg-[#FFC72C] rounded-full mb-3 sm:mb-4 shadow-[0_0_12px_rgba(255,199,44,0.45)]"
                aria-hidden="true"
              />

              {/* Heading: Manufacturer and Distributor of: */}
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-black text-[#0F2752] leading-tight tracking-tight">
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
                  className="text-[#0F2752] inline-block font-black"
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
                  className="text-[#334155] text-sm sm:text-base md:text-lg leading-relaxed font-medium"
                />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ========================================================= */}
        {/* RIGHT SIDE: CHROMAGRID INTERACTIVE LOGO COLLAGE           */}
        {/* ========================================================= */}
        <div className="md:col-span-7 w-full">
          <ChromaGrid
            items={SHOWCASE_BRANDS.map((brand) => {
              const brandAccents: Record<string, string> = {
                linc: '#0052cc',
                doms: '#e11d48',
                speed: '#ff5a00',
                flexoffice: '#0284c7',
                amico: '#16a34a',
                pentonic: '#7c3aed',
              };

              return {
                id: brand.id,
                image: brand.logo,
                title: brand.name,
                accent: brandAccents[brand.id] || '#087BFF',
                selected: selectedBrandId === brand.id,
                onClick: () => handleSelectBrand(brand.id),
              };
            })}
            columns={3}
            radius={220}
            gap={12}
            cardRadius={18}
            aspectRatio="16 / 10"
            objectFit="contain"
            mediaPadding={14}
            theme="light"
            glow={0.7}
            borderGlow={1}
            showInfo={false}
            reveal="spotlight"
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
};

