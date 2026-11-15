'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface PooStandingCharacterProps {
  mode: 'selection' | 'celebrate' | 'thinking';
  reactionTrigger?: number; // increments on user interactions (grade/tier click)
  reactionType?: 'nod' | 'smile' | null;
  className?: string;
  isMobile?: boolean;
}

export const PooStandingCharacter: React.FC<PooStandingCharacterProps> = ({
  mode = 'selection',
  reactionTrigger = 0,
  reactionType = null,
  className = '',
  isMobile = false,
}) => {
  const [animatingReaction, setAnimatingReaction] = useState(false);
  const [blinking, setBlinking] = useState(false);

  // Trigger temporary reaction animation when user interacts
  useEffect(() => {
    if (reactionTrigger > 0) {
      setAnimatingReaction(true);
      const timer = setTimeout(() => {
        setAnimatingReaction(false);
      }, 750);
      return () => clearTimeout(timer);
    }
  }, [reactionTrigger]);

  // Natural blinking
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setBlinking(true);
      setTimeout(() => setBlinking(false), 160);
    }, 4000);

    return () => clearInterval(blinkInterval);
  }, []);

  return (
    <div
      className={`relative select-none ${className}`}
      aria-label="Poo the friendly DSL polar bear standing and guiding"
    >
      {/* Joyful Celebrate Floating Confetti & Sparkles */}
      {mode === 'celebrate' && (
        <div className="absolute -top-12 -left-8 -right-8 -bottom-8 pointer-events-none z-30 overflow-visible">
          <span className="absolute -top-4 left-4 text-3xl animate-bounce">✨</span>
          <span className="absolute top-4 right-2 text-4xl animate-bounce delay-150">🎉</span>
          <span className="absolute top-20 -left-6 text-2xl animate-pulse delay-200">⭐</span>
          <span className="absolute top-28 right-0 text-3xl animate-bounce delay-300">🌟</span>
          <span className="absolute -top-8 right-12 text-2xl animate-pulse">✨</span>
          <span className="absolute bottom-16 -left-4 text-3xl animate-bounce delay-75">🎊</span>
        </div>
      )}

      {/* Poo Body & Motion Container */}
      <div
        className={`relative transition-transform duration-500 ${
          animatingReaction
            ? reactionType === 'nod'
              ? 'animate-poo-nod'
              : 'scale-105 -translate-y-2'
            : mode === 'celebrate'
            ? isMobile
              ? 'animate-poo-celebrate-mobile'
              : 'animate-poo-celebrate'
            : mode === 'selection'
            ? 'animate-poo-point'
            : 'animate-poo-breathe'
        }`}
      >
        <Image
          src="/assets/poo/poo-standing-transparent.png"
          alt="Poo the friendly DSL polar bear with yellow book and glasses smiling warmly"
          width={500}
          height={460}
          priority
          className="w-full h-auto object-contain drop-shadow-[0_25px_40px_rgba(9,40,92,0.3)] filter contrast-105"
        />

        {/* Eyelid Blink Overlay */}
        {blinking && (
          <div
            className="absolute top-[21%] left-[28%] w-[26%] h-[5%] bg-[#E8EEF5] rounded-full pointer-events-none transition-opacity duration-100 shadow-inner"
            style={{ filter: 'blur(0.5px)' }}
          />
        )}
      </div>
    </div>
  );
};
