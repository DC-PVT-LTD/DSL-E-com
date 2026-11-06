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
import { OrderStatus } from '@/types/order';

interface OrderTimelineProps {
  currentStatus: OrderStatus;
  createdAt: string;
  updatedAt?: string;
}

export const OrderTimeline: React.FC<OrderTimelineProps> = ({
  currentStatus,
  createdAt,
  updatedAt,
}) => {
  const norm = (currentStatus || 'PENDING').toUpperCase();
  const isCancelled = norm === 'CANCELLED';

  const stages = [
    { key: 'PENDING', label: 'Order Placed', icon: Clock },
    { key: 'CONFIRMED', label: 'Confirmed', icon: CheckCircle },
    { key: 'PROCESSING', label: 'Processing & Packing', icon: PackageCheck },
    { key: 'SHIPPED', label: 'Dispatched / In Transit', icon: Truck },
    { key: 'DELIVERED', label: 'Delivered', icon: CheckCheck },
  ];

  const stageOrder = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
  const currentIndex = stageOrder.indexOf(norm);

  if (isCancelled) {
    return (
      <div className="bg-rose-50/60 rounded-3xl border border-rose-200 p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-rose-950">Order Cancelled</h4>
            <p className="text-xs text-rose-700">
              This order was cancelled on {new Date(updatedAt || createdAt).toLocaleString()}. Physical inventory has been returned.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Fulfillment Lifecycle Progress</h3>
          <p className="text-[11px] text-slate-400">Chronological state pipeline</p>
        </div>
        <span className="text-[11px] font-bold text-slate-500">
          Created: {new Date(createdAt).toLocaleDateString()}
        </span>
      </div>

      <div className="relative pt-2 pb-2">
        {/* Progress bar background line */}
        <div className="absolute top-5 left-6 right-6 h-1 bg-slate-100 -z-0 hidden md:block" />
        <div
          className="absolute top-5 left-6 h-1 bg-[#08275E] transition-all duration-500 -z-0 hidden md:block"
          style={{
            width: `${Math.max(0, Math.min(100, (currentIndex / (stages.length - 1)) * 100))}%`,
          }}
        />

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {stages.map((stage, idx) => {
            const Icon = stage.icon;
            const isCompleted = currentIndex >= idx;
            const isCurrent = currentIndex === idx;

            return (
              <div
                key={stage.key}
                className="flex md:flex-col items-center md:items-center gap-3 md:gap-2 text-left md:text-center z-10"
              >
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 transition-all ${
                    isCurrent
                      ? 'bg-[#08275E] text-white ring-4 ring-[#08275E]/20 scale-110 shadow-sm'
                      : isCompleted
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div
                    className={`text-xs font-bold ${
                      isCurrent
                        ? 'text-[#08275E]'
                        : isCompleted
                        ? 'text-slate-800'
                        : 'text-slate-400'
                    }`}
                  >
                    {stage.label}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {isCurrent ? 'Current stage' : isCompleted ? 'Completed' : 'Pending'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
