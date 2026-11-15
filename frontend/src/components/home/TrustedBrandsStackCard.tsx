'use client';

import React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion, Variants } from 'framer-motion';
import SplitText from '@/components/common/SplitText';

interface BrandItem {
  id: string;
  name: string;
  logo: string;
  slug: string;
  isGolden?: boolean;
}

const BRANDS: BrandItem[] = [
  {
    id: 'linc',
    name: 'LINC',
    logo: '/images/brands/linc.png',
    slug: 'linc',
    isGolden: false,
  },
  {
    id: 'doms',
    name: 'DOMS',
    logo: '/images/brands/doms.png',
    slug: 'doms',
    isGolden: false,
  },
  {
    id: 'speed',
    name: 'Speed',
    logo: '/images/brands/speed.png',
    slug: 'speed',
    isGolden: true,
  },
  {
    id: 'flexoffice',
    name: 'flexoffice',
    logo: '/images/brands/flexoffice.png',
    slug: 'flexoffice',
    isGolden: false,
  },
  {
    id: 'amico',
    name: 'amico',
    logo: '/images/brands/amico.png',
    slug: 'amico',
    isGolden: false,
  },
  {
    id: 'pentonic',
    name: 'pentonic',
    logo: '/images/brands/pentonic.png',
    slug: 'pentonic',
    isGolden: true,
  },
];

export const TrustedBrandsStackCard: React.FC = () => {
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
      className="w-full h-full flex flex-col justify-center gap-8 sm:gap-12 lg:gap-16 select-none py-6"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={containerVariants}
    >
      {/* 1. Header Section */}
      <motion.div className="text-center w-full max-w-3xl mx-auto" variants={headerVariants}>
        {/* Label: OUR BRANDS with horizontal lines */}
        <div className="inline-flex items-center justify-center gap-3 sm:gap-4 mb-2 sm:mb-3">
          <span className="h-[1px] w-6 sm:w-12 bg-gradient-to-r from-transparent via-blue-400/50 to-blue-400" />
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
          <span className="h-[1px] w-6 sm:w-12 bg-gradient-to-l from-transparent via-blue-400/50 to-blue-400" />
        </div>

        {/* Main Heading: Trusted by the Best with yellow underline */}
        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-[40px] font-black tracking-tight text-white leading-tight flex items-center justify-center flex-wrap gap-x-2.5">
          <SplitText
            text="Trusted by the"
            tag="span"
            effect="rise"
            splitType="words, chars"
            delay={35}
            duration={1.0}
            trigger="view"
            className="text-white inline-block"
          />
          <span className="relative inline-block text-[#FFD84D]">
            <SplitText
              text="Best"
              tag="span"
              effect="rise"
              splitType="chars"
              delay={45}
              duration={1.0}
              trigger="view"
              className="text-[#FFD84D] inline-block"
            />
            {/* Curved yellow underline */}
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

        {/* Supporting text */}
        <SplitText
          text="Proud to partner with leading stationery brands known for quality, reliability and innovation."
          tag="p"
          className="text-blue-100/80 text-xs sm:text-sm md:text-base font-normal leading-relaxed max-w-xl mx-auto mt-2.5 sm:mt-3 px-4"
          effect="fade"
          splitType="words"
          delay={25}
          duration={0.85}
          trigger="view"
          textAlign="center"
        />
      </motion.div>

      {/* 2. Six Brand Glass Cards in One Row */}
      <div className="w-full mt-6 sm:mt-8 pb-3 sm:pb-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4 md:gap-4 xl:gap-5 w-full items-stretch">
          {BRANDS.map((brand) => (
            <motion.div
              key={brand.id}
              variants={cardVariants}
              className="relative flex flex-col items-center"
            >
              <Link
                href={`/brands/${brand.slug}`}
                className={`brand-glass-card group/card relative w-full h-24 sm:h-28 md:h-32 rounded-2xl flex items-center justify-center p-3 sm:p-4 transition-all duration-300 cursor-pointer overflow-hidden ${brand.isGolden ? 'is-golden' : ''
                  }`}
                aria-label={`Explore ${brand.name} Products`}
              >
                {/* Golden edge highlight accent on selected cards */}
                {brand.isGolden && (
                  <div className="golden-edge-highlight absolute top-0 inset-x-3 h-[2px] bg-gradient-to-r from-transparent via-[#FFD84D] to-transparent rounded-full pointer-events-none z-10" />
                )}

                {/* Subtle top specular sheen */}
                <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none rounded-t-2xl" />

                {/* Inner Logo Capsule / Bed ensuring 100% clarity and brand color preservation */}
                <div className="relative z-10 w-full h-full flex items-center justify-center rounded-xl bg-white/95 backdrop-blur-sm p-2 sm:p-2.5 shadow-sm group-hover/card:bg-white group-hover/card:shadow-md transition-all duration-300">
                  <img
                    src={brand.logo}
                    alt={`${brand.name} Logo`}
                    className="max-h-full max-w-full object-contain select-none transition-transform duration-300 group-hover/card:scale-105"
                    draggable={false}
                  />
                </div>
              </Link>

              {/* Realistic reflection beneath each card */}
              <div
                className="card-reflection absolute -bottom-7 sm:-bottom-8 inset-x-2 h-6 sm:h-7 pointer-events-none select-none overflow-hidden opacity-25 group-hover/card:opacity-40 transition-opacity"
                aria-hidden="true"
              >
                <div className="w-full h-full rounded-xl bg-white/70 flex items-center justify-center p-1">
                  <img
                    src={brand.logo}
                    alt=""
                    className="max-h-5 sm:max-h-6 w-auto object-contain opacity-40 brightness-110"
                  />
                </div>
              </div>

              {/* Soft electric blue floor glow ellipse */}
              <div
                className="absolute -bottom-2 inset-x-4 h-1.5 bg-gradient-to-r from-transparent via-[#2672E8]/40 to-transparent blur-xs rounded-full pointer-events-none"
                aria-hidden="true"
              />
            </motion.div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .brand-glass-card {
          background: linear-gradient(180deg, rgba(22, 58, 117, 0.45) 0%, rgba(14, 39, 93, 0.6) 100%);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(59, 130, 246, 0.35);
          box-shadow: 0 8px 30px rgba(2, 10, 32, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.15);
          animation: gentleGlow 4.5s ease-in-out infinite;
        }

        .brand-glass-card:hover {
          border-color: rgba(96, 165, 250, 0.85);
          box-shadow: 0 12px 35px rgba(2, 10, 35, 0.6), 0 0 20px rgba(38, 114, 232, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.25);
          transform: translateY(-2px);
        }

        .brand-glass-card.is-golden {
          border-color: rgba(255, 216, 77, 0.45);
          box-shadow: 0 8px 30px rgba(2, 10, 32, 0.45), 0 0 15px rgba(255, 216, 77, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.2);
        }

        .brand-glass-card.is-golden:hover {
          border-color: rgba(255, 216, 77, 0.85);
          box-shadow: 0 12px 35px rgba(2, 10, 35, 0.6), 0 0 25px rgba(255, 216, 77, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.3);
        }

        .card-reflection {
          transform: scaleY(-1);
          mask-image: linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0) 80%);
          -webkit-mask-image: linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0) 80%);
          filter: blur(1.5px);
        }

        @keyframes gentleGlow {
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
          .brand-glass-card {
            animation: none !important;
          }
        }
      `}</style>
    </motion.div>
  );
};
