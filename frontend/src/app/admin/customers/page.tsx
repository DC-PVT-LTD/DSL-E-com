'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Users, Search, ArrowRight, MapPin, Mail, Phone } from 'lucide-react';
import { INITIAL_CUSTOMERS } from '@/mocks/customers';
import { orderService } from '@/services/orderService';
import { CustomerUser } from '@/types/user';

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerUser[]>(INITIAL_CUSTOMERS);
  const [search, setSearch] = useState('');
  const allOrders = orderService.getAll();

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Customer Directory
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Registered customer accounts, addresses, and order records (Labelled Demo Data)
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-xs text-xs">
        <div className="relative max-w-sm">
          <input
            type="text"
            placeholder="Search by customer name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <th className="py-3 px-4 font-bold">Customer Name</th>
              <th className="py-3 px-4 font-bold">Email</th>
              <th className="py-3 px-4 font-bold">Phone</th>
              <th className="py-3 px-4 font-bold">Primary District</th>
              <th className="py-3 px-4 font-bold">Orders Placed</th>
              <th className="py-3 px-4 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((c) => {
              const orderCount = allOrders.filter(
                (o) => o.customerEmail.toLowerCase() === c.email.toLowerCase()
              ).length;
              const primaryDistrict = c.addresses[0]?.district || 'Colombo';

              return (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-900">{c.name}</td>
                  <td className="py-3.5 px-4 text-slate-600">{c.email}</td>
                  <td className="py-3.5 px-4 text-slate-600 font-mono">{c.phone}</td>
                  <td className="py-3.5 px-4 text-slate-600">{primaryDistrict}</td>
                  <td className="py-3.5 px-4 font-bold text-[#08275E]">{orderCount} orders</td>
                  <td className="py-3.5 px-4 text-right">
                    <Link
                      href={`/admin/customers/${c.id}`}
                      className="bg-[#08275E] hover:bg-[#103b8c] text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition-colors inline-block"
                    >
                      View Profile
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
