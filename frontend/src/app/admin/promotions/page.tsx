'use client';

import React, { useState } from 'react';
import { Tag, Plus, Eye, EyeOff } from 'lucide-react';
import { INITIAL_PROMOTIONS } from '@/mocks/promotions';
import { Promotion } from '@/types/admin';

export default function AdminPromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>(INITIAL_PROMOTIONS);
  const [isAdding, setIsAdding] = useState(false);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState<number>(10);

  const handleToggle = (id: string) => {
    setPromotions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isActive: !p.isActive } : p))
    );
  };

  const handleAddPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !title.trim()) return;

    const newPromo: Promotion = {
      id: `promo-${Date.now()}`,
      code: code.trim().toUpperCase(),
      title,
      description: `${discountType === 'percentage' ? `${discountValue}%` : `LKR ${discountValue}`} discount coupon`,
      discountType,
      discountValue: Number(discountValue),
      startDate: new Date().toISOString(),
      endDate: '2026-12-31T23:59:59Z',
      isActive: true,
      usageCount: 0,
    };

    setPromotions([newPromo, ...promotions]);
    setCode('');
    setTitle('');
    setIsAdding(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Promotions &amp; Coupon Codes
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure discount rules, promotional vouchers, and customer loyalty offers
          </p>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="bg-[#08275E] hover:bg-[#103b8c] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-[#FFD21C]" />
          <span>Create Voucher</span>
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAddPromo} className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs text-xs animate-fade-in">
          <h2 className="text-sm font-bold text-slate-900">New Promo Code</h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Coupon Code *</label>
              <input
                type="text"
                placeholder="e.g. EXAM2026"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-200 uppercase font-mono font-bold"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="font-bold text-slate-700 block mb-1">Campaign Title *</label>
              <input
                type="text"
                placeholder="e.g. Exam Season Special Voucher"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-200"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Discount Amount</label>
              <div className="flex gap-1">
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as any)}
                  className="px-2 py-2 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="percentage">%</option>
                  <option value="fixed">Rs.</option>
                </select>
                <input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-[#08275E] text-white font-bold px-5 py-2 rounded-xl"
            >
              Save Voucher
            </button>
          </div>
        </form>
      )}

      {/* Promotions Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <th className="py-3 px-4 font-bold">Code</th>
              <th className="py-3 px-4 font-bold">Campaign</th>
              <th className="py-3 px-4 font-bold">Discount Value</th>
              <th className="py-3 px-4 font-bold">Times Used</th>
              <th className="py-3 px-4 font-bold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {promotions.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-3.5 px-4 font-mono font-black text-[#08275E]">{p.code}</td>
                <td className="py-3.5 px-4 font-bold text-slate-900">{p.title}</td>
                <td className="py-3.5 px-4 font-bold text-emerald-700">
                  {p.discountType === 'percentage' ? `${p.discountValue}% OFF` : `LKR ${p.discountValue} OFF`}
                </td>
                <td className="py-3.5 px-4 text-slate-500">{p.usageCount} orders</td>
                <td className="py-3.5 px-4">
                  <button
                    onClick={() => handleToggle(p.id)}
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase transition-all ${
                      p.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {p.isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    <span>{p.isActive ? 'Active' : 'Disabled'}</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
