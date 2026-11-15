'use client';

import React from 'react';

export type BearistaPose = 'waving' | 'thoughtful' | 'celebrating';

interface BearistaMascotProps {
  pose?: BearistaPose;
  className?: string;
  size?: number | string;
  animated?: boolean;
  speech?: string;
}

export const BearistaMascot: React.FC<BearistaMascotProps> = ({
  pose = 'waving',
  className = '',
  size = 180,
  animated = true,
  speech,
}) => {
  return (
    <div className="flex flex-col items-center">
      {speech && (
        <div className="relative mb-2 px-3 py-1.5 bg-white text-[#09285C] rounded-2xl shadow-md border border-blue-100 text-[11px] font-bold text-center max-w-[200px] animate-fade-in">
          <span>{speech}</span>
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r border-b border-blue-100 rotate-45" />
        </div>
      )}
      <div
        className={`relative inline-flex items-center justify-center select-none ${className}`}
        style={{ width: size, height: size }}
        role="img"
        aria-label={`Bearista the DSL Stationery Bear - ${pose} pose`}
      >
      <svg
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`w-full h-full drop-shadow-md ${animated ? 'transition-transform duration-300' : ''}`}
      >
        <defs>
          {/* Gradients */}
          <linearGradient id="bearFur" x1="50" y1="20" x2="150" y2="180" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" />
            <stop offset="0.7" stopColor="#F8FAFC" />
            <stop offset="1" stopColor="#E2E8F0" />
          </linearGradient>

          <linearGradient id="bearMuzzle" x1="85" y1="75" x2="115" y2="115" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#F1F5F9" />
          </linearGradient>

          <linearGradient id="apronBlue" x1="60" y1="120" x2="140" y2="195" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0866E8" />
            <stop offset="1" stopColor="#09285C" />
          </linearGradient>

          <linearGradient id="apronStrap" x1="70" y1="110" x2="130" y2="140" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFD84D" />
            <stop offset="1" stopColor="#F59E0B" />
          </linearGradient>

          {/* Soft Shadow Filter */}
          <filter id="softGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.12" />
          </filter>
        </defs>

        {/* Ambient Back Glow */}
        <circle cx="100" cy="100" r="88" fill="#EAF4FF" fillOpacity="0.45" />

        {/* ================= EARS ================= */}
        {/* Left Ear */}
        <g id="left-ear">
          <circle cx="58" cy="52" r="22" fill="url(#bearFur)" stroke="#CBD5E1" strokeWidth="2.5" />
          <circle cx="58" cy="52" r="13" fill="#FBCFE8" />
        </g>
        {/* Right Ear */}
        <g id="right-ear">
          <circle cx="142" cy="52" r="22" fill="url(#bearFur)" stroke="#CBD5E1" strokeWidth="2.5" />
          <circle cx="142" cy="52" r="13" fill="#FBCFE8" />
        </g>

        {/* ================= BODY & APRON ================= */}
        {/* White Bear Torso */}
        <ellipse cx="100" cy="155" rx="54" ry="42" fill="url(#bearFur)" stroke="#CBD5E1" strokeWidth="2.5" />

        {/* Blue DSL Apron */}
        <path
          d="M 68 135 L 76 118 L 124 118 L 132 135 L 142 188 C 142 195 130 198 100 198 C 70 198 58 195 58 188 Z"
          fill="url(#apronBlue)"
          stroke="#09285C"
          strokeWidth="2.5"
        />

        {/* Apron Neck Ribbon */}
        <path
          d="M 80 118 C 80 108 120 108 120 118"
          stroke="url(#apronStrap)"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
        />

        {/* Apron DSL Brand Badge */}
        <rect x="84" y="138" width="32" height="18" rx="5" fill="#FFFFFF" stroke="#FFD84D" strokeWidth="1.5" />
        <text
          x="100"
          y="151"
          textAnchor="middle"
          fontSize="10"
          fontWeight="900"
          fontFamily="system-ui, -apple-system, sans-serif"
          fill="#09285C"
          letterSpacing="0.8"
        >
          DSL
        </text>

        {/* Apron Pocket with mini pencil */}
        <path d="M 86 166 L 114 166 L 112 182 L 88 182 Z" fill="#09285C" fillOpacity="0.35" stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2 2" />
        {/* Pencil sticking out */}
        <rect x="96" y="157" width="5" height="14" rx="1.5" fill="#FFD84D" transform="rotate(12 98 164)" />
        <polygon points="98,155 101,159 96,160" fill="#E11D48" />

        {/* ================= ARMS & PAWS (Pose Dependent) ================= */}
        {pose === 'waving' && (
          <>
            {/* Left Arm Resting at side */}
            <path
              d="M 60 135 C 50 148 48 165 56 172 C 63 177 70 168 70 156 Z"
              fill="url(#bearFur)"
              stroke="#CBD5E1"
              strokeWidth="2"
            />
            {/* Right Arm Waving Cheerfully */}
            <g className={animated ? 'animate-bounce' : ''} style={{ animationDuration: '2s' }}>
              <path
                d="M 136 130 C 150 118 165 96 160 84 C 154 75 142 86 132 108 Z"
                fill="url(#bearFur)"
                stroke="#CBD5E1"
                strokeWidth="2.2"
              />
              {/* Right Paw waving */}
              <circle cx="160" cy="82" r="10" fill="url(#bearFur)" stroke="#CBD5E1" strokeWidth="1.5" />
              {/* Pink paw pads */}
              <circle cx="160" cy="83" r="4.5" fill="#FBCFE8" />
              <circle cx="156" cy="77" r="1.5" fill="#FBCFE8" />
              <circle cx="160" cy="75" r="1.5" fill="#FBCFE8" />
              <circle cx="164" cy="77" r="1.5" fill="#FBCFE8" />
            </g>
          </>
        )}

        {pose === 'thoughtful' && (
          <>
            {/* Left Arm resting on hip */}
            <path
              d="M 60 135 C 46 145 46 165 54 170 C 62 175 68 164 68 152 Z"
              fill="url(#bearFur)"
              stroke="#CBD5E1"
              strokeWidth="2"
            />
            {/* Right Arm Tapping Chin */}
            <path
              d="M 135 135 C 145 125 148 108 135 98 C 126 90 120 100 124 112 Z"
              fill="url(#bearFur)"
              stroke="#CBD5E1"
              strokeWidth="2.2"
            />
            {/* Paw on cheek */}
            <circle cx="128" cy="98" r="8" fill="url(#bearFur)" stroke="#CBD5E1" strokeWidth="1.5" />
            <circle cx="128" cy="98" r="3.5" fill="#FBCFE8" />
            {/* Thought bubbles / sparkles */}
            <circle cx="158" cy="68" r="4" fill="#0866E8" fillOpacity="0.3" />
            <circle cx="170" cy="54" r="6" fill="#0866E8" fillOpacity="0.4" />
            <path d="M 166 38 L 170 30 L 174 38 L 182 42 L 174 46 L 170 54 L 166 46 L 158 42 Z" fill="#FFD84D" />
          </>
        )}

        {pose === 'celebrating' && (
          <>
            {/* Both Arms Raised High with Joy */}
            {/* Left Arm Up */}
            <g className={animated ? 'animate-bounce' : ''} style={{ animationDuration: '1.2s' }}>
              <path
                d="M 64 128 C 48 114 36 90 42 78 C 48 68 62 82 72 104 Z"
                fill="url(#bearFur)"
                stroke="#CBD5E1"
                strokeWidth="2.2"
              />
              <circle cx="42" cy="76" r="9" fill="url(#bearFur)" stroke="#CBD5E1" strokeWidth="1.5" />
              <circle cx="42" cy="76" r="4" fill="#FBCFE8" />
            </g>
            {/* Right Arm Up */}
            <g className={animated ? 'animate-bounce' : ''} style={{ animationDuration: '1.2s', animationDelay: '0.1s' }}>
              <path
                d="M 136 128 C 152 114 164 90 158 78 C 152 68 138 82 128 104 Z"
                fill="url(#bearFur)"
                stroke="#CBD5E1"
                strokeWidth="2.2"
              />
              <circle cx="158" cy="76" r="9" fill="url(#bearFur)" stroke="#CBD5E1" strokeWidth="1.5" />
              <circle cx="158" cy="76" r="4" fill="#FBCFE8" />
            </g>
            {/* Confetti & stars */}
            <path d="M 28 42 L 32 34 L 36 42 L 44 46 L 36 50 L 32 58 L 28 50 L 20 46 Z" fill="#FFD84D" />
            <path d="M 164 42 L 168 34 L 172 42 L 180 46 L 172 50 L 168 58 L 164 50 L 156 46 Z" fill="#0866E8" />
            <circle cx="100" cy="22" r="3" fill="#16A34A" />
            <circle cx="70" cy="28" r="2.5" fill="#E11D48" />
            <circle cx="130" cy="28" r="2.5" fill="#FFD84D" />
          </>
        )}

        {/* ================= HEAD ================= */}
        <circle cx="100" cy="85" r="45" fill="url(#bearFur)" stroke="#CBD5E1" strokeWidth="2.5" />

        {/* Soft Pink Cheeks */}
        <circle cx="72" cy="98" r="7.5" fill="#FBCFE8" fillOpacity="0.6" />
        <circle cx="128" cy="98" r="7.5" fill="#FBCFE8" fillOpacity="0.6" />

        {/* Muzzle */}
        <ellipse cx="100" cy="98" rx="20" ry="15" fill="url(#bearMuzzle)" stroke="#E2E8F0" strokeWidth="1.5" />

        {/* Cute Black Bear Nose */}
        <path
          d="M 94 92 C 94 88 106 88 106 92 C 106 97 101 100 100 100 C 99 100 94 97 94 92 Z"
          fill="#1E293B"
        />

        {/* Smile */}
        {pose === 'celebrating' ? (
          // Big Open Happy Smile
          <path
            d="M 92 102 Q 100 114 108 102 Z"
            fill="#E11D48"
            stroke="#1E293B"
            strokeWidth="1.8"
          />
        ) : pose === 'thoughtful' ? (
          // Curious smirk
          <path
            d="M 96 103 Q 102 107 107 102"
            fill="none"
            stroke="#1E293B"
            strokeWidth="2"
            strokeLinecap="round"
          />
        ) : (
          // Friendly gentle smile
          <path
            d="M 93 103 Q 100 109 107 103"
            fill="none"
            stroke="#1E293B"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}

        {/* ================= EYES & GLASSES ================= */}
        {/* Friendly Dark Bear Eyes */}
        <circle cx="82" cy="82" r="5" fill="#09285C" />
        <circle cx="80.5" cy="80.5" r="1.8" fill="#FFFFFF" />

        <circle cx="118" cy="82" r="5" fill="#09285C" />
        <circle cx="116.5" cy="80.5" r="1.8" fill="#FFFFFF" />

        {/* SIGNATURE ROUND BLACK GLASSES */}
        {/* Left Lens Rim */}
        <circle cx="82" cy="82" r="14" fill="none" stroke="#0F172A" strokeWidth="3" />
        {/* Right Lens Rim */}
        <circle cx="118" cy="82" r="14" fill="none" stroke="#0F172A" strokeWidth="3" />
        {/* Glasses Bridge */}
        <path d="M 96 80 Q 100 78 104 80" fill="none" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
        {/* Glasses Temple arms */}
        <path d="M 68 81 L 57 80" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M 132 81 L 143 80" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      </div>
    </div>
  );
};
