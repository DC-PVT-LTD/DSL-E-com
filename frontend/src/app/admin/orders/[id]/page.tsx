'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  DollarSign,
} from 'lucide-react';
import { orderService, PERMITTED_ORDER_TRANSITIONS } from '@/services/orderService';
import { Order, OrderStatus, PaymentStatus } from '@/types/order';
import { formatLKR } from '@/lib/currency';

function AdminOrderDetailContent() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [order, setOrder] = useState<Order | undefined>(undefined);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadData = () => {
    setOrder(orderService.getById(id));
  };

  useEffect(() => {
    loadData();
    const unsub = orderService.subscribe(loadData);
    return () => unsub();
  }, [id]);

  if (!order) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center text-xs text-slate-500">
        Order not found.
      </div>
    );
  }

  const allowedTransitions = PERMITTED_ORDER_TRANSITIONS[order.orderStatus] || [];

  const handleTransition = (newStatus: OrderStatus) => {
    const success = orderService.updateOrderStatus(order.id, newStatus);
    if (success) {
      setStatusMessage(`Order updated to ${newStatus}`);
      setTimeout(() => setStatusMessage(null), 2000);
    }
  };

  const handleRefund = () => {
    orderService.updatePaymentStatus(order.id, 'refunded');
    setStatusMessage('Simulated refund issued.');
    setTimeout(() => setStatusMessage(null), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <Link href="/admin/orders" className="text-xs font-semibold text-[#08275E] hover:underline flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Orders List</span>
          </Link>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Order #{order.orderNumber}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Placed on {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-blue-100 text-[#08275E]">
            {order.orderStatus}
          </span>
          <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
            Payment: {order.paymentStatus.replace('_', ' ')}
          </span>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold animate-fade-in flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Fulfillment Actions Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900">Manage Fulfillment State Transition</h2>
        <p className="text-xs text-slate-500">
          Current status: <strong className="text-slate-800 capitalize">{order.orderStatus}</strong>.
          Adheres to permitted business lifecycle rules.
        </p>

        {allowedTransitions.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-2">
            {allowedTransitions.map((nextStatus) => {
              const isCancel = nextStatus === 'cancelled';
              return (
                <button
                  key={nextStatus}
                  onClick={() => handleTransition(nextStatus)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    isCancel
                      ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                      : 'bg-[#08275E] hover:bg-[#103b8c] text-white shadow-xs'
                  }`}
                >
                  Transition to &ldquo;{nextStatus}&rdquo;
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">
            This order is in a terminal state ({order.orderStatus}). No further transitions allowed.
          </p>
        )}

        {/* Refund Demo CTA */}
        {order.paymentStatus === 'simulated_paid' && (
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">Need to issue a simulated customer refund?</span>
            <button
              onClick={handleRefund}
              className="px-3.5 py-1.5 rounded-xl border border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 text-xs font-bold transition-colors"
            >
              Issue Demo Refund
            </button>
          </div>
        )}
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer & Address */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs text-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
            Customer Information
          </h2>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Name</span>
            <strong className="text-slate-900 text-sm block">{order.customerName}</strong>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Contact</span>
            <div className="text-slate-700">{order.customerEmail}</div>
            <div className="text-slate-700">{order.customerPhone}</div>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Delivery Address</span>
            <div className="text-slate-700 font-medium">
              {order.shippingAddress.addressLine1}
              {order.shippingAddress.addressLine2 && <>, {order.shippingAddress.addressLine2}</>}
              <br />
              {order.shippingAddress.city}, {order.shippingAddress.district}
            </div>
          </div>
        </div>

        {/* Order Cost Items */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs text-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
            Payment &amp; Financial Summary
          </h2>

          <div className="space-y-2">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span>{formatLKR(order.subtotalCents)}</span>
            </div>
            {order.discountCents > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Voucher Discount</span>
                <span>-{formatLKR(order.discountCents)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-500">
              <span>Delivery Fee</span>
              <span>{order.deliveryCents === 0 ? 'FREE' : formatLKR(order.deliveryCents)}</span>
            </div>
            <div className="flex justify-between text-sm font-black text-slate-900 pt-3 border-t border-slate-100">
              <span>Total Value (LKR)</span>
              <span className="text-[#08275E]">{formatLKR(order.totalCents)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Ordered Products Table */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900">Ordered Products List</h2>
        <div className="divide-y divide-slate-100 text-xs">
          {order.items.map((item) => (
            <div key={item.id} className="py-2.5 flex justify-between items-center">
              <div>
                <span className="font-bold text-slate-800 block">{item.product.name}</span>
                <span className="text-slate-400 text-[11px]">
                  Qty: {item.quantity} × {formatLKR(item.unitPriceCents)}
                </span>
              </div>
              <span className="font-bold text-slate-900">{formatLKR(item.totalPriceCents)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminOrderDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto py-12 text-center text-xs text-slate-500">
          Loading order details...
        </div>
      }
    >
      <AdminOrderDetailContent />
    </Suspense>
  );
}

