'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { adminUserService } from '@/services/adminUserService';
import { useUserStore } from '@/services/userStore';

function AcceptInvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitationData, setInvitationData] = useState<{
    name: string;
    email: string;
    role: string;
    expiresAt: string;
    invitedBy: string;
  } | null>(null);

  // Form states
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('No invitation token found in link. Please verify the URL or contact your store administrator.');
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    adminUserService
      .verifyInvitation(token)
      .then((res) => {
        if (isMounted) {
          setInvitationData(res.data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(
            err?.message ||
              'Invalid or expired invitation token. Please request a new invitation from an administrator.'
          );
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  // Password validation checks
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!isPasswordValid) {
      setFormError('Please ensure all password requirements are satisfied and passwords match.');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      const res = await adminUserService.acceptInvitation({
        token,
        password,
      });

      setIsSuccess(true);

      // Re-fetch authenticated user state so Zustand store is synced with newly set cookies
      try {
        await useUserStore.getState().fetchCurrentUser();
      } catch {
        // silent
      }

      setTimeout(() => {
        router.push('/admin/dashboard');
      }, 2000);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to accept invitation. The token may have expired or already been used.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="w-12 h-12 rounded-2xl bg-[#08275E] text-[#FFD21C] flex items-center justify-center mx-auto shadow-md">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="mt-4 text-center text-2xl font-black text-slate-900 tracking-tight">
          DSL Administrator Setup
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500">
          Establish your credentials to activate your administrative portal access
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-md rounded-3xl border border-slate-200 sm:px-8">
          {isLoading ? (
            <div className="py-12 text-center text-slate-500 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#08275E]" />
              <p className="text-xs font-semibold">Verifying secure invitation token...</p>
            </div>
          ) : error ? (
            <div className="space-y-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">Invitation Invalid or Expired</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{error}</p>
              </div>
              <div className="pt-2">
                <Link
                  href="/admin/login"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#08275E] hover:underline"
                >
                  <span>Go to Admin Login</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : isSuccess ? (
            <div className="space-y-6 text-center py-6">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900">Account Activated!</h3>
                <p className="text-xs text-slate-500">
                  Your administrator password has been set. Redirecting to your dashboard...
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-[#08275E] font-bold">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Opening console...</span>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 text-xs">
              {/* Invitee Info Card */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1 text-slate-700">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">{invitationData?.name}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                    {invitationData?.role}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">{invitationData?.email}</div>
                <div className="text-[10px] text-slate-400 pt-1">
                  Invited by {invitationData?.invitedBy}
                </div>
              </div>

              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-xs text-red-700 flex items-start gap-2 shadow-2xs">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Password Input */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Establish Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a strong password"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#08275E]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Input */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Confirm Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#08275E]"
                />
              </div>

              {/* Password Requirements Checklist */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60 space-y-1.5 text-[11px]">
                <span className="font-bold text-slate-600 block mb-1">Password Requirements:</span>
                <div className="grid grid-cols-2 gap-1">
                  <div
                    className={`flex items-center gap-1.5 ${
                      hasMinLength ? 'text-emerald-700 font-semibold' : 'text-slate-400'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        hasMinLength ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    />
                    <span>At least 8 chars</span>
                  </div>

                  <div
                    className={`flex items-center gap-1.5 ${
                      hasUppercase ? 'text-emerald-700 font-semibold' : 'text-slate-400'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        hasUppercase ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    />
                    <span>1 uppercase letter</span>
                  </div>

                  <div
                    className={`flex items-center gap-1.5 ${
                      hasLowercase ? 'text-emerald-700 font-semibold' : 'text-slate-400'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        hasLowercase ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    />
                    <span>1 lowercase letter</span>
                  </div>

                  <div
                    className={`flex items-center gap-1.5 ${
                      hasNumber ? 'text-emerald-700 font-semibold' : 'text-slate-400'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        hasNumber ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    />
                    <span>1 number</span>
                  </div>
                </div>

                {password.length > 0 && confirmPassword.length > 0 && (
                  <div
                    className={`pt-1 border-t border-slate-200/60 flex items-center gap-1.5 ${
                      passwordsMatch ? 'text-emerald-700 font-semibold' : 'text-red-500'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        passwordsMatch ? 'bg-emerald-500' : 'bg-red-500'
                      }`}
                    />
                    <span>{passwordsMatch ? 'Passwords match' : 'Passwords do not match'}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={!isPasswordValid || isSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-[#08275E] hover:bg-[#103b8c] disabled:opacity-50 text-white py-3 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Activating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Activate Account & Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="w-8 h-8 animate-spin text-[#08275E]" />
        </div>
      }
    >
      <AcceptInvitationContent />
    </Suspense>
  );
}

