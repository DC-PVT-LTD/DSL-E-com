'use client';

import React from 'react';
import {
  ShoppingBag,
  Clock,
  PackageCheck,
  Truck,
  CheckCircle2,
  XCircle,
  TrendingUp,
} from 'lucide-react';
import { OrderStats } from '@/types/order';
import { formatLKR } from '@/lib/currency';

interface OrderStatsCardsProps {
  stats: OrderStats | null;
  isLoading: boolean;
  activeFilter?: string;
  onSelectFilter?: (status: string) => void;
}

export const OrderStatsCards: React.FC<OrderStatsCardsProps> = ({
  stats,
  isLoading,
  activeFilter,
  onSelectFilter,
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs animate-pulse"
          >
            <div className="w-8 h-8 rounded-xl bg-slate-100 mb-2.5" />
            <div className="h-3 w-16 bg-slate-100 rounded mb-1.5" />
            <div className="h-6 w-12 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      id: 'all',
      statusKey: 'all',
      label: 'Total Orders',
      count: stats?.total ?? 0,
      icon: ShoppingBag,
      color: 'text-[#08275E]',
      bg: 'bg-blue-50/70',
      activeBorder: 'ring-2 ring-[#08275E] border-transparent',
    },
    {
      id: 'PENDING',
      statusKey: 'PENDING',
      label: 'Pending',
      count: stats?.pending ?? 0,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50/70',
      activeBorder: 'ring-2 ring-amber-500 border-transparent',
    },
    {
      id: 'CONFIRMED',
      statusKey: 'CONFIRMED',
      label: 'Confirmed',
      count: stats?.confirmed ?? 0,
      icon: CheckCircle2,
      color: 'text-blue-600',
      bg: 'bg-blue-50/70',
      activeBorder: 'ring-2 ring-blue-500 border-transparent',
    },
    {
      id: 'PROCESSING',
      statusKey: 'PROCESSING',
      label: 'Processing',
      count: stats?.processing ?? 0,
      icon: PackageCheck,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50/70',
      activeBorder: 'ring-2 ring-indigo-500 border-transparent',
    },
    {
      id: 'PACKED',
      statusKey: 'PACKED',
      label: 'Packed',
      count: (stats as any)?.packed ?? 0,
      icon: PackageCheck,
      color: 'text-teal-600',
      bg: 'bg-teal-50/70',
      activeBorder: 'ring-2 ring-teal-500 border-transparent',
    },
    {
      id: 'SHIPPED',
      statusKey: 'SHIPPED',
      label: 'Shipped',
      count: stats?.shipped ?? 0,
      icon: Truck,
      color: 'text-purple-600',
      bg: 'bg-purple-50/70',
      activeBorder: 'ring-2 ring-purple-500 border-transparent',
    },
    {
      id: 'DELIVERED',
      statusKey: 'DELIVERED',
      label: 'Delivered',
      count: stats?.delivered ?? 0,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50/70',
      activeBorder: 'ring-2 ring-emerald-500 border-transparent',
    },
    {
      id: 'CANCELLED',
      statusKey: 'CANCELLED',
      label: 'Cancelled',
      count: stats?.cancelled ?? 0,
      icon: XCircle,
      color: 'text-rose-600',
      bg: 'bg-rose-50/70',
      activeBorder: 'ring-2 ring-rose-500 border-transparent',
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          const isSelected =
            (activeFilter?.toUpperCase() === card.statusKey) ||
            (!activeFilter && card.statusKey === 'all') ||
            (activeFilter === 'all' && card.statusKey === 'all');

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onSelectFilter?.(card.statusKey)}
              className={`bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs text-left transition-all hover:shadow-md cursor-pointer group ${
                isSelected ? card.activeBorder : 'hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`w-8 h-8 rounded-xl ${card.bg} ${card.color} flex items-center justify-center transition-transform group-hover:scale-105`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                {isSelected && (
                  <span className="w-2 h-2 rounded-full bg-[#08275E]" />
                )}
              </div>
              <div className="text-[11px] font-semibold text-slate-500 truncate">
                {card.label}
              </div>
              <div className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
                {card.count.toLocaleString()}
              </div>
            </button>
          );
        })}
      </div>

      {stats?.totalRevenueCents !== undefined && stats.totalRevenueCents > 0 && (
        <div className="bg-gradient-to-r from-[#08275E] to-[#103b8c] text-white rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-[#FFD84D]" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wider block">
                Total Orders Value (Excl. Cancelled)
              </span>
              <span className="text-lg font-black text-white">
                {formatLKR(stats.totalRevenueCents)}
              </span>
            </div>
          </div>
          <div className="text-xs text-white/80 self-start sm:self-auto font-medium">
            Synchronized live with backend records
          </div>
        </div>
      )}
    </div>
  );
};
