'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { User, Package, MapPin, Heart, Bookmark, Bell, LogOut } from 'lucide-react';
import { useUserStore } from '@/services/userStore';

export const AccountNav: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const logoutCustomer = useUserStore((state) => state.logoutCustomer);

  const links = [
    { href: '/account', label: 'Overview', icon: User },
    { href: '/account/orders', label: 'Order History', icon: Package },
    { href: '/account/addresses', label: 'Saved Addresses', icon: MapPin },
    { href: '/account/wishlist', label: 'Wishlist', icon: Heart },
    { href: '/account/saved-lists', label: 'Saved Stationery Lists', icon: Bookmark },
    { href: '/account/back-in-stock-alerts', label: 'Back-in-Stock Alerts', icon: Bell },
  ];

  const handleLogout = async () => {
    await logoutCustomer();
    router.push('/login');
  };

  return (
    <div>
      {/* Mobile Horizontal Tabs */}
      <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none mb-6">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold shrink-0 transition-all ${
                isActive
                  ? 'bg-[#0866E8] text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/70'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{link.label}</span>
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200/60 shrink-0 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Exit</span>
        </button>
      </div>

      {/* Desktop Vertical Menu */}
      <div className="hidden lg:block bg-white rounded-3xl border border-slate-100 p-4 space-y-1 shadow-xs">
        <div className="px-3.5 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          My Account
        </div>
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-[#0866E8] text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-[#0866E8]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{link.label}</span>
            </Link>
          );
        })}
        <div className="pt-2 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
