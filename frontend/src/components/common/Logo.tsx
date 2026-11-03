import React from 'react';
import Link from 'next/link';

interface LogoProps {
  variant?: 'light' | 'dark';
  className?: string;
  showSubtitle?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ variant = 'dark', className = '', showSubtitle = true }) => {
  const isLight = variant === 'light';

  return (
    <Link href="/home" className={`inline-flex items-center gap-2.5 group ${className}`}>
      {/* Official DSL Enterprises Logo Badge */}
      <div className={`p-1 rounded-xl transition-transform group-hover:scale-105 ${isLight ? 'bg-white/90' : 'bg-white shadow-xs border border-[#C6E7FF]'}`}>
        <img
          src="/dsl-logo.png"
          alt="DSL Enterprises (Pvt) Ltd"
          className="h-7 sm:h-8 w-auto object-contain"
        />
      </div>

      {/* Playful Whimsical Script Brand Wordmark */}
      <div className="flex flex-col">
        <span className={`font-heylowitch text-2xl sm:text-3xl leading-none tracking-wide transition-colors ${
          isLight ? 'text-white' : 'text-[#292525] group-hover:text-[#0066CC]'
        }`}>
          DSL Stationery
        </span>
        {showSubtitle && (
          <span className={`text-[9px] uppercase tracking-widest font-semibold ${
            isLight ? 'text-white/80' : 'text-[#0066CC]'
          }`}>
            Everyday Essentials
          </span>
        )}
      </div>
    </Link>
  );
};

