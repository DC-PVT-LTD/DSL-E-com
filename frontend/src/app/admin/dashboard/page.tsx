'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  ShoppingCart,
  Boxes,
  Users,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Package,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import { orderService } from '@/services/orderService';
import { productService } from '@/services/productService';
import { Order } from '@/types/order';
import { Product } from '@/types/product';
import { formatLKR } from '@/lib/currency';

export default function AdminDashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const load = () => {
      setOrders(orderService.getAll());
      setProducts(productService.getAll(true));
    };
    load();

    const unsubOrder = orderService.subscribe(load);
    const unsubProduct = productService.subscribe(load);
    return () => {
      unsubOrder();
      unsubProduct();
    };
  }, []);

  const totalSalesCents = orders
    .filter((o) => o.orderStatus !== 'cancelled')
    .reduce((acc, o) => acc + o.totalCents, 0);

  const pendingOrders = orders.filter((o) => o.orderStatus === 'pending' || o.orderStatus === 'confirmed');
  const lowStockProducts = products.filter((p) => p.stockQuantity <= p.lowStockThreshold);
  const bestSellers = products.filter((p) => p.isBestSeller).slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#292525] tracking-tight">
            Admin Dashboard
          </h1>
          <p className="text-xs text-[#292525]/60 mt-1">
            Real-time business performance metrics &bull; <strong className="text-[#B38A00] font-semibold">Labelled Demonstration Data</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/products/new"
            className="bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold px-4 py-2.5 rounded-full transition-all shadow-xs flex items-center gap-1.5"
          >
            <Package className="w-4 h-4 text-white" />
            <span>Add New Product</span>
          </Link>
        </div>
      </div>

      {/* Key Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#292525]/60 uppercase tracking-wider">Gross Sales</span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-black text-[#292525] block">
              {formatLKR(totalSalesCents)}
            </span>
            <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Simulated Demo Revenue</span>
            </span>
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#292525]/60 uppercase tracking-wider">Total Orders</span>
            <div className="w-10 h-10 rounded-2xl bg-[#EBD5FA]/40 text-[#8629B3] flex items-center justify-center font-bold">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-black text-[#292525] block">
              {orders.length}
            </span>
            <span className="text-[11px] text-[#292525]/60 mt-1 block">
              Across all 25 districts
            </span>
          </div>
        </div>

        {/* Pending Orders */}
        <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#292525]/60 uppercase tracking-wider">Pending Fulfillment</span>
            <div className="w-10 h-10 rounded-2xl bg-[#FFF9D2] text-[#B38A00] flex items-center justify-center font-bold">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-black text-[#B38A00] block">
              {pendingOrders.length}
            </span>
            <Link href="/admin/orders" className="text-[11px] font-bold text-[#0066CC] hover:underline mt-1 block">
              Process queue →
            </Link>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#292525]/60 uppercase tracking-wider">Low Stock SKUs</span>
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-black text-rose-600 block">
              {lowStockProducts.length}
            </span>
            <Link href="/admin/inventory" className="text-[11px] font-bold text-rose-700 hover:underline mt-1 block">
              Restock inventory →
            </Link>
          </div>
        </div>
      </div>

      {/* Grid: Recent Orders (Left 7) and Best Sellers / Low stock alerts (Right 5) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Recent Orders List */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <h2 className="text-sm font-bold text-[#292525]">Recent Customer Orders</h2>
            <Link href="/admin/orders" className="text-xs font-bold text-[#0066CC] hover:underline">
              View all orders →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[#292525]/40 border-b border-stone-100">
                  <th className="pb-2 font-semibold">Order</th>
                  <th className="pb-2 font-semibold">Customer</th>
                  <th className="pb-2 font-semibold">Status</th>
                  <th className="pb-2 font-semibold text-right">Total</th>
                  <th className="pb-2 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {orders.slice(0, 5).map((order) => (
                  <tr key={order.id} className="hover:bg-stone-50">
                    <td className="py-3 font-mono font-bold text-[#292525]">{order.orderNumber}</td>
                    <td className="py-3 text-[#292525]/70 truncate max-w-36">{order.customerName}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        order.orderStatus === 'delivered'
                          ? 'bg-emerald-50 text-emerald-700'
                          : order.orderStatus === 'cancelled'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-[#FFFDF0] text-[#292525] border border-[#C6E7FF]'
                      }`}>
                        {order.orderStatus}
                      </span>
                    </td>
                    <td className="py-3 text-right font-black text-[#292525]">{formatLKR(order.totalCents)}</td>
                    <td className="py-3 text-right">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="text-[#0066CC] hover:underline font-bold text-[11px]"
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

        {/* Low Stock Alerts & Best Sellers */}
        <div className="lg:col-span-5 space-y-6">
          {/* Low Stock Warning Box */}
          <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <h2 className="text-sm font-bold text-[#292525] flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <span>Low Stock Action Needed</span>
              </h2>
              <Link href="/admin/inventory" className="text-xs font-bold text-[#0066CC] hover:underline">
                Inventory →
              </Link>
            </div>

            {lowStockProducts.length === 0 ? (
              <p className="text-xs text-[#292525]/40 py-3 text-center">All inventory stock healthy.</p>
            ) : (
              <div className="space-y-2">
                {lowStockProducts.slice(0, 4).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs py-1.5 border-b border-stone-50">
                    <span className="font-semibold text-[#292525] truncate max-w-48">{p.name}</span>
                    <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                      {p.stockQuantity} in stock
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Best Sellers */}
          <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-[#292525] pb-2 border-b border-stone-100">
              Top Selling Stationery
            </h2>
            <div className="space-y-2 text-xs">
              {bestSellers.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-1 border-b border-stone-50">
                  <span className="text-[#292525] font-semibold truncate max-w-56">{p.name}</span>
                  <span className="font-black text-[#0066CC]">{formatLKR(p.priceCents)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
