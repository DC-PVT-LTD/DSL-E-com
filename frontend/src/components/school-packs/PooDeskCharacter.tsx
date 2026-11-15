'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface PooDeskCharacterProps {
  onNoticed?: () => void;
  isLeaving?: boolean;
}

export const PooDeskCharacter: React.FC<PooDeskCharacterProps> = ({
  onNoticed,
  isLeaving = false,
}) => {
  const [phase, setPhase] = useState<'reading' | 'looking_up' | 'waving'>('reading');
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    // Stage 1: Reading -> Looking up at 500ms
    const t1 = setTimeout(() => {
      setPhase('looking_up');
    }, 500);

    // Stage 2: Looking up -> Friendly wave at 1100ms
    const t2 = setTimeout(() => {
      setPhase('waving');
      onNoticed?.();
    }, 1100);

    // Periodic blinking
    const blinkInterval = setInterval(() => {
      setBlinking(true);
      setTimeout(() => setBlinking(false), 180);
    }, 3800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearInterval(blinkInterval);
    };
  }, [onNoticed]);

  return (
    <div
      className={`relative w-[240px] sm:w-[320px] md:w-[380px] lg:w-[420px] transition-all duration-700 select-none ${
        isLeaving ? 'opacity-0 -translate-x-12 scale-95 pointer-events-none' : 'opacity-100'
      }`}
      aria-label="Poo the friendly DSL polar bear sitting at the desk"
    >
      {/* Sitting Poo Layer */}
      <div
        className={`relative transition-transform duration-700 ${
          phase === 'reading'
            ? 'rotate-[-3deg] translate-y-3'
            : phase === 'looking_up'
            ? 'animate-poo-lookup'
            : 'animate-poo-breathe'
        }`}
      >
        <Image
          src="/assets/poo/poo-sitting-desk-clean.png"
          alt="Poo reading at desk"
          width={420}
          height={420}
          priority
          className={`w-full h-auto object-contain drop-shadow-xl transition-transform duration-500 ${
            phase === 'waving' ? 'animate-poo-wave' : ''
          }`}
        />

        {/* Eyelid Blink Overlay (Smooth and subtle) */}
        {blinking && (
          <div
            className="absolute top-[28%] left-[34%] w-[32%] h-[6%] bg-[#E8EEF5] rounded-full pointer-events-none transition-opacity duration-100 shadow-inner"
            style={{ filter: 'blur(0.5px)' }}
          />
        )}

        {/* Subtle Warm Reading Light Reflection on Glasses */}
        <div className="absolute top-[26%] left-[32%] w-4 h-4 bg-amber-200/40 rounded-full blur-[2px] pointer-events-none animate-pulse" />
      </div>
    </div>
  );
};

