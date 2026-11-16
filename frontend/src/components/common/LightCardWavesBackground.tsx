'use client';

import React from 'react';

export const LightCardWavesBackground: React.FC = () => {
  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden rounded-[28px] z-0 select-none"
      aria-hidden="true"
    >
      {/* 1. Base 3D Glassmorphism Translucent Frost Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/94 via-white/84 to-white/72 backdrop-blur-2xl" />

      {/* Top 3D Specular Light Refraction Sheen */}
      <div className="absolute inset-x-0 top-0 h-2/5 bg-gradient-to-b from-white/70 via-white/20 to-transparent pointer-events-none rounded-t-[28px]" />

      {/* 3D Glass Slab Perimeter Bevel & Rim Light */}
      <div className="absolute inset-0 rounded-[28px] pointer-events-none ring-1 ring-inset ring-white/90 shadow-[inset_0_2px_3px_rgba(255,255,255,1),inset_0_-2px_4px_rgba(8,24,56,0.12)]" />

      {/* 2. Top-Left Flowing Silk Ribbon with Golden Yellow Accent (Confined to corner, leaving center pristine) */}
      <svg
        className="absolute -top-6 -left-6 w-[280px] sm:w-[360px] md:w-[420px] h-[160px] sm:h-[210px] md:h-[240px] opacity-90 overflow-visible"
        viewBox="0 0 420 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="blueSilkGradTop" x1="0%" y1="0%" x2="100%" y2="80%">
            <stop offset="0%" stopColor="#0284C7" stopOpacity="0.45" />
            <stop offset="35%" stopColor="#38BDF8" stopOpacity="0.55" />
            <stop offset="70%" stopColor="#93C5FD" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#EFF6FF" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="goldSilkGradTop" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#FCD34D" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#FDE68A" stopOpacity="0.1" />
          </linearGradient>

          <filter id="softGlowTop" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer ethereal blue ribbon body - curving down into left margin */}
        <path
          d="M -30 -20 C 50 10, 140 60, 210 40 C 270 20, 330 -10, 380 -30 L 380 -30 L -30 -30 Z"
          fill="url(#blueSilkGradTop)"
          filter="url(#softGlowTop)"
        />

        {/* Sharp Golden Yellow Contour Ribbon curving smoothly along the outer corner */}
        <path
          d="M -30 90 C 50 70, 130 110, 210 70 C 270 38, 330 0, 370 -20"
          stroke="url(#goldSilkGradTop)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />

        {/* Secondary soft azure wisp */}
        <path
          d="M -30 130 C 40 110, 120 145, 190 105 C 245 75, 290 35, 330 10"
          stroke="#60A5FA"
          strokeWidth="1.8"
          strokeOpacity="0.4"
          strokeLinecap="round"
          filter="blur(2px)"
        />
      </svg>

      {/* 3. Top-Right Soft Silk Fold */}
      <div className="absolute -top-24 -right-24 w-[360px] sm:w-[500px] h-[300px] bg-gradient-to-bl from-blue-200/35 via-blue-100/20 to-transparent rounded-full blur-3xl" />

      {/* 4. Bottom-Right Flowing Wave Ribbon with Golden Yellow Accent */}
      <svg
        className="absolute -bottom-8 -right-8 w-[400px] sm:w-[560px] md:w-[680px] h-[180px] sm:h-[240px] md:h-[280px] opacity-85 overflow-visible"
        viewBox="0 0 680 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="blueSilkGradBottom" x1="100%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#0369A1" stopOpacity="0.4" />
            <stop offset="40%" stopColor="#38BDF8" stopOpacity="0.35" />
            <stop offset="80%" stopColor="#BAE6FD" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="goldSilkGradBottom" x1="100%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.95" />
            <stop offset="60%" stopColor="#FDE047" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#FEF08A" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* Ethereal bottom blue ribbon body */}
        <path
          d="M 720 240 C 560 170, 420 260, 220 200 C 120 175, 40 210, -20 230 L -20 320 L 720 320 Z"
          fill="url(#blueSilkGradBottom)"
          filter="blur(10px)"
        />

        {/* Golden yellow contour wave */}
        <path
          d="M 710 238 C 555 168, 418 258, 220 198 C 120 173, 40 208, -10 228"
          stroke="url(#goldSilkGradBottom)"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Secondary soft azure wisp */}
        <path
          d="M 680 180 C 520 120, 360 210, 160 160"
          stroke="#60A5FA"
          strokeWidth="1.6"
          strokeOpacity="0.35"
          strokeLinecap="round"
          filter="blur(2px)"
        />
      </svg>
    </div>
  );
};

export default LightCardWavesBackground;
