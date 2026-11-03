'use client';

import React, { useState } from 'react';
import { Settings, Save, Check } from 'lucide-react';
import { FREE_DELIVERY_THRESHOLD_CENTS, STANDARD_DELIVERY_FEE_CENTS } from '@/lib/currency';

export default function AdminSettingsPage() {
  const [storeName, setStoreName] = useState('DSL Stationery');
  const [currency, setCurrency] = useState('LKR (Sri Lankan Rupee)');
  const [freeThreshold, setFreeThreshold] = useState(FREE_DELIVERY_THRESHOLD_CENTS / 100);
  const [standardFee, setStandardFee] = useState(STANDARD_DELIVERY_FEE_CENTS / 100);
  const [hotline, setHotline] = useState('+94 11 200 9000');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Application &amp; Store Settings
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Configure business rules, delivery pricing thresholds, and contact channels
        </p>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs text-xs">
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
            Store Identity &amp; Currency
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Business Name</label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Store Currency</label>
              <input
                type="text"
                disabled
                value={currency}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 font-bold"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Customer Support Hotline (Demo)</label>
              <input
                type="text"
                value={hotline}
                onChange={(e) => setHotline(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
            Delivery Calculation Thresholds (LKR)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Free Delivery Minimum Cart (Rs.)</label>
              <input
                type="number"
                value={freeThreshold}
                onChange={(e) => setFreeThreshold(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-bold"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Carts above this value automatically receive Rs. 0 delivery in Colombo and Islandwide.
              </span>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Standard Islandwide Fee (Rs.)</label>
              <input
                type="number"
                value={standardFee}
                onChange={(e) => setStandardFee(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-bold"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Standard courier flat shipping rate.
              </span>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            className="bg-[#08275E] hover:bg-[#103b8c] text-white font-bold px-6 py-2.5 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            {saved ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Saved Settings!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 text-[#FFD21C]" />
                <span>Save Configuration</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
