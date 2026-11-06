'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { useUserStore } from '@/services/userStore';
import { Loader2 } from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdminLoggedIn = useUserStore((state) => state.isAdminLoggedIn);
  const fetchCurrentUser = useUserStore((state) => state.fetchCurrentUser);
  const [isChecking, setIsChecking] = useState(true);

  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    let mounted = true;
    const verify = async () => {
      if (isLoginPage) {
        setIsChecking(false);
        return;
      }
      try {
        await fetchCurrentUser();
      } catch {
        // silent
      } finally {
        if (mounted) {
          setIsChecking(false);
        }
      }
    };
    verify();
    return () => {
      mounted = false;
    };
  }, [isLoginPage, fetchCurrentUser]);

  useEffect(() => {
    if (!isChecking && !isLoginPage && !isAdminLoggedIn) {
      const returnUrl = pathname && pathname !== '/admin/login' ? `?returnUrl=${encodeURIComponent(pathname)}` : '';
      router.push(`/admin/login${returnUrl}`);
    }
  }, [isChecking, isLoginPage, isAdminLoggedIn, router, pathname]);

  if (isLoginPage) {
    return <div className="min-h-screen bg-slate-100">{children}</div>;
  }

  if (isChecking || !isAdminLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100">
        <Loader2 className="w-8 h-8 animate-spin text-[#08275E]" />
        <p className="mt-3 text-xs text-slate-500 font-medium">Verifying administrator session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-100 text-slate-900">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader />
        <main className="flex-1 p-6 sm:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
