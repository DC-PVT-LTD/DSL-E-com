'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function InteractiveAboutSection() {
  const [isGreeting, setIsGreeting] = useState(false);
  const cooldownRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Desktop hover triggers
  const handleMouseEnter = () => {
    setIsGreeting(true);
  };

  const handleMouseLeave = () => {
    setIsGreeting(false);
  };

  // Mobile / Keyboard tap trigger with cooldown
  const handleTriggerGreeting = () => {
    if (cooldownRef.current) return;
    cooldownRef.current = true;
    setIsGreeting(true);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsGreeting(false);
      setTimeout(() => {
        cooldownRef.current = false;
      }, 350);
    }, 2800);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <section
      aria-label="About DSL Stationery"
      className="w-full bg-[#FFF8ED] py-4 select-none"
    >
      {/* Full-width container with seamless background */}
      <div className="w-full">
        {/* ========================================================= */}
        {/* DESKTOP & TABLET VIEW (md and up) — SEAMLESS PANEL        */}
        {/* ========================================================= */}
        <div
          className="hidden md:block relative w-full aspect-[1024/342] overflow-visible cursor-pointer group"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleTriggerGreeting}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleTriggerGreeting();
            }
          }}
          tabIndex={0}
          role="region"
          aria-label="About DSL Stationery. Interactive character on the left."
        >
          {/* Base Torn Pastel-Blue Paper Banner blending seamlessly into #FFF8ED */}
          <div className="absolute inset-0 z-0">
            <Image
              src="/images/about/about_reference_card_2x.png"
              alt="DSL Stationery About card featuring cute girl character with books, pencils and stationery on pastel blue torn paper"
              fill
              priority
              sizes="100vw"
              className="object-fill w-full h-full"
            />
          </div>

          {/* Interactive Character Hotspot (Over the Girl on the Left) */}
          <div
            className="absolute z-20 pointer-events-none"
            style={{
              left: '14%',
              top: '5%',
              width: '23%',
              height: '92%',
            }}
          >
            {/* Friendly Greeting Speech Bubble popping near her waving hand */}
            <div
              className={`absolute -top-7 right-[-10px] z-30 transition-all duration-300 ease-out pointer-events-none ${
                isGreeting
                  ? 'opacity-100 scale-100 -translate-y-1'
                  : 'opacity-0 scale-75 translate-y-2'
              }`}
            >
              <div className="relative bg-white text-[#10285D] px-3.5 py-1.5 rounded-2xl shadow-xl border border-[#10285D]/15 flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-xs lg:text-sm font-black tracking-tight">Hey!</span>
                <span className="text-xs lg:text-sm text-[#FF6584] animate-bounce">✿</span>

                {/* Speech Bubble Tail pointing down-left toward girl */}
                <div className="absolute -bottom-1.5 left-4 w-2.5 h-2.5 bg-white border-b border-r border-[#10285D]/15 transform rotate-45" />
              </div>
            </div>

            {/* Sparkles on Greeting */}
            <div
              className={`absolute top-0 right-2 transition-all duration-300 ${
                isGreeting ? 'opacity-100 scale-100 animate-spin-slow' : 'opacity-0 scale-50'
              }`}
            >
              <span className="text-lg lg:text-xl">✨</span>
            </div>
            <div
              className={`absolute top-8 -left-3 transition-all duration-300 ${
                isGreeting ? 'opacity-100 scale-100 animate-pulse' : 'opacity-0 scale-50'
              }`}
            >
              <span className="text-sm lg:text-base">✦</span>
            </div>
          </div>

          {/* Right Side Content Column (Exact Text & Responsive Scaling) */}
          <div
            className="absolute z-10 flex flex-col justify-center items-start space-y-2 lg:space-y-3 xl:space-y-4"
            style={{
              left: '42%',
              right: '6%',
              top: '10%',
              bottom: '10%',
            }}
          >
            {/* Eyebrow Pill with Yellow Radiating Accent Strokes */}
            <div className="inline-flex items-center gap-2">
              <svg
                width="16"
                height="12"
                viewBox="0 0 16 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-[#FFC72C] w-3.5 h-2.5 xl:w-4 xl:h-3"
                aria-hidden="true"
              >
                <path
                  d="M1 10L6 6M4 2L7 5"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>

              <div className="bg-[#FFDA55] text-[#10285D] px-4 py-1 xl:px-5 xl:py-1.5 rounded-full text-[10px] lg:text-[11.5px] xl:text-[13px] font-black tracking-wider uppercase shadow-2xs flex items-center gap-1.5">
                <span>✿</span>
                <span>CURATED ESSENTIALS FOR REFINED LIVING</span>
                <span>✿</span>
              </div>

              <svg
                width="16"
                height="12"
                viewBox="0 0 16 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-[#FFC72C] w-3.5 h-2.5 xl:w-4 xl:h-3"
                aria-hidden="true"
              >
                <path
                  d="M15 10L10 6M12 2L9 5"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* Main Heading with Yellow Decorative Underline */}
            <div className="relative inline-block">
              <h2 className="text-2xl lg:text-3xl xl:text-4xl 2xl:text-[42px] font-extrabold text-[#10285D] tracking-tight leading-snug">
                Little Essentials. Big Ideas.
              </h2>
              {/* Yellow Decorative Underline below 'Big Ideas.' */}
              <svg
                className="absolute -bottom-2 right-0 w-36 lg:w-48 xl:w-56 text-[#FFC72C]"
                viewBox="0 0 160 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M2 9C45 3 115 2 158 8"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* Exact Description Paragraph */}
            <p className="text-xs lg:text-[13px] xl:text-[15px] 2xl:text-[16.5px] text-[#10285D]/85 leading-relaxed font-medium max-w-xl xl:max-w-2xl pt-0.5">
              We’re a modern stationery store offering everyday essentials, simple finds, and quality products
              designed to make studying, working, planning, and creating effortless and joyful. We handpick items
              you truly love — practical, affordable, and stylish.
            </p>

            {/* CTA Button */}
            <div className="pt-2">
              <Link
                href="/about"
                className="inline-flex items-center justify-center px-7 py-2.5 xl:px-9 xl:py-3 rounded-full border-2 border-[#10285D] bg-white text-xs lg:text-sm xl:text-base font-bold text-[#10285D] hover:bg-[#10285D] hover:text-white transition-all duration-300 shadow-xs hover:shadow-md hover:scale-105 active:scale-95"
              >
                Know More
              </Link>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* MOBILE VIEW (< md) — FULL-WIDTH STACKED RESPONSIVE CARD  */}
        {/* ========================================================= */}
        <div
          className="md:hidden mx-3 sm:mx-4 relative bg-[#E7F2FD] rounded-3xl p-6 shadow-lg border-2 border-white/80 overflow-hidden cursor-pointer"
          onClick={handleTriggerGreeting}
          role="region"
          aria-label="About DSL Stationery"
        >
          <div className="flex flex-col items-center text-center space-y-4 relative z-10 w-full">
            {/* Mobile Complete Character with Stationery */}
            <div className="relative w-64 h-56 sm:w-72 sm:h-64">
              {/* Speech Bubble popping on Tap */}
              <div
                className={`absolute -top-3 right-4 z-30 transition-all duration-300 ease-out pointer-events-none ${
                  isGreeting
                    ? 'opacity-100 scale-100 -translate-y-1'
                    : 'opacity-0 scale-75 translate-y-2'
                }`}
              >
                <div className="relative bg-white text-[#10285D] px-3.5 py-1 rounded-2xl shadow-xl border border-[#10285D]/15 flex items-center gap-1">
                  <span className="text-xs font-black">Hey!</span>
                  <span className="text-xs text-[#FF6584]">✿</span>
                  <div className="absolute -bottom-1.5 left-4 w-2.5 h-2.5 bg-white border-b border-r border-[#10285D]/15 transform rotate-45" />
                </div>
              </div>

              {/* Complete Girl and Stationery Image */}
              <div
                className={`relative w-full h-full transition-transform duration-500 ease-out ${
                  isGreeting ? '-translate-y-1 scale-102' : ''
                }`}
              >
                <Image
                  src="/images/about/girl_with_stationery_2x.png"
                  alt="Original cute girl character with books and pencils waving"
                  fill
                  priority
                  sizes="300px"
                  className="object-contain object-bottom drop-shadow-md rounded-2xl"
                />
              </div>
            </div>

            {/* Eyebrow Pill */}
            <div className="bg-[#FFDA55] text-[#10285D] px-3.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase shadow-2xs flex items-center gap-1">
              <span>✿</span>
              <span>CURATED ESSENTIALS FOR REFINED LIVING</span>
              <span>✿</span>
            </div>

            {/* Heading */}
            <div className="relative">
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#10285D] tracking-tight leading-snug">
                Little Essentials. Big Ideas.
              </h2>
              <svg
                className="w-28 mx-auto mt-1 text-[#FFC72C]"
                viewBox="0 0 160 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M2 9.5C45 3.5 115 2.5 158 8"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* Description */}
            <p className="text-xs text-[#10285D]/85 leading-relaxed font-medium px-2">
              We’re a modern stationery store offering everyday essentials, simple finds, and quality products
              designed to make studying, working, planning, and creating effortless and joyful. We handpick items
              you truly love — practical, affordable, and stylish.
            </p>

            {/* CTA Button */}
            <div className="pt-1">
              <Link
                href="/about"
                className="inline-flex items-center justify-center px-7 py-2.5 rounded-full border-2 border-[#10285D] bg-white text-xs font-bold text-[#10285D] shadow-xs active:scale-95 transition-all"
              >
                Know More
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
