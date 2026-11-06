'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Bell,
  BellRing,
  Trash2,
  ExternalLink,
  Loader2,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { AccountNav } from '@/components/common/AccountNav';
import { useUserStore } from '@/services/userStore';
import { backInStockService } from '@/services/backInStockService';
import { BackInStockAlert } from '@/types/backInStock';
import { formatLKR } from '@/lib/currency';

export default function AccountBackInStockAlertsPage() {
  const router = useRouter();
  const currentUser = useUserStore((state) => state.currentUser);
  const fetchCurrentUser = useUserStore((state) => state.fetchCurrentUser);

  const [alerts, setAlerts] = useState<BackInStockAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  const loadAlerts = async () => {
    setIsLoading(true);
    try {
      const data = await backInStockService.getMyAlerts();
      setAlerts(data);
    } catch (err) {
      console.error('Failed to load back-in-stock alerts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        await fetchCurrentUser();
      } catch {
      } finally {
        if (mounted) setIsCheckingAuth(false);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, [fetchCurrentUser]);

  useEffect(() => {
    if (!isCheckingAuth && !currentUser) {
      router.push('/login?redirect=/account/back-in-stock-alerts');
    } else if (currentUser) {
      loadAlerts();
    }
  }, [isCheckingAuth, currentUser, router]);

  const handleCancel = async (id: string, productName?: string) => {
    if (!confirm(`Cancel back-in-stock alert for "${productName || 'this product'}"?`)) {
      return;
    }
    setCancelingId(id);
    try {
      await backInStockService.cancelAlert(id);
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'CANCELLED' } : a))
      );
    } catch (err: any) {
      alert(err?.message || 'Could not cancel alert. Please try again.');
    } finally {
      setCancelingId(null);
    }
  };

  if (isCheckingAuth || !currentUser) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#0066CC]" />
        <p className="mt-3 text-xs text-[#292525]/60 font-medium">Loading your alerts...</p>
      </div>
    );
  }

  const activeAlerts = alerts.filter(
    (a) => a.status === 'PENDING' || a.status === 'PROCESSING'
  );
  const historyAlerts = alerts.filter(
    (a) => a.status === 'SENT' || a.status === 'CANCELLED'
  );

  const displayedAlerts = activeTab === 'active' ? activeAlerts : historyAlerts;

  return (
    <div className="bg-[#FFFDF0] min-h-screen py-10 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#292525]">
            Back-in-Stock Alerts
          </h1>
          <p className="text-xs sm:text-sm text-[#292525]/60 mt-1">
            Get automated email notifications as soon as out-of-stock stationery products arrive in our warehouse.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <AccountNav />
          </div>

          <div className="lg:col-span-3 space-y-6">
            {/* Tabs */}
            <div className="flex items-center gap-2 border-b border-[#C6E7FF]/60 pb-3">
              <button
                onClick={() => setActiveTab('active')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'active'
                    ? 'bg-[#0066CC] text-white shadow-xs'
                    : 'bg-white text-[#292525]/70 hover:bg-[#F0F7FF] hover:text-[#0066CC] border border-slate-200'
                }`}
              >
                <BellRing className="w-3.5 h-3.5" />
                <span>Active Subscriptions ({activeAlerts.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'history'
                    ? 'bg-[#0066CC] text-white shadow-xs'
                    : 'bg-white text-[#292525]/70 hover:bg-[#F0F7FF] hover:text-[#0066CC] border border-slate-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Alert History ({historyAlerts.length})</span>
              </button>
            </div>

            {isLoading ? (
              <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-12 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#0066CC] mx-auto mb-2" />
                <p className="text-xs text-[#292525]/50">Fetching alert subscriptions...</p>
              </div>
            ) : displayedAlerts.length === 0 ? (
              <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-12 text-center space-y-4 shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-[#F0F7FF] text-[#0066CC] flex items-center justify-center mx-auto border border-[#C6E7FF]">
                  <Bell className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-[#292525]">
                    {activeTab === 'active'
                      ? 'No Active Subscriptions'
                      : 'No Notification History'}
                  </h3>
                  <p className="text-xs text-[#292525]/60 max-w-sm mx-auto">
                    {activeTab === 'active'
                      ? "When a stationery item is out of stock, click 'Notify Me When Available' on its product page to receive automated stock alerts."
                      : "You don't have any completed or cancelled alert notifications yet."}
                  </p>
                </div>
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold text-white bg-[#0066CC] hover:bg-[#0052a3] transition-all shadow-xs"
                >
                  <span>Browse Stationery Catalogue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {displayedAlerts.map((alert) => {
                  const product = alert.product;
                  const isNowInStock = (product?.stockQuantity || 0) > 0;
                  const imageUrl = product?.images?.[0] || '/images/placeholder.jpg';

                  return (
                    <div
                      key={alert.id}
                      className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-5 sm:p-6 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-2xl bg-slate-50 border border-slate-100 p-2 shrink-0 flex items-center justify-center relative overflow-hidden">
                          {product?.images?.[0] ? (
                            <Image
                              src={imageUrl}
                              alt={product.name}
                              fill
                              className="object-contain p-1"
                              unoptimized
                            />
                          ) : (
                            <Package className="w-8 h-8 text-slate-300" />
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            {product?.categoryName && (
                              <span className="text-[10px] font-bold text-[#0066CC] uppercase tracking-wider bg-[#F0F7FF] px-2.5 py-0.5 rounded-md border border-[#C6E7FF]/60">
                                {product.categoryName}
                              </span>
                            )}
                            {alert.status === 'PENDING' && (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200">
                                Active Subscription
                              </span>
                            )}
                            {alert.status === 'PROCESSING' && (
                              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200 flex items-center gap-1">
                                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                Processing Restock
                              </span>
                            )}
                            {alert.status === 'SENT' && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                Alert Sent
                              </span>
                            )}
                            {alert.status === 'CANCELLED' && (
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                                Cancelled
                              </span>
                            )}
                          </div>

                          <h3 className="font-bold text-sm text-[#292525] line-clamp-1">
                            {product?.name || 'Stationery Item'}
                          </h3>

                          <div className="flex items-center gap-3 text-xs">
                            {product?.priceCents ? (
                              <span className="font-extrabold text-[#0066CC]">
                                {formatLKR(product.priceCents)}
                              </span>
                            ) : null}

                            <span className="text-[#292525]/30">•</span>

                            {isNowInStock ? (
                              <span className="text-emerald-700 font-bold flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                                Back in Stock ({product?.stockQuantity} available)
                              </span>
                            ) : (
                              <span className="text-amber-700 font-medium flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                                Awaiting Restock
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-[#292525]/50">
                            Subscribed on {new Date(alert.createdAt).toLocaleDateString()}
                            {alert.sentAt && ` • Alert emailed on ${new Date(alert.sentAt).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0 w-full sm:w-auto justify-end pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        {product?.slug && (
                          <Link
                            href={`/products/${product.slug}`}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-[#0066CC] bg-[#F0F7FF] hover:bg-[#C6E7FF]/50 transition-colors border border-[#C6E7FF]/60"
                          >
                            <span>View Product</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        )}

                        {(alert.status === 'PENDING' || alert.status === 'PROCESSING') && (
                          <button
                            type="button"
                            onClick={() => handleCancel(alert.id, product?.name)}
                            disabled={cancelingId === alert.id}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors border border-rose-200 disabled:opacity-50"
                            title="Cancel alert subscription"
                          >
                            {cancelingId === alert.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                            <span>Cancel Alert</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

