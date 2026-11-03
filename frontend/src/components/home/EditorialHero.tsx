'use client';

import React from 'react';
import Link from 'next/link';

export const EditorialHero: React.FC = () => {
  return (
    <section className="relative w-full h-screen min-h-screen flex flex-col justify-between overflow-hidden bg-slate-900 text-white select-none">
      {/* Background Video (High Definition QHD/4K Sharpened & Colorful) */}
      <div className="absolute inset-0 z-0 overflow-hidden">
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
          {/* Fallback image if video not loaded */}
          <img
            src="/hero-stationery-hd.jpg"
            alt="DSL Stationery Workspace"
            className="w-full h-full object-cover object-center"
          />
        </video>
        {/* Subtle, soft edge gradients to ensure text stands out without dimming the video */}
        <div className="absolute inset-0 bg-linear-to-b from-black/15 via-transparent to-black/20 pointer-events-none" />
      </div>

      {/* TOP HEADER */}
      <header className="relative z-20 w-full px-4 sm:px-8 lg:px-12 pt-6 sm:pt-8 flex items-center justify-between">
        {/* Official DSL Enterprises (Pvt) Ltd Logo - Only the Logo */}
        <Link
          href="/home"
          className="inline-flex items-center hover:opacity-90 transition-opacity"
          title="DSL Enterprises (Pvt) Ltd"
        >
          <img
            src="/dsl-logo-clean.png"
            alt="DSL Enterprises (Pvt) Ltd"
            className="h-10 sm:h-12 w-auto object-contain drop-shadow-[0_2px_10px_rgba(255,255,255,0.9)]"
          />
        </Link>
      </header>

      {/* CENTER EDITORIAL HERO - Clean, Minimal Matching Photo 2 (No Unnecessary Words) */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center my-auto py-6 flex flex-col items-center justify-center">
        {/* Main Editorial Headline with Multi-Color Stationery Palette */}
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

        {/* Light Pastel Blue Rounded Pill "Shop Now" Button with Heylowitch Font */}
        <div className="mt-8 sm:mt-10">
          <Link
            href="/home"
            className="inline-flex items-center justify-center bg-[#C6E7FF] hover:bg-[#B3DEFC] text-[#08275E] font-heylowitch text-xl sm:text-2xl px-10 sm:px-12 py-2.5 sm:py-3 rounded-full shadow-2xl transition-all duration-200 hover:scale-105 tracking-wide cursor-pointer border-2 border-white/80"
          >
            Shop Now
          </Link>
        </div>
      </div>

      {/* BOTTOM BRAND STRIP - Full Glassy Glassmorphism Bar */}
      <div className="relative z-10 w-full px-4 sm:px-8 lg:px-12 pb-6 sm:pb-8">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center sm:justify-between gap-4 sm:gap-6 bg-white/25 backdrop-blur-2xl px-8 sm:px-12 py-3.5 rounded-full border border-white/60 shadow-[0_8px_32px_0_rgba(0,0,0,0.18)]">
          <span className="font-shooting-star text-base sm:text-lg text-slate-900 hover:text-[#08275E] transition-colors cursor-default tracking-wide">
            Doms
          </span>
          <span className="font-shooting-star text-base sm:text-lg text-slate-900 hover:text-[#08275E] transition-colors cursor-default tracking-wide">
            Linc
          </span>
          <span className="font-shooting-star text-base sm:text-lg text-slate-900 hover:text-[#08275E] transition-colors cursor-default tracking-wide">
            Luxor
          </span>
          <span className="font-shooting-star text-base sm:text-lg text-slate-900 hover:text-[#08275E] transition-colors cursor-default tracking-wide">
            Speed
          </span>
          <span className="font-shooting-star text-base sm:text-lg text-slate-900 hover:text-[#08275E] transition-colors cursor-default tracking-wide">
            Camlin
          </span>
          <span className="font-shooting-star text-base sm:text-lg text-slate-900 hover:text-[#08275E] transition-colors cursor-default tracking-wide">
            Fine
          </span>
          <span className="font-shooting-star text-base sm:text-lg text-slate-900 hover:text-[#08275E] transition-colors cursor-default tracking-wide">
            HP
          </span>
          <span className="font-shooting-star text-base sm:text-lg text-slate-900 hover:text-[#08275E] transition-colors cursor-default tracking-wide">
            Wetex
          </span>
          <span className="font-shooting-star text-base sm:text-lg text-slate-900 hover:text-[#08275E] transition-colors cursor-default tracking-wide">
            Lido
          </span>
        </div>
      </div>
    </section>
  );
};

