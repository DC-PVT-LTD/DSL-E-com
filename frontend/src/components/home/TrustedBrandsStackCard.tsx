'use client';

import React, { useState } from 'react';
import { motion, useReducedMotion, Variants } from 'framer-motion';
import LightCardWavesBackground from '@/components/common/LightCardWavesBackground';

interface BrandItem {
  id: string;
  name: string;
  logo: string;
  slug: string;
}

const BRANDS: BrandItem[] = [
  {
    id: 'linc',
    name: 'LINC',
    logo: '/images/brands/linc.png',
    slug: 'linc',
  },
  {
    id: 'doms',
    name: 'DOMS',
    logo: '/images/brands/doms.png',
    slug: 'doms',
  },
  {
    id: 'speed',
    name: 'Speed',
    logo: '/images/brands/speed.png',
    slug: 'speed',
  },
  {
    id: 'flexoffice',
    name: 'flexoffice',
    logo: '/images/brands/flexoffice.png',
    slug: 'flexoffice',
  },
  {
    id: 'amico',
    name: 'amico',
    logo: '/images/brands/amico.png',
    slug: 'amico',
  },
  {
    id: 'pentonic',
    name: 'pentonic',
    logo: '/images/brands/pentonic.png',
    slug: 'pentonic',
  },
];

