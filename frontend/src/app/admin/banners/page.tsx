'use client';

import React, { useState } from 'react';
import { Image, Eye, EyeOff, Plus } from 'lucide-react';
import { INITIAL_BANNERS } from '@/mocks/promotions';
import { StoreBanner } from '@/types/admin';

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<StoreBanner[]>(INITIAL_BANNERS);

  const handleToggle = (id: string) => {
    setBanners((prev) =>
      prev.map((b) => (b.id === id ? { ...b, isActive: !b.isActive } : b))
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Store Banners &amp; Marketing Sliders
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Control promotional callouts and school pack campaign banners displayed on the customer homepage
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {banners.map((banner) => (
          <div
            key={banner.id}
            className="rounded-3xl p-6 border shadow-xs flex flex-col justify-between space-y-4"
            style={{ backgroundColor: banner.backgroundColor, color: banner.textColor }}
          >
            <div className="space-y-2">
              {banner.badgeText && (
                <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full inline-block">
                  {banner.badgeText}
                </span>
              )}
              <h2 className="text-lg font-bold">{banner.title}</h2>
              <p className="text-xs opacity-90 leading-relaxed">{banner.subtitle}</p>
            </div>

            <div className="pt-4 border-t border-white/20 flex items-center justify-between">
              <span className="text-xs font-bold underline">{banner.ctaText} →</span>
              <button
                onClick={() => handleToggle(banner.id)}
                className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
              >
                {banner.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span>{banner.isActive ? 'Active on Store' : 'Inactive'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
