'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  User,
  MapPin,
  Package,
  CreditCard,
  Banknote,
  RotateCcw,
  Edit,
  ArrowRightCircle,
  Ban,
  CheckCircle2,
  AlertCircle,
  Receipt,
  FileText,
  Clock,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';
import { orderService, PERMITTED_ORDER_TRANSITIONS } from '@/services/orderService';
import { orderSocketService } from '@/services/orderSocketService';
import { Order, OrderStatus, ShippingAddress } from '@/types/order';
import { formatLKR } from '@/lib/currency';
import { OrderStatusBadge } from '@/components/admin/orders/OrderStatusBadge';
import { PaymentStatusBadge } from '@/components/admin/orders/PaymentStatusBadge';
import { OrderTimeline } from '@/components/admin/orders/OrderTimeline';
import { EditCustomerModal } from '@/components/admin/orders/EditCustomerModal';
import { EditDeliveryModal } from '@/components/admin/orders/EditDeliveryModal';
import { EditItemsModal } from '@/components/admin/orders/EditItemsModal';
import { StatusTransitionModal } from '@/components/admin/orders/StatusTransitionModal';
import { CancelOrderModal } from '@/components/admin/orders/CancelOrderModal';
import { ReturnManagementCard } from '@/components/admin/orders/ReturnManagementCard';
import { AuditHistoryCard } from '@/components/admin/orders/AuditHistoryCard';
import { AdminNotesCard } from '@/components/admin/orders/AdminNotesCard';

