'use client';

import React, { useState } from 'react';
import { X, AlertTriangle, Loader2, RotateCcw, ShieldAlert } from 'lucide-react';
import { PaymentStatus, PaymentMethod } from '@/types/order';
import { orderService } from '@/services/orderService';
import { formatLKR } from '@/lib/currency';

interface CancelOrderModalProps {
  orderId: string;
  orderNumber: string;
  totalCents: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CancelOrderModal: React.FC<CancelOrderModalProps> = ({
  orderId,
  orderNumber,
  totalCents,
  paymentStatus,
  paymentMethod,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isPaid =
    paymentStatus === 'PAID' ||
    paymentStatus === 'paid' ||
    paymentStatus === 'simulated_paid';

  const isCardOrKoko =
    paymentMethod === 'CARD_PAYHERE' ||
    paymentMethod === 'card_mock' ||
    paymentMethod === 'KOKO_BNPL' ||
    paymentMethod === 'koko_pay_mock';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide an official cancellation reason.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const res = await orderService.cancelOrderApi(orderId, {
      reason: reason.trim(),
      restoreInventory: true,
      processRefund: isPaid,
    });

    setIsSubmitting(false);

    if (res.success) {
      onSuccess();
      onClose();
    } else {
      setError(res.error || 'Failed to cancel order');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl border border-rose-200 max-w-md w-full shadow-2xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-rose-100 bg-rose-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-100 text-rose-700">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-rose-950">Cancel Order #{orderNumber}</h3>
              <p className="text-[11px] text-rose-700">This action will cancel fulfillment &amp; restore stock</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-rose-100 text-rose-400 hover:text-rose-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Refund Eligibility Notice */}
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-xs text-amber-950">
              <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
              <span>Financial &amp; Refund Assessment</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Order value:{' '}
              <strong className="text-slate-900 font-bold">{formatLKR(totalCents)}</strong>.
              {isPaid ? (
                <>
                  {' '}
                  This order is marked as <strong className="text-emerald-700 font-bold">PAID</strong> via{' '}
                  <strong className="capitalize">{paymentMethod.replace(/_/g, ' ')}</strong>.
                  {isCardOrKoko
                    ? ' If cancelling, a gateway refund voucher or reversal must be recorded with the payment provider.'
                    : ' If paid via bank transfer, accounts department must be notified for manual transfer reversal.'}
                </>
              ) : (
                ' This order is unpaid (Cash on Delivery or Pending). No financial refund is required.'
              )}
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 space-y-1 text-[11px]">
            <strong className="text-slate-900 block font-bold">Inventory Impact:</strong>
            <span>
              All physical stock units allocated to this order will be automatically replenished and
              broadcasted across the catalogue.
            </span>
          </div>

          {/* Cancellation Reason */}
          <div className="space-y-1">
            <label className="font-bold text-slate-800 uppercase text-[10px] tracking-wider block">
              Official Cancellation Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Customer requested cancellation prior to dispatch due to incorrect items"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-xs"
            />
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold transition-colors cursor-pointer"
            >
              Keep Order Active
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reason.trim()}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Confirm Cancellation</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
