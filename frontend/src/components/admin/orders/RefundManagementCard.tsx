'use client';

import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  AlertCircle,
  HelpCircle,
  PlusCircle,
  ExternalLink,
  ShieldAlert,
  Loader2,
  CreditCard,
  Building,
  Ban,
  FileCheck2,
} from 'lucide-react';
import { formatLKR } from '@/lib/currency';
import { orderService } from '@/services/orderService';
import {
  OrderRefundsResponse,
  RefundRecord,
  PaymentMethod,
  OrderReturnRequest,
  RefundStatus,
} from '@/types/order';
import { CreateRefundModal } from './CreateRefundModal';
import { useUserStore } from '@/services/userStore';

interface RefundManagementCardProps {
  orderId: string;
  orderNumber: string;
  orderTotalCents: number;
  paymentMethod: PaymentMethod;
  paymentStatus: string;
  returnRequests?: OrderReturnRequest[];
  onOrderUpdated?: () => void;
}

export const RefundManagementCard: React.FC<RefundManagementCardProps> = ({
  orderId,
  orderNumber,
  orderTotalCents,
  paymentMethod,
  paymentStatus,
  returnRequests = [],
  onOrderUpdated,
}) => {
  const [refundData, setRefundData] = useState<OrderRefundsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const hasPermission = useUserStore((state) => state.hasPermission);
  const canManageRefunds = hasPermission('orders.refund');

  // Modals & Action State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [completingRefundId, setCompletingRefundId] = useState<string | null>(null);
  const [externalReference, setExternalReference] = useState<string>('');
  const [completionNotes, setCompletionNotes] = useState<string>('');

  const [rejectingRefundId, setRejectingRefundId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  const [failingRefundId, setFailingRefundId] = useState<string | null>(null);
  const [failureReason, setFailureReason] = useState<string>('');

  const loadRefunds = async () => {
    setIsLoading(true);
    const data = await orderService.fetchOrderRefunds(orderId);
    if (data) {
      setRefundData(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadRefunds();
  }, [orderId]);

  const handleApprove = async (refundId: string) => {
    setActionLoading(true);
    setErrorNotice(null);
    setNotice(null);

    const res = await orderService.approveRefund(orderId, refundId, 'Approved by staff admin');
    setActionLoading(false);

    if (res.success) {
      setNotice('Refund authorized and marked as APPROVED.');
      loadRefunds();
      if (onOrderUpdated) onOrderUpdated();
    } else {
      setErrorNotice(res.error || 'Failed to approve refund.');
    }
  };

  const handleProcessExecution = async (refundId: string) => {
    setActionLoading(true);
    setErrorNotice(null);
    setNotice(null);

    const res = await orderService.processRefundExecution(
      orderId,
      refundId,
      'Submitted for payment gateway/bank remittance'
    );
    setActionLoading(false);

    if (res.success) {
      setNotice('Refund transitioned to in-flight PROCESSING status.');
      loadRefunds();
      if (onOrderUpdated) onOrderUpdated();
    } else {
      setErrorNotice(res.error || 'Failed to process refund execution.');
    }
  };

  const handleComplete = async (refundId: string) => {
    if (!externalReference.trim()) {
      setErrorNotice('External transaction reference is mandatory to complete a refund.');
      return;
    }

    setActionLoading(true);
    setErrorNotice(null);
    setNotice(null);

    const res = await orderService.completeRefund(
      orderId,
      refundId,
      externalReference.trim(),
      completionNotes.trim() || undefined
    );
    setActionLoading(false);

    if (res.success) {
      setNotice('Refund verified and marked as COMPLETED.');
      setCompletingRefundId(null);
      setExternalReference('');
      setCompletionNotes('');
      loadRefunds();
      if (onOrderUpdated) onOrderUpdated();
    } else {
      setErrorNotice(res.error || 'Failed to complete refund.');
    }
  };

  const handleReject = async (refundId: string) => {
    if (!rejectionReason.trim()) {
      setErrorNotice('Rejection reason is required.');
      return;
    }

    setActionLoading(true);
    setErrorNotice(null);
    setNotice(null);

    const res = await orderService.rejectRefund(orderId, refundId, rejectionReason.trim());
    setActionLoading(false);

    if (res.success) {
      setNotice('Refund request was REJECTED and reserved funds released.');
      setRejectingRefundId(null);
      setRejectionReason('');
      loadRefunds();
      if (onOrderUpdated) onOrderUpdated();
    } else {
      setErrorNotice(res.error || 'Failed to reject refund.');
    }
  };

  const handleFail = async (refundId: string) => {
    if (!failureReason.trim()) {
      setErrorNotice('Failure reason is required.');
      return;
    }

    setActionLoading(true);
    setErrorNotice(null);
    setNotice(null);

    const res = await orderService.failRefund(orderId, refundId, failureReason.trim());
    setActionLoading(false);

    if (res.success) {
      setNotice('Refund was marked as FAILED and reserved funds released.');
      setFailingRefundId(null);
      setFailureReason('');
      loadRefunds();
      if (onOrderUpdated) onOrderUpdated();
    } else {
      setErrorNotice(res.error || 'Failed to record refund failure.');
    }
  };

  const refunds = refundData?.refundRecords || [];
  const verifiedCollectedCents = refundData?.verifiedCollectedCents ?? 0;
  const completedRefundsCents = refundData?.completedRefundsCents ?? 0;
  const reservedRefundsCents = refundData?.reservedRefundsCents ?? 0;
  const availableBalanceCents = refundData?.availableRefundBalanceCents ?? 0;

  const isCod = paymentMethod === 'CASH_ON_DELIVERY' || paymentMethod === 'cash_on_delivery';
  const isKoko = paymentMethod === 'KOKO_BNPL' || paymentMethod === 'koko_pay_mock';

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5 text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Refund Management &amp; Financial Lineage
            </h3>
            <p className="text-[11px] text-slate-400">
              Dual-custody authorization, gateway reconciliation &amp; balance reservations
            </p>
          </div>
        </div>

        {canManageRefunds ? (
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            disabled={isCod || isKoko || availableBalanceCents <= 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#08275E] hover:bg-[#103b8c] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Request New Refund</span>
          </button>
        ) : (
          <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-xl">
            Requires orders.refund
          </span>
        )}
      </div>

      {/* Notices */}
      {notice && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>{notice}</span>
        </div>
      )}

      {errorNotice && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-bold">Action Authorization Failed:</strong>
            <span>{errorNotice}</span>
          </div>
        </div>
      )}

      {/* Financial Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            Verified Collected
          </span>
          <span className="text-sm font-black text-slate-900 mt-1 block">
            {formatLKR(verifiedCollectedCents)}
          </span>
          <span className="text-[10px] text-slate-400">Proven bank/gateway funds</span>
        </div>

        <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200/70">
          <span className="text-[10px] uppercase font-bold text-emerald-700 block tracking-wider">
            Completed Refunds
          </span>
          <span className="text-sm font-black text-emerald-900 mt-1 block">
            {formatLKR(completedRefundsCents)}
          </span>
          <span className="text-[10px] text-emerald-600">Disbursed with proof</span>
        </div>

        <div className="p-3 rounded-2xl bg-amber-50/60 border border-amber-200/70">
          <span className="text-[10px] uppercase font-bold text-amber-700 block tracking-wider">
            Reserved / In-Flight
          </span>
          <span className="text-sm font-black text-amber-900 mt-1 block">
            {formatLKR(reservedRefundsCents)}
          </span>
          <span className="text-[10px] text-amber-600">Requested &amp; processing</span>
        </div>

        <div className="p-3 rounded-2xl bg-blue-50/60 border border-blue-200/70">
          <span className="text-[10px] uppercase font-bold text-blue-700 block tracking-wider">
            Available to Refund
          </span>
          <span className="text-sm font-black text-[#08275E] mt-1 block">
            {formatLKR(availableBalanceCents)}
          </span>
          <span className="text-[10px] text-blue-600">Max eligible refund</span>
        </div>
      </div>

      {/* Blocked Method Notice */}
      {isCod && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5">
          <Ban className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <strong className="block font-bold">
              Cash on Delivery (COD) Refunds Strictly Blocked
            </strong>
            <p className="text-[11px] text-amber-800">
              Delivery status is not authoritative proof of cash collection. A verified courier
              remittance module must be provisioned before COD refunds can be authorized.
            </p>
          </div>
        </div>
      )}

      {isKoko && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5">
          <Ban className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <strong className="block font-bold">Koko BNPL Refunds Blocked</strong>
            <p className="text-[11px] text-amber-800">
              Koko payment gateway refund API integration is currently not implemented on the
              platform.
            </p>
          </div>
        </div>
      )}

      {/* Refunds Table / List */}
      {isLoading ? (
        <div className="py-8 text-center text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#08275E]" />
          <span>Loading verified refund records...</span>
        </div>
      ) : refunds.length === 0 ? (
        <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1">
          <div className="text-xs font-semibold text-slate-700">No Refunds Issued</div>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            Zero refund records exist for this order. Click &quot;Request New Refund&quot; above to
            initiate dual-custody authorization.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {refunds.map((ref) => {
            const isRequested = ref.status === 'REQUESTED';
            const isApproved = ref.status === 'APPROVED';
            const isProcessing = ref.status === 'PROCESSING';
            const isCompleted = ref.status === 'COMPLETED';
            const isRejected = ref.status === 'REJECTED';
            const isFailed = ref.status === 'FAILED';

            return (
              <div
                key={ref.id}
                className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3"
              >
                {/* Header row */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 text-xs">
                      {ref.reference || `REF-${ref.id.slice(-6)}`}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(ref.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-slate-900 text-xs">
                      {formatLKR(ref.amountCents)}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                        isCompleted
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : isApproved
                          ? 'bg-blue-50 text-blue-800 border-blue-200'
                          : isProcessing
                          ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                          : isRequested
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {ref.status}
                    </span>
                  </div>
                </div>

                {/* Method & Linked Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 bg-white p-3 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Payout Method
                    </span>
                    <span className="font-semibold text-slate-800 uppercase">
                      {ref.method.replace(/_/g, ' ')}
                    </span>
                    {ref.maskedAccountNumber && (
                      <span className="block text-slate-500 font-mono text-[10px]">
                        Account: {ref.maskedAccountNumber}
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Origin / Return Linkage
                    </span>
                    {ref.orderReturnRequest ? (
                      <span className="font-semibold text-[#08275E]">
                        Return #{ref.orderReturnRequest.returnNumber} (
                        {ref.orderReturnRequest.status})
                      </span>
                    ) : (
                      <span className="text-slate-500">Order Cancellation / Direct Refund</span>
                    )}
                  </div>
                </div>

                {/* Reason & Evidence */}
                <div className="text-[11px] text-slate-700">
                  <strong>Reason:</strong> {ref.reason}
                </div>

                {ref.externalReference && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200 text-[11px]">
                    <strong>Verified External Transaction Reference:</strong>{' '}
                    <code className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-300">
                      {ref.externalReference}
                    </code>
                  </div>
                )}

                {ref.failureReason && (
                  <div className="p-2.5 rounded-xl bg-rose-50 text-rose-900 border border-rose-200 text-[11px]">
                    <strong>Failure / Rejection Note:</strong> {ref.failureReason}
                  </div>
                )}

                {/* Segregation of Duties Lineage */}
                <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-between text-[10px] text-slate-500 font-mono gap-2">
                  <span>
                    Requested by:{' '}
                    <strong className="text-slate-700">
                      {ref.requestedById || ref.processedById || 'System'}
                    </strong>
                  </span>
                  {ref.approvedById && (
                    <span>
                      Approved by:{' '}
                      <strong className="text-blue-700">{ref.approvedById}</strong>
                    </span>
                  )}
                  {ref.completedById && (
                    <span>
                      Completed by:{' '}
                      <strong className="text-emerald-700">{ref.completedById}</strong>
                    </span>
                  )}
                </div>

                {/* Lifecycle Actions */}
                {/* 1. REQUESTED -> Approve or Reject */}
                {isRequested && (
                  <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-end gap-2">
                    {rejectingRefundId === ref.id ? (
                      <div className="w-full space-y-2 pt-1 animate-fade-in">
                        <input
                          type="text"
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="State required rejection reason..."
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setRejectingRefundId(null);
                              setRejectionReason('');
                            }}
                            className="px-3 py-1 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading || !rejectionReason.trim()}
                            onClick={() => handleReject(ref.id)}
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
                          disabled={actionLoading}
                          onClick={() => setRejectingRefundId(ref.id)}
                          className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-colors cursor-pointer"
                        >
                          Reject Request
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleApprove(ref.id)}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Authorize / Approve</span>
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* 2. APPROVED -> Mark In-Flight / Processing */}
                {isApproved && (
                  <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleProcessExecution(ref.id)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#08275E] hover:bg-[#103b8c] text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Mark In-Flight (Processing)</span>
                    </button>
                  </div>
                )}

                {/* 3. PROCESSING -> Complete or Fail */}
                {isProcessing && (
                  <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-end gap-2">
                    {completingRefundId === ref.id ? (
                      <div className="w-full space-y-2 pt-1 animate-fade-in p-3 bg-white rounded-xl border border-slate-200">
                        <label className="block text-[10px] uppercase font-bold text-slate-600">
                          External Transaction Reference *
                        </label>
                        <input
                          type="text"
                          value={externalReference}
                          onChange={(e) => setExternalReference(e.target.value)}
                          placeholder="e.g. PAYHERE-REF-992348 or BANK-SLIP-77382"
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setCompletingRefundId(null);
                              setExternalReference('');
                            }}
                            className="px-3 py-1 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading || !externalReference.trim()}
                            onClick={() => handleComplete(ref.id)}
                            className="px-3.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-40"
                          >
                            Confirm &amp; Complete Refund
                          </button>
                        </div>
                      </div>
                    ) : failingRefundId === ref.id ? (
                      <div className="w-full space-y-2 pt-1 animate-fade-in">
                        <input
                          type="text"
                          value={failureReason}
                          onChange={(e) => setFailureReason(e.target.value)}
                          placeholder="State gateway decline or transaction failure reason..."
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setFailingRefundId(null);
                              setFailureReason('');
                            }}
                            className="px-3 py-1 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading || !failureReason.trim()}
                            onClick={() => handleFail(ref.id)}
                            className="px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-40"
                          >
                            Record Failure
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => setFailingRefundId(ref.id)}
                          className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-colors cursor-pointer"
                        >
                          Mark Failed
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => setCompletingRefundId(ref.id)}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <FileCheck2 className="w-3.5 h-3.5" />
                          <span>Record Completion Reference</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <CreateRefundModal
        orderId={orderId}
        orderNumber={orderNumber}
        paymentMethod={paymentMethod}
        availableBalanceCents={availableBalanceCents}
        returnRequests={returnRequests}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          loadRefunds();
          if (onOrderUpdated) onOrderUpdated();
        }}
      />
    </div>
  );
};

