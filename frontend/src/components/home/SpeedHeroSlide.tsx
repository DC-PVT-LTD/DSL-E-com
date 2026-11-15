'use client';

import React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export const SpeedHeroSlide: React.FC = () => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="w-full max-w-[1720px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16">
        <div className="relative rounded-3xl bg-gradient-to-r from-[#07214A] via-[#092D6B] to-[#0866E8] text-white p-6 sm:p-8 lg:p-12 overflow-hidden shadow-xl border border-blue-900/50">
          <div className="absolute -right-24 -top-24 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-yellow-400/10 rounded-full blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            <div className="lg:col-span-4 flex flex-col items-center lg:items-start text-center lg:text-left gap-4">
              <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20">
                <img
                  src="/images/brands/speed.svg"
                  alt="Speed Brand Logo"
                  className="h-7 sm:h-8 w-auto object-contain brightness-0 invert"
                />
                <span className="text-[11px] font-black uppercase tracking-wider text-[#FFD84D]">
                  Authorised Brand
                </span>
              </div>

              <motion.div
                className="speed-pen-showcase relative w-full max-w-[280px] sm:max-w-[320px] aspect-[4/3] rounded-2xl bg-white/5 border border-white/10 p-4 flex items-center justify-center overflow-hidden group/img shadow-inner"
                initial={prefersReducedMotion ? false : { opacity: 0, y: 8, scale: 0.985 }}
                whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
              >
                <motion.img
                  src="https://www.dsl.lk/media/img/1747715974.jpg"
                  alt="SPEED RIM Ball Pen Series"
                  className="speed-pen-image w-full h-full object-contain drop-shadow-2xl transition-transform duration-500 group-hover/img:scale-105"
                  animate={prefersReducedMotion ? undefined : { y: [0, -2, 0] }}
                  transition={prefersReducedMotion ? undefined : { y: { duration: 4.8, ease: 'easeInOut', repeat: Infinity } }}
                />
                <span className="speed-pen-sheen" aria-hidden="true" />
                <div className="absolute z-[2] bottom-2 left-2 right-2 bg-black/40 backdrop-blur-md text-[10px] sm:text-xs text-white/90 text-center py-1 rounded-lg font-bold">
                  SPEED RIM Ball Pen • 0.7mm Swiss Tip
                </div>
              </motion.div>
            </div>

            <div className="lg:col-span-5 space-y-4 text-center lg:text-left">
              <span className="speed-hero-yellow-glow inline-block bg-[#FFD84D] text-[#594300] text-[10px] sm:text-[11px] font-black px-3.5 py-1 rounded-full uppercase tracking-wider shadow-xs">
                ⭐ Sri Lanka&apos;s Favourite Everyday Pen
              </span>
              <motion.h2
                className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.7 }}
                variants={{ visible: { transition: { staggerChildren: prefersReducedMotion ? 0 : 0.16 } } }}
              >
                <motion.span
                  className="inline-block"
                  variants={{
                    hidden: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -12 },
                    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 85, damping: 20, mass: 0.9 } },
                  }}
                >
                  Write With Speed.
                </motion.span>
                <br className="hidden sm:inline" />
                <span className="text-[#FFD84D] speed-hero-yellow-glow">
                  <motion.span
                    className="inline-block"
                    variants={{
                      hidden: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: -14 },
                      visible: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 90, damping: 22, mass: 0.9 } },
                    }}
                  >
                    Flow Without
                  </motion.span>{' '}
                  <motion.span
                    className="inline-block"
                    variants={{
                      hidden: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 },
                      visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 85, damping: 20, mass: 0.9 } },
                    }}
                  >
                    Limits.
                  </motion.span>
                </span>
              </motion.h2>
              <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed max-w-xl">
                Experience ultra-smooth, smudge-free precision with Speed RIM ballpoint pens, fast-acting correction fluid, and durable office stationery. Engineered for students, teachers, and professionals across Sri Lanka.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
                <div className="bg-white/10 rounded-xl p-2.5 text-center border border-white/10">
                  <span className="speed-hero-yellow-glow block text-[#FFD84D] font-black text-xs sm:text-sm">0.7mm</span>
                  <span className="text-[10px] sm:text-[11px] text-blue-100 font-medium">Swiss Smooth Tip</span>
                </div>
                <div className="bg-white/10 rounded-xl p-2.5 text-center border border-white/10">
                  <span className="speed-hero-yellow-glow block text-[#FFD84D] font-black text-xs sm:text-sm">Quick-Dry</span>
                  <span className="text-[10px] sm:text-[11px] text-blue-100 font-medium">Non-Smudge Ink</span>
                </div>
                <div className="col-span-2 sm:col-span-1 bg-white/10 rounded-xl p-2.5 text-center border border-white/10">
                  <span className="speed-hero-yellow-glow block text-[#FFD84D] font-black text-xs sm:text-sm">Wholesale</span>
                  <span className="text-[10px] sm:text-[11px] text-blue-100 font-medium">50-Pack Boxes</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-3 flex flex-col sm:flex-row lg:flex-col justify-center items-center lg:items-end gap-3 pt-2 lg:pt-0">
              <Link
                href="/brands/speed"
                className="w-full sm:w-auto lg:w-full bg-[#FFD84D] hover:bg-yellow-300 text-[#09285C] font-black text-xs sm:text-sm px-6 py-3.5 rounded-full shadow-lg transition-all hover:scale-105 flex items-center justify-center gap-2 group cursor-pointer text-center"
              >
                <span>Shop Speed Products</span>
                <ArrowRight className="w-4 h-4 text-[#09285C] group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/bulk-order"
                className="w-full sm:w-auto lg:w-full bg-white/15 hover:bg-white/25 text-white font-bold text-xs sm:text-sm px-5 py-3 rounded-full border border-white/20 transition-all flex items-center justify-center gap-2 group cursor-pointer text-center"
              >
                <span>Bulk School Orders</span>
              </Link>
            </div>
          </div>
        </div>
    </section>
  );
};
