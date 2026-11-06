'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  UserPlus,
  ArrowRight,
  AlertCircle,
  Loader2,
  Mail,
  ShieldCheck,
  RefreshCw,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import { useUserStore } from '@/services/userStore';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // OTP Verification state
  const [isVerifying, setIsVerifying] = useState(false);
  const [otp, setOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  const registerCustomer = useUserStore((state) => state.registerCustomer);
  const verifyEmail = useUserStore((state) => state.verifyEmail);
  const resendVerificationOtp = useUserStore((state) => state.resendVerificationOtp);

  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await registerCustomer(name, email, password, phone || undefined);
      if (res.requiresVerification) {
        setIsVerifying(true);
        setResendCooldown(60);
        setSuccessMessage('A 6-digit verification code has been dispatched to your email.');
      } else {
        router.push('/account');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setError('Please enter a valid 6-digit numeric verification code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await verifyEmail(email, cleanOtp);
      if (res.success) {
        setSuccessMessage('Email verified successfully! Redirecting to your account...');
        setTimeout(() => {
          router.push('/account');
        }, 1200);
      }
    } catch (err: any) {
      setError(err?.message || 'Invalid or expired verification code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isResending) return;
    setIsResending(true);
    setError(null);
    try {
      await resendVerificationOtp(email);
      setResendCooldown(60);
      setSuccessMessage('A fresh verification code has been sent to your email.');
    } catch (err: any) {
      setError(err?.message || 'Unable to resend verification code right now.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16 sm:py-24">
      <div className="bg-white rounded-3xl border border-[#C6E7FF]/70 p-8 sm:p-10 shadow-sm space-y-6">
        {/* Step 1: Registration Form */}
        {!isVerifying ? (
          <>
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-[#FFFDF0] border-2 border-[#0066CC] text-[#0066CC] flex items-center justify-center mx-auto shadow-xs">
                <UserPlus className="w-7 h-7" />
              </div>
              <h1 className="text-2xl font-black text-[#292525] tracking-tight">Create Customer Account</h1>
              <p className="text-xs text-[#292525]/70">Save your addresses and manage your stationery orders</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5 text-xs text-red-700 flex items-start gap-2 shadow-2xs">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-[#292525] block mb-1.5">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Nimesha Perera"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#C6E7FF]/40 transition-all text-[#292525] bg-[#FFFDF0]/50"
                />
              </div>

              <div>
                <label className="font-bold text-[#292525] block mb-1.5">Email Address</label>
                <input
                  type="email"
                  placeholder="nimesha@example.lk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#C6E7FF]/40 transition-all text-[#292525] bg-[#FFFDF0]/50"
                />
              </div>

              <div>
                <label className="font-bold text-[#292525] block mb-1.5">Phone Number (Sri Lanka)</label>
                <input
                  type="tel"
                  placeholder="+94 77 123 4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#C6E7FF]/40 transition-all text-[#292525] bg-[#FFFDF0]/50"
                />
              </div>

              <div>
                <label className="font-bold text-[#292525] block mb-1.5">Password</label>
                <input
                  type="password"
                  placeholder="•••••••• (min 8 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#C6E7FF]/40 transition-all text-[#292525] bg-[#FFFDF0]/50"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-[#0066CC] hover:bg-[#0052a3] disabled:opacity-60 text-white py-3.5 rounded-full font-bold text-sm shadow-md hover:shadow-lg transition-all mt-3 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Continue with Verification</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="text-center text-xs text-[#292525]/70 pt-3 border-t border-[#C6E7FF]/30">
              Already registered?{' '}
              <Link href="/login" className="font-bold text-[#0066CC] hover:underline">
                Sign in here
              </Link>
            </div>
          </>
        ) : (
          /* Step 2: Email OTP Verification Screen */
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-[#EBF5FF] border-2 border-[#0066CC] text-[#0066CC] flex items-center justify-center mx-auto shadow-xs">
                <Mail className="w-7 h-7" />
              </div>
              <h1 className="text-2xl font-black text-[#292525] tracking-tight">Verify Your Email</h1>
              <p className="text-xs text-[#292525]/70">
                We sent a 6-digit confirmation code to{' '}
                <span className="font-bold text-[#0066CC]">{email}</span>.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5 text-xs text-red-700 flex items-start gap-2 shadow-2xs">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-xs text-emerald-800 flex items-start gap-2 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-[#292525] block mb-1.5 text-center">
                  6-Digit Verification Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    required
                    disabled={isSubmitting}
                    className="w-full text-center tracking-[0.5em] font-mono text-xl py-3 rounded-2xl border border-stone-300 focus:outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#C6E7FF]/50 bg-stone-50 font-bold"
                  />
                  <KeyRound className="w-4 h-4 text-stone-400 absolute left-4 top-3.5" />
                </div>
                <p className="text-[11px] text-[#292525]/60 text-center mt-2">
                  Code expires in 10 minutes. Check your spam folder if you do not see it.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || otp.length !== 6}
                className="w-full flex items-center justify-center gap-2 bg-[#0066CC] hover:bg-[#0052a3] disabled:opacity-60 text-white py-3.5 rounded-full font-bold text-sm shadow-md hover:shadow-lg transition-all mt-3 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verify &amp; Activate Account</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsVerifying(false)}
                  className="text-stone-500 hover:text-stone-800 underline"
                >
                  Edit details
                </button>

                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || isResending}
                  className="font-bold text-[#0066CC] disabled:text-stone-400 hover:underline flex items-center gap-1"
                >
                  {isResending ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : null}
                  <span>
                    {resendCooldown > 0
                      ? `Resend code in ${resendCooldown}s`
                      : 'Resend code'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
