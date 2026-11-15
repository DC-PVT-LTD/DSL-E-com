'use client';

import React from 'react';

export interface HeroTrustRibbonProps {
  className?: string;
  variant?: 'desktop' | 'mobile';
  showArtwork?: boolean;
}

/**
 * HeroTrustRibbon Component
 * Premium curved ribbon trust-indicator component for the DSL Homepage Hero.
 * 
 * Implementation:
 * - Uses native SVG `<textPath>` with precision Bézier curves (`#ribbonTopCurve` and `#ribbonBotCurve`).
 * - Text letters physically bend and flow along the ribbon's 3D wave geometry.
 * - Icons are positioned at the exact tangent angle and coordinates along the curve.
 * - Perfectly responsive: 1024x576 viewBox matches the underlying ribbon artwork across all screen sizes.
 */
export const HeroTrustRibbon: React.FC<HeroTrustRibbonProps> = ({
  className = '',
  variant = 'desktop',
  showArtwork = true,
}) => {
  const isMobile = variant === 'mobile';

  // Responsive font sizes within the 1024x576 SVG canvas
  const titleFontSize = isMobile ? '15.5' : '14';
  const subFontSize = isMobile ? '11.5' : '10.5';

  return (
    <div
      className={`hero-trust-ribbon relative aspect-[1024/576] select-none ${isMobile
          ? 'w-full max-w-[640px] mx-auto overflow-hidden rounded-2xl'
          : 'h-full max-w-full flex items-center justify-end'
        } ${className}`}
      role="region"
      aria-label="DSL Trust Indicators: 20,000+ Products, Islandwide Delivery, Trusted Partner"
    >
      {/* 1. Underlying Ribbon & Child Cutout Artwork */}
      {showArtwork && (
        <img
          src="/images/hero-child-ribbon.png"
          alt="DSL Distributors - Supplies Without Limits"
          className={`w-full h-full ${isMobile ? 'object-contain' : 'object-contain object-right drop-shadow-2xl'
            }`}
          loading="eager"
        />
      )}

      {/* 2. SVG Curved Text & Icons Overlay (True Mathematical Ribbon Curve) */}
      <svg
        viewBox="0 0 1024 576"
        className="absolute inset-0 w-full h-full pointer-events-auto overflow-visible"
        aria-hidden="true"
      >
        <defs>
          {/* Top Curve Path: For primary bold values (20,000+, Islandwide, Trusted) */}
          <path
            id="ribbonTopCurve"
            d="M 402.4 502.4 C 476.2 525.0, 554.2 518.0, 628.5 501.2 C 702.8 485.3, 781.8 449.8, 861.4 402.0"
            fill="none"
          />

          {/* Bottom Curve Path: For secondary labels (Products, Delivery, Partner) */}
          <path
            id="ribbonBotCurve"
            d="M 397.2 516.5 C 473.7 539.0, 555.9 532.0, 631.7 515.8 C 707.5 499.6, 788.7 463.1, 869.1 414.9"
            fill="none"
          />

          {/* Subtle printed-on-ribbon shadow filter */}
          <filter id="ribbonTextGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1.2" stdDeviation="1.2" floodColor="#020e24" floodOpacity="0.55" />
          </filter>
        </defs>

        {/* ========================================================= */}
        {/* GROUP 1: 20,000+ Products                                 */}
        {/* ========================================================= */}
        {/* Icon: Layers (Position: x=414.5, y=513.0, Tangent: +11.5°) */}
        <g
          transform="translate(414.5, 513.0) rotate(11.5)"
          className="transition-transform duration-200 hover:scale-110 cursor-default"
        >
          <rect
            x="-13"
            y="-13"
            width="26"
            height="26"
            rx="6.5"
            fill="rgba(255, 255, 255, 0.12)"
            stroke="rgba(255, 255, 255, 0.22)"
            strokeWidth="0.9"
          />
          {/* Layers icon */}
          <path
            d="M -6 -2.5 L 0 1.5 L 6 -2.5 L 0 -6.5 Z"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M -6 2 L 0 6 L 6 2"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* Divider 1: Between Group 1 & Group 2 (x=542.6, y=519.3, Perpendicular: -2.2°) */}
        <g transform="translate(542.6, 519.3) rotate(-2.2)">
          <line
            x1="0"
            y1="-11"
            x2="0"
            y2="11"
            stroke="rgba(255, 255, 255, 0.28)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </g>

        {/* ========================================================= */}
        {/* GROUP 2: Islandwide Delivery                              */}
        {/* ========================================================= */}
        {/* Icon: Truck (Position: x=567.6, y=517.7, Tangent: -5.3°) */}
        <g
          transform="translate(567.6, 517.7) rotate(-5.3)"
          className="transition-transform duration-200 hover:scale-110 cursor-default"
        >
          <rect
            x="-13"
            y="-13"
            width="26"
            height="26"
            rx="6.5"
            fill="rgba(255, 255, 255, 0.12)"
            stroke="rgba(255, 255, 255, 0.22)"
            strokeWidth="0.9"
          />
          {/* Truck icon */}
          <path
            d="M -7 -4.5 H 1 V 4 H -7 Z"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <path
            d="M 1 -1 H 4.2 L 7 2 V 4 H 1 Z"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <circle cx="-4" cy="5.2" r="1.6" fill="#ffffff" />
          <circle cx="4.2" cy="5.2" r="1.6" fill="#ffffff" />
        </g>

        {/* Divider 2: Between Group 2 & Group 3 (x=699.0, y=488.3, Perpendicular: -19.4°) */}
        <g transform="translate(699.0, 488.3) rotate(-19.4)">
          <line
            x1="0"
            y1="-11"
            x2="0"
            y2="11"
            stroke="rgba(255, 255, 255, 0.28)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </g>

        {/* ========================================================= */}
        {/* GROUP 3: Trusted Partner                                  */}
        {/* ========================================================= */}
        {/* Icon: ShieldCheck (Position: x=722.4, y=479.6, Tangent: -21.5°) */}
        <g
          transform="translate(722.4, 479.6) rotate(-21.5)"
          className="transition-transform duration-200 hover:scale-110 cursor-default"
        >
          <rect
            x="-13"
            y="-13"
            width="26"
            height="26"
            rx="6.5"
            fill="rgba(255, 255, 255, 0.12)"
            stroke="rgba(255, 255, 255, 0.22)"
            strokeWidth="0.9"
          />
          {/* ShieldCheck icon */}
          <path
            d="M 0 -6.5 C 3.5 -6.5, 6.5 -4.5, 6.5 0 C 6.5 4.5, 3.5 7, 0 8 C -3.5 7, -6.5 4.5, -6.5 0 C -6.5 -4.5, -3.5 -6.5, 0 -6.5 Z"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <path
            d="M -3 0.5 L -0.5 3 L 3.5 -1.5"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* ========================================================= */}
        {/* CURVED TEXT ON PATH: Main Values (Bold White)            */}
        {/* ========================================================= */}
        <text
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontSize={titleFontSize}
          fontWeight="900"
          fill="#ffffff"
          letterSpacing="-0.2px"
          filter="url(#ribbonTextGlow)"
          className="select-none"
        >
          <textPath href="#ribbonTopCurve" startOffset="7.2%">
            20,000+
          </textPath>
          <textPath href="#ribbonTopCurve" startOffset="38.8%">
            Islandwide
          </textPath>
          <textPath href="#ribbonTopCurve" startOffset="71.2%">
            Trusted
          </textPath>
        </text>

        {/* ========================================================= */}
        {/* CURVED TEXT ON PATH: Sub-labels (Light-blue / White 88%)  */}
        {/* ========================================================= */}
        <text
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontSize={subFontSize}
          fontWeight="600"
          fill="rgba(255, 255, 255, 0.88)"
          letterSpacing="0.15px"
          filter="url(#ribbonTextGlow)"
          className="select-none"
        >
          <textPath href="#ribbonBotCurve" startOffset="7.2%">
            Products
          </textPath>
          <textPath href="#ribbonBotCurve" startOffset="38.8%">
            Delivery
          </textPath>
          <textPath href="#ribbonBotCurve" startOffset="71.2%">
            Partner
          </textPath>
        </text>
      </svg>
    </div>
  );
};

export default HeroTrustRibbon;
