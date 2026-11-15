'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import {
  Scale,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RotateCcw,
  CreditCard,
  Building,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Loader2,
  FileSpreadsheet,
} from 'lucide-react';
import { formatLKR } from '@/lib/currency';
import { orderService } from '@/services/orderService';
import {
  ReconciliationItem,
  ReconciliationSummary,
  ReconciliationQueryParams,
  PaymentMethod,
} from '@/types/order';

function ReconciliationContent() {
  const [items, setItems] = useState<ReconciliationItem[]>([]);
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<string>('');
  const [refundStatus, setRefundStatus] = useState<string>('');
  const [hasDiscrepancy, setHasDiscrepancy] = useState<string>('all'); // 'all' | 'true' | 'false'
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const loadData = useCallback(
    async (targetPage = 1) => {
      setIsLoading(true);
      setError(null);

      const query: ReconciliationQueryParams = {
        page: targetPage,
        limit: 20,
      };
      if (search.trim()) query.search = search.trim();
      if (paymentMethod) query.paymentMethod = paymentMethod;
      if (paymentStatus) query.paymentStatus = paymentStatus;
      if (refundStatus) query.refundStatus = refundStatus;
      if (hasDiscrepancy === 'true') query.hasDiscrepancy = true;
      if (hasDiscrepancy === 'false') query.hasDiscrepancy = false;
      if (startDate) query.startDate = startDate;
      if (endDate) query.endDate = endDate;

      try {
        const res = await orderService.fetchFinancialReconciliation(query);
        if (res) {
          setItems(res.items);
          setPagination(res.pagination);
          setSummary(res.summary);
        } else {
          setError('Failed to load reconciliation records from backend API.');
        }
      } catch (err: any) {
        setError(err?.message || 'Error communicating with reconciliation service');
      } finally {
        setIsLoading(false);
      }
    },
    [search, paymentMethod, paymentStatus, refundStatus, hasDiscrepancy, startDate, endDate]
  );

  useEffect(() => {
    loadData(1);
  }, [loadData]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData(1);
  };

  const clearFilters = () => {
    setSearch('');
    setPaymentMethod('');
    setPaymentStatus('');
    setRefundStatus('');
    setHasDiscrepancy('all');
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="space-y-6 text-xs animate-fade-in">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#08275E]/10 text-[#08275E]">
              <Scale className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-slate-900">Financial Reconciliation</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative audit trail, verified collection matching &amp; discrepancy detection
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadData(pagination.page)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            Total Orders
          </span>
          <span className="text-xl font-black text-slate-900 mt-1 block">
            {summary ? summary.totalOrders : '—'}
          </span>
          <span className="text-[10px] text-slate-400">
            Total: {summary ? formatLKR(summary.totalOrderAmountCents) : '—'}
          </span>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            Verified Collections
          </span>
          <span className="text-xl font-black text-emerald-700 mt-1 block">
            {summary ? formatLKR(summary.totalVerifiedCollectedCents) : '—'}
          </span>
          <span className="text-[10px] text-slate-400">Proven funds collected</span>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            Completed Refunds
          </span>
          <span className="text-xl font-black text-slate-900 mt-1 block">
            {summary ? formatLKR(summary.totalCompletedRefundsCents) : '—'}
          </span>
          <span className="text-[10px] text-slate-400">Executed with evidence</span>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            Reserved / In-Flight
          </span>
          <span className="text-xl font-black text-amber-600 mt-1 block">
            {summary ? formatLKR(summary.totalReservedRefundsCents) : '—'}
          </span>
          <span className="text-[10px] text-slate-400">Encumbered balances</span>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-rose-600 block tracking-wider">
            Reconciliation Exceptions
          </span>
          <span className="text-xl font-black text-rose-600 mt-1 block">
            {summary ? summary.discrepancyCount : '—'}
          </span>
          <span className="text-[10px] text-slate-400">Requires audit review</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Order #, Payment Gateway Ref, or Refund Ref..."
              className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#08275E]"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2.5 rounded-2xl bg-[#08275E] hover:bg-[#103b8c] text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Filter
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              Clear
            </button>
          </div>
        </form>

        {/* Filter Selectors */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-slate-100">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none"
            >
              <option value="">All Methods</option>
              <option value="CARD_PAYHERE">PayHere Card</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CASH_ON_DELIVERY">Cash on Delivery</option>
              <option value="KOKO_BNPL">Koko BNPL</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Payment Status
            </label>
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none"
            >
              <option value="">All Payment Statuses</option>
              <option value="PAID">PAID</option>
              <option value="PENDING">PENDING</option>
              <option value="REFUNDED">REFUNDED</option>
              <option value="FAILED">FAILED</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Refund Lifecycle
            </label>
            <select
              value={refundStatus}
              onChange={(e) => setRefundStatus(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none"
            >
              <option value="">All Refund Statuses</option>
              <option value="REQUESTED">REQUESTED</option>
              <option value="APPROVED">APPROVED</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="FAILED">FAILED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Discrepancy Exception
            </label>
            <select
              value={hasDiscrepancy}
              onChange={(e) => setHasDiscrepancy(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none"
            >
              <option value="all">All Orders</option>
              <option value="true">Exceptions Only (!)</option>
              <option value="false">Balanced Orders Only</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Date Filter
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#08275E]" />
            <span>Auditing financial reconciliation records...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
            <h3 className="font-bold text-slate-900 text-sm">Failed to Load Records</h3>
            <p className="text-slate-500 max-w-sm mx-auto">{error}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Scale className="w-8 h-8 text-slate-300 mx-auto" />
            <h3 className="font-bold text-slate-800 text-sm">No Reconciliation Records Match</h3>
            <p className="text-slate-400 max-w-sm mx-auto">
              No orders found matching the specified search query or filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider font-bold border-b border-slate-200">
                  <th className="py-3 px-4">Order</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Method &amp; Status</th>
                  <th className="py-3 px-4 text-right">Order Total</th>
                  <th className="py-3 px-4 text-right">Verified Collected</th>
                  <th className="py-3 px-4 text-right">Completed Refund</th>
                  <th className="py-3 px-4 text-right">Reserved Refund</th>
                  <th className="py-3 px-4 text-center">Audit Audit State</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((row) => (
                  <tr
                    key={row.orderId}
                    className={`hover:bg-slate-50/60 transition-colors ${
                      row.hasDiscrepancy ? 'bg-rose-50/20' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/admin/orders/${row.orderId}`}
                        className="font-mono font-bold text-[#08275E] hover:underline block"
                      >
                        {row.orderNumber}
                      </Link>
                      <span className="text-[10px] text-slate-400">
                        {new Date(row.createdAt).toLocaleDateString()}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800 block">
                        {row.customerName}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        {row.customerEmail || 'Guest'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-700 uppercase block text-[11px]">
                        {row.paymentMethod.replace(/_/g, ' ')}
                      </span>
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block mt-0.5 border ${
                          row.paymentStatus === 'PAID'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : row.paymentStatus === 'REFUNDED'
                            ? 'bg-purple-50 text-purple-800 border-purple-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {row.paymentStatus}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right font-black text-slate-900 font-mono">
                      {formatLKR(row.totalCents)}
                    </td>

                    <td className="py-3.5 px-4 text-right font-black text-emerald-700 font-mono">
                      {formatLKR(row.verifiedCollectedCents)}
                      {row.paymentReferences.length > 0 && (
                        <span className="block text-[9px] text-slate-400 font-mono font-normal">
                          Ref: {row.paymentReferences[0]}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right font-black text-slate-900 font-mono">
                      {formatLKR(row.completedRefundsCents)}
                      {row.refundReferences.length > 0 && (
                        <span className="block text-[9px] text-slate-400 font-mono font-normal">
                          Ext: {row.refundReferences[0]}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right font-bold text-amber-700 font-mono">
                      {formatLKR(row.reservedRefundsCents)}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {row.hasDiscrepancy ? (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            <span>Discrepancy</span>
                          </span>
                          <div className="text-[10px] text-rose-800 text-left font-sans max-w-xs">
                            {row.discrepancies.map((d, i) => (
                              <div key={i}>• {d.split(':')[0]}</div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Balanced</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <Link
                        href={`/admin/orders/${row.orderId}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors"
                      >
                        <span>Audit</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <span className="text-slate-500 text-[11px]">
              Showing page <strong>{pagination.page}</strong> of{' '}
              <strong>{pagination.totalPages}</strong> ({pagination.total} total orders)
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => loadData(pagination.page - 1)}
                className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => loadData(pagination.page + 1)}
                className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminReconciliationPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-[#08275E]" />
          <span>Loading Financial Reconciliation Module...</span>
        </div>
      }
    >
      <ReconciliationContent />
    </Suspense>
  );
}
