'use client';

import React from 'react';
import Link from 'next/link';
import {
  Eye,
  ChevronLeft,
  ChevronRight,
  PackageOpen,
  AlertCircle,
  CreditCard,
  Banknote,
  RotateCw,
} from 'lucide-react';
import { Order } from '@/types/order';
import { OrderStatusBadge } from './OrderStatusBadge';
import { PaymentStatusBadge } from './PaymentStatusBadge';
import { formatLKR } from '@/lib/currency';

interface OrderTableProps {
  orders: Order[];
  isLoading: boolean;
  error?: string | null;
  onRetry?: () => void;
  page: number;
  limit: number;
  totalPages: number;
  totalOrders: number;
  onPageChange: (newPage: number) => void;
  onLimitChange?: (newLimit: number) => void;
}

export const OrderTable: React.FC<OrderTableProps> = ({
  orders,
  isLoading,
  error,
  onRetry,
  page,
  limit,
  totalPages,
  totalOrders,
  onPageChange,
  onLimitChange,
}) => {
  const formatPaymentMethod = (method: string) => {
    switch (method) {
      case 'CASH_ON_DELIVERY':
      case 'cash_on_delivery':
        return { label: 'Cash on Delivery', icon: Banknote };
      case 'CARD_PAYHERE':
      case 'card_mock':
        return { label: 'Card (PayHere)', icon: CreditCard };
      case 'BANK_TRANSFER':
      case 'bank_transfer_mock':
        return { label: 'Bank Transfer', icon: CreditCard };
      case 'KOKO_BNPL':
      case 'koko_pay_mock':
        return { label: 'Koko BNPL', icon: CreditCard };
      default:
        return { label: method?.replace(/_/g, ' ') || 'Payment', icon: CreditCard };
    }
  };

  if (error) {
    return (
      <div className="bg-white rounded-3xl border border-rose-200 p-12 text-center shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 mx-auto flex items-center justify-center mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-1">Failed to Load Orders</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mb-5">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#08275E] hover:bg-[#103b8c] text-white rounded-xl text-xs font-bold transition-all"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
      {/* Table responsive container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50/80 text-slate-600 border-b border-slate-200 text-[11px] uppercase tracking-wider font-bold">
              <th className="py-3.5 px-4">Order ID</th>
              <th className="py-3.5 px-4">Customer</th>
              <th className="py-3.5 px-4">Date &amp; Time</th>
              <th className="py-3.5 px-4">Items</th>
              <th className="py-3.5 px-4">Total Amount</th>
              <th className="py-3.5 px-4">Payment</th>
              <th className="py-3.5 px-4">Fulfilment</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              // Loading Skeleton Rows
              [...Array(6)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="py-4 px-4">
                    <div className="h-4 w-24 bg-slate-100 rounded" />
                  </td>
                  <td className="py-4 px-4">
                    <div className="h-4 w-32 bg-slate-100 rounded mb-1" />
                    <div className="h-3 w-40 bg-slate-50 rounded" />
                  </td>
                  <td className="py-4 px-4">
                    <div className="h-4 w-28 bg-slate-100 rounded" />
                  </td>
                  <td className="py-4 px-4">
                    <div className="h-4 w-12 bg-slate-100 rounded" />
                  </td>
                  <td className="py-4 px-4">
                    <div className="h-4 w-20 bg-slate-100 rounded" />
                  </td>
                  <td className="py-4 px-4">
                    <div className="h-5 w-24 bg-slate-100 rounded-full" />
                  </td>
                  <td className="py-4 px-4">
                    <div className="h-5 w-24 bg-slate-100 rounded-full" />
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="h-7 w-20 bg-slate-100 rounded-xl ml-auto" />
                  </td>
                </tr>
              ))
            ) : orders.length === 0 ? (
              // Empty State
              <tr>
                <td colSpan={8} className="py-16 px-4 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-400 mx-auto flex items-center justify-center mb-3">
                    <PackageOpen className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1">No Orders Found</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    No orders match your active filters or search terms. Try clearing or relaxing
                    your search parameters.
                  </p>
                </td>
              </tr>
            ) : (
              // Order Rows
              orders.map((order) => {
                const payMethodConfig = formatPaymentMethod(order.paymentMethod);
                const PayIcon = payMethodConfig.icon;
                const formattedDate = new Date(order.createdAt).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                });
                const formattedTime = new Date(order.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <tr
                    key={order.id}
                    className="hover:bg-slate-50/70 transition-colors group"
                  >
                    {/* Order ID */}
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-mono font-black text-[#08275E] hover:underline block"
                      >
                        {order.orderNumber}
                      </Link>
                      {order.trackingNumber && (
                        <span className="text-[10px] text-slate-400 font-mono block">
                          TRK: {order.trackingNumber}
                        </span>
                      )}
                    </td>

                    {/* Customer */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 group-hover:text-[#08275E] transition-colors">
                        {order.customerName}
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium">
                        {order.customerEmail}
                      </div>
                      <div className="text-[10px] text-slate-400">{order.customerPhone}</div>
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                      <div className="font-semibold text-slate-800">{formattedDate}</div>
                      <div className="text-[10px] text-slate-400">{formattedTime}</div>
                    </td>

                    {/* Items */}
                    <td className="py-3.5 px-4 text-slate-700">
                      <span className="font-bold">{order.items?.length || 0}</span>
                      <span className="text-slate-400 text-[11px] ml-1">items</span>
                    </td>

                    {/* Total Amount */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-black text-slate-900 text-sm">
                        {formatLKR(order.totalCents)}
                      </span>
                    </td>

                    {/* Payment Info */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <PaymentStatusBadge status={order.paymentStatus} />
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                          <PayIcon className="w-2.5 h-2.5" />
                          <span>{payMethodConfig.label}</span>
                        </div>
                      </div>
                    </td>

                    {/* Fulfilment Status */}
                    <td className="py-3.5 px-4">
                      <OrderStatusBadge status={order.orderStatus} />
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#08275E] hover:bg-[#103b8c] text-white font-bold text-xs shadow-xs transition-all hover:scale-[1.02]"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Order</span>
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {!isLoading && orders.length > 0 && (
        <div className="p-4 bg-slate-50/60 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>
              Page <strong className="text-slate-900 font-bold">{page}</strong> of{' '}
              <strong className="text-slate-900 font-bold">{Math.max(1, totalPages)}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span>
              Total records: <strong className="text-slate-900 font-bold">{totalOrders}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onLimitChange && (
              <div className="flex items-center gap-1 mr-2">
                <span className="text-[11px] text-slate-400">Rows:</span>
                <select
                  value={limit}
                  onChange={(e) => onLimitChange(Number(e.target.value))}
                  className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            )}

            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            {/* Numeric page pills */}
            <div className="hidden sm:flex items-center gap-1">
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                let p = i + 1;
                if (totalPages > 5 && page > 3) {
                  p = page - 2 + i;
                  if (p > totalPages) p = totalPages - (4 - i);
                }
                if (p < 1 || p > totalPages) return null;

                const isCurrent = p === page;
                return (
                  <button
                    key={p}
                    onClick={() => onPageChange(p)}
                    className={`w-7 h-7 rounded-lg font-bold text-xs transition-colors ${
                      isCurrent
                        ? 'bg-[#08275E] text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
