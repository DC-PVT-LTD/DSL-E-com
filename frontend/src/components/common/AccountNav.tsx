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
    <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-4 space-y-1 shadow-sm">
      <div className="px-3.5 py-2 text-[11px] font-bold text-[#292525]/50 uppercase tracking-wider">
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
                ? 'bg-[#0066CC] text-white shadow-xs'
                : 'text-[#292525]/80 hover:bg-[#FFFDF0] hover:text-[#0066CC]'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{link.label}</span>
          </Link>
        );
      })}
      <div className="pt-2 border-t border-[#C6E7FF]/30">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};