export const TrustedBrandsStackCard: React.FC = () => {
  const [activeBrandId, setActiveBrandId] = useState<string>('speed');
  const prefersReducedMotion = useReducedMotion();

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : 0.08,
        delayChildren: prefersReducedMotion ? 0 : 0.1,
      },
    },
  };

  const headerVariants: Variants = {
    hidden: prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.55,
        ease: 'easeOut',
      },
    },
  };

  const cardVariants: Variants = {
    hidden: prefersReducedMotion
      ? { opacity: 1, y: 0, scale: 1 }
      : { opacity: 0, y: 22, scale: 0.92 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 95,
        damping: 18,
        mass: 0.8,
      },
    },
  };

  return (
    <motion.div
      className="relative w-full h-full flex flex-col justify-center gap-6 sm:gap-8 lg:gap-10 select-none py-6 sm:py-8 px-4 sm:px-8 lg:px-12 overflow-hidden rounded-[28px]"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={containerVariants}
    >
      {/* Light Silk Waves Background matching uploaded reference */}
      <LightCardWavesBackground />

      {/* 1. Header Section */}
      <motion.div className="relative z-10 text-center w-full max-w-3xl mx-auto" variants={headerVariants}>
        {/* Label: OUR BRANDS with vibrant golden lines and high contrast */}
        <div className="inline-flex items-center justify-center gap-3 sm:gap-4 mb-2.5 sm:mb-3.5">
          <span className="h-[2.5px] w-8 sm:w-14 bg-gradient-to-r from-transparent via-[#FFB800] to-[#FF9E0B] rounded-full inline-block shadow-[0_0_8px_rgba(255,184,0,0.45)]" />
          <span className="px-3.5 py-1 rounded-full bg-white/85 border border-blue-200/60 shadow-[0_2px_8px_rgba(8,102,232,0.08)] backdrop-blur-md text-xs sm:text-sm font-extrabold tracking-[0.24em] text-[#0866E8] uppercase select-none inline-block drop-shadow-xs">
            OUR BRANDS
          </span>
          <span className="h-[2.5px] w-8 sm:w-14 bg-gradient-to-r from-[#FF9E0B] via-[#FFB800] to-transparent rounded-full inline-block shadow-[0_0_8px_rgba(255,184,0,0.45)]" />
        </div>

        {/* Main Heading: Trusted by the Best with fully visible 't' in Best */}
        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-[40px] font-black tracking-tight leading-tight flex items-center justify-center flex-wrap gap-x-2.5">
          <span className="text-[#0F2752] inline-block font-black">
            Trusted by the
          </span>
          <span className="relative inline-block text-[#0866E8] italic font-black pl-1 pr-3 sm:pr-4">
            <span className="text-[#0866E8] italic font-black inline-block pr-1">
              Best
            </span>
            {/* Curved yellow underline matching reference */}
            <svg
              className="absolute -bottom-2 sm:-bottom-2.5 left-0 w-full h-2.5 sm:h-3.5 overflow-visible pointer-events-none"
              viewBox="0 0 100 14"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M 2 4 Q 50 14 98 4"
                stroke="#FFC72C"
                strokeWidth="3.4"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </h2>

        {/* Supporting text */}
        <p className="text-[#475569] text-xs sm:text-sm md:text-base font-medium leading-relaxed max-w-xl mx-auto mt-2.5 sm:mt-3 px-4">
          Proud to partner with leading stationery brands known for quality, reliability and innovation.
        </p>
      </motion.div>

      {/* 2. Six Brand 3D Glass Cards in One Row */}
      {/* Requirement: Only Speed has the orange line; when user clicks other brands, they do NOT get any colour in 1st card */}
      <div className="relative z-10 w-full mt-6 sm:mt-8 pb-3 sm:pb-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4 md:gap-4 xl:gap-5 w-full items-stretch">
          {BRANDS.map((brand) => {
            const isSpeed = brand.id === 'speed';
            const isSelected = activeBrandId === brand.id;

            return (
              <motion.div
                key={brand.id}
                variants={cardVariants}
                className="relative flex flex-col items-center [perspective:1000px]"
              >
                <div
                  onClick={() => setActiveBrandId(brand.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveBrandId(brand.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={`brand-glass-card group/card relative w-full h-24 sm:h-28 md:h-32 rounded-2xl flex items-center justify-center p-3 sm:p-4 transition-all duration-300 cursor-pointer overflow-hidden ${
                    isSpeed ? 'is-speed-card' : ''
                  }`}
                  aria-label={`Select ${brand.name}`}
                  aria-pressed={isSelected}
                >
                  {/* Glowing orange edge line at top ONLY for Speed card */}
                  {isSpeed && (
                    <div className="golden-edge-highlight absolute top-0 inset-x-2.5 h-[3px] bg-gradient-to-r from-transparent via-[#FF9E0B] to-transparent rounded-full pointer-events-none z-20 shadow-[0_0_12px_rgba(255,158,11,1)]" />
                  )}

                  {/* 3D Diagonal Specular Glass Surface Glare */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/70 via-white/10 to-transparent pointer-events-none rounded-2xl opacity-80 z-10" />

                  {/* Inner 3D Logo Capsule / Bed */}
                  <div className="relative z-10 w-full h-full flex items-center justify-center rounded-xl bg-white/94 backdrop-blur-md p-2 sm:p-2.5 shadow-[inset_0_1.5px_2px_rgba(255,255,255,1),0_3px_10px_rgba(8,24,64,0.06)] group-hover/card:shadow-[inset_0_1.5px_2px_rgba(255,255,255,1),0_6px_16px_rgba(8,102,232,0.12)] transition-all duration-300">
                    <img
                      src={brand.logo}
                      alt={`${brand.name} Logo`}
                      className="max-h-full max-w-full object-contain select-none transition-transform duration-300 group-hover/card:scale-105"
                      draggable={false}
                    />
                  </div>
                </div>

                {/* Realistic reflection beneath each card on glossy floor */}
                <div
                  className={`card-reflection absolute -bottom-7 sm:-bottom-8 inset-x-2 h-6 sm:h-7 pointer-events-none select-none overflow-hidden transition-opacity duration-300 ${
                    isSpeed ? 'opacity-50' : 'opacity-25 group-hover/card:opacity-40'
                  }`}
                  aria-hidden="true"
                >
                  <div className="w-full h-full rounded-xl bg-white/80 flex items-center justify-center p-1">
                    <img
                      src={brand.logo}
                      alt=""
                      className="max-h-5 sm:max-h-6 w-auto object-contain opacity-40 brightness-105"
                    />
                  </div>
                </div>

                {/* Floor ambient glow ellipse */}
                <div
                  className={`absolute -bottom-2 inset-x-4 h-1.5 rounded-full blur-xs pointer-events-none transition-all duration-300 ${
                    isSpeed
                      ? 'bg-gradient-to-r from-transparent via-[#FF9E0B]/60 to-transparent scale-125'
                      : 'bg-gradient-to-r from-transparent via-[#0866E8]/10 to-transparent opacity-40'
                  }`}
                  aria-hidden="true"
                />
              </motion.div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .brand-glass-card {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.75) 100%);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1.5px solid rgba(255, 255, 255, 0.9);
          box-shadow:
            inset 0 1.5px 2px rgba(255, 255, 255, 1),
            inset 0 0 0 1px rgba(255, 255, 255, 0.8),
            inset 0 -2px 3px rgba(8, 102, 232, 0.05),
            0 12px 28px -6px rgba(8, 24, 64, 0.12),
            0 4px 10px rgba(0, 0, 0, 0.03);
          transform: perspective(800px) translateZ(0);
          transform-style: preserve-3d;
        }

        .brand-glass-card:hover {
          border-color: rgba(255, 255, 255, 1);
          box-shadow:
            inset 0 2px 2px rgba(255, 255, 255, 1),
            inset 0 0 0 1px rgba(255, 255, 255, 0.95),
            0 20px 42px -8px rgba(8, 24, 64, 0.2),
            0 4px 16px rgba(8, 102, 232, 0.08);
          transform: perspective(800px) translateY(-6px) translateZ(12px) scale(1.03);
        }

        /* ONLY Speed has the vibrant glowing orange line & border */
        .brand-glass-card.is-speed-card {
          border-color: #FF9E0B;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 248, 230, 0.92) 100%);
          box-shadow:
            inset 0 1.5px 2px rgba(255, 255, 255, 1),
            inset 0 0 0 1px rgba(255, 255, 255, 0.9),
            0 0 28px rgba(255, 158, 11, 0.45),
            0 16px 36px -6px rgba(8, 24, 64, 0.16);
          transform: perspective(800px) translateY(-3px) translateZ(8px) scale(1.02);
        }

        .brand-glass-card.is-speed-card:hover {
          border-color: #F59E0B;
          box-shadow:
            inset 0 2px 2px rgba(255, 255, 255, 1),
            0 0 34px rgba(255, 158, 11, 0.65),
            0 22px 42px -6px rgba(8, 24, 64, 0.22);
          transform: perspective(800px) translateY(-7px) translateZ(14px) scale(1.04);
        }

        .card-reflection {
          transform: scaleY(-1);
          mask-image: linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0) 80%);
          -webkit-mask-image: linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0) 80%);
          filter: blur(1.5px);
        }
      `}</style>
    </motion.div>
  );
};
