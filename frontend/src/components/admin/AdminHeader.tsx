'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Menu, RotateCcw, Check, User, ShieldCheck, Database, ExternalLink } from 'lucide-react';
import { resetAllDemoData } from '@/services/resetDemoService';
import { useUserStore } from '@/services/userStore';

interface AdminHeaderProps {
  onOpenMobileNav?: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({ onOpenMobileNav }) => {
  const [resetSuccess, setResetSuccess] = useState(false);
  const adminEmail = useUserStore((state) => state.adminEmail);
  const currentUser = useUserStore((state) => state.currentUser);
  const roleSlug = useUserStore((state) => state.roleSlug);

  const handleReset = () => {
    resetAllDemoData();
    setResetSuccess(true);
    setTimeout(() => {
      setResetSuccess(false);
      window.location.reload();
    }, 800);
  };

  const displayName = currentUser?.name || 'Administrator';
  const displayEmail = currentUser?.email || adminEmail || 'admin@dslstationery.lk';
  const displayRole = currentUser?.roleName || (roleSlug === 'super_admin' ? 'Super Admin' : currentUser?.role || 'Admin');

  // Compute initials
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'AD';

  return (
    <header className="h-16 bg-white border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Menu Toggle */}
        <button
          onClick={onOpenMobileNav}
          className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
          title="Open admin navigation"
          aria-label="Open admin navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <span className="text-xs font-black text-slate-900 uppercase tracking-wider hidden sm:inline">
            Store Operations Console
          </span>
          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden xs:inline">PostgreSQL</span> Connected
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Quick link to public store */}
        <Link
          href="/"
          target="_blank"
          className="hidden md:inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#0066CC] transition"
        >
          <span>Storefront</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>

        <div className="h-4 w-px bg-slate-200 hidden md:block" />

        {/* Admin Profile Pill */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#0066CC] text-white flex items-center justify-center font-black text-xs shadow-xs ring-2 ring-sky-100">
            {initials}
          </div>
          <div className="text-left text-xs leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-800 max-w-[140px] sm:max-w-[180px] truncate">
                {displayName}
              </span>
              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-200">
                {displayRole}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 max-w-[160px] sm:max-w-[200px] truncate block">
              {displayEmail}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
