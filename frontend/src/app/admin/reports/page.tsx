'use client';

import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, DollarSign, ShoppingCart, MapPin } from 'lucide-react';
import { orderService } from '@/services/orderService';
import { Order } from '@/types/order';
import { formatLKR } from '@/lib/currency';

export default function AdminReportsPage() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    setOrders(orderService.getAll());
  }, []);

  const totalSalesCents = orders
    .filter((o) => o.orderStatus !== 'cancelled')
    .reduce((acc, o) => acc + o.totalCents, 0);

  const averageOrderValueCents = orders.length > 0 ? Math.round(totalSalesCents / orders.length) : 0;

  // District distribution
  const districtCounts: Record<string, number> = {};
  orders.forEach((o) => {
    const dist = o.shippingAddress.district || 'Colombo';
    districtCounts[dist] = (districtCounts[dist] || 0) + 1;
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Sales &amp; Fulfillment Analytics
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Performance metrics derived from demonstration customer orders
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase">Total Revenue</span>
          <div className="text-2xl font-black text-[#08275E]">{formatLKR(totalSalesCents)}</div>
          <span className="text-[11px] text-emerald-600 font-semibold block">Excluding cancellations</span>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase">Average Order Value (AOV)</span>
          <div className="text-2xl font-black text-slate-900">{formatLKR(averageOrderValueCents)}</div>
          <span className="text-[11px] text-slate-500 block">Per stationery purchase</span>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase">Completed Orders</span>
          <div className="text-2xl font-black text-emerald-700">
            {orders.filter((o) => o.orderStatus === 'delivered').length}
          </div>
          <span className="text-[11px] text-slate-500 block">Successfully delivered</span>
        </div>
      </div>

      {/* Regional District Distribution */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#08275E]" />
          <span>Orders by Sri Lankan District</span>
        </h2>

        <div className="space-y-3">
          {Object.entries(districtCounts).map(([dist, count]) => {
            const percent = Math.round((count / orders.length) * 100);
            return (
              <div key={dist} className="space-y-1 text-xs">
                <div className="flex justify-between font-semibold">
                  <span className="text-slate-800">{dist}</span>
                  <span className="text-slate-500">{count} orders ({percent}%)</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#08275E]" style={{ width: `${percent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
