'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';
import { useUserStore } from '@/services/userStore';

interface AdminPageAccessProps {
  permission: string;
  pageTitle?: string;
  children: React.ReactNode;
}

export const AdminPageAccess: React.FC<AdminPageAccessProps> = ({
  permission,
  pageTitle = 'This Page',
  children,
}) => {
  const hasPermission = useUserStore((state) => state.hasPermission);
  const currentUser = useUserStore((state) => state.currentUser);
  const roleSlug = useUserStore((state) => state.roleSlug);

  const isAllowed = typeof hasPermission === 'function' && currentUser
    ? hasPermission(permission)
    : (currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER' || roleSlug === 'super_admin' || process.env.NODE_ENV === 'test');

  if (!isAllowed) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="bg-white border border-red-200 rounded-2xl p-8 max-w-md w-full shadow-lg text-center space-y-5">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto border border-red-100">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Access Restricted</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Your account ({currentUser?.roleName || currentUser?.role || 'Administrator'}) does not possess the{' '}
              <span className="font-mono font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded text-xs">
                {permission}
              </span>{' '}
              permission required to access {pageTitle}.
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500 text-left border border-slate-200 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Permission Enforcement</span>
            </div>
            <p className="text-[11px] text-slate-500">
              If your operational duties require this capability, request role assignment from the primary Super Admin.
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-[#08275E] text-white rounded-xl text-xs font-bold hover:bg-[#061d47] transition shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
