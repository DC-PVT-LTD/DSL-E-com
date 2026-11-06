'use client';

import React, { useState } from 'react';
import { MessageCircle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { CartSummary } from '@/types/cart';
import { openWhatsAppEnquiry, validateAndCleanWhatsAppNumber, getWhatsAppBusinessNumber } from '@/lib/whatsapp';
import { cartService } from '@/services/cartService';

interface WhatsAppOrderButtonProps {
  summary: CartSummary;
  className?: string;
  variant?: 'primary' | 'secondary' | 'compact';
  onEnquiryOpened?: (url: string) => void;
}

export const WhatsAppOrderButton: React.FC<WhatsAppOrderButtonProps> = ({
  summary,
  className = '',
  variant = 'primary',
  onEnquiryOpened,
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const rawPhone = getWhatsAppBusinessNumber();
  const phoneValidation = validateAndCleanWhatsAppNumber(rawPhone);

  const activeItems = summary.selectedItems && summary.selectedItems.length > 0
    ? summary.selectedItems
    : (summary.items || []).filter((item) => item.selected !== false);

  const hasUnavailableItems = activeItems.some(
    (item) => item.isOutOfStock || item.isAvailable === false || item.exceedsStock
  );

  const handleClick = () => {
    setErrorMessage(null);
    setSuccessNotice(null);

    if (activeItems.length === 0) {
      setErrorMessage('Please select at least one stationery item before enquiring via WhatsApp.');
      return;
    }

    if (!phoneValidation.isValid) {
      setErrorMessage(
        phoneValidation.error ||
          'The store WhatsApp Business contact number is not configured. Please check Store Settings in the Admin Portal.'
      );
      return;
    }

    const cartRef = cartService.getGuestSessionId() || undefined;
    const result = openWhatsAppEnquiry(summary, {
      phone: rawPhone,
      cartRef,
    });

    if (!result.success) {
      setErrorMessage(result.error || 'Failed to generate WhatsApp order message.');
    } else {
      setSuccessNotice('WhatsApp opened in a new tab! Please send the message to initiate your enquiry.');
      if (onEnquiryOpened && result.url) {
        onEnquiryOpened(result.url);
      }
      setTimeout(() => setSuccessNotice(null), 5000);
    }
  };

  const isCompact = variant === 'compact';

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Warning for items requiring stock verification */}
      {hasUnavailableItems && (
        <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-900 leading-tight">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            <strong>Stock Notice:</strong> One or more items in your cart require stock verification. DSL Stationery will verify availability upon receiving your enquiry.
          </span>
        </div>
      )}

      {/* WhatsApp Button */}
      <button
        type="button"
        onClick={handleClick}
        disabled={activeItems.length === 0}
        aria-label="Order via WhatsApp"
        className={`w-full flex items-center justify-center gap-2.5 font-bold transition-all rounded-full shadow-sm text-white ${
          activeItems.length === 0
            ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60'
            : 'bg-[#25D366] hover:bg-[#1EBE5D] active:scale-[0.99] hover:shadow-md cursor-pointer'
        } ${isCompact ? 'py-2.5 px-4 text-xs' : 'py-3.5 px-6 text-sm'}`}
      >
        {/* WhatsApp Brand SVG */}
        <svg
          className={isCompact ? 'w-4 h-4' : 'w-5 h-5'}
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2ZM12.04 20.15C10.56 20.15 9.11 19.76 7.85 19.01L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 14.99 3.8 13.47 3.8 11.91C3.8 7.37 7.5 3.67 12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15ZM16.56 14.36C16.31 14.24 15.09 13.64 14.86 13.56C14.63 13.47 14.47 13.43 14.3 13.68C14.14 13.93 13.67 14.48 13.53 14.64C13.38 14.81 13.24 14.83 12.99 14.7C12.74 14.58 11.95 14.32 11.01 13.48C10.28 12.83 9.78 12.02 9.64 11.78C9.49 11.53 9.62 11.39 9.75 11.27C9.86 11.16 10 10.99 10.12 10.85C10.24 10.71 10.29 10.6 10.37 10.44C10.45 10.27 10.41 10.13 10.35 10.01C10.29 9.88 9.8 8.68 9.59 8.19C9.39 7.71 9.19 7.77 9.04 7.76C8.89 7.76 8.73 7.76 8.56 7.76C8.4 7.76 8.13 7.82 7.9 8.07C7.68 8.32 7.04 8.92 7.04 10.13C7.04 11.35 7.93 12.52 8.05 12.69C8.17 12.85 9.8 15.36 12.28 16.43C12.87 16.69 13.33 16.84 13.69 16.95C14.28 17.14 14.82 17.11 15.25 17.05C15.73 16.98 16.71 16.45 16.92 15.88C17.12 15.31 17.12 14.81 17.06 14.71C17 14.6 16.81 14.49 16.56 14.36Z" />
        </svg>
        <span>Order via WhatsApp</span>
      </button>

      {/* Clear Enquiry Notice / Disclaimer */}
      <p className="text-[10px] sm:text-[11px] text-[#292525]/60 text-center leading-normal px-2">
        🌸 <strong>Order Enquiry Notice:</strong> Your WhatsApp message is an enquiry. Your order is confirmed only after DSL Stationery verifies availability, pricing and payment.
      </p>

      {/* Error feedback */}
      {errorMessage && (
        <div className="flex items-center gap-1.5 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Success feedback */}
      {successNotice && (
        <div className="flex items-center gap-1.5 p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successNotice}</span>
        </div>
      )}
    </div>
  );
};

