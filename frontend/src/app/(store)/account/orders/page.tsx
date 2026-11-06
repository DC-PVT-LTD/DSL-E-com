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
        <Loader2 className="w-8 h-8 animate-spin text-[#0066CC]" />
        <p className="mt-3 text-xs text-[#292525]/60 font-medium">Loading orders...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-[#292525] tracking-tight">Order History</h1>
        <p className="text-xs text-[#292525]/70 mt-1">Review your past and active stationery purchases</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <AccountNav />
        </div>

        <div className="lg:col-span-3 space-y-4">
          {orders.length === 0 ? (
            <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-12 text-center text-xs text-[#292525]/60 shadow-sm">
              No orders placed yet.
            </div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 sm:p-7 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between pb-3 border-b border-[#C6E7FF]/30 gap-2">
                  <div>
                    <span className="font-mono text-xs font-black text-[#0066CC]">{order.orderNumber}</span>
                    <span className="text-[11px] text-[#292525]/50 block mt-0.5">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-[#FFFDF0] text-[#292525] border border-[#C6E7FF]/60">
                      {order.orderStatus}
                    </span>

                    {/* Phase 15.3: Buy Again Action */}
                    <button
                      type="button"
                      onClick={() => handleBuyAgain(order.id)}
                      disabled={reorderingOrderId === order.id}
                      className="bg-white hover:bg-[#FFFDF0] text-[#0066CC] border border-[#0066CC]/50 text-xs font-bold px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50"
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
                      className="bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 shadow-xs"
                    >
                      <span>Track Details</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-[#292525]/80">
                  {order.items.map((item: any) => (
                    <div key={item.id} className="flex justify-between">
                      <span>{item.quantity}x {item.product?.name || item.productName || 'Stationery Item'}</span>
                      <span className="font-bold text-[#292525]">{formatLKR(item.totalPriceCents)}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-[#C6E7FF]/30 flex justify-between text-xs font-bold text-[#292525]">
                  <span>Total Amount</span>
                  <span className="text-base font-black text-[#0066CC]">{formatLKR(order.totalCents)}</span>
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
