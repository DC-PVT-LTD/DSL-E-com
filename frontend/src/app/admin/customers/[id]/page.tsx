'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, User, Mail, Phone, MapPin, Package } from 'lucide-react';
import { INITIAL_CUSTOMERS } from '@/mocks/customers';
import { orderService } from '@/services/orderService';
import { CustomerUser } from '@/types/user';
import { Order } from '@/types/order';
import { formatLKR } from '@/lib/currency';

function AdminCustomerDetailContent() {
  const params = useParams();
  const id = params.id as string;

  const [customer, setCustomer] = useState<CustomerUser | undefined>(undefined);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    const cust = INITIAL_CUSTOMERS.find((c) => c.id === id);
    setCustomer(cust);
    if (cust) {
      const custOrders = orderService
        .getAll()
        .filter((o) => o.customerEmail.toLowerCase() === cust.email.toLowerCase());
      setOrders(custOrders);
    }
  }, [id]);

  if (!customer) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center text-xs text-slate-500">
        Customer record not found.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <Link href="/admin/customers" className="text-xs font-semibold text-[#08275E] hover:underline flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Customers</span>
          </Link>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{customer.name}</h1>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full uppercase mt-1 inline-block">
            Demonstration Customer Account
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs text-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
            Contact Information
          </h2>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Email</span>
            <span className="font-bold text-slate-800">{customer.email}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Phone</span>
            <span className="font-bold text-slate-800">{customer.phone}</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs text-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
            Saved Delivery Addresses ({customer.addresses.length})
          </h2>
          {customer.addresses.map((a) => (
            <div key={a.id} className="p-3 rounded-2xl bg-slate-50 text-slate-700 space-y-1">
              <strong className="block text-slate-900">{a.fullName}</strong>
              <p>{a.addressLine1}, {a.city}, {a.district}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Customer Orders */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
          Order History ({orders.length})
        </h2>

        {orders.length === 0 ? (
          <p className="text-xs text-slate-400 py-3">No orders associated with this customer account yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {orders.map((o) => (
              <div key={o.id} className="py-3 flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold text-[#08275E] block">{o.orderNumber}</span>
                  <span className="text-slate-400 text-[11px]">{new Date(o.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-black text-slate-900">{formatLKR(o.totalCents)}</span>
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="text-[#08275E] font-bold hover:underline text-[11px]"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminCustomerDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto py-12 text-center text-xs text-slate-500">
          Loading customer record...
        </div>
      }
    >
      <AdminCustomerDetailContent />
    </Suspense>
  );
}

