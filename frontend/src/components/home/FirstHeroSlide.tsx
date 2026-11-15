'use client';

import React, { useState, useEffect, useRef } from 'react';

export const FirstHeroSlide: React.FC = () => {
  const [animActive, setAnimActive] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Monitor slide activation (mount & carousel slide transitions)
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const checkVisibility = () => {
      const parent = root.parentElement;
      if (!parent) return;
      const isVisible =
        !parent.classList.contains('opacity-0') &&
        parent.getAttribute('aria-hidden') !== 'true';
      setAnimActive(isVisible);
    };

    // Initial check
    checkVisibility();

    // Observe parent container for carousel slide changes
    const parent = root.parentElement;
    if (!parent) return;

    const observer = new MutationObserver(() => {
      checkVisibility();
    });

    observer.observe(parent, {
      attributes: true,
      attributeFilter: ['class', 'aria-hidden'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={rootRef}
      className={`relative w-full h-[535px] sm:h-[580px] md:h-[632px] lg:h-[calc(100vh-102px)] lg:max-h-[640px] xl:max-h-[680px] overflow-hidden select-none bg-[#092556] flex items-center justify-center cursor-default ${animActive ? 'speed-stage-active' : 'speed-stage-idle'
        }`}
    >
      {/* ========================================================= */}
      {/* LAYER 1: ATMOSPHERIC FULL-BLEED BACKGROUND IMAGE         */}
      {/* Static, razor-sharp background                            */}
      {/* ========================================================= */}
      <div className="absolute inset-0 w-full h-full pointer-events-none">
        <div className="w-full h-full">
          <img
            src="/images/hero/speed-hero/hero-background.png"
            alt="Speed Write Beyond Limits Background"
            className="w-full h-full object-cover object-center select-none"
            draggable={false}
          />
        </div>
      </div>

      {/* ========================================================= */}
      {/* RESPONSIVE STAGE CONTAINER (Maintains exact 1670:941 ratio) */}
      {/* ========================================================= */}
      <div className="relative w-full h-full max-w-[1780px] mx-auto flex items-center justify-center pointer-events-none px-2 sm:px-4 lg:px-8">
        <div
          className="relative w-full h-full flex items-center justify-center"
          style={{
            aspectRatio: '1670 / 941',
            maxWidth: '100%',
            maxHeight: '100%',
          }}
        >
          {/* ========================================================= */}
          {/* LAYER 2: FEATURE BULLET ICONS (Shifted Left & Scaled Up)  */}
          {/* 3 Icons Revealed Sequentially with Slow, Smooth Glide     */}
          {/* ========================================================= */}
          <div className="absolute inset-0 w-full h-full pointer-events-none z-[35] speed-left-shift">
            <div
              className="w-full h-full origin-left"
              style={{
                transform: 'scale(1.18)',
              }}
            >
              {/* Feature Icon 1: Smooth Flow */}
              <div
                className="absolute inset-0 w-full h-full speed-entrance-icon-1"
                style={{ clipPath: 'inset(0% 0% 68.22% 0%)' }}
              >
                <img
                  src="/images/hero/speed-hero/feature-icons.png"
                  alt="Feature Badge: Smooth Flow"
                  className="w-full h-full object-contain select-none"
                  draggable={false}
                />
              </div>

              {/* Feature Icon 2: Comfort Grip */}
              <div
                className="absolute inset-0 w-full h-full speed-entrance-icon-2"
                style={{ clipPath: 'inset(31.78% 0% 56.43% 0%)' }}
              >
                <img
                  src="/images/hero/speed-hero/feature-icons.png"
                  alt="Feature Badge: Comfort Grip"
                  className="w-full h-full object-contain select-none"
                  draggable={false}
                />
              </div>

              {/* Feature Icon 3: Reliable & Durable */}
              <div
                className="absolute inset-0 w-full h-full speed-entrance-icon-3"
                style={{ clipPath: 'inset(43.57% 0% 0% 0%)' }}
              >
                <img
                  src="/images/hero/speed-hero/feature-icons.png"
                  alt="Feature Badge: Reliable and Durable"
                  className="w-full h-full object-contain select-none"
                  draggable={false}
                />
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* LAYER 3: RED SPEED LOGO (Top Right - Shifted More Right)  */}
          {/* Static clean placement                                    */}
          {/* ========================================================= */}
          <div className="absolute inset-0 w-full h-full pointer-events-none z-10 speed-right-shift">
            <div className="w-full h-full">
              <img
                src="/images/hero/speed-hero/speed-logo.png"
                alt="SPEED Brand Logo"
                className="w-full h-full object-contain select-none drop-shadow-md"
                draggable={false}
              />
            </div>
          </div>

          {/* ========================================================= */}
          {/* LAYER 4: SUPPORTING SPEED PENS (Shifted More Right)       */}
          {/* Static: No movement, no float, no entrance anim           */}
          {/* ========================================================= */}
          <div className="absolute inset-0 w-full h-full pointer-events-none z-10 speed-right-shift">
            <div className="w-full h-full">
              {/* Supporting Pen 1: Black Pen */}
              <div
                className="absolute inset-0 w-full h-full"
                style={{
                  clipPath:
                    'polygon(0% 0%, 91.14% 0%, 91.14% 68.01%, 87.43% 96.71%, 87.43% 100%, 0% 100%)',
                }}
              >
                <img
                  src="/images/hero/speed-hero/main-pen.png"
                  alt="SPEED Black Pen"
                  className="w-full h-full object-contain select-none drop-shadow-lg"
                  draggable={false}
                />
              </div>

              {/* Supporting Pen 2: Red Pen */}
              <div
                className="absolute inset-0 w-full h-full"
                style={{
                  clipPath:
                    'polygon(91.14% 0%, 94.37% 0%, 94.37% 68.01%, 90.42% 96.71%, 90.42% 100%, 87.43% 100%, 87.43% 96.71%, 91.14% 68.01%)',
                }}
              >
                <img
                  src="/images/hero/speed-hero/main-pen.png"
                  alt="SPEED Red Pen"
                  className="w-full h-full object-contain select-none drop-shadow-lg"
                  draggable={false}
                />
              </div>

              {/* Supporting Pen 3: Blue Pen */}
              <div
                className="absolute inset-0 w-full h-full"
                style={{
                  clipPath:
                    'polygon(94.37% 0%, 100% 0%, 100% 100%, 90.42% 100%, 90.42% 96.71%, 94.37% 68.01%)',
                }}
              >
                <img
                  src="/images/hero/speed-hero/main-pen.png"
                  alt="SPEED Blue Pen"
                  className="w-full h-full object-contain select-none drop-shadow-lg"
                  draggable={false}
                />
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* LAYER 5: 3D BLUE RIBBON BACK LOOP (Behind 'WRITE' & Child) */}
          {/* Static layer matching reference (no ribbon animation)     */}
          {/* ========================================================= */}
          <div className="absolute inset-0 w-full h-full pointer-events-none z-15">
            <div className="w-full h-full">
              <img
                src="/images/hero/speed-hero/ribbon-back.png"
                alt="Ribbon Back Loop"
                className="w-full h-full object-contain select-none"
                draggable={false}
              />
            </div>
          </div>

          {/* ========================================================= */}
          {/* LAYER 6: 3D TYPOGRAPHY — 'WRITE'                          */}
          {/* Slow, elegant entrance from above (1.8s)                  */}
          {/* ========================================================= */}
          <div className="absolute inset-0 w-full h-full pointer-events-none z-[18]">
            <div className="w-full h-full speed-entrance-write">
              <img
                src="/images/hero/speed-hero/write.png"
                alt="WRITE"
                className="w-full h-full object-contain select-none drop-shadow-[0_12px_24px_rgba(0,0,0,0.3)] animate-float-text-top"
                draggable={false}
              />
            </div>
          </div>

          {/* ========================================================= */}
          {/* LAYER 7: CHILD CHARACTER (In Front of 'WRITE')            */}
          {/* Static: No movement, no float, no entrance anim           */}
          {/* ========================================================= */}
          <div className="absolute inset-0 w-full h-full pointer-events-none z-[22]">
            <div className="w-full h-full">
              <img
                src="/images/hero/speed-hero/child.png"
                alt="Speed Hero Boy with Pen"
                className="w-full h-full object-contain select-none drop-shadow-[0_14px_28px_rgba(0,0,0,0.35)]"
                draggable={false}
              />
            </div>
          </div>

          {/* ========================================================= */}
          {/* LAYER 8: 3D BLUE RIBBON FRONT LOOP (Wraps across chest)   */}
          {/* Static foreground layer (no ribbon animation)             */}
          {/* ========================================================= */}
          <div className="absolute inset-0 w-full h-full pointer-events-none z-[26]">
            <div className="w-full h-full">
              <img
                src="/images/hero/speed-hero/ribbon-front.png"
                alt="Ribbon Front Loop"
                className="w-full h-full object-contain select-none drop-shadow-md"
                draggable={false}
              />
            </div>
          </div>

          {/* ========================================================= */}
          {/* LAYER 9: 3D TYPOGRAPHY — 'BEYOND'                         */}
          {/* Slow, elegant entrance from below (1.8s)                  */}
          {/* ========================================================= */}
          <div className="absolute inset-0 w-full h-full pointer-events-none z-[30]">
            <div className="w-full h-full speed-entrance-beyond">
              <img
                src="/images/hero/speed-hero/beyond.png"
                alt="BEYOND"
                className="w-full h-full object-contain select-none drop-shadow-[0_12px_24px_rgba(0,0,0,0.3)] animate-float-text-mid"
                draggable={false}
              />
            </div>
          </div>

          {/* ========================================================= */}
          {/* LAYER 10: 3D TYPOGRAPHY — 'LIMITS'                        */}
          {/* Slow, elegant entrance from below (1.8s)                  */}
          {/* ========================================================= */}
          <div className="absolute inset-0 w-full h-full pointer-events-none z-[32]">
            <div className="w-full h-full speed-entrance-limits">
              <img
                src="/images/hero/speed-hero/limits.png"
                alt="LIMITS"
                className="w-full h-full object-contain select-none drop-shadow-[0_14px_28px_rgba(0,0,0,0.35)] animate-float-text-bot"
                draggable={false}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* KEYFRAME ANIMATIONS, TIMELINES & RESPONSIVE ALIGNMENT     */}
      {/* ========================================================= */}
      <style jsx>{`
        /* Shift feature icons left and up */
        .speed-left-shift {
          transform: translate(-10px, -20px);
        }
        @media (min-width: 640px) {
          .speed-left-shift {
            transform: translate(-35px, -30px);
          }
        }
        @media (min-width: 768px) {
          .speed-left-shift {
            transform: translate(-60px, -40px);
          }
        }
        @media (min-width: 1024px) {
          .speed-left-shift {
            transform: translate(clamp(-160px, -8.5vw, -80px), -48px);
          }
        }
        @media (min-width: 1280px) {
          .speed-left-shift {
            transform: translate(clamp(-210px, -10vw, -110px), -55px);
          }
        }
        @media (min-width: 1536px) {
          .speed-left-shift {
            transform: translate(clamp(-260px, -12vw, -140px), -65px);
          }
        }

        /* Shift SPEED logo and 3 pens right on larger screens */
        .speed-right-shift {
          transform: translateX(0px);
        }
        @media (min-width: 640px) {
          .speed-right-shift {
            transform: translateX(35px);
          }
        }
        @media (min-width: 768px) {
          .speed-right-shift {
            transform: translateX(55px);
          }
        }
        @media (min-width: 1024px) {
          .speed-right-shift {
            transform: translateX(clamp(80px, 8vw, 160px));
          }
        }
        @media (min-width: 1280px) {
          .speed-right-shift {
            transform: translateX(clamp(110px, 9.5vw, 210px));
          }
        }
        @media (min-width: 1536px) {
          .speed-right-shift {
            transform: translateX(clamp(140px, 11vw, 260px));
          }
        }

        /* Initial States when Idle (Only wording and 3 features are animated) */
        .speed-stage-idle .speed-entrance-write,
        .speed-stage-idle .speed-entrance-beyond,
        .speed-stage-idle .speed-entrance-limits,
        .speed-stage-idle .speed-entrance-icon-1,
        .speed-stage-idle .speed-entrance-icon-2,
        .speed-stage-idle .speed-entrance-icon-3 {
          opacity: 0;
        }

        /* Default Opacity When Active */
        .speed-stage-active .speed-entrance-write,
        .speed-stage-active .speed-entrance-beyond,
        .speed-stage-active .speed-entrance-limits,
        .speed-stage-active .speed-entrance-icon-1,
        .speed-stage-active .speed-entrance-icon-2,
        .speed-stage-active .speed-entrance-icon-3 {
          opacity: 1;
        }

        /* --------------------------------------------------------- */
        /* ENTRANCE TIMELINE SEQUENCE (Slow, Smooth & Elegant)       */
        /* --------------------------------------------------------- */

        /* 0.25s – WRITE Typography Entrance (Smooth, Fluid Glide Down, 1.0s) */
        @keyframes speedEntranceWrite {
          0% {
            opacity: 0;
            transform: translate3d(0, -28px, 0);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }
        .speed-stage-active .speed-entrance-write {
          animation: speedEntranceWrite 1.0s cubic-bezier(0.16, 1, 0.3, 1) 0.25s backwards;
          animation-fill-mode: forwards;
          will-change: transform, opacity;
        }

        /* 0.55s – BEYOND Typography Entrance (Smooth, Fluid Glide Up, 1.0s) */
        @keyframes speedEntranceBeyond {
          0% {
            opacity: 0;
            transform: translate3d(0, 22px, 0);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }
        .speed-stage-active .speed-entrance-beyond {
          animation: speedEntranceBeyond 1.0s cubic-bezier(0.16, 1, 0.3, 1) 0.55s backwards;
          animation-fill-mode: forwards;
          will-change: transform, opacity;
        }

        /* 0.85s – LIMITS Typography Entrance (Smooth, Fluid Glide Up, 1.0s) */
        @keyframes speedEntranceLimits {
          0% {
            opacity: 0;
            transform: translate3d(0, 26px, 0);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }
        .speed-stage-active .speed-entrance-limits {
          animation: speedEntranceLimits 1.0s cubic-bezier(0.16, 1, 0.3, 1) 0.85s backwards;
          animation-fill-mode: forwards;
          will-change: transform, opacity;
        }

        /* 1.15s – Feature Icons Sequential Reveal (Smooth Fluid Slide From Left, 0.9s) */
        @keyframes speedEntranceIcon {
          0% {
            opacity: 0;
            transform: translate3d(-20px, 0, 0);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }
        .speed-stage-active .speed-entrance-icon-1 {
          animation: speedEntranceIcon 0.9s cubic-bezier(0.16, 1, 0.3, 1) 1.15s backwards;
          animation-fill-mode: forwards;
          will-change: transform, opacity;
        }
        .speed-stage-active .speed-entrance-icon-2 {
          animation: speedEntranceIcon 0.9s cubic-bezier(0.16, 1, 0.3, 1) 1.40s backwards;
          animation-fill-mode: forwards;
          will-change: transform, opacity;
        }
        .speed-stage-active .speed-entrance-icon-3 {
          animation: speedEntranceIcon 0.9s cubic-bezier(0.16, 1, 0.3, 1) 1.65s backwards;
          animation-fill-mode: forwards;
          will-change: transform, opacity;
        }

        /* --------------------------------------------------------- */
        /* SUBTLE FLOATING MICRO-ANIMATIONS (Slow & Peaceful)        */
        /* --------------------------------------------------------- */
        @keyframes floatTextTop {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-3px);
          }
        }
        @keyframes floatTextMid {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-3px);
          }
        }
        @keyframes floatTextBot {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-3px);
          }
        }

        .animate-float-text-top {
          animation: floatTextTop 8s ease-in-out infinite 2.2s;
          will-change: transform;
        }
        .animate-float-text-mid {
          animation: floatTextMid 8.5s ease-in-out infinite 2.7s;
          will-change: transform;
        }
        .animate-float-text-bot {
          animation: floatTextBot 9s ease-in-out infinite 3.2s;
          will-change: transform;
        }

        /* --------------------------------------------------------- */
        /* ACCESSIBILITY: PREFERS-REDUCED-MOTION                     */
        /* --------------------------------------------------------- */
        @media (prefers-reduced-motion: reduce) {
          .speed-stage-active .speed-entrance-write,
          .speed-stage-active .speed-entrance-beyond,
          .speed-stage-active .speed-entrance-limits,
          .speed-stage-active .speed-entrance-icon-1,
          .speed-stage-active .speed-entrance-icon-2,
          .speed-stage-active .speed-entrance-icon-3,
          .animate-float-text-top,
          .animate-float-text-mid,
          .animate-float-text-bot {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
};
