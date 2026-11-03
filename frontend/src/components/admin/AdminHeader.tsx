'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { RotateCcw, Check, User } from 'lucide-react';
import { resetAllDemoData } from '@/services/resetDemoService';
import { useUserStore } from '@/services/userStore';

export const AdminHeader: React.FC = () => {
  const [resetSuccess, setResetSuccess] = useState(false);
  const adminEmail = useUserStore((state) => state.adminEmail);

  const handleReset = () => {
    resetAllDemoData();
    setResetSuccess(true);
    setTimeout(() => {
      setResetSuccess(false);
      window.location.reload();
    }, 800);
  };

  return (
    <header className="h-16 bg-white border-b border-stone-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-[#292525] uppercase tracking-wider">
          Store Operations Console
        </span>
        <span className="text-[10px] font-bold bg-[#FFF9D2] text-[#594300] border border-[#FFD84D] px-2.5 py-0.5 rounded-full">
          Demo Synchronized
        </span>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleReset}
          disabled={resetSuccess}
          className="text-xs font-bold text-[#292525]/70 hover:text-[#0066CC] bg-stone-100 hover:bg-[#FFFDF0] px-3.5 py-1.5 rounded-full border border-stone-200 flex items-center gap-1.5 transition-colors"
          title="Reset all mock data"
        >
          {resetSuccess ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-700">Data Reset!</span>
            </>
          ) : (
            <>
              <RotateCcw className="w-3.5 h-3.5 text-[#0066CC]" />
              <span>Reset Demo Data</span>
            </>
          )}
        </button>

        <div className="h-4 w-px bg-stone-200" />

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#0066CC] text-white flex items-center justify-center font-bold text-xs shadow-xs">
            AD
          </div>
          <div className="hidden sm:block text-left text-xs">
            <span className="font-bold text-[#292525] block leading-tight">Admin Demo</span>
            <span className="text-[11px] text-[#292525]/50">{adminEmail || 'admin@dslstationery.lk'}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
