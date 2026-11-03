'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingCart, Search, Eye, Filter, CheckCircle2, XCircle } from 'lucide-react';
import { orderService } from '@/services/orderService';
import { Order, OrderStatus } from '@/types/order';
import { formatLKR } from '@/lib/currency';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = () => {
    setOrders(orderService.getAll());
  };

  useEffect(() => {
    loadData();
    const unsub = orderService.subscribe(loadData);
    return () => unsub();
  }, []);

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== 'all' && o.orderStatus !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!o.orderNumber.toLowerCase().includes(q) && !o.customerName.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Order Fulfillment Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track customer orders, manage shipping transitions, and process demo refunds
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs text-xs">
        <div className="flex items-center gap-3 flex-1 min-w-64">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by Order # or Customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#08275E]"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700"
          >
            <option value="all">All Order Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="processing">Processing (Packing)</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <span className="text-slate-400 font-medium">
          Showing {filteredOrders.length} orders
        </span>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <th className="py-3 px-4 font-bold">Order #</th>
              <th className="py-3 px-4 font-bold">Customer</th>
              <th className="py-3 px-4 font-bold">District</th>
              <th className="py-3 px-4 font-bold">Items</th>
              <th className="py-3 px-4 font-bold">Payment</th>
              <th className="py-3 px-4 font-bold">Fulfillment Status</th>
              <th className="py-3 px-4 font-bold">Total (LKR)</th>
              <th className="py-3 px-4 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredOrders.map((order) => (
              <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-3.5 px-4 font-mono font-bold text-[#08275E]">
                  {order.orderNumber}
                </td>
                <td className="py-3.5 px-4">
                  <div className="font-bold text-slate-900">{order.customerName}</div>
                  <div className="text-[11px] text-slate-400">{order.customerPhone}</div>
                </td>
                <td className="py-3.5 px-4 text-slate-600">
                  {order.shippingAddress.district}
                </td>
                <td className="py-3.5 px-4 text-slate-600">
                  {order.items.length} items
                </td>
                <td className="py-3.5 px-4">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    order.paymentStatus === 'simulated_paid'
                      ? 'bg-emerald-50 text-emerald-700'
                      : order.paymentStatus === 'refunded'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {order.paymentStatus.replace('_', ' ')}
                  </span>
                </td>
                <td className="py-3.5 px-4">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    order.orderStatus === 'delivered'
                      ? 'bg-emerald-100 text-emerald-800'
                      : order.orderStatus === 'cancelled'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-blue-100 text-[#08275E]'
                  }`}>
                    {order.orderStatus}
                  </span>
                </td>
                <td className="py-3.5 px-4 font-black text-slate-900">
                  {formatLKR(order.totalCents)}
                </td>
                <td className="py-3.5 px-4 text-right">
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="bg-[#08275E] hover:bg-[#103b8c] text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition-colors inline-block"
                  >
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
