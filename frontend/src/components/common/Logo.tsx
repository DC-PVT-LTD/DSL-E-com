'use client';

import React from 'react';
import Link from 'next/link';

interface LogoProps {
  className?: string;
  href?: string;
  variant?: 'light' | 'dark';
  showSubtitle?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  href = '/home',
  variant = 'light',
  showSubtitle = true,
}) => {
  const isDark = variant === 'dark';

  return (
    <Link
      href={href}
      className={`inline-flex items-center group select-none ${className}`}
      title="DSL Enterprises (Pvt) Ltd - Stationery Distributors"
    >
      <div className="flex flex-col items-start justify-center">
        <img
          src="/images/dsl-logo-header.png"
          alt="DSL Enterprises (Pvt) Ltd"
          className="h-10 sm:h-12 md:h-13 lg:h-14 w-auto object-contain transition-transform duration-200 group-hover:scale-[1.02]"
        />
        {showSubtitle && (
          <span
            className={`text-[8.5px] sm:text-[9.5px] md:text-[10px] font-black uppercase tracking-[0.26em] pl-12 sm:pl-14 md:pl-16 -mt-0.5 hidden sm:block ${
              isDark ? 'text-sky-200/90' : 'text-[#102A5E]/85'
            }`}
          >
            Stationery Distributors
          </span>
        )}
      </div>
    </Link>
  );
};
