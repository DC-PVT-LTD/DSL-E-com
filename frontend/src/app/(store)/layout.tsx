'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { DemoBanner } from '@/components/common/DemoBanner';
import { Navbar } from '@/components/common/Navbar';
import { Footer } from '@/components/common/Footer';
import { CartDrawer } from '@/components/common/CartDrawer';
import { MobileBottomNav } from '@/components/common/MobileBottomNav';

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Only isolated welcome splash screen hides common store chrome
  const isSplashPage = pathname === '/welcome';

  return (
    <div className="min-h-screen flex flex-col text-[#09285C] bg-white antialiased selection:bg-[#EAF4FF] selection:text-[#0866E8]">
      {!isSplashPage && <Navbar />}
      {!isSplashPage && <DemoBanner />}
      <CartDrawer />
      <main className="flex-1 pb-16 lg:pb-0">
        {children}
      </main>
      {!isSplashPage && <Footer />}
      {!isSplashPage && <MobileBottomNav />}
    </div>
  );
}
