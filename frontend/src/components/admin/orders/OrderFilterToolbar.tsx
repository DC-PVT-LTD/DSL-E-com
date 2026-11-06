'use client';

import React from 'react';
import { Search, RotateCcw, Calendar, ArrowUpDown, Filter } from 'lucide-react';
import { OrderQueryParams } from '@/types/order';

interface OrderFilterToolbarProps {
  filters: OrderQueryParams;
  onFilterChange: (updates: Partial<OrderQueryParams>) => void;
  onClearFilters: () => void;
  totalResults: number;
  isLoading: boolean;
}

export const OrderFilterToolbar: React.FC<OrderFilterToolbarProps> = ({
  filters,
  onFilterChange,
  onClearFilters,
  totalResults,
  isLoading,
}) => {
  const hasActiveFilters = Boolean(
    (filters.search && filters.search.trim().length > 0) ||
      (filters.status && filters.status !== 'all') ||
      (filters.paymentStatus && filters.paymentStatus !== 'all') ||
      filters.startDate ||
      filters.endDate ||
      filters.sortBy !== 'createdAt' ||
      filters.sortOrder !== 'desc'
  );

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-xs space-y-3.5 text-xs">
      {/* Top row: Search and primary filter pills */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Order #, Customer, Email, or Phone..."
            value={filters.search || ''}
            onChange={(e) => onFilterChange({ search: e.target.value, page: 1 })}
            className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E] transition-all"
          />
          {filters.search && (
            <button
              onClick={() => onFilterChange({ search: '', page: 1 })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Order Status */}
          <div className="relative">
            <select
              value={filters.status || 'all'}
              onChange={(e) => onFilterChange({ status: e.target.value, page: 1 })}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E] transition-colors cursor-pointer text-xs"
            >
              <option value="all">All Order Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PROCESSING">Processing</option>
              <option value="SHIPPED">Shipped</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Payment Status */}
          <div className="relative">
            <select
              value={filters.paymentStatus || 'all'}
              onChange={(e) => onFilterChange({ paymentStatus: e.target.value, page: 1 })}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E] transition-colors cursor-pointer text-xs"
            >
              <option value="all">All Payment Statuses</option>
              <option value="PAID">Paid</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
              <option value="REFUNDED">Refunded</option>
            </select>
          </div>

          {/* Sorting */}
          <div className="relative flex items-center">
            <select
              value={`${filters.sortBy || 'createdAt'}-${filters.sortOrder || 'desc'}`}
              onChange={(e) => {
                const [by, order] = e.target.value.split('-') as [
                  'createdAt' | 'totalCents' | 'orderNumber',
                  'asc' | 'desc'
                ];
                onFilterChange({ sortBy: by, sortOrder: order, page: 1 });
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#08275E]/20 focus:border-[#08275E] transition-colors cursor-pointer text-xs"
            >
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
              <option value="totalCents-desc">Highest Amount</option>
              <option value="totalCents-asc">Lowest Amount</option>
              <option value="orderNumber-asc">Order Number (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bottom row: Date range filter, active indicators, and reset CTA */}
      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-slate-600">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Date Range:</span>
          </span>

          <input
            type="date"
            value={filters.startDate || ''}
            onChange={(e) => onFilterChange({ startDate: e.target.value, page: 1 })}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#08275E]"
            title="Start Date"
          />
          <span className="text-slate-400 text-xs">to</span>
          <input
            type="date"
            value={filters.endDate || ''}
            onChange={(e) => onFilterChange({ endDate: e.target.value, page: 1 })}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#08275E]"
            title="End Date"
          />

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 font-bold transition-colors cursor-pointer text-xs"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear All Filters</span>
            </button>
          )}
        </div>

        <div className="text-[11px] font-medium text-slate-500 flex items-center gap-2">
          {isLoading ? (
            <span className="text-[#08275E] font-semibold animate-pulse">Syncing orders...</span>
          ) : (
            <span>
              Showing <strong className="text-slate-900 font-bold">{totalResults}</strong> orders
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
