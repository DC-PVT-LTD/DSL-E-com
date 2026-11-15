'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, Phone, MapPin, ArrowRight, ChevronDown } from 'lucide-react';

export const Footer: React.FC = () => {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    catalogue: true,
    services: false,
    help: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <footer className="relative w-full overflow-hidden select-none mt-auto">
      {/* ========================================================================= */}
      {/* 1. ATMOSPHERIC ABSTRACT BLUE & GOLDEN WATERCOLOR BACKGROUND               */}
      {/* Visible through the translucent glassmorphism footer panel                */}
      {/* ========================================================================= */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none bg-gradient-to-b from-[#EFF6FF] via-[#E2EEFE] to-[#CEE3FC]">
        {/* Soft Blue Watercolor Cloud Texture */}
        <div className="absolute inset-0 opacity-80 mix-blend-multiply">
          <img
            src="/images/footer-watercolor.png"
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover object-top opacity-75"
          />
        </div>

        {/* Floating Silk Cloud Waves Texture */}
        <div className="absolute inset-0 opacity-40 mix-blend-screen">
          <img
            src="/images/footer-silk-waves.png"
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover object-center"
          />
        </div>

        {/* Delicate Warm Golden/Yellow Sunlight Glow Highlights */}
        <div className="absolute -top-14 left-1/2 -translate-x-1/2 w-[650px] h-80 rounded-full bg-amber-300/30 blur-3xl pointer-events-none" />
        <div className="absolute top-8 right-8 w-96 h-96 rounded-full bg-sky-300/35 blur-3xl pointer-events-none" />
        <div className="absolute top-8 left-8 w-96 h-96 rounded-full bg-sky-300/35 blur-3xl pointer-events-none" />
        <div className="absolute bottom-16 right-1/4 w-72 h-72 rounded-full bg-amber-200/25 blur-2xl pointer-events-none" />
      </div>

      {/* ========================================================================= */}
      {/* 2. MAIN FLOATING TRANSLUCENT GLASSMORPHISM CONTAINER                      */}
      {/* Matches media_1794282757237_4de38530.jpg layout                           */}
      {/* ========================================================================= */}
      <div className="relative z-10 w-full max-w-[1400px] mx-auto px-3.5 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-6 sm:pb-8">
        <div className="relative w-full rounded-[24px] sm:rounded-[32px] lg:rounded-[36px] bg-white/45 backdrop-blur-2xl border border-white/85 shadow-[0_20px_50px_rgba(9,44,104,0.10),inset_0_1px_2px_rgba(255,255,255,0.95)] p-5 sm:p-8 lg:p-10 overflow-hidden transition-all duration-300">
          
          {/* Top Specular Glass Reflection Edge */}
          <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/95 to-transparent pointer-events-none" />

          {/* 4 Clean Columns on Desktop with Translucent Hairline Dividers */}
          <div className="flex flex-col md:grid md:grid-cols-2 lg:flex lg:flex-row items-stretch justify-between gap-6 md:gap-8 lg:gap-0">
            
            {/* ------------------------------------------------------------- */}
            {/* COLUMN 1: Company Identity & Socials (lg: 32% width)          */}
            {/* ------------------------------------------------------------- */}
            <div className="w-full lg:w-[32%] lg:pr-8 flex flex-col justify-between">
              <div>
                {/* Official DSL Logo from Header */}
                <Link href="/home" className="inline-block group mb-3.5" title="DSL Enterprises (Pvt) Ltd">
                  <img
                    src="/images/dsl-logo-header.png"
                    alt="DSL Enterprises (Pvt) Ltd"
                    className="h-9 sm:h-10 md:h-11 w-auto object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                  />
                </Link>

                {/* Company Description */}
                <p className="text-xs sm:text-[12.5px] text-[#092C68]/85 leading-relaxed font-normal max-w-sm mb-4">
                  <strong className="text-[#092C68] font-bold">DSL Enterprises (Pvt) Ltd.</strong> established in 2009 in Moratuwa, is a premier national distributor of educational stationery, exercise books, art materials, and office essentials across Sri Lanka.
                </p>

                {/* Social Media Glass Buttons */}
                <div className="flex items-center gap-2 mb-4">
                  {/* Facebook */}
                  <a
                    href="https://facebook.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Facebook"
                    className="w-9 h-9 rounded-xl bg-white/70 hover:bg-white text-[#092C68] hover:text-[#0866F5] border border-white/85 shadow-xs hover:shadow-md backdrop-blur-md flex items-center justify-center transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </a>

                  {/* Instagram */}
                  <a
                    href="https://instagram.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Instagram"
                    className="w-9 h-9 rounded-xl bg-white/70 hover:bg-white text-[#092C68] hover:text-[#0866F5] border border-white/85 shadow-xs hover:shadow-md backdrop-blur-md flex items-center justify-center transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                    </svg>
                  </a>

                  {/* LinkedIn */}
                  <a
                    href="https://linkedin.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="LinkedIn"
                    className="w-9 h-9 rounded-xl bg-white/70 hover:bg-white text-[#092C68] hover:text-[#0866F5] border border-white/85 shadow-xs hover:shadow-md backdrop-blur-md flex items-center justify-center transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                    </svg>
                  </a>

                  {/* YouTube */}
                  <a
                    href="https://youtube.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="YouTube"
                    className="w-9 h-9 rounded-xl bg-white/70 hover:bg-white text-[#092C68] hover:text-[#0866F5] border border-white/85 shadow-xs hover:shadow-md backdrop-blur-md flex items-center justify-center transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                  </a>
                </div>

                {/* Preserved Micro Contact Information */}
                <div className="space-y-1.5 text-xs text-[#092C68]/80 pt-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-[#0866F5] shrink-0" />
                    <span className="font-medium text-[11.5px]">DSL Enterprises (Pvt) Ltd, Moratuwa, Sri Lanka</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-0.5">
                    <a
                      href="tel:+94112009000"
                      className="inline-flex items-center gap-1.5 text-[#092C68] hover:text-[#0866F5] font-bold text-[11.5px] transition-colors"
                    >
                      <Phone className="w-3 h-3 text-[#0866F5]" />
                      <span>+94 11 200 9000</span>
                    </a>
                    <span className="text-slate-300">•</span>
                    <a
                      href="mailto:info@dsl.lk"
                      className="inline-flex items-center gap-1.5 text-[#092C68] hover:text-[#0866F5] font-bold text-[11.5px] transition-colors"
                    >
                      <Mail className="w-3 h-3 text-[#0866F5]" />
                      <span>info@dsl.lk</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Vertical Hairline Divider 1 */}
            <div className="hidden lg:block w-[1px] bg-slate-300/40 self-stretch my-2 shrink-0" aria-hidden="true" />

            {/* ------------------------------------------------------------- */}
            {/* COLUMN 2: Product Catalogue (lg: 22% width)                   */}
            {/* ------------------------------------------------------------- */}
            <div className="w-full lg:w-[22%] lg:px-6">
              <button
                type="button"
                onClick={() => toggleSection('catalogue')}
                className="w-full flex items-center justify-between text-left lg:pointer-events-none py-1 lg:py-0 mb-3"
              >
                <h5 className="text-sm font-bold text-[#092C68] flex items-center gap-2 tracking-tight">
                  <span className="w-2 h-2 rounded-full bg-[#EAB308] shadow-[0_0_6px_rgba(234,179,8,0.7)] shrink-0" />
                  <span>Product Catalogue</span>
                </h5>
                <ChevronDown
                  className={`w-4 h-4 text-[#092C68] transition-transform duration-200 lg:hidden ${
                    openSections.catalogue ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <ul
                className={`space-y-2 text-xs text-[#092C68]/85 transition-all ${
                  openSections.catalogue ? 'block' : 'hidden lg:block'
                }`}
              >
                <li>
                  <Link href="/shop" className="hover:text-[#0866F5] transition-colors inline-block py-0.5 font-medium">
                    All Products
                  </Link>
                </li>
                <li>
                  <Link href="/categories/exercise-books" className="hover:text-[#0866F5] transition-colors inline-block py-0.5 font-medium">
                    CR Books &amp; Paper
                  </Link>
                </li>
                <li>
                  <Link href="/categories/pens-and-writing" className="hover:text-[#0866F5] transition-colors inline-block py-0.5 font-medium">
                    Pens &amp; Writing
                  </Link>
                </li>
                <li>
                  <Link href="/categories/art-and-drawing" className="hover:text-[#0866F5] transition-colors inline-block py-0.5 font-medium">
                    Art &amp; Craft Supplies
                  </Link>
                </li>
                <li>
                  <Link href="/school-packs" className="hover:text-[#0866F5] transition-colors inline-block py-0.5 font-medium">
                    School Stationery Packs
                  </Link>
                </li>
                <li>
                  <Link href="/brands" className="hover:text-[#0866F5] transition-colors inline-block py-0.5 font-medium">
                    Authorised Brands
                  </Link>
                </li>
              </ul>
            </div>

            {/* Vertical Hairline Divider 2 */}
            <div className="hidden lg:block w-[1px] bg-slate-300/40 self-stretch my-2 shrink-0" aria-hidden="true" />

            {/* ------------------------------------------------------------- */}
            {/* COLUMN 3: Services (lg: 21% width)                            */}
            {/* ------------------------------------------------------------- */}
            <div className="w-full lg:w-[21%] lg:px-6">
              <button
                type="button"
                onClick={() => toggleSection('services')}
                className="w-full flex items-center justify-between text-left lg:pointer-events-none py-1 lg:py-0 mb-3"
              >
                <h5 className="text-sm font-bold text-[#092C68] flex items-center gap-2 tracking-tight">
                  <span className="w-2 h-2 rounded-full bg-[#EAB308] shadow-[0_0_6px_rgba(234,179,8,0.7)] shrink-0" />
                  <span>Services</span>
                </h5>
                <ChevronDown
                  className={`w-4 h-4 text-[#092C68] transition-transform duration-200 lg:hidden ${
                    openSections.services ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <ul
                className={`space-y-2 text-xs text-[#092C68]/85 transition-all ${
                  openSections.services ? 'block' : 'hidden lg:block'
                }`}
              >
                <li>
                  <Link href="/find-my-stationery" className="hover:text-[#0866F5] transition-colors inline-block py-0.5 font-medium">
                    Find My Stationery
                  </Link>
                </li>
                <li>
                  <Link href="/bulk-order" className="hover:text-[#0866F5] transition-colors inline-block py-0.5 font-medium">
                    Bulk School Orders
                  </Link>
                </li>
                <li>
                  <Link href="/account/wishlist" className="hover:text-[#0866F5] transition-colors inline-block py-0.5 font-medium">
                    My Wishlist
                  </Link>
                </li>
                <li>
                  <Link href="/cart" className="hover:text-[#0866F5] transition-colors inline-block py-0.5 font-medium">
                    Shopping Cart
                  </Link>
                </li>
                <li className="pt-2">
                  {/* Distinctive Admin Portal Button with Subtle Yellow Glow & Accent */}
                  <Link
                    href="/admin/dashboard"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0866F5] hover:bg-[#005cd9] text-white font-bold text-xs shadow-[0_4px_14px_rgba(8,102,245,0.35),0_0_12px_rgba(245,158,11,0.45)] hover:shadow-lg transition-all duration-200 border-b-2 border-amber-400 group"
                  >
                    <span>Admin Portal</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                </li>
              </ul>
            </div>

            {/* Vertical Hairline Divider 3 */}
            <div className="hidden lg:block w-[1px] bg-slate-300/40 self-stretch my-2 shrink-0" aria-hidden="true" />

            {/* ------------------------------------------------------------- */}
            {/* COLUMN 4: Help & Policies (lg: 25% width)                     */}
            {/* ------------------------------------------------------------- */}
            <div className="w-full lg:w-[25%] lg:pl-6">
              <button
                type="button"
                onClick={() => toggleSection('help')}
                className="w-full flex items-center justify-between text-left lg:pointer-events-none py-1 lg:py-0 mb-3"
              >
                <h5 className="text-sm font-bold text-[#092C68] flex items-center gap-2 tracking-tight">
                  <span className="w-2 h-2 rounded-full bg-[#EAB308] shadow-[0_0_6px_rgba(234,179,8,0.7)] shrink-0" />
                  <span>Help &amp; Policies</span>
                </h5>
                <ChevronDown
                  className={`w-4 h-4 text-[#092C68] transition-transform duration-200 lg:hidden ${
                    openSections.help ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <ul
                className={`space-y-2 text-xs text-[#092C68]/85 transition-all ${
                  openSections.help ? 'block' : 'hidden lg:block'
                }`}
              >
                <li>
                  <Link href="/about" className="hover:text-[#0866F5] transition-colors inline-block py-0.5 font-medium">
                    About DSL Enterprises
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-[#0866F5] transition-colors inline-block py-0.5 font-medium">
                    Contact Distribution Team
                  </Link>
                </li>
                <li>
                  <Link href="/faq" className="hover:text-[#0866F5] transition-colors inline-block py-0.5 font-medium">
                    FAQ &amp; Help Center
                  </Link>
                </li>
                <li>
                  <Link href="/delivery" className="hover:text-[#0866F5] transition-colors inline-block py-0.5 font-medium">
                    Delivery Information
                  </Link>
                </li>
                <li>
                  <Link href="/returns" className="hover:text-[#0866F5] transition-colors inline-block py-0.5 font-medium">
                    Returns &amp; Replacement
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-[#0866F5] transition-colors inline-block py-0.5 font-medium">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-[#0866F5] transition-colors inline-block py-0.5 font-medium">
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>

          </div>

          {/* ------------------------------------------------------------- */}
          {/* BOTTOM ROW: Copyright & Currency Selector                     */}
          {/* ------------------------------------------------------------- */}
          <div className="pt-6 mt-8 border-t border-slate-300/40 flex flex-col sm:flex-row items-center justify-between text-xs text-[#092C68]/75 gap-3.5">
            <p className="font-normal text-center sm:text-left">
              &copy; {new Date().getFullYear()} DSL Enterprises (Pvt) Ltd. All rights reserved.
            </p>

            {/* Currency Pill with Warm-Yellow Indicator */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/75 hover:bg-white text-xs font-semibold text-[#092C68] border border-white/90 shadow-2xs backdrop-blur-md transition-all">
              <span className="w-2 h-2 rounded-full bg-[#EAB308] shadow-[0_0_5px_#EAB308]" />
              <span>Currency: Sri Lankan Rupees (LKR)</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#092C68]/60" />
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. LAYERED FLOWING DECORATIVE WAVES AT THE VERY BOTTOM                    */}
      {/* Featuring Gold, Royal Blue and Navy Ribbon Swirls matching reference      */}
      {/* ========================================================================= */}
      <div className="relative w-full h-14 sm:h-20 md:h-24 lg:h-28 overflow-hidden pointer-events-none mt-2">
        <svg
          viewBox="0 0 1440 140"
          fill="none"
          className="w-full h-full"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {/* 1. Sleek Golden-Yellow Accent Ribbon Swirl (peaks left & right) */}
          <path
            d="M-20 65 C180 20, 360 95, 680 75 C980 55, 1220 15, 1460 30 L1460 140 L-20 140 Z"
            fill="url(#footerGoldGrad)"
            opacity="0.95"
          />

          {/* 2. Vibrant Royal-Blue Flowing Ribbon */}
          <path
            d="M-20 75 C200 45, 520 110, 840 65 C1120 25, 1320 60, 1460 45 L1460 140 L-20 140 Z"
            fill="url(#footerRoyalGrad)"
          />

          {/* 3. Deep Navy-Blue Foundation Ribbon */}
          <path
            d="M-20 90 C240 65, 580 120, 920 80 C1180 50, 1340 75, 1460 70 L1460 140 L-20 140 Z"
            fill="#092C68"
          />

          {/* Color Gradients */}
          <defs>
            <linearGradient id="footerGoldGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="35%" stopColor="#FBBF24" />
              <stop offset="70%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>

            <linearGradient id="footerRoyalGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#0866F5" />
              <stop offset="50%" stopColor="#168BFF" />
              <stop offset="100%" stopColor="#0550C6" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </footer>
  );
};
