'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  MapPin,
  Calendar,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Clock,
  Layers,
  CreditCard,
  Building,
  RotateCcw,
  Truck,
  FileSpreadsheet,
  FileText,
  HelpCircle,
} from 'lucide-react';
import { useUserStore } from '@/services/userStore';
import { reportService } from '@/services/reportService';
import {
  SalesReportResponse,
  ReportPeriod,
  ExportFormat,
} from '@/types/report';
import { formatLKR } from '@/lib/currency';
import { AdminPageAccess } from '@/components/admin/AdminPageAccess';

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function isValidCalendarDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (month < 1 || month > 12) return false;
  if (day < 1) return false;

  const daysInMonths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonths[month - 1];
}

export default function AdminReportsPage() {
  const hasPermission = useUserStore((state) => state.hasPermission);
  const currentUser = useUserStore((state) => state.currentUser);
  const isAuthorized = currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER' || (typeof hasPermission === 'function' && hasPermission('reports.view'));

  // Reporting query states
  const [period, setPeriod] = useState<ReportPeriod>('last30days');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [appliedCustomFrom, setAppliedCustomFrom] = useState('');
  const [appliedCustomTo, setAppliedCustomTo] = useState('');

  // Data states
  const [reportData, setReportData] = useState<SalesReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Tabular vs visual chart view toggle
  const [activeTab, setActiveTab] = useState<'chart' | 'table'>('chart');

  // Load report data from backend
  const loadReport = useCallback(async () => {
    if (!isAuthorized) return;
    setLoading(true);
    setError(null);
    setExportError(null);

    try {
      const data = await reportService.fetchSalesReport({
        period,
        dateFrom: period === 'custom' ? appliedCustomFrom : undefined,
        dateTo: period === 'custom' ? appliedCustomTo : undefined,
      });
      setReportData(data);
    } catch (err: any) {
      console.error('Failed to load report data:', err);
      setError(err?.message || 'Failed to retrieve authoritative report data from the backend.');
    } finally {
      setLoading(false);
    }
  }, [isAuthorized, period, appliedCustomFrom, appliedCustomTo]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handlePeriodChange = (newPeriod: ReportPeriod) => {
    setPeriod(newPeriod);
    if (newPeriod !== 'custom') {
      setAppliedCustomFrom('');
      setAppliedCustomTo('');
    }
  };

  const handleApplyCustomRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customFrom || !customTo) {
      setError('Both start date and end date are required for custom period.');
      return;
    }
    if (!isValidCalendarDate(customFrom) || !isValidCalendarDate(customTo)) {
      setError('Please enter valid calendar dates in YYYY-MM-DD format.');
      return;
    }
    if (customFrom > customTo) {
      setError('Start date cannot be after end date.');
      return;
    }
    const diffMs = new Date(customTo).getTime() - new Date(customFrom).getTime();
    const diffDays = Math.round(diffMs / (24 * 3600 * 1000)) + 1;
    if (diffDays > 366) {
      setError('Custom reporting period cannot exceed 366 days (1 year).');
      return;
    }
    setError(null);
    setAppliedCustomFrom(customFrom);
    setAppliedCustomTo(customTo);
  };

  const handleExport = async (format: ExportFormat) => {
    if (!isAuthorized) return;
    setExportingFormat(format);
    setExportError(null);

    try {
      await reportService.downloadReportFile(
        {
          period,
          dateFrom: period === 'custom' ? appliedCustomFrom : undefined,
          dateTo: period === 'custom' ? appliedCustomTo : undefined,
        },
        format
      );
    } catch (err: any) {
      console.error(`Export failed (${format}):`, err);
      setExportError(err?.message || `Failed to export ${format.toUpperCase()} report.`);
    } finally {
      setExportingFormat(null);
    }
  };

  // Max value in daily buckets for relative chart bar heights
  const maxDailySalesCents = useMemo(() => {
    if (!reportData?.dailySales || reportData.dailySales.length === 0) return 1;
    const maxVal = Math.max(...reportData.dailySales.map((d) => d.grossSalesCents));
    return maxVal > 0 ? maxVal : 1;
  }, [reportData]);

  // Authorization fallback
  if (!isAuthorized) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Financial &amp; Executive Reports
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative financial metrics and order performance grounded in PostgreSQL data.
          </p>
        </div>

        <div className="p-8 rounded-3xl bg-amber-50/70 border border-amber-200 text-center max-w-xl mx-auto space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
            <p className="text-xs text-slate-600 mt-1">
              Executive sales and financial reports contain sensitive business ledger information. Access is strictly restricted to Administrators and Managers.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const kpi = reportData?.kpi;
  const reconciliation = reportData?.reconciliation;
  const cancellation = reportData?.cancellationReconciliation;

  return (
    <AdminPageAccess permission="reports.view" pageTitle="Financial Reports">
      <div className="space-y-8 pb-12">
        {/* Page Header & Controls Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Financial &amp; Executive Reports
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <Clock className="w-3 h-3 text-blue-600" />
                <span>Asia/Colombo (+05:30)</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Authoritative financial metrics and order performance grounded in PostgreSQL ledger data.
            </p>
          </div>

          {/* Export & Refresh Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {(typeof hasPermission === 'function' ? hasPermission('reports.export') : isAuthorized) && (
              <>
                <button
                  onClick={() => handleExport('xlsx')}
                  disabled={loading || exportingFormat !== null}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-xs"
                  title="Download multi-worksheet XLSX report"
                >
                  {exportingFormat === 'xlsx' ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                  )}
                  <span>Export Excel</span>
                </button>

                <button
                  onClick={() => handleExport('csv')}
                  disabled={loading || exportingFormat !== null}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs"
                  title="Download sanitized CSV summary"
                >
                  {exportingFormat === 'csv' ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileText className="w-3.5 h-3.5" />
                  )}
                  <span>Export CSV</span>
                </button>
              </>
            )}

            <button
              onClick={loadReport}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 transition-colors"
              title="Refresh reporting ledger data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Date Range Selector Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 uppercase mr-1">Period:</span>
              {(
                [
                  { id: 'today', label: 'Today' },
                  { id: 'last7days', label: 'Last 7 Days' },
                  { id: 'last30days', label: 'Last 30 Days' },
                  { id: 'custom', label: 'Custom Range' },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  onClick={() => handlePeriodChange(p.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${period === p.id
                    ? 'bg-[#08275E] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {reportData && (
              <div className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  Active Window: <strong className="text-slate-800">{reportData.dateFrom}</strong> to{' '}
                  <strong className="text-slate-800">{reportData.dateTo}</strong> (Asia/Colombo)
                </span>
              </div>
            )}
          </div>

          {/* Custom Range Inputs */}
          {period === 'custom' && (
            <form
              onSubmit={handleApplyCustomRange}
              className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs"
            >
              <div className="flex items-center gap-2">
                <label htmlFor="custom-from" className="font-semibold text-slate-600">
                  From:
                </label>
                <input
                  id="custom-from"
                  type="text"
                  placeholder="YYYY-MM-DD"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  required
                  className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#08275E]"
                />
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="custom-to" className="font-semibold text-slate-600">
                  To:
                </label>
                <input
                  id="custom-to"
                  type="text"
                  placeholder="YYYY-MM-DD"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  required
                  className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#08275E]"
                />
              </div>

              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors"
              >
                Apply Filter
              </button>
            </form>
          )}

          {exportError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{exportError}</span>
            </div>
          )}
        </div>

        {/* Error state */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-medium flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={loadReport}
              className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700 transition-colors text-[11px]"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && !reportData && (
          <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-28 bg-slate-200 rounded-3xl" />
              ))}
            </div>
            <div className="h-64 bg-slate-200 rounded-3xl" />
          </div>
        )}

        {/* Report Content */}
        {reportData && kpi && (
          <div className="space-y-8">
            {/* Executive KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {/* Gross Sales */}
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Gross Sales
                </span>
                <div className="text-xl sm:text-2xl font-black text-[#08275E]">
                  {formatLKR(kpi.grossSalesCents)}
                </div>
                <span className="text-[11px] text-slate-500 font-medium block">
                  Captured non-cancelled orders
                </span>
              </div>

              {/* Net Revenue */}
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Net Revenue
                </span>
                <div
                  className={`text-xl sm:text-2xl font-black ${kpi.netRevenueCents >= 0 ? 'text-emerald-700' : 'text-rose-600'
                    }`}
                >
                  {formatLKR(kpi.netRevenueCents)}
                </div>
                <span className="text-[11px] text-slate-500 font-medium block">
                  Gross Sales - Sales Refunds
                </span>
              </div>

              {/* Completed Refunds */}
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Completed Refunds
                </span>
                <div className="text-xl sm:text-2xl font-black text-rose-600">
                  {formatLKR(kpi.totalRefundsCents)}
                </div>
                <span className="text-[11px] text-slate-500 font-medium block">
                  Sales: {formatLKR(kpi.salesEligibleRefundsCents)} | Cancel: {formatLKR(kpi.cancelledOrderRefundsCents)}
                </span>
              </div>

              {/* Average Order Value (Net AOV) */}
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Avg Order Value (Net AOV)
                </span>
                <div className="text-xl sm:text-2xl font-black text-slate-900">
                  {formatLKR(kpi.averageOrderValueCents)}
                </div>
                <span className="text-[11px] text-slate-500 font-medium block">
                  Net Revenue / {kpi.paidOrdersCount} paid orders (refunds deducted)
                </span>
              </div>

              {/* Orders Placed */}
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Orders Placed
                </span>
                <div className="text-xl sm:text-2xl font-black text-slate-900">
                  {kpi.totalOrdersCount}
                </div>
                <span className="text-[11px] text-slate-500 font-medium block">
                  {kpi.deliveredOrdersCount} Delivered | {kpi.cancelledOrdersCount} Cancelled
                </span>
              </div>

              {/* Cash on Delivery Collected */}
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  COD Collected
                </span>
                <div className="text-xl sm:text-2xl font-black text-amber-700">
                  {formatLKR(kpi.codCollectedCents)}
                </div>
                <span className="text-[11px] text-slate-500 font-medium block">
                  {kpi.codCollectedCount} delivered | {kpi.codPendingCount} pending
                </span>
              </div>
            </div>

            {/* Cancellation & Refund Reconciliation Section */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <RotateCcw className="w-5 h-5 text-[#08275E]" />
                    <h2 className="text-base font-bold text-slate-900">
                      Cancellation &amp; Refund Ledger Reconciliation
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Enforces separation between Sales-Eligible refunds and Cancelled-Order refunds to ensure mathematical integrity.
                  </p>
                  {cancellation?.cohortDescription && (
                    <p className="text-xs text-slate-600 mt-1.5 bg-slate-50 border border-slate-200/80 rounded-xl p-2.5">
                      <strong className="text-slate-800">Cohort:</strong> {cancellation.cohortDescription}
                      {cancellation.asOfTimestamp && (
                        <span className="text-slate-500 ml-2 block sm:inline">
                          (As of: {new Date(cancellation.asOfTimestamp).toLocaleString('en-GB', { timeZone: 'Asia/Colombo' })} Asia/Colombo)
                        </span>
                      )}
                    </p>
                  )}
                </div>

                {/* Status Verification Pills */}
                <div className="flex flex-wrap items-center gap-2">
                  {reconciliation?.independentVerification?.overallStatus && (
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${reconciliation.independentVerification.overallStatus === 'PASS'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : reconciliation.independentVerification.overallStatus === 'MISMATCH'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : reconciliation.independentVerification.overallStatus === 'INCONSISTENT_DATA'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                    >
                      {reconciliation.independentVerification.overallStatus === 'PASS' ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {reconciliation.independentVerification.overallStatus === 'PASS' && 'Independent Verification Passed'}
                        {reconciliation.independentVerification.overallStatus === 'MISMATCH' && 'Calculation Mismatch Detected'}
                        {reconciliation.independentVerification.overallStatus === 'INCONSISTENT_DATA' && 'Ledger Inconsistencies Detected'}
                        {reconciliation.independentVerification.overallStatus === 'NOT_VERIFIABLE' && 'Verification Unavailable'}
                      </span>
                    </span>
                  )}

                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${reconciliation?.isNetRevenueReconciled
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Net Revenue Reconciled</span>
                  </span>

                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${reconciliation?.isRefundsReconciled
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Refunds Reconciled</span>
                  </span>

                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${reconciliation?.isCancelledReconciled
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Cancelled Ledger Reconciled</span>
                  </span>
                </div>
              </div>

              {/* Reconciliation Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase block">
                    Cancelled-but-Paid Orders
                  </span>
                  <div className="text-lg font-black text-slate-900">
                    {cancellation?.cancelledPaidOrdersCount || 0} orders
                  </div>
                  <span className="text-[11px] text-slate-500 block">
                    Orders marked CANCELLED with captured payments
                  </span>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase block">
                    Cancelled Captured Payment
                  </span>
                  <div className="text-lg font-black text-slate-900">
                    {formatLKR(cancellation?.cancelledPaidCapturedCents || 0)}
                  </div>
                  <span className="text-[11px] text-slate-500 block">
                    Excluded from Gross Sales &amp; Net Revenue
                  </span>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase block">
                    Cancelled Completed Refunds
                  </span>
                  <div className="text-lg font-black text-emerald-700">
                    {formatLKR(cancellation?.cancelledPaidRefundedCents || 0)}
                  </div>
                  <span className="text-[11px] text-slate-500 block">
                    Authoritative RefundRecord (COMPLETED)
                  </span>
                </div>

                <div
                  className={`rounded-2xl p-4 border space-y-1 ${(cancellation?.cancelledPaidOutstandingCents || 0) > 0
                    ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                    : (cancellation?.cancelledPaidOutstandingCents || 0) < 0
                      ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                      : 'bg-slate-50 border-slate-200/80 text-slate-900'
                    }`}
                >
                  <span className="text-[11px] font-bold text-slate-500 uppercase block">
                    Outstanding Cancelled Balance
                  </span>
                  <div className="text-lg font-black">
                    {formatLKR(cancellation?.cancelledPaidOutstandingCents || 0)}
                  </div>
                  <span className="text-[11px] text-slate-500 block">
                    {(cancellation?.cancelledPaidOutstandingCents || 0) > 0
                      ? 'Pending refund liability to customers'
                      : (cancellation?.cancelledPaidOutstandingCents || 0) < 0
                        ? 'Warning: Total refunds exceed captured payments'
                        : 'Fully refunded with zero balance'}
                  </span>
                </div>
              </div>

              {/* Independent Verification Finding Alert Box */}
              {reconciliation?.independentVerification &&
                reconciliation.independentVerification.overallStatus !== 'PASS' && (
                  <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        Independent Verification Report: {reconciliation.independentVerification.overallStatus}
                      </span>
                    </div>
                    <div className="text-xs text-amber-700 space-y-1">
                      {reconciliation.independentVerification.grossSalesCheck?.status === 'MISMATCH' && (
                        <p>
                          Gross Sales mismatch: Report has {formatLKR(reconciliation.independentVerification.grossSalesCheck.sharedValueCents)} vs Independent Aggregate {formatLKR(reconciliation.independentVerification.grossSalesCheck.independentValueCents)} (Diff: {formatLKR(reconciliation.independentVerification.grossSalesCheck.differenceCents)})
                        </p>
                      )}
                      {reconciliation.independentVerification.netRevenueCheck?.status === 'MISMATCH' && (
                        <p>
                          Net Revenue mismatch: Report has {formatLKR(reconciliation.independentVerification.netRevenueCheck.sharedValueCents)} vs Independent Aggregate {formatLKR(reconciliation.independentVerification.netRevenueCheck.independentValueCents)} (Diff: {formatLKR(reconciliation.independentVerification.netRevenueCheck.differenceCents)})
                        </p>
                      )}
                      {reconciliation.independentVerification.salesRefundsCheck?.status === 'MISMATCH' && (
                        <p>
                          Sales Refunds mismatch: Report has {formatLKR(reconciliation.independentVerification.salesRefundsCheck.sharedValueCents)} vs Independent Aggregate {formatLKR(reconciliation.independentVerification.salesRefundsCheck.independentValueCents)} (Diff: {formatLKR(reconciliation.independentVerification.salesRefundsCheck.differenceCents)})
                        </p>
                      )}
                      {reconciliation.independentVerification.cancelledCohortCheck?.status === 'MISMATCH' && (
                        <p>
                          Cancelled Cohort captured or refund calculations differ between report and independent database aggregations.
                        </p>
                      )}
                    </div>
                  </div>
                )}

              {/* Inconsistencies Alert Box if any */}
              {reconciliation && reconciliation.inconsistencies.length > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Detected Financial Ledger Inconsistencies ({reconciliation.inconsistencies.length})</span>
                  </div>
                  <ul className="text-xs text-amber-700 space-y-1 list-disc pl-5">
                    {reconciliation.inconsistencies.map((item, idx) => (
                      <li key={idx}>
                        <strong>{item.code}:</strong> {item.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Daily Sales Performance Section */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#08275E]" />
                    <span>Daily Sales &amp; Revenue Trends</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Chronological calendar day buckets in Asia/Colombo (+05:30)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('chart')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${activeTab === 'chart'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    Visual Chart
                  </button>
                  <button
                    onClick={() => setActiveTab('table')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${activeTab === 'table'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    Tabular Ledger
                  </button>
                </div>
              </div>

              {activeTab === 'chart' ? (
                <div className="space-y-4">
                  {/* Visual Bar Chart */}
                  <div className="h-64 flex items-end gap-2 sm:gap-3 pt-8 pb-4 px-2 border-b border-slate-100 overflow-x-auto">
                    {reportData.dailySales.map((day) => {
                      const grossHeight = Math.max(
                        4,
                        Math.round((day.grossSalesCents / maxDailySalesCents) * 100)
                      );
                      const netHeight = Math.max(
                        4,
                        Math.round((Math.max(0, day.netRevenueCents) / maxDailySalesCents) * 100)
                      );

                      return (
                        <div
                          key={day.date}
                          className="flex-1 min-w-[36px] max-w-[50px] flex flex-col items-center gap-1.5 group relative"
                        >
                          {/* Hover Tooltip */}
                          <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col bg-slate-900 text-white text-[11px] rounded-xl p-2.5 z-20 whitespace-nowrap shadow-lg">
                            <span className="font-bold text-slate-300">{day.date}</span>
                            <span>Gross: {formatLKR(day.grossSalesCents)}</span>
                            <span>Refunds: {formatLKR(day.refundsCents)}</span>
                            <span className="text-emerald-400 font-semibold">
                              Net: {formatLKR(day.netRevenueCents)}
                            </span>
                            <span className="text-slate-400">
                              {day.paidOrderCount} paid / {day.orderCount} total orders
                            </span>
                          </div>

                          {/* Bar pair */}
                          <div className="w-full h-44 flex items-end justify-center gap-1">
                            <div
                              className="w-1/2 bg-[#08275E] rounded-t-sm transition-all hover:bg-blue-800"
                              style={{ height: `${grossHeight}%` }}
                              title={`Gross: ${formatLKR(day.grossSalesCents)}`}
                            />
                            <div
                              className="w-1/2 bg-emerald-600 rounded-t-sm transition-all hover:bg-emerald-700"
                              style={{ height: `${netHeight}%` }}
                              title={`Net: ${formatLKR(day.netRevenueCents)}`}
                            />
                          </div>

                          {/* Date label */}
                          <span className="text-[10px] text-slate-400 font-medium rotate-[-45deg] origin-top-left mt-2 block">
                            {day.date.slice(5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-center gap-6 text-xs text-slate-600 pt-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 bg-[#08275E] rounded-xs" />
                      <span>Gross Sales</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 bg-emerald-600 rounded-xs" />
                      <span>Net Revenue</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Tabular View */
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Date (Colombo)</th>
                        <th className="py-2.5 px-3 text-right">Gross Sales</th>
                        <th className="py-2.5 px-3 text-right">Refunds</th>
                        <th className="py-2.5 px-3 text-right">Net Revenue</th>
                        <th className="py-2.5 px-3 text-center">Paid Orders</th>
                        <th className="py-2.5 px-3 text-center">Total Orders</th>
                        <th className="py-2.5 px-3 text-right">Daily AOV</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportData.dailySales.map((d) => (
                        <tr key={d.date} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 font-semibold text-slate-800">{d.date}</td>
                          <td className="py-2.5 px-3 text-right font-medium text-slate-900">
                            {formatLKR(d.grossSalesCents)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-rose-600">
                            {d.refundsCents > 0 ? `-${formatLKR(d.refundsCents)}` : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                            {formatLKR(d.netRevenueCents)}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-700">{d.paidOrderCount}</td>
                          <td className="py-2.5 px-3 text-center text-slate-500">{d.orderCount}</td>
                          <td className="py-2.5 px-3 text-right text-slate-700">
                            {formatLKR(d.averageOrderValueCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Breakdown Distributions Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Payment Method Distribution */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#08275E]" />
                  <span>Payment Method Distribution</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Grounded in non-cancelled captured order payments
                </p>

                <div className="space-y-4 pt-2">
                  {reportData.paymentMethods.map((pm) => (
                    <div key={pm.method} className="space-y-1.5 text-xs">
                      <div className="flex justify-between items-center font-semibold">
                        <span className="text-slate-800">{pm.name}</span>
                        <div className="text-right">
                          <span className="text-slate-900 font-bold">{formatLKR(pm.totalCents)}</span>
                          <span className="text-slate-400 text-[11px] ml-1.5">
                            ({pm.count} orders, {pm.percentage}%)
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#08275E] rounded-full transition-all"
                          style={{ width: `${pm.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Regional District Distribution */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#08275E]" />
                  <span>Sri Lankan District Distribution</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Extracted from OrderAddressSnapshot shipping records
                </p>

                <div className="space-y-4 pt-2 max-h-80 overflow-y-auto pr-1">
                  {reportData.districtDistribution.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No qualifying orders in this period.</p>
                  ) : (
                    reportData.districtDistribution.map((dist) => (
                      <div key={dist.district} className="space-y-1.5 text-xs">
                        <div className="flex justify-between items-center font-semibold">
                          <span className="text-slate-800">{dist.district}</span>
                          <div className="text-right">
                            <span className="text-slate-900 font-bold">{formatLKR(dist.totalCents)}</span>
                            <span className="text-slate-400 text-[11px] ml-1.5">
                              ({dist.count} orders, {dist.percentage}%)
                            </span>
                          </div>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-600 rounded-full transition-all"
                            style={{ width: `${dist.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Order Status Lifecycle Breakdown */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#08275E]" />
                <span>Order Status Lifecycle Breakdown</span>
              </h2>
              <p className="text-xs text-slate-500">
                Distribution of all orders placed within the active reporting window
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-2">
                {reportData.orderStatuses.map((st) => (
                  <div
                    key={st.status}
                    className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/70 text-center space-y-1"
                  >
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                      {st.name}
                    </span>
                    <div className="text-lg font-black text-slate-900">{st.count}</div>
                    <span className="text-[10px] text-slate-500 block">
                      {formatLKR(st.totalCents)} ({st.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Orders in Period */}
            {reportData.recentOrders && reportData.recentOrders.length > 0 && (
              <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-[#08275E]" />
                  <span>Recent Qualifying Orders</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Latest orders created in this reporting period
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Order Number</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">District</th>
                        <th className="py-2.5 px-3 text-right">Total Amount</th>
                        <th className="py-2.5 px-3 text-center">Payment Status</th>
                        <th className="py-2.5 px-3 text-center">Order Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportData.recentOrders.slice(0, 10).map((ord) => (
                        <tr key={ord.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 font-bold text-blue-700">
                            <Link href={`/admin/orders/${ord.id}`} className="hover:underline">
                              {ord.orderNumber}
                            </Link>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">
                            {ord.createdAt.slice(0, 10)}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {ord.customerName}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{ord.district}</td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-900">
                            {formatLKR(ord.totalCents)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ord.paymentStatus === 'PAID'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : ord.paymentStatus === 'REFUNDED'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                            >
                              {ord.paymentStatus}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {ord.orderStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminPageAccess>
  );
}
