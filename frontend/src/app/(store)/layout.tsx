'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { DemoBanner } from '@/components/common/DemoBanner';
import { Navbar } from '@/components/common/Navbar';
import { Footer } from '@/components/common/Footer';
import { CartDrawer } from '@/components/common/CartDrawer';

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Only standalone landing cover (/welcome) hides common store chrome
  const isCoverPage = pathname === '/welcome';

  return (
    <div className="min-h-screen flex flex-col bg-[#FFF8ED] text-[#10285D]">
      {!isCoverPage && <DemoBanner />}
      {!isCoverPage && <Navbar />}
      <CartDrawer />
      <main className="flex-1">
        {children}
      </main>
      {!isCoverPage && <Footer />}
    </div>
  );
}
