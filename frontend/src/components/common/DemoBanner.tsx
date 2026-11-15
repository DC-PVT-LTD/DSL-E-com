'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { announcementService, AnnouncementAd, DEFAULT_ANNOUNCEMENTS } from '@/services/announcementService';

export const DemoBanner: React.FC = () => {
  const [items, setItems] = useState<AnnouncementAd[]>(DEFAULT_ANNOUNCEMENTS);

  useEffect(() => {
    // Initial sync load
    const active = announcementService.getActive();
    if (active.length > 0) {
      setItems(active);
    }

    // Subscribe to admin additions and updates
    const unsubscribe = announcementService.subscribe(() => {
      const updated = announcementService.getActive();
      setItems(updated.length > 0 ? updated : DEFAULT_ANNOUNCEMENTS);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <aside
      aria-label="Store Announcements"
      className="bg-[#0866F5] text-white text-xs font-black h-[38px] flex items-center overflow-hidden select-none relative z-40 border-b border-blue-600/40 shadow-xs group"
    >
      {/* Edge gradient masks for smooth fade */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-r from-[#0866F5] to-transparent z-10" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-l from-[#0866F5] to-transparent z-10" />

      {/* Continuous Marquee Scrolling to the RIGHT */}
      <div className="animate-marquee-right flex items-center whitespace-nowrap">
        {[...items, ...items].map((ad, idx) => (
          <div key={`announcement-${ad.id}-${idx}`} className="flex items-center gap-3 px-6 shrink-0">
            {ad.link ? (
              <Link
                href={ad.link}
                className="tracking-wide uppercase text-[11px] sm:text-xs font-black hover:text-[#FFD84D] transition-colors cursor-pointer"
              >
                {ad.text}
              </Link>
            ) : (
              <span className="tracking-wide uppercase text-[11px] sm:text-xs font-black">
                {ad.text}
              </span>
            )}
            <span className="text-[#FFD84D] text-xs select-none">•</span>
          </div>
        ))}
      </div>
    </aside>
  );
};
