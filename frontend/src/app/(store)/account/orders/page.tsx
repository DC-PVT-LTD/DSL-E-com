'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Package, ArrowRight, Loader2, Repeat, ShoppingBag } from 'lucide-react';
import { AccountNav } from '@/components/common/AccountNav';
import { orderService } from '@/services/orderService';
import { useUserStore } from '@/services/userStore';
import { useCartStore } from '@/services/cartStore';
import { Order, BuyAgainResponse } from '@/types/order';
import { formatLKR } from '@/lib/currency';
import { BuyAgainModal } from '@/components/orders/BuyAgainModal';

export default function AccountOrdersPage() {
  const router = useRouter();
  const currentUser = useUserStore((state) => state.currentUser);
  const fetchCurrentUser = useUserStore((state) => state.fetchCurrentUser);
  const addBuyAgainBatch = useCartStore((state) => state.addBuyAgainBatch);

  const [orders, setOrders] = useState<Order[]>([]);
  const [isChecking, setIsChecking] = useState(true);

  // Buy Again State
  const [reorderingOrderId, setReorderingOrderId] = useState<string | null>(null);
  const [buyAgainResult, setBuyAgainResult] = useState<BuyAgainResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        await fetchCurrentUser();
      } catch {
      } finally {
        if (mounted) setIsChecking(false);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, [fetchCurrentUser]);

  useEffect(() => {
    if (!isChecking && !currentUser) {
      router.push('/login');
    }
  }, [isChecking, currentUser, router]);

  useEffect(() => {
    let mounted = true;
    const loadOrders = async () => {
      try {
        const res = await orderService.fetchOrders();
        const liveList = res?.orders || [];
        if (mounted && liveList.length > 0) {
          setOrders(liveList);
          return;
        }
      } catch {
        // fallback to cached/mock orders
      }
      if (mounted) setOrders(orderService.getAll());
    };

    loadOrders();
    const unsub = orderService.subscribe(() => {
      loadOrders();
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const handleBuyAgain = async (orderId: string) => {
    setReorderingOrderId(orderId);
    try {
      const res = await orderService.buyAgain(orderId);

      // Add eligible in-stock items to existing cart
      const availableItems = res.items
        .filter((it) => it.availableQuantity > 0 && it.product)
        .map((it) => ({
          product: it.product,
          variant: it.variant,
          quantity: it.availableQuantity,
          bundleInfo: it.bundleInfo,
        }));

      if (availableItems.length > 0) {
        await addBuyAgainBatch(availableItems);
      }

      setBuyAgainResult(res);
      setIsModalOpen(true);
    } catch (err: any) {
      alert(err?.message || 'Unable to reorder products from this order. Please try again.');
    } finally {
      setReorderingOrderId(null);
    }
  };

  if (isChecking || !currentUser) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#0866E8]" />
        <p className="mt-3 text-xs text-slate-500 font-medium">Loading orders...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-14">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-[#09285C] tracking-tight">Order History</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">Review your past and active stationery purchases</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <AccountNav />
        </div>

        <div className="lg:col-span-3 space-y-4">
          {orders.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center text-xs text-slate-500 shadow-xs">
              No orders placed yet.
            </div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="bg-white rounded-3xl border border-slate-100 p-5 sm:p-7 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-100 gap-2">
                  <div>
                    <span className="font-mono text-xs font-black text-[#0866E8]">{order.orderNumber}</span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-[#F7FAFF] text-[#09285C] border border-blue-100">
                      {order.orderStatus}
                    </span>

                    {(order.paymentMethod === 'BANK_TRANSFER' || order.paymentMethod === 'bank_transfer_mock') && (
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                          order.paymentStatus === 'PAID' || order.paymentStatus === 'paid'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : order.orderStatus === 'CANCELLED' || order.paymentStatus === 'FAILED' || order.paymentStatus === 'failed'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {order.paymentStatus === 'PAID' || order.paymentStatus === 'paid'
                          ? 'Transfer Verified'
                          : order.orderStatus === 'CANCELLED' || order.paymentStatus === 'FAILED' || order.paymentStatus === 'failed'
                          ? 'Transfer Rejected'
                          : 'Verification Pending'}
                      </span>
                    )}

                    {/* Buy Again Action */}
                    <button
                      type="button"
                      onClick={() => handleBuyAgain(order.id)}
                      disabled={reorderingOrderId === order.id}
                      className="bg-white hover:bg-blue-50 text-[#0866E8] border border-blue-200 text-xs font-bold px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50 touch-target"
                      title="Quickly reorder available products from this order"
                    >
                      {reorderingOrderId === order.id ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Checking...</span>
                        </>
                      ) : (
                        <>
                          <Repeat className="w-3.5 h-3.5" />
                          <span>Buy Again</span>
                        </>
                      )}
                    </button>

                    <Link
                      href={`/orders/${order.id}`}
                      className="bg-[#0866E8] hover:bg-[#09285C] text-white text-xs font-bold px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 shadow-xs touch-target"
                    >
                      <span>Track Details</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  {order.items.map((item: any) => (
                    <div key={item.id} className="flex justify-between gap-2">
                      <span className="truncate">{item.quantity}x {item.product?.name || item.productName || 'Stationery Item'}</span>
                      <span className="font-bold text-[#09285C] shrink-0">{formatLKR(item.totalPriceCents)}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-between text-xs font-bold text-slate-700">
                  <span>Total Amount</span>
                  <span className="text-base font-black text-[#0866E8]">{formatLKR(order.totalCents)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Buy Again Summary Modal */}
      <BuyAgainModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        result={buyAgainResult}
      />
    </div>
  );
}
