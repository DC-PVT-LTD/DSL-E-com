'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  CreditCard,
  Building2,
  Truck,
  Download,
  Search,
  Filter,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  DollarSign,
  TrendingUp,
  FileText,
  X,
  ShieldCheck,
  Scale,
  Calendar,
} from 'lucide-react';
import {
  paymentsService,
  PaymentsSummary,
  PaymentTransactionItem,
  PaymentMethod,
  PaymentStatus,
  OrderStatus,
  PaymentsDashboardQueryParams,
  PaymentsReconciliationReport,
} from '@/services/paymentsService';
import { formatLKR } from '@/lib/currency';
import { useUserStore } from '@/services/userStore';
import Link from 'next/link';
import { AdminPageAccess } from '@/components/admin/AdminPageAccess';

function AdminPaymentsDashboardContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentUser = useUserStore((state) => state.currentUser);
  const isManagerOrAdmin =
    currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER';

  // URL state
  const initialPage = Number(searchParams.get('page')) || 1;
  const initialLimit = Number(searchParams.get('limit')) || 20;
  const initialSearch = searchParams.get('search') || '';
  const initialMethod = (searchParams.get('paymentMethod') as PaymentMethod | 'ALL') || 'ALL';
  const initialPaymentStatus = (searchParams.get('paymentStatus') as PaymentStatus | 'ALL') || 'ALL';
  const initialOrderStatus = (searchParams.get('orderStatus') as OrderStatus | 'ALL') || 'ALL';
  const initialDateFrom = searchParams.get('dateFrom') || '';
  const initialDateTo = searchParams.get('dateTo') || '';
  const initialSortBy = (searchParams.get('sortBy') as any) || 'createdAt';
  const initialSortOrder = (searchParams.get('sortOrder') as any) || 'desc';

  const [page, setPage] = useState(initialPage);
  const [limit] = useState(initialLimit);
  const [search, setSearch] = useState(initialSearch);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | 'ALL'>(initialMethod);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | 'ALL'>(initialPaymentStatus);
  const [orderStatus, setOrderStatus] = useState<OrderStatus | 'ALL'>(initialOrderStatus);
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const [sortBy, setSortBy] = useState<'createdAt' | 'totalAmountCents' | 'paidAt'>(initialSortBy);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialSortOrder);

  const [summary, setSummary] = useState<PaymentsSummary | null>(null);
  const [transactions, setTransactions] = useState<PaymentTransactionItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected Transaction for Drawer
  const [selectedTx, setSelectedTx] = useState<PaymentTransactionItem | null>(null);

  // Reconciliation check
  const [reconciliation, setReconciliation] = useState<PaymentsReconciliationReport | null>(null);
  const [isReconLoading, setIsReconLoading] = useState(false);
  const [showReconModal, setShowReconModal] = useState(false);

  // Sync URL
  const syncUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', String(page));
    if (search) params.set('search', search);
    if (paymentMethod !== 'ALL') params.set('paymentMethod', paymentMethod);
    if (paymentStatus !== 'ALL') params.set('paymentStatus', paymentStatus);
    if (orderStatus !== 'ALL') params.set('orderStatus', orderStatus);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (sortBy !== 'createdAt') params.set('sortBy', sortBy);
    if (sortOrder !== 'desc') params.set('sortOrder', sortOrder);

    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [
    page,
    search,
    paymentMethod,
    paymentStatus,
    orderStatus,
    dateFrom,
    dateTo,
    sortBy,
    sortOrder,
    pathname,
    router,
  ]);

  // Load Summary
  const loadSummary = useCallback(async () => {
    setIsSummaryLoading(true);
    try {
      const data = await paymentsService.getSummary({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setSummary(data);
    } catch (err) {
      console.warn('Could not load payments summary:', err);
    } finally {
      setIsSummaryLoading(false);
    }
  }, [dateFrom, dateTo]);

  // Load Transactions
  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await paymentsService.getTransactions({
        page,
        limit,
        search: search.trim() || undefined,
        paymentMethod,
        paymentStatus,
        orderStatus,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy,
        sortOrder,
      });
      setTransactions(res.data);
      setTotalItems(res.meta?.totalItems ?? res.data.length);
      setTotalPages(res.meta?.totalPages ?? 1);
    } catch (err: any) {
      setError(err?.message || 'Failed to load payments transactions');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, paymentMethod, paymentStatus, orderStatus, dateFrom, dateTo, sortBy, sortOrder]);

  useEffect(() => {
    loadSummary();
    loadTransactions();
    syncUrl();
  }, [loadSummary, loadTransactions, syncUrl]);

  // CSV Export
  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      await paymentsService.downloadCsvExport({
        search: search.trim() || undefined,
        paymentMethod,
        paymentStatus,
        orderStatus,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy,
        sortOrder,
      });
    } catch (err: any) {
      alert(err?.message || 'CSV export failed');
    } finally {
      setIsExporting(false);
    }
  };

  // Run Consistency Checker
  const handleRunReconciliation = async () => {
    setIsReconLoading(true);
    setShowReconModal(true);
    try {
      const report = await paymentsService.getReconciliationReport();
      setReconciliation(report);
    } catch (err: any) {
      alert(err?.message || 'Failed to run consistency check');
    } finally {
      setIsReconLoading(false);
    }
  };

  const getMethodBadge = (m: PaymentMethod) => {
    switch (m) {
      case 'BANK_TRANSFER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#0066CC] border border-blue-200">
            <Building2 className="w-3 h-3" />
            <span>Bank Transfer</span>
          </span>
        );
      case 'CARD_PAYHERE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <CreditCard className="w-3 h-3" />
            <span>PayHere Card</span>
          </span>
        );
      case 'CASH_ON_DELIVERY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Truck className="w-3 h-3" />
            <span>Cash on Delivery</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
            {m}
          </span>
        );
    }
  };

  const getPaymentStatusBadge = (s: PaymentStatus) => {
    switch (s) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            <span>PAID</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3" />
            <span>FAILED</span>
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" />
            <span>PENDING</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
            {s}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-[#0066CC]/10 text-[#0066CC]">
              <CreditCard className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Payments & Transactions
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Stage 3.4 — Consolidated multi-channel payment reconciliation across PayHere, Bank
            Transfers, and COD.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRunReconciliation}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="Run financial consistency diagnostics"
          >
            <Scale className="w-3.5 h-3.5 text-[#0066CC]" />
            <span>Consistency Check</span>
          </button>

          {isManagerOrAdmin && (
            <button
              onClick={handleExportCsv}
              disabled={isExporting || isLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              title="Export filtered transactions as RFC-4180 CSV"
            >
              <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
              <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
            </button>
          )}

          <button
            onClick={() => {
              loadSummary();
              loadTransactions();
            }}
            disabled={isLoading || isSummaryLoading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Collected */}
        <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Paid Volume</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {isSummaryLoading ? '...' : formatLKR(summary?.totalPaidVolumeCents || 0)}
          </div>
          <div className="text-[11px] text-slate-500">
            {summary?.totalTransactions || 0} total lifetime transactions
          </div>
        </div>

        {/* Bank Transfers */}
        <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-[#0066CC]" />
              <span>Bank Transfers</span>
            </span>
            <Link
              href="/admin/payments/bank-transfers"
              className="text-[10px] font-bold text-[#0066CC] hover:underline"
            >
              Open Queue →
            </Link>
          </div>
          <div className="text-2xl font-black text-[#0066CC]">
            {isSummaryLoading ? '...' : summary?.bankTransfers?.pending || 0}
            <span className="text-xs font-normal text-slate-400 ml-1">pending</span>
          </div>
          <div className="text-[11px] text-slate-500 flex justify-between">
            <span>Verified: {summary?.bankTransfers?.verified || 0}</span>
            <span>Rejected: {summary?.bankTransfers?.rejected || 0}</span>
          </div>
        </div>

        {/* PayHere Card Payments */}
        <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
              <span>PayHere Cards</span>
            </span>
          </div>
          <div className="text-2xl font-black text-indigo-900">
            {isSummaryLoading ? '...' : summary?.payhereCards?.succeeded || 0}
            <span className="text-xs font-normal text-slate-400 ml-1">succeeded</span>
          </div>
          <div className="text-[11px] text-slate-500 flex justify-between">
            <span>Volume: {formatLKR(summary?.payhereCards?.totalVolumeCents || 0)}</span>
            <span className="text-rose-600">Failed: {summary?.payhereCards?.failed || 0}</span>
          </div>
        </div>

        {/* Cash On Delivery */}
        <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
              <Truck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Cash on Delivery</span>
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-900">
            {isSummaryLoading ? '...' : summary?.cashOnDelivery?.pendingCollection || 0}
            <span className="text-xs font-normal text-slate-400 ml-1">pending dispatch</span>
          </div>
          <div className="text-[11px] text-slate-500 flex justify-between">
            <span>Collected: {summary?.cashOnDelivery?.deliveredPaid || 0}</span>
            <span>{formatLKR(summary?.cashOnDelivery?.totalVolumeCents || 0)}</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search order #, customer name/email..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
            />
          </div>

          {/* Payment Method */}
          <div>
            <select
              value={paymentMethod}
              onChange={(e) => {
                setPaymentMethod(e.target.value as any);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#0066CC] bg-white text-slate-700"
            >
              <option value="ALL">All Methods</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CARD_PAYHERE">PayHere Card</option>
              <option value="CASH_ON_DELIVERY">Cash on Delivery</option>
            </select>
          </div>

          {/* Payment Status */}
          <div>
            <select
              value={paymentStatus}
              onChange={(e) => {
                setPaymentStatus(e.target.value as any);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#0066CC] bg-white text-slate-700"
            >
              <option value="ALL">All Payment Statuses</option>
              <option value="PAID">PAID</option>
              <option value="PENDING">PENDING</option>
              <option value="FAILED">FAILED</option>
            </select>
          </div>

          {/* Date From */}
          <div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              title="From date"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#0066CC] bg-white text-slate-700"
            />
          </div>

          {/* Date To */}
          <div>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              title="To date"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#0066CC] bg-white text-slate-700"
            />
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-100 text-[10px]">
              <tr>
                <th className="py-3 px-4">Order #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Payment Status</th>
                <th className="py-3 px-4">Order Status</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#0066CC]" />
                    <span>Loading payment transactions...</span>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No transactions found for the specified filters.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className={`hover:bg-blue-50/40 transition-colors ${selectedTx?.id === tx.id ? 'bg-blue-50/60' : ''
                      }`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-[#0066CC]">
                      {tx.orderNumber}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800">{tx.customerName}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[130px]">
                        {tx.customerEmail}
                      </div>
                    </td>
                    <td className="py-3 px-4">{getMethodBadge(tx.paymentMethod)}</td>
                    <td className="py-3 px-4 font-black text-slate-900">
                      {formatLKR(tx.totalAmountCents)}
                    </td>
                    <td className="py-3 px-4">{getPaymentStatusBadge(tx.paymentStatus)}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {tx.orderStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedTx(tx)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing Page {page} of {totalPages} ({totalItems} transactions)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Inspection Drawer */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl overflow-y-auto flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 sticky top-0 z-10 backdrop-blur-md">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Transaction Audit Record
                </span>
                <h2 className="text-lg font-black text-slate-900">
                  Order #{selectedTx.orderNumber}
                </h2>
              </div>
              <button
                onClick={() => setSelectedTx(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200/60 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1 text-xs">
              {/* Core Financial Snapshot */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                  <span className="text-slate-500">Payment Status:</span>
                  {getPaymentStatusBadge(selectedTx.paymentStatus)}
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                  <span className="text-slate-500">Order Status:</span>
                  <span className="font-bold text-slate-800">{selectedTx.orderStatus}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                  <span className="text-slate-500">Total Payable:</span>
                  <span className="font-black text-base text-[#0066CC]">
                    {formatLKR(selectedTx.totalAmountCents)}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                  <span className="text-slate-500">Payment Channel:</span>
                  {getMethodBadge(selectedTx.paymentMethod)}
                </div>
                {selectedTx.paidAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Settled At:</span>
                    <span className="font-medium text-slate-700">
                      {new Date(selectedTx.paidAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Customer Info */}
              <div className="p-4 bg-white rounded-2xl border border-slate-100 space-y-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Customer Record
                </h3>
                <div className="text-slate-700 space-y-1">
                  <div>Name: <strong>{selectedTx.customerName}</strong></div>
                  <div>Email: {selectedTx.customerEmail}</div>
                  {selectedTx.customerPhone && <div>Phone: {selectedTx.customerPhone}</div>}
                </div>
              </div>

              {/* Bank Transfer Details (if applicable) */}
              {selectedTx.paymentMethod === 'BANK_TRANSFER' && (
                <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-100 space-y-3">
                  <h3 className="text-xs font-bold text-[#0066CC] uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-4 h-4" />
                    <span>Bank Transfer Details</span>
                  </h3>
                  {selectedTx.bankTransferDetails ? (
                    <div className="space-y-2 text-slate-700">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Submission Status:</span>
                        <strong className="text-slate-900">{selectedTx.bankTransferDetails.status}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Reference:</span>
                        <span className="font-mono font-bold text-slate-900">
                          {selectedTx.bankTransferDetails.referenceNumber || 'None'}
                        </span>
                      </div>
                      {selectedTx.bankTransferDetails.depositDate && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Deposit Date:</span>
                          <span>{selectedTx.bankTransferDetails.depositDate}</span>
                        </div>
                      )}
                      {selectedTx.bankTransferDetails.rejectionReason && (
                        <div className="pt-2 text-rose-700 font-medium">
                          Rejection Reason: {selectedTx.bankTransferDetails.rejectionReason}
                        </div>
                      )}

                      {/* Manager/Admin review shortcut */}
                      {isManagerOrAdmin && (
                        <div className="pt-2">
                          <Link
                            href={`/admin/payments/bank-transfers?search=${selectedTx.orderNumber}`}
                            className="inline-flex items-center gap-1 text-xs font-bold text-[#0066CC] hover:underline"
                          >
                            <span>Open In Bank Review Queue →</span>
                          </Link>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-slate-400 italic">No deposit slip submitted yet.</p>
                  )}
                </div>
              )}

              {/* Gateway attempt info */}
              {selectedTx.latestPaymentAttempt && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Latest Payment Attempt
                  </h3>
                  <div className="text-slate-600 space-y-1">
                    <div>Attempt Status: <strong className="text-slate-800">{selectedTx.latestPaymentAttempt.status}</strong></div>
                    {selectedTx.latestPaymentAttempt.gatewayRef && (
                      <div className="font-mono text-[11px]">
                        Ref: {selectedTx.latestPaymentAttempt.gatewayRef}
                      </div>
                    )}
                    <div className="text-[11px] text-slate-400">
                      Logged at: {new Date(selectedTx.latestPaymentAttempt.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Consistency Checker Modal (Stage 3.5) */}
      {showReconModal && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-[#0066CC]" />
                <h3 className="text-base font-black text-slate-900">
                  Financial Consistency Diagnostics
                </h3>
              </div>
              <button
                onClick={() => setShowReconModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isReconLoading ? (
              <div className="py-12 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#0066CC]" />
                <span>Running diagnostic consistency checks...</span>
              </div>
            ) : reconciliation ? (
              <div className="space-y-4 text-xs">
                <div
                  className={`p-4 rounded-2xl flex items-start gap-3 ${reconciliation.summary.healthy
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border border-rose-200 text-rose-900'
                    }`}
                >
                  {reconciliation.summary.healthy ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className="font-bold">
                      {reconciliation.summary.healthy
                        ? 'Payment Ledger State: Healthy & Consistent'
                        : `${reconciliation.summary.totalAnomalies} Anomalies Detected in Orders`}
                    </h4>
                    <p className="text-[11px] mt-0.5">
                      Audited {reconciliation.summary.totalCheckedOrders} orders across all payment
                      channels.
                    </p>
                  </div>
                </div>

                {reconciliation.anomalies.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                      Flagged Discrepancies
                    </h4>
                    {reconciliation.anomalies.map((a, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] space-y-1"
                      >
                        <div className="flex justify-between font-bold text-slate-800">
                          <span>{a.orderNumber}</span>
                          <span className="text-rose-600">{a.type}</span>
                        </div>
                        <p className="text-slate-600">{a.details}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="text-[11px] text-slate-400 text-right">
                  Audited at {new Date(reconciliation.checkedAt).toLocaleString()}
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowReconModal(false)}
                className="px-5 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPaymentsPage() {
  return (
    <AdminPageAccess permission="orders.view" pageTitle="Payments Dashboard">
      <Suspense
        fallback={
          <div className="p-12 text-center text-xs text-slate-400">
            Loading payments dashboard...
          </div>
        }
      >
        <AdminPaymentsDashboardContent />
      </Suspense>
    </AdminPageAccess>
  );
}
