'use client';

import React, { useState } from 'react';
import {
  X,
  ArrowRightCircle,
  Truck,
  AlertTriangle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { OrderStatus } from '@/types/order';
import { orderService, PERMITTED_ORDER_TRANSITIONS } from '@/services/orderService';
import { OrderStatusBadge } from './OrderStatusBadge';

interface StatusTransitionModalProps {
  orderId: string;
  orderNumber: string;
  currentStatus: OrderStatus;
  initialTracking?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newStatus: OrderStatus, tracking?: string | null) => void;
}

export const StatusTransitionModal: React.FC<StatusTransitionModalProps> = ({
  orderId,
  orderNumber,
  currentStatus,
  initialTracking,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const normCurrent = (currentStatus || 'PENDING').toUpperCase();
  const allowed = (PERMITTED_ORDER_TRANSITIONS[normCurrent] || []).filter(
    (s) => s.toUpperCase() !== 'CANCELLED' // Cancellations have dedicated CancelOrderModal with refund rules
  );

  const [selectedStatus, setSelectedStatus] = useState<string>(allowed[0] || '');
  const [trackingNumber, setTrackingNumber] = useState<string>(initialTracking || '');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStatus) {
      setError('Please select a target status.');
      return;
    }

    if (selectedStatus.toUpperCase() === 'SHIPPED' && !trackingNumber.trim()) {
      setError('Tracking number is recommended when marking an order as Shipped.');
      // allow proceed if they confirm or fill
    }

    setIsSubmitting(true);
    setError(null);

    const res = await orderService.transitionStatusApi(orderId, {
      status: selectedStatus as OrderStatus,
      trackingNumber: trackingNumber.trim() || undefined,
      notes: reason.trim() || undefined,
    });

    setIsSubmitting(false);

    if (res.success) {
      onSuccess(selectedStatus as OrderStatus, trackingNumber.trim() || null);
      onClose();
    } else {
      setError(res.error || 'Failed to update order status');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full shadow-2xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#08275E]/10 text-[#08275E]">
              <ArrowRightCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Update Fulfillment Status</h3>
              <p className="text-[11px] text-slate-400">Order #{orderNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
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

          <div>
            <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider mb-1">
              Current Status
            </span>
            <OrderStatusBadge status={currentStatus} size="md" />
          </div>

          {allowed.length === 0 ? (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-500 text-center">
              This order has reached a terminal state (<strong>{currentStatus}</strong>). No further
              forward transitions are permitted.
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">
                  Select Permitted Target Status <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {allowed.map((statusOption) => (
                    <label
                      key={statusOption}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedStatus === statusOption
                          ? 'border-[#08275E] bg-[#08275E]/5 ring-1 ring-[#08275E]'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="targetStatus"
                          value={statusOption}
                          checked={selectedStatus === statusOption}
                          onChange={(e) => setSelectedStatus(e.target.value)}
                          className="accent-[#08275E]"
                        />
                        <span className="font-bold text-slate-900 capitalize">
                          {statusOption.toLowerCase()}
                        </span>
                      </div>
                      <OrderStatusBadge status={statusOption} size="sm" />
                    </label>
                  ))}
                </div>
              </div>

              {selectedStatus.toUpperCase() === 'SHIPPED' && (
                <div className="space-y-1 p-3.5 rounded-2xl bg-purple-50/60 border border-purple-200 animate-fade-in">
                  <label className="font-bold text-purple-900 uppercase text-[10px] tracking-wider block flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-purple-700" />
                    <span>Courier Tracking Number</span>
                  </label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="e.g. DSL-EXP-92813 or Pronto #49281"
                    className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white text-xs font-mono text-purple-900 focus:outline-none focus:ring-1 focus:ring-purple-600"
                  />
                  <span className="text-[10px] text-purple-700 block">
                    Customer will receive this tracking reference in their delivery confirmation.
                  </span>
                </div>
              )}

              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">
                  Transition Reason / Note (Optional)
                </label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Order verified and handed over to courier"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#08275E]"
                />
              </div>
            </>
          )}

          {/* Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            {allowed.length > 0 && (
              <button
                type="submit"
                disabled={isSubmitting || !selectedStatus}
                className="px-4 py-2 rounded-xl bg-[#08275E] hover:bg-[#103b8c] text-white font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Status Update</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
