'use client';

import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  CheckCircle2,
  XCircle,
  PackageCheck,
  AlertCircle,
  Loader2,
  HelpCircle,
} from 'lucide-react';
import { OrderReturnRequest } from '@/types/order';
import { orderService } from '@/services/orderService';
import { formatLKR } from '@/lib/currency';

interface ReturnManagementCardProps {
  orderId: string;
  orderNumber: string;
}

export const ReturnManagementCard: React.FC<ReturnManagementCardProps> = ({
  orderId,
  orderNumber,
}) => {
  const [returns, setReturns] = useState<OrderReturnRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadReturns = async () => {
      setIsLoading(true);
      const res = await orderService.fetchOrderReturns(orderId);
      if (mounted) {
        setReturns(res);
        setIsLoading(false);
      }
    };
    loadReturns();
    return () => {
      mounted = false;
    };
  }, [orderId]);

  const handleAction = async (
    returnId: string,
    action: 'APPROVE' | 'REJECT' | 'CONFIRM_RECEIVED',
    reason?: string
  ) => {
    setActionLoading(true);
    setNotice(null);
    const res = await orderService.processReturnAction(orderId, returnId, action, reason);
    setActionLoading(false);

    if (res.success) {
      const refreshed = await orderService.fetchOrderReturns(orderId);
      setReturns(refreshed);
      setRejectingId(null);
      setRejectionReason('');
    } else {
      if (res.isBackendPending) {
        setNotice(
          'Return processing endpoint [PATCH /api/v1/admin/orders/:id/returns/:returnId/status] is pending implementation by the backend developer (documented in PHASE_11_BACKEND_API_REQUIREMENTS.md).'
        );
      } else {
        alert(res.error || 'Failed to process return');
      }
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
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-bold">API Coordination Notice:</strong>
            <span>{notice}</span>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="py-6 text-center text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#08275E]" />
          <span>Checking return requests...</span>
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
                  <div key={it.id} className="py-1.5 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-slate-800">{it.productName}</span>
                      <span className="text-[10px] text-slate-400 ml-2">Qty: {it.quantity}</span>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500">{it.reason}</span>
                  </div>
                ))}
              </div>

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
                          onClick={() => handleAction(ret.id, 'REJECT', rejectionReason)}
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
                <div className="pt-2 border-t border-slate-200/60 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleAction(ret.id, 'CONFIRM_RECEIVED')}
                    disabled={actionLoading}
                    className="px-3.5 py-1.5 rounded-xl bg-[#08275E] hover:bg-[#103b8c] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <PackageCheck className="w-3.5 h-3.5" />
                    <span>Confirm Products Received &amp; Restock</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
