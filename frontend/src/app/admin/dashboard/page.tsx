'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  ShoppingCart,
  Boxes,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Package,
  Layers,
  RefreshCw,
  Clock,
  ShieldAlert,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  Search,
  ExternalLink,
  ChevronRight,
  CreditCard,
  FileCheck,
  BarChart3,
  Filter,
} from 'lucide-react';
import { dashboardService } from '@/services/dashboardService';
import { DashboardKpisResponse, DashboardRecentOrder } from '@/types/dashboard';
import { ReportPeriod } from '@/types/report';
import { formatLKR } from '@/lib/currency';
import { OrderStatusBadge } from '@/components/admin/orders/OrderStatusBadge';
import { PaymentStatusBadge } from '@/components/admin/orders/PaymentStatusBadge';
import { AdminPageAccess } from '@/components/admin/AdminPageAccess';

export default function AdminDashboardPage() {
  const [period, setPeriod] = useState<ReportPeriod>('last30days');
  const [data, setData] = useState<DashboardKpisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAccessDenied, setIsAccessDenied] = useState(false);

  // Recent orders client-side search & status filter for fast scanning
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'ALL' | 'PENDING' | 'CONFIRMED' | 'DELIVERED'>('ALL');

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);
    setIsAccessDenied(false);

    try {
      const response = await dashboardService.fetchDashboardKpis({ period });
      setData(response);
    } catch (err: any) {
      if (err?.status === 403 || err?.message?.includes('Forbidden')) {
        setIsAccessDenied(true);
      } else {
        setError(err?.message || 'Failed to load executive dashboard metrics.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Filtered recent orders based on local filter bar
  const filteredRecentOrders = useMemo(() => {
    if (!data?.recentOrders) return [];
    return data.recentOrders.filter((order: DashboardRecentOrder) => {
      const matchesSearch =
        !orderSearch.trim() ||
        order.orderNumber.toLowerCase().includes(orderSearch.toLowerCase()) ||
        order.customerName.toLowerCase().includes(orderSearch.toLowerCase());

      const matchesStatus =
        orderStatusFilter === 'ALL' ||
        (orderStatusFilter === 'PENDING' && order.orderStatus === 'PENDING') ||
        (orderStatusFilter === 'CONFIRMED' && (order.orderStatus === 'CONFIRMED' || order.orderStatus === 'PROCESSING')) ||
        (orderStatusFilter === 'DELIVERED' && order.orderStatus === 'DELIVERED');

      return matchesSearch && matchesStatus;
    });
  }, [data?.recentOrders, orderSearch, orderStatusFilter]);

  // Access Denied State
  if (isAccessDenied) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-3xl p-8 text-center max-w-xl mx-auto my-12 space-y-4">
        <ShieldAlert className="w-12 h-12 text-rose-600 mx-auto" />
        <h2 className="text-xl font-black text-rose-900">Access Restricted</h2>
        <p className="text-xs text-rose-700">
          Your account role does not have authorization to view the administrator executive dashboard.
          If you believe this is an error, contact your system administrator.
        </p>
        <div className="pt-2">
          <Link
            href="/admin/login"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-full transition-all"
          >
            Return to Login
          </Link>
        </div>
      </div>
    );
  }

  // Error State with Retry
  if (error && !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Admin Dashboard</h1>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>Unable to load dashboard data</span>
          </div>
          <p className="text-xs text-rose-700">{error}</p>
          <div className="pt-1">
            <button
              onClick={() => loadDashboard()}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2 rounded-full transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Request</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasFinancial = Boolean(data?.financial);
  const showFinancialWarning =
    data?.financialVerificationStatus && data.financialVerificationStatus !== 'PASS';

  const pendingQueueCount = data?.orders.pendingFulfillmentQueue ?? 0;
  const lowStockCount = data?.inventory.lowStockSkuCount ?? 0;

  return (
    <AdminPageAccess permission="dashboard.view" pageTitle="Executive Dashboard">
      <div className="space-y-6 sm:space-y-8">
        {/* Executive Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Store Operations Dashboard
              </h1>
              <span className="hidden sm:inline-flex text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0066CC] border border-blue-200">
                Live Overview
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-1.5">
              <span>Authoritative Backend Data</span>
              <span>&bull;</span>
              <span className="font-semibold text-[#0066CC]">Asia/Colombo (UTC+05:30)</span>
              {data && (
                <>
                  <span>&bull;</span>
                  <span className="text-slate-600 font-medium">
                    Reporting: {data.dateFrom} to {data.dateTo}
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Period Selector */}
            <div className="flex items-center bg-white border border-slate-200 rounded-2xl p-1 shadow-2xs">
              <button
                onClick={() => setPeriod('today')}
                disabled={isLoading}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  period === 'today'
                    ? 'bg-[#0066CC] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setPeriod('last7days')}
                disabled={isLoading}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  period === 'last7days'
                    ? 'bg-[#0066CC] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => setPeriod('last30days')}
                disabled={isLoading}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  period === 'last30days'
                    ? 'bg-[#0066CC] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                30 Days
              </button>
            </div>

            {/* Refresh Action */}
            <button
              onClick={() => loadDashboard(true)}
              disabled={isLoading || isRefreshing}
              title="Refresh dashboard metrics"
              className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-all shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 text-slate-600 ${isRefreshing ? 'animate-spin text-[#0066CC]' : ''}`}
              />
            </button>

            {/* Quick Action: New Product */}
            <Link
              href="/admin/products/new"
              className="bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-1.5"
            >
              <Package className="w-4 h-4 text-white" />
              <span>Add Product</span>
            </Link>
          </div>
        </div>

        {/* Operational Quick Action Hub (WettaPharma-inspired fast shortcuts) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Link
            href="/admin/orders"
            className="group p-3.5 bg-white hover:bg-blue-50/50 rounded-2xl border border-slate-200/90 hover:border-blue-300 transition-all shadow-2xs flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-blue-50 group-hover:bg-[#0066CC] text-[#0066CC] group-hover:text-white flex items-center justify-center transition-colors shrink-0">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block truncate group-hover:text-[#0066CC]">Orders Queue</span>
                <span className="text-[10px] text-slate-400 block truncate">Fulfillment & Shipping</span>
              </div>
            </div>
            {pendingQueueCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 shrink-0">
                {pendingQueueCount}
              </span>
            )}
          </Link>

          <Link
            href="/admin/payments/bank-transfers"
            className="group p-3.5 bg-white hover:bg-indigo-50/50 rounded-2xl border border-slate-200/90 hover:border-indigo-300 transition-all shadow-2xs flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white flex items-center justify-center transition-colors shrink-0">
                <FileCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block truncate group-hover:text-indigo-600">Bank Transfers</span>
                <span className="text-[10px] text-slate-400 block truncate">Verification Queue</span>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>

          <Link
            href="/admin/inventory"
            className="group p-3.5 bg-white hover:bg-rose-50/50 rounded-2xl border border-slate-200/90 hover:border-rose-300 transition-all shadow-2xs flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-rose-50 group-hover:bg-rose-600 text-rose-600 group-hover:text-white flex items-center justify-center transition-colors shrink-0">
                <Boxes className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block truncate group-hover:text-rose-600">Inventory Stock</span>
                <span className="text-[10px] text-slate-400 block truncate">Stock & Reorder</span>
              </div>
            </div>
            {lowStockCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 shrink-0">
                {lowStockCount} alert{lowStockCount > 1 ? 's' : ''}
              </span>
            )}
          </Link>

          <Link
            href="/admin/reports"
            className="group p-3.5 bg-white hover:bg-emerald-50/50 rounded-2xl border border-slate-200/90 hover:border-emerald-300 transition-all shadow-2xs flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 group-hover:bg-emerald-600 text-emerald-600 group-hover:text-white flex items-center justify-center transition-colors shrink-0">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block truncate group-hover:text-emerald-600">Sales Reports</span>
                <span className="text-[10px] text-slate-400 block truncate">Financial Metrics</span>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>

          <Link
            href="/admin/payments"
            className="group p-3.5 bg-white hover:bg-sky-50/50 rounded-2xl border border-slate-200/90 hover:border-sky-300 transition-all shadow-2xs col-span-2 sm:col-span-1 flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-sky-50 group-hover:bg-[#0066CC] text-[#0066CC] group-hover:text-white flex items-center justify-center transition-colors shrink-0">
                <CreditCard className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block truncate group-hover:text-[#0066CC]">Payments Portal</span>
                <span className="text-[10px] text-slate-400 block truncate">PayHere & COD</span>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#0066CC] group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>
        </div>

        {/* Unverified Financial Alert */}
        {showFinancialWarning && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-amber-900">
                Financial Reconciliation Notice ({data?.financialVerificationStatus})
              </h4>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Financial metrics are currently omitted because independent database reconciliation has
                not completed with a clean verification. Operational metrics below reflect live orders
                and warehouse inventory.
              </p>
            </div>
          </div>
        )}

        {/* Summary Metric Cards (Key Metrics Grid) */}
        {isLoading && !data ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs animate-pulse h-36"
              >
                <div className="h-4 bg-slate-100 rounded-md w-24 mb-4" />
                <div className="h-8 bg-slate-100 rounded-md w-32 mb-2" />
                <div className="h-3 bg-slate-100 rounded-md w-20" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* 1. Gross Sales (ADMIN & MANAGER only) */}
            {hasFinancial && data?.financial && (
              <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between hover:border-emerald-200 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Gross Sales
                  </span>
                  <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-lg font-black text-slate-900 block" title={formatLKR(data.financial.grossSalesCents)}>
                    {formatLKR(data.financial.grossSalesCents)}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                    <TrendingUp className="w-3 h-3" />
                    <span>{data.financial.paidOrdersCount} Paid Orders</span>
                  </span>
                </div>
              </div>
            )}

            {/* 2. Net Revenue (ADMIN & MANAGER only) */}
            {hasFinancial && data?.financial && (
              <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between hover:border-indigo-200 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Net Revenue
                  </span>
                  <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-lg font-black text-slate-900 block" title={formatLKR(data.financial.netRevenueCents)}>
                    {formatLKR(data.financial.netRevenueCents)}
                  </span>
                  <span className="text-[10px] text-indigo-600 font-bold mt-1 block">
                    Avg Order: {formatLKR(data.financial.averageOrderValueCents)}
                  </span>
                </div>
              </div>
            )}

            {/* 3. Total Orders (In selected period) */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between hover:border-blue-200 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Total Orders
                </span>
                <div className="w-9 h-9 rounded-2xl bg-blue-50 text-[#0066CC] flex items-center justify-center font-bold">
                  <ShoppingCart className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-slate-900 block">
                  {data?.orders.totalOrdersInPeriod ?? 0}
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block font-medium">
                  Created in selected period
                </span>
              </div>
            </div>

            {/* 4. Pending Fulfillment Queue (Live outstanding work across all time) */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between hover:border-amber-200 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Pending Queue
                </span>
                <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                  <Package className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-amber-600 block">
                  {pendingQueueCount}
                </span>
                <Link
                  href="/admin/orders"
                  className="text-[10px] font-bold text-[#0066CC] hover:underline mt-1 block flex items-center gap-1"
                >
                  <span>Process open queue</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* 5. Low Stock Alerts (Live inventory count) */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between hover:border-rose-200 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Low Stock SKUs
                </span>
                <div className="w-9 h-9 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-rose-600 block">
                  {lowStockCount}
                </span>
                <Link
                  href="/admin/inventory"
                  className="text-[10px] font-bold text-rose-700 hover:underline mt-1 block flex items-center gap-1"
                >
                  <span>Restock inventory</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* 6. Completed Refunds (ADMIN & MANAGER only) */}
            {hasFinancial && data?.financial && (
              <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between hover:border-purple-200 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Refunds
                  </span>
                  <div className="w-9 h-9 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                    <ArrowRight className="w-4 h-4 rotate-180" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-xl font-black text-purple-700 block truncate" title={formatLKR(data.financial.completedRefundsCents)}>
                    {formatLKR(data.financial.completedRefundsCents)}
                  </span>
                  <span className="text-[10px] text-purple-600 font-bold mt-1 block">
                    Completed in period
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Operational Section: Recent Orders (Left 7/8) + Action Feeds (Right 5/4) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Recent Orders Work Center */}
          <div className="lg:col-span-7 xl:col-span-8 bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-black text-slate-900">Recent Customer Orders</h2>
                <p className="text-xs text-slate-400">Authoritative incoming orders across all payment methods</p>
              </div>
              <Link
                href="/admin/orders"
                className="text-xs font-bold text-[#0066CC] hover:underline flex items-center gap-1"
              >
                <span>View all orders</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Fast Scanning Search & Filter Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Filter recent orders by # or customer..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50/50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:bg-white transition"
                />
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl shrink-0">
                {(['ALL', 'PENDING', 'CONFIRMED', 'DELIVERED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setOrderStatusFilter(st)}
                    className={`px-2.5 py-1 text-[10px] font-extrabold rounded-lg transition-all ${
                      orderStatusFilter === st
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {st === 'ALL' ? 'All' : st === 'CONFIRMED' ? 'Confirmed' : st === 'PENDING' ? 'Pending' : 'Delivered'}
                  </button>
                ))}
              </div>
            </div>

            {/* Orders Table Container */}
            {isLoading && !data ? (
              <div className="py-8 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-12 bg-slate-50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : filteredRecentOrders.length === 0 ? (
              <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">No matching orders found</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {orderSearch ? 'Try adjusting your search criteria.' : 'No recent orders match the selected filter.'}
                </p>
                {orderSearch && (
                  <button
                    onClick={() => {
                      setOrderSearch('');
                      setOrderStatusFilter('ALL');
                    }}
                    className="mt-3 text-xs font-bold text-[#0066CC] hover:underline"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto -mx-5 sm:mx-0">
                <table className="w-full text-left text-xs min-w-[580px]">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-100 text-[11px]">
                      <th className="pb-2.5 pl-5 sm:pl-0 pr-3 font-bold uppercase tracking-wider">Order</th>
                      <th className="pb-2.5 px-3 font-bold uppercase tracking-wider">Customer</th>
                      <th className="pb-2.5 px-3 font-bold uppercase tracking-wider">Fulfillment</th>
                      <th className="pb-2.5 px-3 font-bold uppercase tracking-wider">Payment</th>
                      {hasFinancial && <th className="pb-2.5 px-3 font-bold uppercase tracking-wider text-right">Total</th>}
                      <th className="pb-2.5 px-3 font-bold uppercase tracking-wider text-right">Date</th>
                      <th className="pb-2.5 pr-5 sm:pr-0 pl-3 font-bold uppercase tracking-wider text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRecentOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="py-3 pl-5 sm:pl-0 pr-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                          <Link href={`/admin/orders/${order.id}`} className="hover:text-[#0066CC]">
                            {order.orderNumber}
                          </Link>
                        </td>
                        <td className="py-3 px-3 text-slate-700 font-medium truncate max-w-36">
                          {order.customerName}
                        </td>
                        <td className="py-3 px-3">
                          <OrderStatusBadge status={order.orderStatus} size="sm" />
                        </td>
                        <td className="py-3 px-3">
                          <PaymentStatusBadge status={order.paymentStatus} size="sm" />
                        </td>
                        {hasFinancial && (
                          <td className="py-3 px-3 text-right font-black text-slate-900 whitespace-nowrap">
                            {order.totalCents !== undefined ? formatLKR(order.totalCents) : '—'}
                          </td>
                        )}
                        <td className="py-3 px-3 text-right text-[11px] text-slate-500 whitespace-nowrap">
                          {order.createdAtColombo}
                        </td>
                        <td className="py-3 pr-5 sm:pr-0 pl-3 text-right whitespace-nowrap">
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="inline-flex items-center gap-1 text-[#0066CC] hover:text-[#004d99] font-bold text-[11px] bg-blue-50/60 hover:bg-blue-100/60 px-2.5 py-1 rounded-lg transition"
                          >
                            <span>Manage</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right Column: Low Stock Alerts & Top Selling Stationery */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-6">
            {/* Low Stock Warning Box */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>Low Stock Warnings</span>
                </h2>
                <Link
                  href="/admin/inventory"
                  className="text-xs font-bold text-[#0066CC] hover:underline"
                >
                  Manage Stock →
                </Link>
              </div>

              {isLoading && !data ? (
                <div className="py-4 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 bg-slate-50 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : !data?.inventory.lowStockItems || data.inventory.lowStockItems.length === 0 ? (
                <div className="py-6 text-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                  <p className="text-xs text-emerald-800 font-bold">
                    All inventory stock healthy
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    No items currently below minimum replenishment thresholds.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {data.inventory.lowStockItems.map((item) => {
                    const isCritical = item.stockQuantity <= 2;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition-colors"
                      >
                        <div className="truncate max-w-[170px] sm:max-w-[200px]">
                          <span className="font-bold text-slate-800 block truncate" title={item.name}>
                            {item.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {item.sku} {item.isVariant ? '(Variant)' : ''}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span
                            className={`font-black text-[11px] px-2 py-0.5 rounded-md inline-block ${
                              isCritical
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {item.stockQuantity} left
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Min: {item.lowStockThreshold}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top Selling Products */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-[#0066CC] shrink-0" />
                  <span>Top Selling Stationery</span>
                </h2>
                <span className="text-[10px] text-slate-400 font-bold uppercase">
                  {period === 'today' ? 'Today' : period === 'last7days' ? 'Last 7d' : 'Last 30d'}
                </span>
              </div>

              {isLoading && !data ? (
                <div className="py-4 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 bg-slate-50 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : !data?.topSellingProducts || data.topSellingProducts.length === 0 ? (
                <div className="py-6 text-center">
                  <Package className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                  <p className="text-xs text-slate-400 font-medium">
                    No stationery sales recorded in this period.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 text-xs max-h-80 overflow-y-auto pr-1">
                  {data.topSellingProducts.map((p, idx) => (
                    <div
                      key={p.productId}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 truncate max-w-[180px] sm:max-w-[210px]">
                        <span className="text-[11px] font-black text-slate-400 w-4 text-center shrink-0">
                          #{idx + 1}
                        </span>
                        {p.image ? (
                          <img
                            src={p.image}
                            alt={p.name}
                            className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <Package className="w-4 h-4" />
                          </div>
                        )}
                        <div className="truncate">
                          <span className="text-slate-800 font-bold block truncate" title={p.name}>
                            {p.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{p.sku}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-extrabold text-[#0066CC] block">
                          {p.unitsSold} units
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium block">
                          {formatLKR(p.priceCents)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminPageAccess>
  );
}