function AdminOrderDetailContent() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal open states
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false);
  const [isEditDeliveryOpen, setIsEditDeliveryOpen] = useState(false);
  const [isEditItemsOpen, setIsEditItemsOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadOrder = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetched = await orderService.fetchOrderById(id);
      if (fetched) {
        setOrder(fetched);
      } else {
        setError(`Order "${id}" could not be found.`);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load order from server');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadOrder();

    // Subscribe to real-time events for this specific order
    const unsubSocket = orderSocketService.subscribeOrder(id, (payload) => {
      loadOrder();
      showToast(`Real-time update received: ${payload.event}`);
    });

    // Also handle reconnection
    const unsubReconnect = orderSocketService.onReconnect(() => {
      loadOrder();
    });

    return () => {
      unsubSocket();
      unsubReconnect();
    };
  }, [id, loadOrder]);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
        <div className="h-6 w-32 bg-slate-200 rounded" />
        <div className="h-12 w-80 bg-slate-200 rounded-2xl" />
        <div className="h-32 bg-slate-200 rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-slate-200 rounded-3xl" />
          <div className="h-64 bg-slate-200 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Order Not Found</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          {error || 'The requested order record does not exist or may have been removed.'}
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Link
            href="/admin/orders"
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Orders List</span>
          </Link>
          <button
            onClick={loadOrder}
            className="px-4 py-2 rounded-xl bg-[#08275E] hover:bg-[#103b8c] text-white text-xs font-bold transition-colors inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      </div>
    );
  }

  const normStatus = (order.orderStatus || 'PENDING').toUpperCase();
  const isTerminal = normStatus === 'DELIVERED' || normStatus === 'CANCELLED';
  const isLockedForItems =
    normStatus === 'SHIPPED' || normStatus === 'DELIVERED' || normStatus === 'CANCELLED';
  const allowedTransitions = PERMITTED_ORDER_TRANSITIONS[normStatus] || [];
  const canTransition = allowedTransitions.length > 0;
  const canCancel = !isTerminal;

  // Format payment details
  const latestPayment = order.paymentAttempts && order.paymentAttempts.length > 0
    ? order.paymentAttempts[0]
    : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 p-4 bg-slate-900 text-white rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold animate-slide-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#08275E] hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to All Orders</span>
        </Link>
        <span className="text-[11px] font-mono text-slate-400">ID: {order.id}</span>
      </div>

      {/* A. Order Overview Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-mono">
              #{order.orderNumber}
            </h1>
            <OrderStatusBadge status={order.orderStatus} size="md" />
            <PaymentStatusBadge status={order.paymentStatus} size="md" />
          </div>
          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
            <span>
              Placed on <strong className="text-slate-700">{new Date(order.createdAt).toLocaleString()}</strong>
            </span>
            {order.trackingNumber && (
              <>
                <span className="text-slate-300">•</span>
                <span className="font-mono text-[#08275E] font-bold">
                  Tracking: {order.trackingNumber}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Global Action CTAs */}
        <div className="flex flex-wrap items-center gap-2.5">
          {canTransition && (
            <button
              onClick={() => setIsStatusModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#08275E] hover:bg-[#103b8c] text-white font-bold text-xs shadow-xs transition-all hover:scale-[1.02] cursor-pointer"
            >
              <ArrowRightCircle className="w-4 h-4" />
              <span>Update Status</span>
            </button>
          )}

          {canCancel && (
            <button
              onClick={() => setIsCancelModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs transition-all cursor-pointer"
            >
              <Ban className="w-4 h-4" />
              <span>Cancel Order</span>
            </button>
          )}
        </div>
      </div>

      {/* Fulfilment Timeline Card */}
      <OrderTimeline
        currentStatus={order.orderStatus}
        createdAt={order.createdAt}
        updatedAt={order.updatedAt}
      />

      {/* Grid: Customer & Delivery Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* B. Customer Information */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4 text-xs flex flex-col justify-between">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-[#08275E]">
                  <User className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Customer Information</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditCustomerOpen(true)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#08275E] hover:underline cursor-pointer"
              >
                <Edit className="w-3 h-3" />
                <span>Edit Customer</span>
              </button>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Full Name
              </span>
              <strong className="text-slate-900 text-sm block mt-0.5">
                {order.customerName}
              </strong>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Email Address
              </span>
              <span className="text-slate-700 font-medium block mt-0.5">
                {order.customerEmail || 'No email registered'}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Phone Number
              </span>
              <span className="text-slate-700 font-medium block mt-0.5 font-mono">
                {order.customerPhone || 'No phone registered'}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Account Type: {order.userId ? 'Registered Customer' : 'Guest Checkout'}</span>
            {order.userId && <span className="font-mono text-slate-500">UID: {order.userId.slice(0, 10)}...</span>}
          </div>
        </div>

        {/* C. Delivery Information */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4 text-xs flex flex-col justify-between">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-[#08275E]">
                  <MapPin className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Delivery Information</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditDeliveryOpen(true)}
                disabled={isLockedForItems}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#08275E] hover:underline disabled:opacity-40 disabled:no-underline cursor-pointer"
              >
                <Edit className="w-3 h-3" />
                <span>Edit Delivery</span>
              </button>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Recipient &amp; Street Address
              </span>
              <div className="text-slate-800 font-semibold mt-0.5 leading-relaxed">
                {order.shippingAddress.fullName || order.customerName}
                <br />
                {order.shippingAddress.addressLine1}
                {order.shippingAddress.addressLine2 && <>, {order.shippingAddress.addressLine2}</>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  City &amp; District
                </span>
                <span className="text-slate-800 font-medium block mt-0.5">
                  {order.shippingAddress.city}, <strong>{order.shippingAddress.district}</strong>
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Postal Code
                </span>
                <span className="text-slate-800 font-mono block mt-0.5">
                  {order.shippingAddress.postalCode || 'N/A'}
                </span>
              </div>
            </div>

            {order.shippingAddress.deliveryNotes && (
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px]">
                <strong className="text-slate-800 block text-[10px] uppercase font-bold">
                  Instructions for Courier:
                </strong>
                <span>{order.shippingAddress.deliveryNotes}</span>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Island-wide Delivery Service</span>
            <span className="font-semibold text-slate-600">Province: {order.shippingAddress.district} District</span>
          </div>
        </div>
      </div>

      {/* D. Order Items Table */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#08275E]/10 text-[#08275E]">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Ordered Products &amp; Quantities</h3>
              <p className="text-[11px] text-slate-400">
                {order.items?.length || 0} line items included in this order
              </p>
            </div>
          </div>

          {!isLockedForItems && (
            <button
              onClick={() => setIsEditItemsOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>Edit Items</span>
            </button>
          )}
        </div>

        {/* Items Listing */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 uppercase text-[10px] tracking-wider font-bold border-b border-slate-200">
                <th className="py-2.5 px-3">Item</th>
                <th className="py-2.5 px-3">SKU</th>
                <th className="py-2.5 px-3 text-center">Quantity</th>
                <th className="py-2.5 px-3 text-right">Unit Price</th>
                <th className="py-2.5 px-3 text-right">Line Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {order.items?.map((item: any) => {
                const img = item.product?.images?.[0] || item.product?.image;
                return (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden relative">
                          {img ? (
                            <Image
                              src={img}
                              alt={item.productName || item.product?.name || 'Product'}
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          ) : (
                            <ShoppingBag className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block">
                            {item.productName || item.product?.name}
                          </span>
                          {item.variantName && (
                            <span className="text-[10px] text-slate-500 block">
                              Variant: {item.variantName}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-slate-500 text-[11px]">
                      {item.sku || item.product?.sku || 'N/A'}
                    </td>

                    <td className="py-3 px-3 text-center font-bold text-slate-800">
                      {item.quantity}
                    </td>

                    <td className="py-3 px-3 text-right text-slate-600 font-medium">
                      {formatLKR(item.unitPriceCents)}
                    </td>

                    <td className="py-3 px-3 text-right font-black text-slate-900">
                      {formatLKR(item.totalPriceCents || item.unitPriceCents * item.quantity)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid: E. Pricing Summary & F. Payment Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* E. Pricing Summary */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4 text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                <Receipt className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Pricing &amp; Cost Breakdown</h3>
            </div>
            <span className="text-[11px] font-bold text-slate-400 font-mono">Currency: LKR</span>
          </div>

          <div className="space-y-2.5">
            <div className="flex justify-between text-slate-600">
              <span>Items Subtotal</span>
              <span className="font-semibold text-slate-800">{formatLKR(order.subtotalCents)}</span>
            </div>

            {order.discountCents > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Promotional Voucher / Discount</span>
                <span>-{formatLKR(order.discountCents)}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-600">
              <span>Island Delivery Fee</span>
              <span className="font-semibold text-slate-800">
                {order.deliveryCents === 0 ? 'FREE DELIVERY' : formatLKR(order.deliveryCents)}
              </span>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-between items-baseline">
              <span className="font-black text-slate-900 text-sm">Authoritative Total</span>
              <span className="text-xl font-black text-[#08275E]">
                {formatLKR(order.totalCents)}
              </span>
            </div>
          </div>
        </div>

        {/* F. Payment Details */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4 text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-50 text-[#08275E]">
                <CreditCard className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Payment &amp; Gateway Details</h3>
            </div>
            <PaymentStatusBadge status={order.paymentStatus} size="sm" />
          </div>

          <div className="space-y-2.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Payment Method:</span>
              <span className="font-bold text-slate-800 uppercase">
                {order.paymentMethod?.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">Paid Amount:</span>
              <span className="font-black text-slate-900">
                {order.paymentStatus === 'PAID' || order.paymentStatus === 'simulated_paid'
                  ? formatLKR(order.totalCents)
                  : 'Pending Settlement'}
              </span>
            </div>

            {latestPayment?.gatewayReference && (
              <div className="flex justify-between">
                <span className="text-slate-500">Gateway Reference:</span>
                <span className="font-mono text-slate-800 text-[11px] font-bold">
                  {latestPayment.gatewayReference}
                </span>
              </div>
            )}

            {latestPayment?.createdAt && (
              <div className="flex justify-between">
                <span className="text-slate-500">Attempt Timestamp:</span>
                <span className="text-slate-600 font-mono text-[10px]">
                  {new Date(latestPayment.createdAt).toLocaleString()}
                </span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-slate-500">Refund Status:</span>
              <span className="font-semibold text-slate-700">
                {order.paymentStatus === 'REFUNDED' || order.paymentStatus === 'refunded'
                  ? 'Refund Processed'
                  : 'None Issued'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* I. Return Requests Section */}
      <ReturnManagementCard orderId={order.id} orderNumber={order.orderNumber} />

      {/* J. Audit History Section */}
      <AuditHistoryCard orderId={order.id} orderCreatedAt={order.createdAt} />

      {/* K. Admin Notes Section */}
      <AdminNotesCard
        orderId={order.id}
        customerNotes={order.customerNotes || order.notes}
      />

      {/* Modals */}
      <EditCustomerModal
        orderId={order.id}
        initialCustomer={{
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone,
        }}
        isOpen={isEditCustomerOpen}
        onClose={() => setIsEditCustomerOpen(false)}
        onSuccess={(updated) => {
          setOrder((prev) => (prev ? { ...prev, ...updated } : prev));
          showToast('Customer information updated.');
        }}
      />

      <EditDeliveryModal
        orderId={order.id}
        initialAddress={order.shippingAddress}
        isOpen={isEditDeliveryOpen}
        onClose={() => setIsEditDeliveryOpen(false)}
        onSuccess={(updatedAddress) => {
          setOrder((prev) => (prev ? { ...prev, shippingAddress: updatedAddress } : prev));
          showToast('Delivery information updated.');
        }}
      />

      <EditItemsModal
        orderId={order.id}
        currentItems={order.items}
        isLocked={isLockedForItems}
        isOpen={isEditItemsOpen}
        onClose={() => setIsEditItemsOpen(false)}
        onSuccess={(newItems) => {
          loadOrder();
          showToast('Order items updated.');
        }}
      />

      <StatusTransitionModal
        orderId={order.id}
        orderNumber={order.orderNumber}
        currentStatus={order.orderStatus}
        initialTracking={order.trackingNumber}
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        onSuccess={(newStatus, trk) => {
          setOrder((prev) =>
            prev
              ? {
                  ...prev,
                  orderStatus: newStatus,
                  trackingNumber: trk !== undefined ? trk : prev.trackingNumber,
                }
              : prev
          );
          showToast(`Order status updated to "${newStatus}".`);
        }}
      />

      <CancelOrderModal
        orderId={order.id}
        orderNumber={order.orderNumber}
        totalCents={order.totalCents}
        paymentStatus={order.paymentStatus}
        paymentMethod={order.paymentMethod}
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onSuccess={() => {
          loadOrder();
          showToast('Order cancelled. Stock replenished.');
        }}
      />
    </div>
  );
}

export default function AdminOrderDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-5xl mx-auto py-12 text-center text-xs text-slate-500">
          Loading order details...
        </div>
      }
    >
      <AdminOrderDetailContent />
    </Suspense>
  );
}
