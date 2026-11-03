'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, MapPin, Check, Loader2 } from 'lucide-react';
import { AccountNav } from '@/components/common/AccountNav';
import { useUserStore } from '@/services/userStore';

export default function AccountAddressesPage() {
  const router = useRouter();
  const currentUser = useUserStore((state) => state.currentUser);
  const fetchCurrentUser = useUserStore((state) => state.fetchCurrentUser);
  const addAddress = useUserStore((state) => state.addAddress);
  const removeAddress = useUserStore((state) => state.removeAddress);

  const [isChecking, setIsChecking] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('Colombo');

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        await fetchCurrentUser();
      } catch {
      } finally {
        if (mounted) setIsChecking(false);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, [fetchCurrentUser]);

  useEffect(() => {
    if (!isChecking && !currentUser) {
      router.push('/login');
    }
  }, [isChecking, currentUser, router]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressLine1.trim() || !city.trim()) return;

    addAddress({
      fullName: fullName || currentUser?.name || 'Customer',
      phone: phone || currentUser?.phone || '+94 77 000 0000',
      email: currentUser?.email || 'customer@example.lk',
      addressLine1,
      city,
      district,
      isDefault: false,
    });

    setAddressLine1('');
    setCity('');
    setIsAdding(false);
  };

  if (isChecking || !currentUser) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#0066CC]" />
        <p className="mt-3 text-xs text-[#292525]/60 font-medium">Loading addresses...</p>
      </div>
    );
  }

  const addresses = currentUser?.addresses || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Saved Delivery Addresses</h1>
          <p className="text-xs text-slate-500 mt-1">Manage delivery locations for fast 1-click checkout</p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="bg-[#08275E] hover:bg-[#103b8c] text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Address</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <AccountNav />
        </div>

        <div className="lg:col-span-3 space-y-6">
          {/* Add Address Form Modal / Inline */}
          {isAdding && (
            <form onSubmit={handleAdd} className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs text-xs animate-fade-in">
              <h2 className="font-bold text-slate-900 text-sm">Add New Address</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Recipient Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Full name"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Mobile Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+94 77 ..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="font-semibold text-slate-600 block mb-1">Street Address</label>
                  <input
                    type="text"
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    placeholder="House / Street"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">City / Town</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">District</label>
                  <input
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="bg-[#08275E] text-white font-bold text-xs px-4 py-2 rounded-xl"
                >
                  Save Address
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="bg-slate-100 text-slate-600 font-bold text-xs px-4 py-2 rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Address Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {addresses.map((addr) => (
              <div key={addr.id} className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col justify-between shadow-xs space-y-4">
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-[#08275E]" />
                      {addr.fullName}
                    </span>
                    {addr.isDefault && (
                      <span className="text-[10px] font-bold bg-[#08275E] text-white px-2 py-0.5 rounded-full uppercase">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 leading-relaxed pt-2">
                    {addr.addressLine1}
                    {addr.addressLine2 && <>, {addr.addressLine2}</>}
                    <br />
                    {addr.city}, {addr.district}
                  </p>
                  <p className="text-slate-500 font-medium">Phone: {addr.phone}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => removeAddress(addr.id)}
                    className="text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1 font-semibold"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
