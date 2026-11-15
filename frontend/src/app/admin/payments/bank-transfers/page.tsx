'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  FileCheck,
  Search,
  Filter,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Building2,
  ExternalLink,
  ChevronRight,
  User,
  Calendar,
  DollarSign,
  ArrowUpDown,
  X,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import {
  paymentsService,
  BankTransferQueueItem,
  BankTransferDetailItem,
  BankDepositStatus,
  RejectionCategory,
  REJECTION_CATEGORY_LABELS,
} from '@/services/paymentsService';
import { formatLKR } from '@/lib/currency';
import { useUserStore } from '@/services/userStore';

function BankTransfersQueueContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentUser = useUserStore((state) => state.currentUser);
  const isManagerOrAdmin =
    currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER';

  // URL state
  const initialPage = Number(searchParams.get('page')) || 1;
  const initialLimit = Number(searchParams.get('limit')) || 20;
  const initialStatus = (searchParams.get('status') as BankDepositStatus | 'ALL') || 'ALL';
  const initialSearch = searchParams.get('search') || '';
  const initialDateFrom = searchParams.get('dateFrom') || '';
  const initialDateTo = searchParams.get('dateTo') || '';
  const initialSortBy = (searchParams.get('sortBy') as any) || 'createdAt';
  const initialSortOrder = (searchParams.get('sortOrder') as any) || 'desc';

  const [page, setPage] = useState(initialPage);
  const [limit] = useState(initialLimit);
  const [status, setStatus] = useState<BankDepositStatus | 'ALL'>(initialStatus);
  const [search, setSearch] = useState(initialSearch);
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const [sortBy, setSortBy] = useState<'createdAt' | 'amountCents' | 'depositDate'>(initialSortBy);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialSortOrder);

  const [submissions, setSubmissions] = useState<BankTransferQueueItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected for Drawer
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<BankTransferDetailItem | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // Modals inside Drawer
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionCategory, setRejectionCategory] = useState<RejectionCategory>('REFERENCE_NOT_FOUND');
  const [rejectionExplanation, setRejectionExplanation] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Sync URL
  const syncUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', String(page));
    if (status !== 'ALL') params.set('status', status);
    if (search) params.set('search', search);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (sortBy !== 'createdAt') params.set('sortBy', sortBy);
    if (sortOrder !== 'desc') params.set('sortOrder', sortOrder);

    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [page, status, search, dateFrom, dateTo, sortBy, sortOrder, pathname, router]);

  // Load Submissions
  const loadSubmissions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await paymentsService.getBankTransfers({
        page,
        limit,
        status,
        search: search.trim() || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy,
        sortOrder,
      });
      setSubmissions(res.data);
      setTotalItems(res.meta?.totalItems ?? res.data.length);
      setTotalPages(res.meta?.totalPages ?? 1);
    } catch (err: any) {
      setError(err?.message || 'Failed to load Bank Transfer submissions');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, status, search, dateFrom, dateTo, sortBy, sortOrder]);

  useEffect(() => {
    loadSubmissions();
    syncUrl();
  }, [loadSubmissions, syncUrl]);

  // Load Details when selected
  useEffect(() => {
    if (!selectedId) {
      setDetailItem(null);
      return;
    }
    let active = true;
    setIsDetailLoading(true);
    paymentsService
      .getBankTransferDetails(selectedId)
      .then((data) => {
        if (active) setDetailItem(data);
      })
      .catch((err) => {
        if (active) setError(err?.message || 'Failed to fetch transfer details');
      })
      .finally(() => {
        if (active) setIsDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  const handleApprove = async () => {
    if (!selectedId) return;
    setIsSubmittingAction(true);
    try {
      await paymentsService.approveBankTransfer(selectedId, {
        adminNotes: adminNotes.trim() || undefined,
      });
      setActionSuccessMsg('Bank transfer verified successfully! Order is now confirmed.');
      setIsApproveModalOpen(false);
      setAdminNotes('');
      // Reload details and list
      const updated = await paymentsService.getBankTransferDetails(selectedId);
      setDetailItem(updated);
      loadSubmissions();
    } catch (err: any) {
      alert(err?.message || 'Failed to approve bank transfer');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleReject = async () => {
    if (!selectedId) return;
    if (!rejectionExplanation.trim()) {
      alert('Please provide a specific explanation for the rejection.');
      return;
    }
    setIsSubmittingAction(true);
    try {
      const res = await paymentsService.rejectBankTransfer(selectedId, {
        category: rejectionCategory,
        explanation: rejectionExplanation.trim(),
      });
      setActionSuccessMsg(
        `Bank transfer rejected. ${res.stockRestored ? 'Stock has been automatically restored.' : ''}`
      );
      setIsRejectModalOpen(false);
      setRejectionExplanation('');
      // Reload details and list
      const updated = await paymentsService.getBankTransferDetails(selectedId);
      setDetailItem(updated);
      loadSubmissions();
    } catch (err: any) {
      alert(err?.message || 'Failed to reject bank transfer');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const receiptUrl = selectedId ? paymentsService.getReceiptFileUrl(selectedId) : '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-[#0066CC]/10 text-[#0066CC]">
              <FileCheck className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Bank Transfers Review Queue
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Stage 3.3 — Verification of customer deposit slips against corporate bank statements.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadSubmissions()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* Non-Manager/Admin Notice */}
      {!isManagerOrAdmin && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 text-xs">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Read-Only Staff Mode:</span> You have view-only access to order
            payment statuses. Only accounts team members with <strong>MANAGER</strong> or{' '}
            <strong>ADMIN</strong> roles are authorized to inspect receipt files, verify, or reject
            submissions.
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
              placeholder="Search by order #, ref, customer name..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as any);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#0066CC] bg-white text-slate-700"
            >
              <option value="ALL">All Deposit States</option>
              <option value="PENDING">Pending Verification</option>
              <option value="VERIFIED">Verified (Approved)</option>
              <option value="REJECTED">Rejected</option>
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

        {/* Active Filter Pills */}
        {(status !== 'ALL' || search || dateFrom || dateTo) && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-400">Filters:</span>
            {status !== 'ALL' && (
              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#0066CC] font-bold text-[11px]">
                Status: {status}
              </span>
            )}
            {search && (
              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#0066CC] font-bold text-[11px]">
                Search: {search}
              </span>
            )}
            <button
              onClick={() => {
                setStatus('ALL');
                setSearch('');
                setDateFrom('');
                setDateTo('');
                setPage(1);
              }}
              className="text-slate-400 hover:text-slate-600 underline ml-auto text-[11px] cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Submissions Table */}
      <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-100 text-[10px]">
              <tr>
                <th className="py-3 px-4">Order #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Payable Amount</th>
                <th className="py-3 px-4">Bank Reference</th>
                <th className="py-3 px-4">Deposit Date</th>
                <th className="py-3 px-4">Verification Status</th>
                <th className="py-3 px-4">Submitted At</th>
                <th className="py-3 px-4 text-right">Review Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#0066CC]" />
                    <span>Loading verification queue...</span>
                  </td>
                </tr>
              ) : submissions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No bank transfer submissions match the selected filters.
                  </td>
                </tr>
              ) : (
                submissions.map((sub) => {
                  const isVerified = sub.status === 'VERIFIED';
                  const isRejected = sub.status === 'REJECTED';
                  const isPending = sub.status === 'PENDING';

                  return (
                    <tr
                      key={sub.id}
                      className={`hover:bg-blue-50/40 transition-colors ${
                        selectedId === sub.id ? 'bg-blue-50/60' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-[#0066CC]">
                        {sub.order?.orderNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">
                          {sub.order?.customer?.name || 'Guest Customer'}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[140px]">
                          {sub.order?.customer?.email}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-black text-slate-900">
                        {formatLKR(sub.amountCents || sub.order?.totalAmountCents)}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        {sub.referenceNumber || (
                          <span className="text-slate-300 italic">None entered</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {sub.depositDate || (
                          <span className="text-slate-300 italic">Not stated</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isVerified
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isRejected
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {isVerified ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          ) : isRejected ? (
                            <XCircle className="w-3 h-3 text-rose-600" />
                          ) : (
                            <Clock className="w-3 h-3 text-amber-600" />
                          )}
                          <span>{sub.status}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {new Date(sub.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedId(sub.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-[#0066CC] hover:bg-[#0052a3] text-white transition-all shadow-xs cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Review Slip</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing Page {page} of {totalPages} ({totalItems} submissions)
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

      {/* Verification Drawer */}
      {selectedId && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl overflow-y-auto flex flex-col">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 sticky top-0 z-10 backdrop-blur-md">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Deposit Slip Verification
                </span>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <span>Order #{detailItem?.order?.orderNumber}</span>
                  {detailItem && (
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        detailItem.status === 'VERIFIED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : detailItem.status === 'REJECTED'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {detailItem.status}
                    </span>
                  )}
                </h2>
              </div>
              <button
                onClick={() => {
                  setSelectedId(null);
                  setActionSuccessMsg(null);
                }}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200/60 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-6 space-y-6 flex-1">
              {actionSuccessMsg && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{actionSuccessMsg}</span>
                </div>
              )}

              {isDetailLoading ? (
                <div className="py-24 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#0066CC]" />
                  <span>Loading full submission details...</span>
                </div>
              ) : detailItem ? (
                <>
                  {/* Warning Callout */}
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-800">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Corporate Bank Statement Comparison Required</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-800">
                      Always confirm that the funds have cleared into DSL Stationery’s Commercial
                      Bank corporate account before approving. Verify exact amount and reference number.
                    </p>
                  </div>

                  {/* Submission Snapshot */}
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">
                        Customer Entered Reference
                      </span>
                      <strong className="text-slate-800 font-mono text-sm">
                        {detailItem.referenceNumber || 'None entered'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">
                        Customer Stated Deposit Date
                      </span>
                      <strong className="text-slate-800 text-sm">
                        {detailItem.depositDate || 'Not specified'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">
                        Payable Total
                      </span>
                      <strong className="text-[#0066CC] font-black text-base">
                        {formatLKR(detailItem.amountCents || detailItem.order.totalAmountCents)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">
                        Submitted At
                      </span>
                      <span className="text-slate-700">
                        {new Date(detailItem.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Receipt Viewer Card */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-[#0066CC]" />
                        <span>Uploaded Receipt Document</span>
                      </h3>
                      {isManagerOrAdmin && (
                        <a
                          href={receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0066CC] hover:underline"
                        >
                          <span>Open Full Size</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    {isManagerOrAdmin ? (
                      <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-900/5 aspect-video flex items-center justify-center p-2 relative group">
                        {/* We use an iframe or img element pointing to the secure receipt stream */}
                        <iframe
                          src={receiptUrl}
                          className="w-full h-full rounded-xl border border-slate-200 bg-white"
                          title="Receipt Preview"
                        />
                      </div>
                    ) : (
                      <div className="p-8 text-center rounded-2xl bg-slate-100 border border-slate-200 text-slate-500 text-xs">
                        <ShieldAlert className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                        <span>Receipt preview restricted to Managers and Administrators.</span>
                      </div>
                    )}
                  </div>

                  {/* Order Line Items */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Order Items ({detailItem.order.items?.length || 0})
                    </h3>
                    <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100 text-xs">
                      {detailItem.order.items?.map((item) => (
                        <div key={item.id} className="p-3 flex justify-between items-center">
                          <div>
                            <span className="font-bold text-slate-800">{item.productName}</span>
                            <span className="text-slate-400 block text-[11px]">
                              Qty: {item.quantity} × {formatLKR(item.priceCents)}
                            </span>
                          </div>
                          <span className="font-black text-slate-900">
                            {formatLKR(item.totalCents)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Review Audit History */}
                  {detailItem.reviewedById && (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs space-y-1">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">
                        Audit Review Record
                      </span>
                      <div className="text-slate-700">
                        Reviewed by: <strong>{detailItem.reviewer?.name || detailItem.reviewer?.email || detailItem.reviewedById}</strong>
                      </div>
                      {detailItem.reviewedAt && (
                        <div className="text-slate-500 text-[11px]">
                          Reviewed at: {new Date(detailItem.reviewedAt).toLocaleString()}
                        </div>
                      )}
                      {detailItem.rejectionReason && (
                        <div className="text-rose-700 font-medium pt-1">
                          Rejection Reason: {detailItem.rejectionReason}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Action Bar (Manager / Admin Only) */}
            {isManagerOrAdmin && detailItem?.status === 'PENDING' && (
              <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 sticky bottom-0 z-10">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(true)}
                  disabled={isSubmittingAction}
                  className="px-5 py-2.5 rounded-full border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  Reject Submission
                </button>
                <button
                  type="button"
                  onClick={() => setIsApproveModalOpen(true)}
                  disabled={isSubmittingAction}
                  className="px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  Verify & Confirm Order
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Approve Confirmation Modal */}
      {isApproveModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-emerald-700">
              <CheckCircle2 className="w-6 h-6" />
              <h3 className="text-base font-black">Approve Bank Transfer</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Confirm that <strong>{formatLKR(detailItem?.amountCents || 0)}</strong> has been credited to
              DSL Stationery’s bank account. This will atomically mark the order as{' '}
              <strong>CONFIRMED</strong> and payment as <strong>PAID</strong>.
            </p>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Admin Notes (Optional)
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="e.g. Verified on ComBank statement at 14:30"
                rows={2}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsApproveModalOpen(false)}
                disabled={isSubmittingAction}
                className="px-4 py-2 rounded-full border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={isSubmittingAction}
                className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
              >
                {isSubmittingAction ? 'Verifying...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-700">
              <XCircle className="w-6 h-6" />
              <h3 className="text-base font-black">Reject Bank Transfer</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Rejecting will mark the submission as <strong>REJECTED</strong>, cancel the order, and{' '}
              <strong>automatically restore physical inventory stock</strong>. The customer will see
              this reason on their order tracking page.
            </p>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Reason Category (Required)
              </label>
              <select
                value={rejectionCategory}
                onChange={(e) => setRejectionCategory(e.target.value as RejectionCategory)}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none bg-white"
              >
                {Object.entries(REJECTION_CATEGORY_LABELS).map(([catKey, label]) => (
                  <option key={catKey} value={catKey}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Detailed Explanation for Customer (Required)
              </label>
              <textarea
                value={rejectionExplanation}
                onChange={(e) => setRejectionExplanation(e.target.value)}
                placeholder="Explain why the deposit could not be verified..."
                rows={3}
                required
                className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                disabled={isSubmittingAction}
                className="px-4 py-2 rounded-full border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={isSubmittingAction || !rejectionExplanation.trim()}
                className="px-5 py-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingAction ? 'Rejecting & Restoring Stock...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BankTransfersQueuePage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-xs text-slate-400">
          Loading Bank Transfers review queue...
        </div>
      }
    >
      <BankTransfersQueueContent />
    </Suspense>
  );
}
