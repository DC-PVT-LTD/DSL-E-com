'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Package, ArrowRight, Printer, AlertTriangle, Sparkles } from 'lucide-react';
import { orderService } from '@/services/orderService';
import { Order } from '@/types/order';
import { formatLKR } from '@/lib/currency';

function CheckoutResultContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [order, setOrder] = useState<Order | undefined>(undefined);

  useEffect(() => {
    if (orderId) {
      setOrder(orderService.getById(orderId));
    }
  }, [orderId]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 text-center space-y-8">
      {/* Success Badge */}
      <div className="w-20 h-20 rounded-full bg-[#EBD5FA] text-[#8629B3] flex items-center justify-center mx-auto shadow-sm border border-[#CFA6E8]">
        <CheckCircle2 className="w-10 h-10" />
      </div>

      <div className="space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-[#8629B3] bg-[#EBD5FA]/60 px-4 py-1.5 rounded-full inline-flex items-center gap-1.5 border border-[#CFA6E8]/40">
          <Sparkles className="w-3.5 h-3.5" /> Order Placed Successfully
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-[#292525] tracking-tight">
          Thank you for choosing DSL Stationery!
        </h1>
        <p className="text-sm text-[#292525]/70 max-w-md mx-auto">
          Your order has been recorded in our system and will be delivered within 2–3 business days.
        </p>
      </div>

      {/* Demo Disclaimer Box */}
      <div className="bg-[#FFF9D2] border border-[#FFD84D] rounded-2xl p-4 text-xs text-[#594300] text-left flex items-start gap-3 shadow-xs">
        <AlertTriangle className="w-5 h-5 text-[#B38A00] shrink-0 mt-0.5" />
        <div>
          <strong className="font-bold">Demonstration Order Notice:</strong> This is a frontend demo order. No actual
          payment was deducted and no real packages will be dispatched. You can track, update, or inspect this order
          in the Store Admin application.
        </div>
      </div>

      {order && (
        <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 sm:p-8 text-left space-y-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between pb-4 border-b border-[#C6E7FF]/30 gap-2">
            <div>
              <span className="text-[10px] text-[#292525]/50 block uppercase font-mono">Order Number</span>
              <span className="text-lg font-black text-[#0066CC] font-mono">{order.orderNumber}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[#292525]/50 block uppercase">Tracking ID</span>
              <span className="text-xs font-bold text-[#292525] font-mono bg-[#FFFDF0] px-2 py-0.5 rounded border border-[#C6E7FF]/40">{order.trackingNumber}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <strong className="block text-[#292525]/50 uppercase text-[10px] mb-1">Customer Details</strong>
              <div className="font-bold text-[#292525]">{order.customerName}</div>
              <div className="text-[#292525]/70">{order.customerEmail}</div>
              <div className="text-[#292525]/70">{order.customerPhone}</div>
            </div>

            <div>
              <strong className="block text-[#292525]/50 uppercase text-[10px] mb-1">Shipping Destination</strong>
              <div className="text-[#292525] font-medium">
                {order.shippingAddress.addressLine1}, {order.shippingAddress.city}, {order.shippingAddress.district}
              </div>
            </div>
          </div>

          {/* Ordered items breakdown */}
          <div className="pt-4 border-t border-[#C6E7FF]/30">
            <h3 className="text-xs font-bold text-[#292525] mb-3">Order Items</h3>
            <div className="space-y-2">
              {order.items.map((i) => (
                <div key={i.id} className="flex justify-between text-xs py-1.5 border-b border-stone-100">
                  <span className="text-[#292525]/80">
                    {i.quantity}x {i.product.name}
                  </span>
                  <span className="font-bold text-[#292525]">{formatLKR(i.totalPriceCents)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-between text-sm font-bold text-[#292525]">
            <span>Total Amount Paid (Simulated)</span>
            <span className="text-lg font-black text-[#0066CC]">{formatLKR(order.totalCents)}</span>
          </div>
        </div>
      )}

      {/* Next Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
        {order && (
          <Link
            href={`/orders/${order.id}`}
            className="bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold px-6 py-3 rounded-full transition-all shadow-md flex items-center gap-2"
          >
            <Package className="w-4 h-4" />
            <span>Track Order Status</span>
          </Link>
        )}

        <Link
          href="/shop"
          className="bg-white hover:bg-[#FFFDF0] text-[#292525] border border-[#C6E7FF] text-xs font-bold px-6 py-3 rounded-full transition-all shadow-xs flex items-center gap-1.5"
        >
          Continue Shopping <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutResultPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-[#292525]/50">Loading order result...</div>}>
      <CheckoutResultContent />
    </Suspense>
  );
}
