'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  AlertCircle,
  HelpCircle,
  RotateCcw,
  CreditCard,
  Building,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { formatLKR } from '@/lib/currency';
import { orderService } from '@/services/orderService';
import { OrderReturnRequest, PaymentMethod } from '@/types/order';

interface CreateRefundModalProps {
  orderId: string;
  orderNumber: string;
  paymentMethod: PaymentMethod;
  availableBalanceCents: number;
  returnRequests?: OrderReturnRequest[];
  preselectedReturnId?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateRefundModal: React.FC<CreateRefundModalProps> = ({
  orderId,
  orderNumber,
  paymentMethod,
  availableBalanceCents,
  returnRequests = [],
  preselectedReturnId = null,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [amountRupees, setAmountRupees] = useState<string>(
    availableBalanceCents > 0 ? (availableBalanceCents / 100).toFixed(2) : '0.00'
  );
  const [method, setMethod] = useState<string>(paymentMethod);
  const [reason, setReason] = useState<string>('');
  const [selectedReturnId, setSelectedReturnId] = useState<string>(
    preselectedReturnId || ''
  );
  const [bankName, setBankName] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [beneficiaryName, setBeneficiaryName] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Stable idempotency key for this logical refund submission session
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => `ref-req-${orderId}-${Date.now()}`);
  const lastSubmittedPayloadSigRef = useRef<string | null>(null);

  // Generate a fresh stable idempotency key when the modal is opened for a new refund workflow
  useEffect(() => {
    if (isOpen) {
      setIdempotencyKey(`ref-req-${orderId}-${Date.now()}`);
      lastSubmittedPayloadSigRef.current = null;
      setError(null);
    }
  }, [isOpen, orderId]);

  if (!isOpen) return null;

  const amountCents = Math.round(parseFloat(amountRupees || '0') * 100);
  const isCod = paymentMethod === 'CASH_ON_DELIVERY' || paymentMethod === 'cash_on_delivery';
  const isKoko = paymentMethod === 'KOKO_BNPL' || paymentMethod === 'koko_pay_mock';
  const isBankTransfer = method === 'BANK_TRANSFER' || method === 'bank_transfer_mock';
  const isPayHere = method === 'CARD_PAYHERE' || method === 'card_mock';

  const isBlockedMethod = isCod || isKoko;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isBlockedMethod) {
      setError(
        isCod
          ? 'Cash on Delivery refunds are strictly blocked: courier remittance cannot be verified.'
          : 'Koko BNPL refunds are currently blocked: gateway integration is not implemented.'
      );
      return;
    }

    if (isNaN(amountCents) || amountCents <= 0) {
      setError('Please enter a valid positive refund amount.');
      return;
    }

    if (amountCents > availableBalanceCents) {
      setError(
        `Refund amount (${formatLKR(amountCents)}) cannot exceed the available balance of ${formatLKR(
          availableBalanceCents
        )}.`
      );
      return;
    }

    if (!reason.trim()) {
      setError('Please provide an official business reason for this refund request.');
      return;
    }

    let maskedAcc = undefined;
    if (isBankTransfer) {
      if (!bankName.trim() || !accountNumber.trim()) {
        setError('Bank Name and Account Number are required for manual bank transfers.');
        return;
      }
      // Never store full unmasked account details
      const cleanAcc = accountNumber.trim();
      const last4 = cleanAcc.slice(-4);
      maskedAcc = `${bankName.trim()} ••••${last4}`;
    }

    setIsLoading(true);

    // Form a signature of the logical payload to verify if the admin edited inputs between retries
    const payloadSignature = `${orderId}:${amountCents}:${method}:${selectedReturnId || ''}:${reason.trim()}`;
    let activeKey = idempotencyKey;

    // If inputs were changed after a previous submission attempt, this is a distinct logical request:
    // Generate a new idempotency key so we don't send conflicting parameters with an existing key.
    if (lastSubmittedPayloadSigRef.current && lastSubmittedPayloadSigRef.current !== payloadSignature) {
      activeKey = `ref-req-${orderId}-${Date.now()}`;
      setIdempotencyKey(activeKey);
    }
    lastSubmittedPayloadSigRef.current = payloadSignature;

    const payload = {
      amountCents,
      method,
      reason: reason.trim(),
      maskedAccountNumber: maskedAcc,
      orderReturnRequestId: selectedReturnId || undefined,
      idempotencyKey: activeKey,
    };

