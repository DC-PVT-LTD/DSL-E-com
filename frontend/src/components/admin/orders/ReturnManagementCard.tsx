'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  RotateCcw,
  CheckCircle2,
  XCircle,
  PackageCheck,
  AlertCircle,
  Loader2,
  HelpCircle,
} from 'lucide-react';
import { OrderReturnRequest, PaymentMethod } from '@/types/order';
import { orderService } from '@/services/orderService';
import { formatLKR } from '@/lib/currency';
import { CreateRefundModal } from './CreateRefundModal';

interface ReturnManagementCardProps {
  orderId: string;
  orderNumber: string;
  paymentMethod?: PaymentMethod;
  availableBalanceCents?: number;
  onRefundInitiated?: () => void;
}

export const ReturnManagementCard: React.FC<ReturnManagementCardProps> = ({
  orderId,
  orderNumber,
  paymentMethod = 'CARD_PAYHERE',
  availableBalanceCents = 0,
  onRefundInitiated,
}) => {
  const [returns, setReturns] = useState<OrderReturnRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [restockMap, setRestockMap] = useState<Record<string, boolean>>({});
  const [refundModalReturnId, setRefundModalReturnId] = useState<string | null>(null);

  const isRestockChecked = (returnId: string) => restockMap[returnId] !== false; // defaults to true
  const setRestockChecked = (returnId: string, value: boolean) => {
    setRestockMap((prev) => ({ ...prev, [returnId]: value }));
  };

  const loadReturns = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await orderService.fetchOrderReturns(orderId);
      setReturns(res);
    } catch (err: any) {
      const isNetwork = err?.isNetworkError || err?.message?.toLowerCase().includes('network') || err?.status === 0;
      const errorMsg = isNetwork
        ? 'Unable to connect to the server. Please check your network connection.'
        : 'Failed to retrieve return requests. Please try again.';
      setFetchError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadReturns();
  }, [loadReturns]);

  const handleAction = async (
    returnId: string,
    action: 'APPROVE' | 'REJECT' | 'CONFIRM_RECEIVED',
    payload?: { rejectionReason?: string; restockItems?: boolean }
  ) => {
    setActionLoading(true);
    setNotice(null);
    setErrorNotice(null);
    const res = await orderService.processReturnAction(orderId, returnId, action, payload);
    setActionLoading(false);

    if (res.success) {
      await loadReturns();
      setRejectingId(null);
      setRejectionReason('');
      setNotice(
        action === 'APPROVE'
          ? 'Return request approved successfully.'
          : action === 'REJECT'
          ? 'Return request rejected.'
          : 'Products marked as received and return completed.'
      );
    } else {
      setErrorNotice(res.error || 'Failed to process return request');
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4 text-xs">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
            <RotateCcw className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Return &amp; Exchange Requests</h3>
            <p className="text-[11px] text-slate-400">
              Manage product returns, inspections, and replacement approvals
            </p>
          </div>
        </div>

        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
          {returns.length} Return Requests
        </span>
      </div>

      {notice && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-emerald-600 hover:text-emerald-800 text-xs font-bold px-1"
          >
            ×
          </button>
        </div>
      )}

      {errorNotice && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="block font-bold">Action Failed:</strong>
            <span>{errorNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorNotice(null)}
            className="text-rose-600 hover:text-rose-800 text-xs font-bold px-1"
          >
            ×
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="py-6 text-center text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#08275E]" />
          <span>Checking return requests...</span>
        </div>
      ) : fetchError ? (
        <div className="p-6 rounded-2xl bg-rose-50/70 border border-rose-200 text-center space-y-3 animate-fade-in">
          <div className="flex justify-center">
            <AlertCircle className="w-8 h-8 text-rose-500" />
          </div>
          <div className="space-y-1">
            <div className="text-xs font-bold text-rose-800">Failed to Load Return Requests</div>
            <p className="text-[11px] text-rose-600 max-w-sm mx-auto">
              {fetchError}
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={loadReturns}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      ) : returns.length === 0 ? (
        <div className="p-6 rounded-2xl bg-slate-50/70 border border-slate-200 text-center space-y-1">
          <div className="text-xs font-semibold text-slate-700">No Return Requests Registered</div>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            The customer has not submitted a return or replacement request for Order #{orderNumber}.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {returns.map((ret) => (
            <div
              key={ret.id}
              className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-mono font-bold text-slate-900 text-xs">
                    Return #{ret.returnNumber}
                  </span>
                  <div className="text-[10px] text-slate-400">
                    Requested on {new Date(ret.createdAt).toLocaleString()}
                  </div>
                </div>

                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                    ret.status === 'APPROVED'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : ret.status === 'REJECTED'
                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  {ret.status}
                </span>
              </div>

              <div className="text-slate-700 text-xs">
                <strong>Customer Reason:</strong> {ret.reason}
              </div>

              {ret.rejectionReason && (
                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-800 text-[11px] border border-rose-200">
                  <strong>Rejection Note:</strong> {ret.rejectionReason}
                </div>
              )}

              {/* Items in Return */}
              <div className="bg-white rounded-xl border border-slate-200 p-2.5 divide-y divide-slate-100">
                {ret.items.map((it) => (
                  <div key={it.id} className="py-2 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-slate-800">{it.productName}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-500 font-mono">
                          Requested Qty: {it.quantity}
                        </span>
                        {it.receivedAt && (
                          <span className="text-[10px] text-emerald-600">
                            (Received {new Date(it.receivedAt).toLocaleDateString()})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold">{it.reason}</span>
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          it.status === 'REFUNDED'
                            ? 'bg-purple-50 text-purple-800 border-purple-200'
                            : it.status === 'RECEIVED'
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : it.status === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : it.status === 'REJECTED'
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {it.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Linked Financial Refund Information */}
              {(ret as any).refundRecords && (ret as any).refundRecords.length > 0 ? (
                <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-900 text-xs flex items-center gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5 text-purple-700" />
                      <span>Linked Financial Refund</span>
                    </span>
                    {(ret as any).refundRecords.map((rf: any) => (
                      <span
                        key={rf.id}
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          rf.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : rf.status === 'APPROVED'
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : rf.status === 'PROCESSING'
                            ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                            : rf.status === 'REQUESTED'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                      >
                        {rf.status}
                      </span>
                    ))}
                  </div>
                  {(ret as any).refundRecords.map((rf: any) => (
                    <div key={rf.id} className="text-[11px] text-purple-900 space-y-1">
                      <div className="flex justify-between">
                        <span>Refund Amount:</span>
                        <strong className="font-mono text-purple-950">
                          {formatLKR(rf.amountCents)}
                        </strong>
                      </div>
                      {rf.externalReference && (
                        <div className="flex justify-between">
                          <span>Completion Reference:</span>
                          <code className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-purple-200">
                            {rf.externalReference}
                          </code>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : ret.status === 'APPROVED' || ret.status === 'COMPLETED' ? (
                <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-between">
                  <span className="text-[11px] text-slate-600">
                    No refund recorded yet for this return request.
                  </span>
                  <button
                    type="button"
                    onClick={() => setRefundModalReturnId(ret.id)}
                    className="px-2.5 py-1 rounded-lg bg-[#08275E] hover:bg-[#103b8c] text-white text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    Issue Return Refund
                  </button>
                </div>
              ) : null}

              {/* Action Buttons */}
              {ret.status === 'PENDING' && (
                <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-end gap-2">
                  {rejectingId === ret.id ? (
                    <div className="w-full space-y-2 pt-1 animate-fade-in">
                      <input
                        type="text"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="State official rejection reason..."
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setRejectingId(null);
                            setRejectionReason('');
                          }}
                          className="px-3 py-1 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading || !rejectionReason.trim()}
                          onClick={() =>
                            handleAction(ret.id, 'REJECT', {
                              rejectionReason: rejectionReason.trim(),
                            })
                          }
                          className="px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-40"
                        >
                          Confirm Rejection
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setRejectingId(ret.id)}
                        disabled={actionLoading}
                        className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-colors cursor-pointer"
                      >
                        Reject Return
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAction(ret.id, 'APPROVE')}
                        disabled={actionLoading}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve Return</span>
                      </button>
                    </>
                  )}
                </div>
              )}

              {ret.status === 'APPROVED' && (
                <div className="pt-3 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 text-xs font-semibold">
                    <input
                      type="checkbox"
                      checked={isRestockChecked(ret.id)}
                      onChange={(e) => setRestockChecked(ret.id, e.target.checked)}
                      className="w-4 h-4 rounded text-[#08275E] border-slate-300 focus:ring-[#08275E] cursor-pointer"
                    />
                    <span>Restock returned items to catalogue inventory</span>
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      handleAction(ret.id, 'CONFIRM_RECEIVED', {
                        restockItems: isRestockChecked(ret.id),
                      })
                    }
                    disabled={actionLoading}
                    className="px-3.5 py-1.5 rounded-xl bg-[#08275E] hover:bg-[#103b8c] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <PackageCheck className="w-3.5 h-3.5" />
                    <span>Confirm Products Received</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {refundModalReturnId && (
        <CreateRefundModal
          orderId={orderId}
          orderNumber={orderNumber}
          paymentMethod={paymentMethod}
          availableBalanceCents={availableBalanceCents}
          returnRequests={returns}
          preselectedReturnId={refundModalReturnId}
          isOpen={Boolean(refundModalReturnId)}
          onClose={() => setRefundModalReturnId(null)}
          onSuccess={() => {
            setRefundModalReturnId(null);
            loadReturns();
            if (onRefundInitiated) onRefundInitiated();
          }}
        />
      )}
    </div>
  );
};
