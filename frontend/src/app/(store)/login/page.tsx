'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, ArrowRight, User } from 'lucide-react';
import { useUserStore } from '@/services/userStore';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('kavindu.s@example.lk');
  const [password, setPassword] = useState('demo123456');
  const loginCustomer = useUserStore((state) => state.loginCustomer);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginCustomer(email);
    router.push('/account');
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16 sm:py-24">
      <div className="bg-white rounded-3xl border border-[#C6E7FF]/70 p-8 sm:p-10 shadow-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-[#FFFDF0] border-2 border-[#0066CC] text-[#0066CC] flex items-center justify-center mx-auto shadow-xs">
            <User className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-[#292525] tracking-tight">Welcome Back!</h1>
          <p className="text-xs text-[#292525]/70">Sign in to access your orders, wishlist, and saved lists</p>
        </div>

        <div className="bg-[#FFF9D2] border border-[#FFD84D] rounded-2xl p-3.5 text-[11px] text-[#594300] flex items-start gap-2 shadow-2xs">
          <Sparkles className="w-4 h-4 text-[#B38A00] shrink-0 mt-0.5" />
          <span>Demo mode: You can enter any sample email to simulate customer sign in.</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-[#292525] block mb-1.5">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#C6E7FF]/40 transition-all text-[#292525] bg-[#FFFDF0]/50"
            />
          </div>

          <div>
            <label className="font-bold text-[#292525] block mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#C6E7FF]/40 transition-all text-[#292525] bg-[#FFFDF0]/50"
            />
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-[#0066CC] hover:bg-[#0052a3] text-white py-3.5 rounded-full font-bold text-sm shadow-md hover:shadow-lg transition-all mt-3"
          >
            <span>Sign In to Account</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center text-xs text-[#292525]/70 pt-3 border-t border-[#C6E7FF]/30">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-bold text-[#0066CC] hover:underline">
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
}
