'use client';

import React from 'react';
import { CheckCircle2, Clock, XCircle, RotateCcw } from 'lucide-react';

interface PaymentStatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const PaymentStatusBadge: React.FC<PaymentStatusBadgeProps> = ({ status, size = 'sm' }) => {
  const norm = (status || 'PENDING').toUpperCase();

  const configs: Record<
    string,
    { label: string; bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }> }
  > = {
    PAID: {
      label: 'Paid',
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      icon: CheckCircle2,
    },
    SIMULATED_PAID: {
      label: 'Paid',
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      icon: CheckCircle2,
    },
    PENDING: {
      label: 'Payment Pending',
      bg: 'bg-slate-50',
      text: 'text-slate-700',
      border: 'border-slate-200',
      icon: Clock,
    },
    FAILED: {
      label: 'Failed',
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200',
      icon: XCircle,
    },
    REFUNDED: {
      label: 'Refunded',
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200',
      icon: RotateCcw,
    },
  };

  const current = configs[norm] || configs.PENDING;
  const Icon = current.icon;

  const sizeClasses = size === 'sm' ? 'text-[10px] px-2.5 py-0.5 gap-1.5' : 'text-xs px-3 py-1 gap-2';

  return (
    <span
      className={`inline-flex items-center font-bold uppercase tracking-wider rounded-full border ${current.bg} ${current.text} ${current.border} ${sizeClasses}`}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0'} />
      <span>{current.label}</span>
    </span>
  );
};