    const res = await orderService.requestRefund(orderId, payload);
    setIsLoading(false);

    if (res.success) {
      onSuccess();
      onClose();
    } else {
      setError(res.error || 'Failed to submit refund request.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden text-xs">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#08275E]/10 text-[#08275E]">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Request Official Refund</h3>
              <p className="text-[11px] text-slate-400">Order #{orderNumber}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Refund Validation Error:</strong>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Blocked Method Notice */}
          {isCod && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">COD Refunds Blocked:</strong>
                <span>
                  Cash on Delivery refunds are strictly blocked. Delivery status does not guarantee
                  courier cash collection remittance.
                </span>
              </div>
            </div>
          )}

          {isKoko && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Koko BNPL Refunds Blocked:</strong>
                <span>
                  Koko gateway refund API integration is not implemented on the platform.
                </span>
              </div>
            </div>
          )}

          {/* Available Balance Card */}
          <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-blue-700 block tracking-wider">
                Maximum Refund Ceiling
              </span>
              <span className="text-[11px] text-blue-900">
                Verified collected funds minus completed &amp; reserved refunds
              </span>
            </div>
            <div className="text-right">
              <span className="text-sm font-black text-[#08275E]">
                {formatLKR(availableBalanceCents)}
              </span>
            </div>
          </div>

          {/* Amount Field */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Refund Amount (LKR) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                Rs.
              </span>
              <input
                type="number"
                step="0.01"
                min="1"
                max={availableBalanceCents / 100}
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                disabled={isBlockedMethod || availableBalanceCents <= 0}
                className="w-full pl-10 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#08275E] disabled:bg-slate-100"
                required
              />
            </div>
          </div>

          {/* Refund Method Selection */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Payout Method *
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              disabled={isBlockedMethod}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#08275E] disabled:bg-slate-100"
            >
              <option value="CARD_PAYHERE">PayHere Card (Gateway Refund)</option>
              <option value="BANK_TRANSFER">Manual Bank Transfer (Direct Remittance)</option>
            </select>
          </div>

          {/* Method Specific Explanations */}
          {isPayHere && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <CreditCard className="w-3.5 h-3.5 text-[#08275E]" />
                <span>PayHere Execution Procedure:</span>
              </div>
              <p>
                1. Requesting registers this refund in <code>REQUESTED</code> status and reserves the
                order balance.
              </p>
              <p>
                2. After independent approval, execute the refund via the{' '}
                <strong>PayHere Merchant Portal</strong>.
              </p>
              <p>3. Enter the PayHere transaction reference to complete the refund record.</p>
            </div>
          )}

          {isBankTransfer && (
            <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2.5">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <Building className="w-3.5 h-3.5 text-amber-700" />
                <span>Beneficiary Bank Remittance Details:</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 font-bold uppercase mb-0.5">
                    Bank Name *
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. Commercial Bank"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#08275E]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 font-bold uppercase mb-0.5">
                    Account Number *
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="e.g. 8001234567"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#08275E]"
                  />
                </div>
              </div>
              <p className="text-[10px] text-amber-800 italic">
                * Note: Full account numbers are never stored in the database. Only masked numbers
                (e.g., ••••4567) are retained.
              </p>
            </div>
          )}

          {/* Linked Return Request Selection */}
          {returnRequests.length > 0 && (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Link to Return Request (Optional)
              </label>
              <select
                value={selectedReturnId}
                onChange={(e) => setSelectedReturnId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#08275E]"
              >
                <option value="">-- No Return Linked (Manual / Cancellation Refund) --</option>
                {returnRequests
                  .filter((r) => r.status === 'APPROVED' || r.status === 'COMPLETED')
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      Return #{r.returnNumber} ({r.status}) - {r.reason}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Reason Field */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Official Reason / Audit Note *
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State reason for customer refund..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#08275E]"
              required
            />
          </div>

          {/* Dual Custody Warning */}
          <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600 text-[11px] flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              <strong>Segregation of Duties Enforced:</strong> As the requester, you will NOT be
              permitted to approve or complete this refund. Secondary administrative sign-off is
              required.
            </span>
          </div>

          {/* Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || isBlockedMethod || availableBalanceCents <= 0}
              className="px-4 py-2 rounded-xl bg-[#08275E] hover:bg-[#103b8c] text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? 'Submitting Request...' : 'Submit Refund Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

