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
  // Standalone landing cover (/ and /welcome) hides common store chrome
  const isCoverPage = pathname === '/' || pathname === '/welcome';
  // Home page uses the native hero banner with integrated white-wave header
  const isHomePage = pathname === '/home';
  // About page uses its dedicated editorial layout
  const isAboutPage = pathname === '/about';

  // Apply cute pastel background to all store pages EXCEPT welcome, home, and about
  const isCuteBgPage = !isCoverPage && !isHomePage && !isAboutPage;

  return (
    <div
      className={`min-h-screen flex flex-col text-[#10285D] ${
        isCuteBgPage ? 'cute-store-bg' : 'bg-[#FFF8ED]'
      }`}
    >
      {!isCoverPage && !isHomePage && <DemoBanner />}
      {!isCoverPage && <Navbar />}
      <CartDrawer />
      <main className="flex-1">
        {children}
      </main>
      {!isCoverPage && <Footer />}
    </div>
  );
}
