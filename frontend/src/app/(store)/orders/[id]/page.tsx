'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Package,
  CheckCircle2,
  Clock,
  Truck,
  ArrowLeft,
  XCircle,
  AlertCircle,
  MapPin,
  Calendar,
} from 'lucide-react';
import { orderService } from '@/services/orderService';
import { Order, OrderStatus } from '@/types/order';
import { formatLKR } from '@/lib/currency';

const STATUS_STEPS: { key: OrderStatus; label: string }[] = [
  { key: 'confirmed', label: 'Order Confirmed' },
  { key: 'processing', label: 'Packing in Warehouse' },
  { key: 'shipped', label: 'Dispatched to Courier' },
  { key: 'delivered', label: 'Delivered' },
];

function OrderTrackingContent() {
  const params = useParams();
  const id = params.id as string;
  const [order, setOrder] = useState<Order | undefined>(undefined);

  useEffect(() => {
    const o = orderService.getById(id);
    setOrder(o);

    const unsub = orderService.subscribe(() => {
      setOrder(orderService.getById(id));
    });
    return () => unsub();
  }, [id]);

  if (!order) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-[#292525]">Order Not Found</h1>
        <p className="text-xs text-[#292525]/60 mt-2">Could not find any order with ID {id}.</p>
        <Link
          href="/shop"
          className="mt-4 inline-flex items-center gap-1.5 bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold px-5 py-2.5 rounded-full shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Shop</span>
        </Link>
      </div>
    );
  }

  const currentStepIdx = STATUS_STEPS.findIndex((s) => s.key === order.orderStatus);
  const isCancelled = order.orderStatus === 'cancelled';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#C6E7FF]/30 gap-4">
        <div>
          <Link href="/account/orders" className="text-xs font-bold text-[#0066CC] hover:underline flex items-center gap-1 mb-2">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Orders</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black text-[#292525] tracking-tight">
            Order #{order.orderNumber}
          </h1>
          <p className="text-xs text-[#292525]/60 mt-1">
            Placed on {new Date(order.createdAt).toLocaleDateString('en-LK', { dateStyle: 'long' })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
            isCancelled
              ? 'bg-rose-100 text-rose-800'
              : order.orderStatus === 'delivered'
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-[#FFFDF0] text-[#292525] border border-[#C6E7FF]'
          }`}>
            {order.orderStatus.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Tracking Stepper */}
      {!isCancelled ? (
        <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 sm:p-8 shadow-sm">
          <h2 className="text-sm font-bold text-[#292525] mb-6 flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#0066CC]" />
            <span>Live Delivery Timeline</span>
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {STATUS_STEPS.map((step, idx) => {
              const isCompleted = idx <= currentStepIdx;
              const isCurrent = idx === currentStepIdx;
              return (
                <div key={step.key} className="relative flex flex-col items-center text-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs mb-2 transition-all ${
                      isCompleted
                        ? 'bg-[#0066CC] text-white shadow-xs'
                        : 'bg-[#FFFDF0] text-[#292525]/40 border border-[#C6E7FF]/40'
                    } ${isCurrent ? 'ring-4 ring-[#C6E7FF]/50' : ''}`}
                  >
                    {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                  </div>
                  <span className={`text-xs ${isCompleted ? 'font-bold text-[#292525]' : 'text-[#292525]/40'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-8 pt-6 border-t border-[#C6E7FF]/30 flex flex-wrap items-center justify-between text-xs text-[#292525]/70 gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#0066CC]" />
              <span>Estimated Delivery: <strong className="text-[#292525]">{order.estimatedDeliveryDate || '2-3 Business Days'}</strong></span>
            </div>
            <div>
              Courier Tracking: <strong className="font-mono text-[#292525] bg-[#FFFDF0] px-2 py-0.5 rounded border border-[#C6E7FF]/50">{order.trackingNumber}</strong>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 flex items-center gap-3 text-xs text-rose-800">
          <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>This order was cancelled and inventory has been returned to stock.</span>
        </div>
      )}

      {/* Items & Shipping Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 sm:p-7 space-y-4 shadow-sm">
          <h2 className="text-sm font-bold text-[#292525] pb-2 border-b border-[#C6E7FF]/30">
            Package Contents ({order.items.length} items)
          </h2>
          <div className="space-y-3">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between items-center py-2 border-b border-stone-100 text-xs">
                <div>
                  <div className="font-bold text-[#292525]">{item.product.name}</div>
                  <div className="text-[#292525]/50">Qty: {item.quantity} × {formatLKR(item.unitPriceCents)}</div>
                </div>
                <div className="font-bold text-[#292525]">{formatLKR(item.totalPriceCents)}</div>
              </div>
            ))}
          </div>

          <div className="pt-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-[#292525]/70">
              <span>Subtotal</span>
              <span>{formatLKR(order.subtotalCents)}</span>
            </div>
            {order.discountCents > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount</span>
                <span>-{formatLKR(order.discountCents)}</span>
              </div>
            )}
            <div className="flex justify-between text-[#292525]/70">
              <span>Delivery</span>
              <span>{order.deliveryCents === 0 ? <span className="text-[#0066CC] font-bold">FREE</span> : formatLKR(order.deliveryCents)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-[#292525] pt-2 border-t border-[#C6E7FF]/30">
              <span>Total Paid</span>
              <span className="text-base font-black text-[#0066CC]">{formatLKR(order.totalCents)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 sm:p-7 space-y-4 shadow-sm text-xs">
          <h2 className="text-sm font-bold text-[#292525] pb-2 border-b border-[#C6E7FF]/30">
            Shipping Destination
          </h2>
          <div>
            <strong className="block text-[#292525] font-bold">{order.customerName}</strong>
            <p className="text-[#292525]/70 mt-1 leading-relaxed">
              {order.shippingAddress.addressLine1}
              {order.shippingAddress.addressLine2 && <>, {order.shippingAddress.addressLine2}</>}
              <br />
              {order.shippingAddress.city}, {order.shippingAddress.district}
              {order.shippingAddress.postalCode && <> - {order.shippingAddress.postalCode}</>}
            </p>
            <p className="text-[#292525]/70 mt-2">Phone: {order.customerPhone}</p>
          </div>

          <div className="pt-4 border-t border-[#C6E7FF]/30">
            <span className="text-[#292525]/50 block text-[10px] uppercase font-bold">Payment Method</span>
            <span className="font-bold text-[#292525] capitalize mt-0.5 block">
              {order.paymentMethod.replace('_', ' ')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrderTrackingPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-[#292525]/50">Loading order tracking...</div>}>
      <OrderTrackingContent />
    </Suspense>
  );
}
