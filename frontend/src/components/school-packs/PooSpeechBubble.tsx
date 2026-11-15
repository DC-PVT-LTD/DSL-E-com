'use client';

import React from 'react';

interface PooSpeechBubbleProps {
  title: string;
  emoji?: string;
  body: string;
  tailPosition?: 'left' | 'bottom-left' | 'bottom' | 'top-left' | 'top' | 'none';
  children?: React.ReactNode;
  className?: string;
  showSunbeams?: boolean;
}

export const PooSpeechBubble: React.FC<PooSpeechBubbleProps> = ({
  title,
  emoji,
  body,
  tailPosition = 'left',
  children,
  className = '',
  showSunbeams = true,
}) => {
  return (
    <div
      className={`relative inline-block max-w-lg w-full animate-speech-float ${className}`}
      role="region"
      aria-live="polite"
    >
      {/* Sunbeam Sparkle Accents */}
      {showSunbeams && (
        <div className="absolute -top-3 -right-2 flex gap-1 pointer-events-none select-none z-10">
          <svg
            className="w-7 h-7 sm:w-8 sm:h-8 text-[#FFB800] drop-shadow-sm animate-pulse"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2L13.5 8.5L20 10L14.5 13.5L16 20L11 16L6 20L7.5 13.5L2 10L8.5 8.5L12 2Z" />
          </svg>
        </div>
      )}

      {/* Main Glass Speech Bubble Card */}
      <div className="relative bg-white/95 backdrop-blur-md rounded-[28px] sm:rounded-[36px] p-5 sm:p-7 shadow-[0_20px_50px_rgba(9,40,92,0.18)] border border-white/80 ring-1 ring-slate-100/50">
        {/* Tail pointing toward Poo */}
        {tailPosition === 'left' && (
          <div
            className="absolute top-1/2 -left-3.5 -translate-y-1/2 w-4 h-4 bg-white/95 border-l border-b border-white/80 rotate-45 hidden md:block"
            aria-hidden="true"
          />
        )}
        {tailPosition === 'bottom-left' && (
          <div
            className="absolute -bottom-3 left-10 w-5 h-5 bg-white/95 border-r border-b border-white/80 rotate-45 block"
            aria-hidden="true"
          />
        )}
        {tailPosition === 'top-left' && (
          <div
            className="absolute -top-2.5 left-10 w-5 h-5 bg-white/95 border-l border-t border-white/80 rotate-45 block shadow-[-2px_-2px_4px_rgba(0,0,0,0.03)]"
            aria-hidden="true"
          />
        )}
        {tailPosition === 'top' && (
          <div
            className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 bg-white/95 border-l border-t border-white/80 rotate-45 block shadow-[-2px_-2px_4px_rgba(0,0,0,0.03)]"
            aria-hidden="true"
          />
        )}

        {/* Content */}
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-[#09285C] tracking-tight flex items-center gap-2 flex-wrap">
            <span>{title}</span>
            {emoji && <span className="inline-block animate-bounce">{emoji}</span>}
          </h2>

          <p className="text-xs sm:text-sm md:text-base font-bold text-slate-700 leading-relaxed">
            {body}
          </p>
        </div>

        {/* Action Controls / Buttons Slot */}
        {children && <div className="mt-5 pt-2 flex flex-wrap items-center gap-3">{children}</div>}
      </div>
    </div>
  );
};

