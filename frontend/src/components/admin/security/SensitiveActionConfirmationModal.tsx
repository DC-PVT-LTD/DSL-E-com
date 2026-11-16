'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, CheckCircle2, ShieldAlert } from 'lucide-react';

export interface SensitiveActionConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  actionTitle: string;
  actionDescription: string;
  impactWarning?: string;
  targetResourceType?: string;
  targetResourceName?: string;
  expectedConfirmationPhrase: string;
  confirmButtonLabel?: string;
  onConfirmed: (confirmationPhrase: string) => Promise<void> | void;
  isDestructive?: boolean;
}

export function SensitiveActionConfirmationModal({
  isOpen,
  onClose,
  actionTitle,
  actionDescription,
  impactWarning,
  targetResourceType,
  targetResourceName,
  expectedConfirmationPhrase,
  confirmButtonLabel = 'Confirm & Execute',
  onConfirmed,
  isDestructive = true,
}: SensitiveActionConfirmationProps) {
  const [typedValue, setTypedValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTypedValue('');
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Matching logic:
  // Case-insensitive for email addresses, exact trimmed match for text phrases
  const isEmail = expectedConfirmationPhrase.includes('@');
  const isMatch = isEmail
    ? typedValue.trim().toLowerCase() === expectedConfirmationPhrase.trim().toLowerCase()
    : typedValue.trim() === expectedConfirmationPhrase.trim();

  const handleConfirm = async () => {
    if (!isMatch || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await onConfirmed(typedValue.trim());
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to complete sensitive operation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isDestructive
                  ? 'bg-red-50 text-red-600 border border-red-200'
                  : 'bg-amber-50 text-amber-600 border border-amber-200'
              }`}
            >
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 leading-tight">{actionTitle}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{actionDescription}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition disabled:opacity-50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Target Resource Callout */}
          {(targetResourceType || targetResourceName) && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                {targetResourceType || 'Target Resource'}:
              </span>
              <span className="font-mono font-bold text-slate-800 break-all">{targetResourceName}</span>
            </div>
          )}

          {/* Impact Warning */}
          {impactWarning && (
            <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-black text-amber-950 text-[11px] uppercase tracking-wider">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Impact Warning</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">{impactWarning}</p>
            </div>
          )}

          {/* Confirmation Prompt */}
          <div className="space-y-2 pt-1">
            <p className="text-xs text-slate-600 leading-relaxed">
              To proceed with this operation, please type{' '}
              <span className="inline-block px-2 py-0.5 font-mono font-bold text-xs bg-slate-100 text-slate-900 border border-slate-300 rounded-md select-all">
                {expectedConfirmationPhrase}
              </span>{' '}
              in the input below:
            </p>

            <input
              type="text"
              autoFocus
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              placeholder={`Type "${expectedConfirmationPhrase}" to confirm`}
              disabled={isSubmitting}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#08275E] focus:border-transparent transition shadow-inner"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 transition disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isMatch || isSubmitting}
            className={`px-5 py-2 rounded-xl text-xs font-bold text-white transition flex items-center gap-1.5 shadow-xs cursor-pointer ${
              isMatch
                ? isDestructive
                  ? 'bg-red-600 hover:bg-red-700 shadow-red-200'
                  : 'bg-[#08275E] hover:bg-[#0c3785] shadow-blue-200'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60'
            }`}
          >
            {isSubmitting ? (
              <span>Verifying & Executing...</span>
            ) : (
              <>
                {isMatch && <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>{confirmButtonLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Re-export as alias for compatibility
export const SensitiveActionConfirmation = SensitiveActionConfirmationModal;
