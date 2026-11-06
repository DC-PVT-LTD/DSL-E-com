'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  User,
  UserCheck,
  ArrowRight,
  ShieldCheck,
  Lock,
  Mail,
  KeyRound,
  CheckCircle2,
  Sparkles,
  Loader2,
  LogOut,
  Clock,
} from 'lucide-react';
import { useUserStore } from '@/services/userStore';

interface CheckoutGatewayProps {
  onContinueAsGuest: () => void;
  onAuthenticatedContinue: () => void;
  selectedItemCount: number;
}

export const CheckoutGateway: React.FC<CheckoutGatewayProps> = ({
  onContinueAsGuest,
  onAuthenticatedContinue,
  selectedItemCount,
}) => {
  const currentUser = useUserStore((state) => state.currentUser);
  const loginCustomer = useUserStore((state) => state.loginCustomer);
  const logoutCustomer = useUserStore((state) => state.logoutCustomer);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your email and password');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const success = await loginCustomer(email.trim(), password);
      if (success) {
        onAuthenticatedContinue();
      } else {
        setErrorMessage('Invalid email or password. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Unable to sign in. Please check your credentials or continue as guest.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Stepper Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 bg-[#FFFDF0] px-4 py-1.5 rounded-full border border-[#C6E7FF]/60 text-xs font-semibold text-[#0066CC]">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Step 1 of 3: Checkout Gateway</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#292525]">
          How would you like to checkout?
        </h1>
        <p className="text-xs sm:text-sm text-[#292525]/60 max-w-md mx-auto">
          Checking out with {selectedItemCount} {selectedItemCount === 1 ? 'item' : 'items'}. Choose
          to sign in to your registered account or proceed directly as a guest.
        </p>
      </div>

      {/* Two-Column Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {/* OPTION A: Registered Customer */}
        <div className="bg-white rounded-3xl border-2 border-[#0066CC] p-6 sm:p-8 flex flex-col justify-between shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-[#0066CC] text-white text-[10px] font-extrabold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
            Recommended
          </div>

          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-[#F0F7FF] border border-[#C6E7FF] flex items-center justify-center text-[#0066CC]">
                {currentUser ? <UserCheck className="w-6 h-6" /> : <User className="w-6 h-6" />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#292525]">Customer Checkout</h2>
                <p className="text-xs text-[#292525]/60">For registered account holders</p>
              </div>
            </div>

            {currentUser ? (
              <div className="space-y-4 my-6 p-4 rounded-2xl bg-[#FFFDF0] border border-[#C6E7FF]/60">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Signed in as:</span>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-extrabold text-[#292525]">{currentUser.name}</p>
                  <p className="text-xs text-[#292525]/70">{currentUser.email}</p>
                  {currentUser.phone && (
                    <p className="text-xs text-[#292525]/60">{currentUser.phone}</p>
                  )}
                </div>
                {currentUser.addresses && currentUser.addresses.length > 0 && (
                  <p className="text-[11px] text-[#0066CC] font-semibold">
                    ✓ {currentUser.addresses.length} saved delivery{' '}
                    {currentUser.addresses.length === 1 ? 'address' : 'addresses'} ready
                  </p>
                )}
              </div>
            ) : (
              <form onSubmit={handleSignIn} className="space-y-3.5 my-5">
                <p className="text-xs text-[#292525]/70 leading-relaxed mb-1">
                  Sign in to use your saved addresses, access order history, and track real-time delivery.
                </p>

                <div>
                  <label className="text-[11px] font-bold text-[#292525] block mb-1">
                    Email Address
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="w-4 h-4 text-[#292525]/40 absolute left-3" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="customer@example.lk"
                      className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-[#C6E7FF] bg-[#FFFDF0] focus:outline-hidden focus:border-[#0066CC]"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-[#292525]">Password</label>
                    <Link
                      href="/forgot-password"
                      className="text-[10px] text-[#0066CC] hover:underline"
                    >
                      Forgot?
                    </Link>
                  </div>
                  <div className="relative flex items-center">
                    <KeyRound className="w-4 h-4 text-[#292525]/40 absolute left-3" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-[#C6E7FF] bg-[#FFFDF0] focus:outline-hidden focus:border-[#0066CC]"
                      required
                    />
                  </div>
                </div>

                {errorMessage && (
                  <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
                    {errorMessage}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 bg-[#0066CC] hover:bg-[#0052a3] disabled:opacity-50 text-white py-3 rounded-full font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                  <span>Sign In &amp; Proceed to Delivery</span>
                </button>
              </form>
            )}
          </div>

          {currentUser ? (
            <div className="space-y-2 pt-2">
              <button
                onClick={onAuthenticatedContinue}
                className="w-full flex items-center justify-center gap-2 bg-[#0066CC] hover:bg-[#0052a3] text-white py-3.5 rounded-full font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                <span>Continue to Delivery Details</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={async () => {
                  await logoutCustomer();
                  setEmail('');
                  setPassword('');
                }}
                className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#292525]/50 hover:text-rose-600 py-1 transition-colors"
              >
                <LogOut className="w-3 h-3" />
                <span>Switch or sign out of account</span>
              </button>
            </div>
          ) : (
            <div className="text-center pt-2 border-t border-[#C6E7FF]/40">
              <span className="text-[11px] text-[#292525]/60">Don&apos;t have an account yet? </span>
              <button
                onClick={onContinueAsGuest}
                className="text-[11px] text-[#0066CC] font-bold hover:underline"
              >
                Checkout as Guest
              </button>
            </div>
          )}
        </div>

        {/* OPTION B: Guest Checkout */}
        <div className="bg-white rounded-3xl border border-[#C6E7FF]/70 p-6 sm:p-8 flex flex-col justify-between shadow-xs hover:border-[#0066CC]/50 transition-all">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-[#FAF7EE] border border-[#C6E7FF]/50 flex items-center justify-center text-[#292525]/70">
                <Clock className="w-6 h-6 text-[#0066CC]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#292525]">Guest Checkout</h2>
                <p className="text-xs text-[#292525]/60">Fast &amp; simple without password</p>
              </div>
            </div>

            <p className="text-xs text-[#292525]/70 leading-relaxed mb-6">
              In a hurry? Place your stationery order quickly without creating an account. You only need
              to provide your delivery address and contact information.
            </p>

            {/* Guest Advantages Checklist */}
            <div className="space-y-3 mb-8 bg-[#FAF7EE]/60 p-4 rounded-2xl border border-[#C6E7FF]/30">
              <div className="flex items-start gap-2.5 text-xs text-[#292525]/80">
                <CheckCircle2 className="w-4 h-4 text-[#0066CC] shrink-0 mt-0.5" />
                <span>No password or account registration required.</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-[#292525]/80">
                <CheckCircle2 className="w-4 h-4 text-[#0066CC] shrink-0 mt-0.5" />
                <span>Supports both PayHere (Card) and Cash on Delivery.</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-[#292525]/80">
                <CheckCircle2 className="w-4 h-4 text-[#0066CC] shrink-0 mt-0.5" />
                <span>Optional 1-click account creation after completing your order.</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-[#292525]/80">
                <CheckCircle2 className="w-4 h-4 text-[#0066CC] shrink-0 mt-0.5" />
                <span>Secure guest order tracking link sent to your email.</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={onContinueAsGuest}
              className="w-full flex items-center justify-center gap-2 bg-white border-2 border-[#0066CC] text-[#0066CC] hover:bg-[#F0F7FF] py-3.5 rounded-full font-bold text-xs shadow-xs hover:shadow-md transition-all cursor-pointer group"
            >
              <span>Continue as Guest</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <p className="text-center text-[10px] text-[#292525]/40">
              Your cart items and pricing remain completely preserved.
            </p>
          </div>
        </div>
      </div>

      {/* Trust & Guarantee Banner */}
      <div className="p-4 bg-white rounded-2xl border border-[#C6E7FF]/60 flex flex-wrap items-center justify-around gap-4 text-center text-xs text-[#292525]/70">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#0066CC]" />
          <span>100% Genuine Stationery</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Lock className="w-4 h-4 text-[#0066CC]" />
          <span>256-Bit Encrypted Checkout</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-[#0066CC]" />
          <span>10-Minute Reserved Stock Protection</span>
        </div>
      </div>
    </div>
  );
};

