'use client';

import React from 'react';
import {
  Clock,
  CheckCircle,
  PackageCheck,
  Truck,
  CheckCheck,
  XCircle,
} from 'lucide-react';

interface OrderStatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
}

export const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({ status, size = 'sm' }) => {
  const norm = (status || 'PENDING').toUpperCase();

  const configs: Record<
    string,
    { label: string; bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }> }
  > = {
    PENDING: {
      label: 'Pending',
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200',
      icon: Clock,
    },
    CONFIRMED: {
      label: 'Confirmed',
      bg: 'bg-blue-50',
      text: 'text-blue-800',
      border: 'border-blue-200',
      icon: CheckCircle,
    },
    PROCESSING: {
      label: 'Processing',
      bg: 'bg-indigo-50',
      text: 'text-indigo-800',
      border: 'border-indigo-200',
      icon: PackageCheck,
    },
    PACKED: {
      label: 'Packed',
      bg: 'bg-teal-50',
      text: 'text-teal-800',
      border: 'border-teal-200',
      icon: PackageCheck,
    },
    SHIPPED: {
      label: 'Shipped',
      bg: 'bg-purple-50',
      text: 'text-purple-800',
      border: 'border-purple-200',
      icon: Truck,
    },
    DELIVERED: {
      label: 'Delivered',
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      border: 'border-emerald-200',
      icon: CheckCheck,
    },
    CANCELLED: {
      label: 'Cancelled',
      bg: 'bg-rose-50',
      text: 'text-rose-800',
      border: 'border-rose-200',
      icon: XCircle,
    },
  };

  const current = configs[norm] || configs.PENDING;
  const Icon = current.icon;

  const sizeClasses = {
    sm: 'text-[11px] px-2.5 py-1 gap-1.5',
    md: 'text-xs px-3 py-1.5 gap-2',
    lg: 'text-sm px-4 py-2 gap-2.5 font-bold',
  }[size];

  return (
    <span
      className={`inline-flex items-center font-bold uppercase tracking-wider rounded-full border ${current.bg} ${current.text} ${current.border} ${sizeClasses}`}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3 shrink-0' : 'w-4 h-4 shrink-0'} />
      <span>{current.label}</span>
    </span>
  );
};
