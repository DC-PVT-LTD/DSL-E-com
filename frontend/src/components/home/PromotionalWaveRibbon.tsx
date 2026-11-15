'use client';

import React from 'react';

/**
 * Small 4-point sparkle star separator matching the exact visual reference
 */
const StarDivider: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#087BFF] fill-current shrink-0 inline-block mx-4 sm:mx-6"
    aria-hidden="true"
  >
    <path d="M12 2 Q12 12 22 12 Q12 12 12 22 Q12 12 2 12 Q12 12 12 2 Z" />
  </svg>
);

/**
 * A single repeating group of promotional marquee messages
 */
const RibbonGroup: React.FC = () => (
  <div className="flex items-center shrink-0">
    <span className="text-[#102C60] font-black tracking-wider text-xs sm:text-[13px] uppercase whitespace-nowrap">
      QUALITY STATIONERY
    </span>
    <StarDivider />
    <span className="text-[#087BFF] font-black tracking-wider text-xs sm:text-[13px] uppercase whitespace-nowrap">
      TRUSTED BRANDS
    </span>
    <StarDivider />
    <span className="text-[#102C60] font-black tracking-wider text-xs sm:text-[13px] uppercase whitespace-nowrap">
      SCHOOL & OFFICE ESSENTIALS
    </span>
    <StarDivider />
  </div>
);

interface PromotionalWaveRibbonProps {
  className?: string;
}

export const PromotionalWaveRibbon: React.FC<PromotionalWaveRibbonProps> = ({
  className = '',
}) => {
  return (
    <div
      className={`relative w-full overflow-hidden select-none !my-2 sm:!my-3 py-1 ${className}`}
      aria-label="Promotional marquee ribbon"
    >
      {/* Flowing Wave Ribbon Container */}
      <div className="relative w-full h-[46px] sm:h-[52px] flex items-center justify-center overflow-hidden">
        {/* Continuous organic flowing wave SVG ribbon background */}
        <svg
          viewBox="0 0 1440 76"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-xs"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="dslRibbonGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#EDF6FE" />
              <stop offset="50%" stopColor="#E2F0FE" />
              <stop offset="100%" stopColor="#CEE6FE" />
            </linearGradient>
            <linearGradient id="dslRibbonBackGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#BFDEFE" />
              <stop offset="100%" stopColor="#ADCFFE" />
            </linearGradient>
          </defs>

          {/* Back Ribbon Subtle Dimension Accent */}
          <path
            d="M 0 21 C 52 9, 92 9, 144 21 C 196 33, 236 33, 288 21 C 340 9, 380 9, 432 21 C 484 33, 524 33, 576 21 C 628 9, 668 9, 720 21 C 772 33, 812 33, 864 21 C 916 9, 956 9, 1008 21 C 1060 33, 1100 33, 1152 21 C 1204 9, 1244 9, 1296 21 C 1348 33, 1388 33, 1440 21 L 1440 61 C 1388 73, 1348 73, 1296 61 C 1244 49, 1204 49, 1152 61 C 1100 73, 1060 73, 1008 61 C 956 49, 916 49, 864 61 C 812 73, 772 73, 720 61 C 668 49, 628 49, 576 61 C 524 73, 484 73, 432 61 C 380 49, 340 49, 288 61 C 236 73, 196 73, 144 61 C 92 49, 52 49, 0 61 Z"
            fill="url(#dslRibbonBackGrad)"
            opacity="0.55"
          />

          {/* Front Flowing Wave Ribbon with Defined Upper and Lower Curves */}
          <path
            d="M 0 17 C 52 5, 92 5, 144 17 C 196 29, 236 29, 288 17 C 340 5, 380 5, 432 17 C 484 29, 524 29, 576 17 C 628 5, 668 5, 720 17 C 772 29, 812 29, 864 17 C 916 5, 956 5, 1008 17 C 1060 29, 1100 29, 1152 17 C 1204 5, 1244 5, 1296 17 C 1348 29, 1388 29, 1440 17 L 1440 57 C 1388 69, 1348 69, 1296 57 C 1244 45, 1204 45, 1152 57 C 1100 69, 1060 69, 1008 57 C 956 45, 916 45, 864 57 C 812 69, 772 69, 720 57 C 668 45, 628 45, 576 57 C 524 69, 484 69, 432 57 C 380 45, 340 45, 288 57 C 236 69, 196 69, 144 57 C 92 45, 52 45, 0 57 Z"
            fill="url(#dslRibbonGrad)"
            stroke="#B6DCFE"
            strokeWidth="1.2"
          />
        </svg>

        {/* Horizontal Infinite Marquee Scrolling Track */}
        <div className="relative z-10 w-full overflow-hidden flex items-center group cursor-default">
          <div className="animate-wave-marquee flex items-center shrink-0">
            {/* Track 1 */}
            <div className="flex items-center shrink-0">
              {Array.from({ length: 6 }).map((_, i) => (
                <RibbonGroup key={`track-1-${i}`} />
              ))}
            </div>
            {/* Track 2 (seamless infinite continuation) */}
            <div className="flex items-center shrink-0" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <RibbonGroup key={`track-2-${i}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromotionalWaveRibbon;

