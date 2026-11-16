'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  MapPin,
  Package,
  Calendar,
  CreditCard,
  Clock,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
  RefreshCw,
  Heart,
  Bookmark,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShoppingBag,
  DollarSign,
  Check,
  X,
  Lock,
} from 'lucide-react';
import { customerService } from '@/services/customerService';
import { CustomerDetail } from '@/types/customer';
import { formatLKR } from '@/lib/currency';
import { useUserStore } from '@/services/userStore';
import { AdminPageAccess } from '@/components/admin/AdminPageAccess';

function AdminCustomerDetailContent() {
  const params = useParams();
  const id = params.id as string;

  const currentUser = useUserStore((state) => state.currentUser);
  const isManagerOrAdmin =
    currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER';

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status toggle modal state
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusReason, setStatusReason] = useState('');
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);

  const loadCustomer = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await customerService.fetchCustomerById(id);
      setCustomer(data);
    } catch (err: any) {
      console.error('Failed to load customer profile:', err);
      setError(err?.message || 'Customer profile not found or could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadCustomer();
  }, [loadCustomer]);

  const handleConfirmStatusToggle = async () => {
    if (!customer) return;
    if (customer.customerType === 'GUEST') {
      alert('Guest customers do not have account credentials to suspend or activate.');
      setIsStatusModalOpen(false);
      return;
    }
    setIsSubmittingStatus(true);
    try {
      const targetStatus = !customer.isActive;
      await customerService.updateCustomerStatus(
        customer.id,
        targetStatus,
        statusReason.trim() || undefined
      );

      await loadCustomer();
      setIsStatusModalOpen(false);
      setStatusReason('');
    } catch (err: any) {
      alert(err?.message || 'Failed to update customer status');
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-pulse py-6">
        <div className="h-6 w-36 bg-slate-200 rounded mb-4"></div>
        <div className="h-10 w-64 bg-slate-200 rounded mb-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-slate-200 rounded-3xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-slate-200 rounded-3xl"></div>
          <div className="h-64 bg-slate-200 rounded-3xl"></div>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Customer Record Not Found</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          {error || `No customer record exists with ID "${id}".`}
        </p>
        <div className="mt-6">
          <Link
            href="/admin/customers"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#08275E] text-white text-xs font-bold hover:bg-[#103b8c] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Customer Directory</span>
          </Link>
        </div>
      </div>
    );
  }

  const isGuest = customer.customerType === 'GUEST';

  const regDateFormatted = !isGuest && customer.createdAt
    ? new Date(customer.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  const lastUpdateFormatted = !isGuest && customer.updatedAt
    ? new Date(customer.updatedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';

  const firstOrderDateFormatted = customer.orderSummary.firstOrderDate
    ? new Date(customer.orderSummary.firstOrderDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Never';

  const lastOrderDateFormatted = customer.orderSummary.lastOrderDate
    ? new Date(customer.orderSummary.lastOrderDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Never';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <Link
            href="/admin/customers"
            className="text-xs font-semibold text-[#08275E] hover:underline inline-flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Customer Directory</span>
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {customer.name}
            </h1>

            {isGuest ? (
              <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Guest Buyer</span>
              </span>
            ) : (
              <>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    customer.isActive
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {customer.isActive ? (
                    <UserCheck className="w-3.5 h-3.5" />
                  ) : (
                    <UserX className="w-3.5 h-3.5" />
                  )}
                  <span>{customer.isActive ? 'Active Account' : 'Suspended Account'}</span>
                </span>

                {customer.isEmailVerified ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    <ShieldCheck className="w-3 h-3 text-blue-600" />
                    <span>Verified Email</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <ShieldAlert className="w-3 h-3 text-amber-600" />
                    <span>Unverified Email</span>
                  </span>
                )}
              </>
            )}
          </div>

          <p className="text-[11px] text-slate-400 font-mono mt-1">
            {isGuest ? 'Guest Identifier' : 'Customer ID'}: {customer.id}
          </p>

          {isGuest && (
            <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-2 max-w-xl">
              <strong>Estimated Identity:</strong> This guest profile is grouped from unauthenticated checkout orders matching available contact details. Contact matching estimates identity and does not verify an individual.
            </p>
          )}
        </div>

        {/* Action button (Only available for Registered customers & Admin/Manager) */}
        {!isGuest && (
          <div className="flex items-center gap-2">
            {isManagerOrAdmin ? (
              <button
                type="button"
                onClick={() => {
                  setStatusReason('');
                  setIsStatusModalOpen(true);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                  customer.isActive
                    ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                {customer.isActive ? (
                  <>
                    <UserX className="w-3.5 h-3.5" />
                    <span>Suspend Account</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Reactivate Account</span>
                  </>
                )}
              </button>
            ) : (
              <div
                title="Status changes require Manager or Admin privileges"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-400 cursor-not-allowed"
              >
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Account Status (Locked)</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* KPI Overview Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Orders</span>
            <ShoppingBag className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-xl font-black text-slate-900">
            {customer.orderSummary.totalOrders}
          </p>
          <span className="text-[10px] text-slate-400">
            Last: {lastOrderDateFormatted}
          </span>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Spent</span>
            <CreditCard className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-black text-slate-900">
            {formatLKR(customer.orderSummary.totalSpendCents)}
          </p>
          <span className="text-[10px] text-slate-400">All-time lifetime value</span>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Average Order</span>
            <DollarSign className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-xl font-black text-slate-900">
            {formatLKR(customer.orderSummary.averageOrderValueCents)}
          </p>
          <span className="text-[10px] text-slate-400">Per placed order</span>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {isGuest ? 'Delivery Locations' : 'Saved Addresses'}
            </span>
            <MapPin className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-xl font-black text-slate-900">
            {customer.addresses.length}
          </p>
          <span className="text-[10px] text-slate-400">
            {isGuest ? 'From order shipments' : 'In address book'}
          </span>
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact & Account Profile */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs text-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
            <User className="w-4 h-4 text-[#08275E]" />
            <span>{isGuest ? 'Guest Contact Information' : 'Profile & Account Info'}</span>
          </h2>

          <div className="space-y-3">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Customer Name</span>
              <span className="font-bold text-slate-800 text-sm">{customer.name}</span>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Email Address</span>
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{customer.email || 'No email provided'}</span>
              </div>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Telephone Number</span>
              <div className="flex items-center gap-1.5 font-mono text-slate-800">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{customer.phone || 'No phone number provided'}</span>
              </div>
            </div>

            {isGuest ? (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">First Order Date</span>
                  <span className="text-slate-600 text-[11px]">{firstOrderDateFormatted}</span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Last Order Date</span>
                  <span className="text-slate-600 text-[11px]">{lastOrderDateFormatted}</span>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Registered Date</span>
                    <span className="text-slate-600 text-[11px]">{regDateFormatted}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Last Updated</span>
                    <span className="text-slate-600 text-[11px]">{lastUpdateFormatted}</span>
                  </div>
                </div>

                {/* Engagement indicators */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                    <Heart className="w-3.5 h-3.5 text-rose-500" />
                    <span><strong>{customer.wishlistCount}</strong> items in wishlist</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                    <Bookmark className="w-3.5 h-3.5 text-blue-500" />
                    <span><strong>{customer.savedListsCount}</strong> saved lists</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Delivery Addresses */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs text-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#08275E]" />
              <span>{isGuest ? 'Order Delivery Locations' : 'Saved Delivery Addresses'}</span>
            </span>
            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {customer.addresses.length}
            </span>
          </h2>

          {customer.addresses.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              <MapPin className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
              <p className="font-medium">No recorded delivery addresses.</p>
              <p className="text-[11px] text-slate-300">
                {isGuest
                  ? 'No shipping address recorded on guest orders.'
                  : 'Customer has not added any addresses yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {customer.addresses.map((a) => (
                <div
                  key={a.id}
                  className={`p-3 rounded-2xl border transition-colors ${
                    a.isDefault
                      ? 'bg-blue-50/40 border-blue-200'
                      : 'bg-slate-50 border-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <strong className="text-slate-900 font-bold">{a.fullName}</strong>
                    {a.isDefault && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-[#08275E]">
                        Default Address
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600">
                    {a.addressLine1}
                    {a.addressLine2 ? `, ${a.addressLine2}` : ''}
                  </p>
                  <p className="text-slate-600">
                    {a.city}, <strong>{a.district}</strong>
                    {a.postalCode ? ` (${a.postalCode})` : ''}
                  </p>
                  {a.phone && (
                    <p className="text-slate-400 font-mono text-[11px] mt-1">Phone: {a.phone}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Customer Order History */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-4 h-4 text-[#08275E]" />
            <span>Associated Order History ({customer.orders.length})</span>
          </h2>
        </div>

        {customer.orders.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-bold text-slate-700">No orders placed yet</p>
            <p className="text-xs text-slate-400 mt-1">
              This customer does not have any recorded orders.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 font-bold uppercase text-[10px]">
                  <th className="py-3 px-4">Order Number</th>
                  <th className="py-3 px-4">Date Placed</th>
                  <th className="py-3 px-4 text-center">Items</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Order Status</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customer.orders.map((o) => {
                  const date = new Date(o.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#08275E]">
                        <Link href={`/admin/orders/${o.id}`} className="hover:underline">
                          {o.orderNumber}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">{date}</td>
                      <td className="py-3.5 px-4 text-center text-slate-600 font-bold">
                        {o.itemsCount}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            o.paymentStatus === 'PAID'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : o.paymentStatus === 'FAILED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {o.paymentStatus} ({o.paymentMethod})
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            o.orderStatus === 'DELIVERED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : o.orderStatus === 'CANCELLED'
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-blue-50 text-[#08275E]'
                          }`}
                        >
                          {o.orderStatus}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-slate-900">
                        {formatLKR(o.totalCents)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="bg-[#08275E] hover:bg-[#103b8c] text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition-colors inline-flex items-center gap-1 shadow-xs"
                        >
                          <span>View Order</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Account Status Toggle Modal (Registered Customers Only) */}
      {!isGuest && isStatusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                {customer.isActive ? 'Suspend Customer Account' : 'Reactivate Customer Account'}
              </h3>
              <button
                type="button"
                onClick={() => setIsStatusModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Are you sure you want to{' '}
              <strong className={customer.isActive ? 'text-rose-600' : 'text-emerald-600'}>
                {customer.isActive ? 'SUSPEND' : 'REACTIVATE'}
              </strong>{' '}
              the customer account for <strong>{customer.name}</strong> ({customer.email})?
            </p>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Reason for change (Optional, will be recorded in audit log)
              </label>
              <textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="e.g. Account suspended due to customer request or fraud verification..."
                rows={3}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#08275E]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsStatusModalOpen(false)}
                disabled={isSubmittingStatus}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusToggle}
                disabled={isSubmittingStatus}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors flex items-center gap-1.5 cursor-pointer ${
                  customer.isActive
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isSubmittingStatus ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>
                  Confirm {customer.isActive ? 'Suspension' : 'Reactivation'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminCustomerDetailPage() {
  return (
    <AdminPageAccess permission="customers.view" pageTitle="Customer Details">
      <Suspense
        fallback={
          <div className="max-w-5xl mx-auto py-12 text-center text-xs text-slate-500">
            Loading customer record...
          </div>
        }
      >
        <AdminCustomerDetailContent />
      </Suspense>
    </AdminPageAccess>
  );
}
