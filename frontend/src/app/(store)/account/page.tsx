'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Package, Heart, MapPin, Bookmark, ArrowRight, User } from 'lucide-react';
import { useUserStore } from '@/services/userStore';
import { orderService } from '@/services/orderService';
import { Order } from '@/types/order';
import { AccountNav } from '@/components/common/AccountNav';
import { formatLKR } from '@/lib/currency';

export default function AccountOverviewPage() {
  const currentUser = useUserStore((state) => state.currentUser);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    setOrders(orderService.getAll().slice(0, 3));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-[#292525] tracking-tight">Account Overview</h1>
        <p className="text-xs text-[#292525]/70 mt-1">
          Welcome back, {currentUser ? currentUser.name : 'Customer'}! Manage your orders, wishlist, and addresses.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <AccountNav />
        </div>

        <div className="lg:col-span-3 space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 flex items-center gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-[#EBD5FA] text-[#8629B3] flex items-center justify-center font-bold">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <span className="text-2xl font-black text-[#292525]">{orders.length}</span>
                <span className="text-xs text-[#292525]/60 block">Recent Orders</span>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 flex items-center gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-[#C6E7FF]/50 text-[#0066CC] flex items-center justify-center font-bold">
                <Heart className="w-6 h-6" />
              </div>
              <div>
                <span className="text-2xl font-black text-[#292525]">
                  {currentUser?.wishlistProductIds.length || 0}
                </span>
                <span className="text-xs text-[#292525]/60 block">Wishlist Items</span>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 flex items-center gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-[#FFF9D2] text-[#B38A00] flex items-center justify-center font-bold">
                <Bookmark className="w-6 h-6" />
              </div>
              <div>
                <span className="text-2xl font-black text-[#292525]">
                  {currentUser?.savedLists.length || 0}
                </span>
                <span className="text-xs text-[#292525]/60 block">Saved Stationery Lists</span>
              </div>
            </div>
          </div>

          {/* Recent Orders Section */}
          <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 sm:p-8 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-[#C6E7FF]/30">
              <h2 className="text-sm font-bold text-[#292525]">Recent Orders</h2>
              <Link href="/account/orders" className="text-xs font-bold text-[#0066CC] hover:underline flex items-center gap-1">
                View all orders <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {orders.length === 0 ? (
              <p className="text-xs text-[#292525]/50 py-6 text-center">No recent orders found.</p>
            ) : (
              <div className="divide-y divide-stone-100">
                {orders.map((o) => (
                  <div key={o.id} className="py-3.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-[#0066CC] block font-mono">{o.orderNumber}</span>
                      <span className="text-[#292525]/60">{o.items.length} items • {formatLKR(o.totalCents)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FFFDF0] text-[#292525] border border-[#C6E7FF]/60">
                        {o.orderStatus}
                      </span>
                      <Link href={`/orders/${o.id}`} className="text-[#292525]/40 hover:text-[#0066CC] transition-colors">
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
