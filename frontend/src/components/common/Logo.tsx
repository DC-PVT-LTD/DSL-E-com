'use client';

import React from 'react';
import Link from 'next/link';

interface LogoProps {
  className?: string;
  href?: string;
  variant?: 'light' | 'dark';
  showSubtitle?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className = '', href = '/' }) => {
  return (
    <Link
      href={href}
      className={`inline-flex items-baseline gap-1.5 group select-none ${className}`}
      title="DSL Stationery"
    >
      <span className="relative inline-block">
        <span className="font-extrabold text-2xl sm:text-[28px] tracking-tight text-[#10285D] lowercase leading-none">
          dsl
        </span>
        {/* Soft yellow curved arc / smile stroke under 'dsl' */}
        <svg
          className="absolute -bottom-1.5 left-0 w-full h-2 overflow-visible pointer-events-none"
          viewBox="0 0 38 8"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M 2 2.5 Q 19 8 36 2.5"
            stroke="#FFD84D"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="font-normal text-xl sm:text-[23px] text-[#10285D] tracking-tight leading-none">
        Stationery
      </span>
    </Link>
  );
};
