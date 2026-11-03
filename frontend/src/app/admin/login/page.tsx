'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, ArrowRight, Store } from 'lucide-react';
import { useUserStore } from '@/services/userStore';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@dslstationery.lk');
  const [password, setPassword] = useState('admin1234');
  const loginAdmin = useUserStore((state) => state.loginAdmin);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginAdmin(email);
    router.push('/admin/dashboard');
  };

  return (
    <div className="max-w-md mx-auto py-16 sm:py-24">
      <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xs space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#08275E] text-[#FFD21C] flex items-center justify-center mx-auto shadow-md">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Admin Portal Sign In</h1>
          <p className="text-xs text-slate-500">Authorized store managers and inventory officers</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-[11px] text-[#08275E]">
          Demo Access Credentials: <strong className="font-mono">admin@dslstationery.lk</strong> (Any password accepted)
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Admin Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#08275E]"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#08275E]"
            />
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-[#08275E] hover:bg-[#103b8c] text-white py-3.5 rounded-xl font-bold text-sm shadow-md transition-all mt-2"
          >
            <span>Sign In to Admin Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-100">
          <Link href="/home" className="font-bold text-[#08275E] hover:underline flex items-center justify-center gap-1">
            <Store className="w-3.5 h-3.5" />
            <span>Return to Customer Storefront</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
