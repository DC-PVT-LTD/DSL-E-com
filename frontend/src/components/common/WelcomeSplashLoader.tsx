'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface WelcomeSplashLoaderProps {
  durationSeconds?: number;
  onFinished?: () => void;
}

export const WelcomeSplashLoader: React.FC<WelcomeSplashLoaderProps> = ({
  durationSeconds = 4,
  onFinished,
}) => {
  const [visible, setVisible] = useState(true);
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const [progressWidth, setProgressWidth] = useState(0);

  useEffect(() => {
    // Start progress bar animation
    const pTimer = setTimeout(() => {
      setProgressWidth(100);
    }, 50);

    // Countdown interval
    const cInterval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(cInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Auto dismiss after duration
    const dismissTimer = setTimeout(() => {
      handleDismiss();
    }, durationSeconds * 1000);

    return () => {
      clearTimeout(pTimer);
      clearInterval(cInterval);
      clearTimeout(dismissTimer);
    };
  }, [durationSeconds]);

  const handleDismiss = () => {
    setVisible(false);
    onFinished?.();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="welcome-splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] } }}
          className="fixed inset-0 z-[99999] w-screen h-screen min-h-screen overflow-hidden bg-slate-900 text-white select-none pointer-events-auto flex flex-col justify-between"
        >
          {/* Background Video */}
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <video
              autoPlay
              loop
              muted
              playsInline
              poster="/hero-stationery-hd.jpg"
              className="w-full h-full object-cover object-center scale-[1.005] will-change-transform"
            >
              <source src="/hero-video-4k.mp4" type="video/mp4" />
              <source src="/hero-video-hd.mp4" type="video/mp4" />
              <source src="/hero-video.mp4" type="video/mp4" />
              <img
                src="/hero-stationery-hd.jpg"
                alt="DSL Stationery Workspace"
                className="w-full h-full object-cover object-center"
              />
            </video>
            <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-black/35 pointer-events-none" />
          </div>

          {/* Top Progress Loading Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-white/20 z-50 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#38BDF8] via-[#FFD21C] to-[#4ADE80] shadow-[0_0_12px_rgba(56,189,248,0.8)]"
              style={{
                width: `${progressWidth}%`,
                transition: `width ${durationSeconds}s linear`,
              }}
            />
          </div>

          {/* TOP HEADER */}
          <header className="relative z-20 w-full px-4 sm:px-8 lg:px-12 pt-6 sm:pt-8 flex items-center justify-between">
            <div className="inline-flex items-center">
              <img
                src="/dsl-logo-clean.png"
                alt="DSL Enterprises (Pvt) Ltd"
                className="h-10 sm:h-12 w-auto object-contain drop-shadow-[0_2px_10px_rgba(255,255,255,0.9)]"
              />
            </div>

            {/* Quick Skip Button with live countdown */}
            <button
              type="button"
              onClick={handleDismiss}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/30 text-white text-xs sm:text-sm font-medium backdrop-blur-md transition-all duration-200 cursor-pointer shadow-lg hover:scale-105 active:scale-95"
              aria-label="Skip intro and go to store"
            >
              <span>Skip</span>
              <span className="w-5 h-5 rounded-full bg-white/25 flex items-center justify-center text-[10px] font-bold">
                {timeLeft}s
              </span>
            </button>
          </header>

          {/* CENTER EDITORIAL HEADLINE */}
          <div className="relative z-10 max-w-5xl mx-auto px-6 text-center my-auto py-6 flex flex-col items-center justify-center">
            <h1 className="font-shooting-star text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-normal tracking-wide leading-snug drop-shadow-[0_4px_22px_rgba(0,0,0,0.95)] max-w-3xl">
              <span className="text-white">Our </span>
              <span className="text-[#FFD21C]">Partner </span>
              <span className="text-white">in </span>
              <span className="text-[#38BDF8]">Learning</span>
              <span className="text-white">, </span>
              <span className="text-[#FF5C8D]">Creating </span>
              <span className="text-white">&amp; </span>
              <span className="text-[#4ADE80]">Working</span>
            </h1>

            {/* Pill "Shop Now" / "Enter Store" Button */}
            <div className="mt-8 sm:mt-10">
              <button
                type="button"
                onClick={handleDismiss}
                className="inline-flex items-center justify-center bg-[#C6E7FF] hover:bg-[#B3DEFC] text-[#08275E] font-heylowitch text-xl sm:text-2xl px-10 sm:px-12 py-2.5 sm:py-3 rounded-full shadow-2xl transition-all duration-200 hover:scale-105 tracking-wide cursor-pointer border-2 border-white/80 active:scale-95"
              >
                Shop Now
              </button>
            </div>
          </div>

          {/* BOTTOM BRAND STRIP */}
          <div className="relative z-10 w-full px-4 sm:px-8 lg:px-12 pb-6 sm:pb-8">
            <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center sm:justify-between gap-4 sm:gap-6 bg-white/25 backdrop-blur-2xl px-8 sm:px-12 py-3.5 rounded-full border border-white/60 shadow-[0_8px_32px_0_rgba(0,0,0,0.18)]">
              {['Doms', 'Linc', 'Luxor', 'Speed', 'Camlin', 'Fine', 'HP', 'Wetex', 'Lido'].map((brand) => (
                <span
                  key={brand}
                  className="font-shooting-star text-base sm:text-lg text-slate-900 hover:text-[#08275E] transition-colors cursor-default tracking-wide"
                >
                  {brand}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WelcomeSplashLoader;
