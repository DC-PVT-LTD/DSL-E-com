'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Plus } from 'lucide-react';
import { schoolPackService } from '@/services/schoolPackService';
import { productService } from '@/services/productService';
import { SchoolPackTier } from '@/types/school-pack';

export default function AdminNewSchoolPackPage() {
  const router = useRouter();
  const allProducts = productService.getAll();

  const [name, setName] = useState('');
  const [grade, setGrade] = useState('Grade 6-9');
  const [tier, setTier] = useState<SchoolPackTier>('standard');
  const [description, setDescription] = useState('');
  const [savingsPercentage, setSavingsPercentage] = useState(15);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([
    allProducts[0]?.id || '',
    allProducts[3]?.id || '',
  ]);

  const handleToggleProduct = (pid: string) => {
    if (selectedProductIds.includes(pid)) {
      setSelectedProductIds(selectedProductIds.filter((id) => id !== pid));
    } else {
      setSelectedProductIds([...selectedProductIds, pid]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const items = selectedProductIds.map((pid, idx) => {
      const prod = allProducts.find((p) => p.id === pid)!;
      return {
        id: `pi-${Date.now()}-${idx}`,
        productId: prod.id,
        productName: prod.name,
        defaultQuantity: 2,
        unitPriceCents: prod.priceCents,
      };
    });

    const calculatedTotal = schoolPackService.calculatePackTotal(items, savingsPercentage);

    schoolPackService.createPack({
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      grade,
      tier,
      description: description || `Curated ${tier} stationery kit for ${grade} students in Sri Lanka.`,
      savingsPercentage,
      totalPriceCents: calculatedTotal,
      isActive: true,
      items,
    });

    router.push('/admin/school-packs');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <Link href="/admin/school-packs" className="text-xs font-semibold text-[#08275E] hover:underline flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Packs</span>
          </Link>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Create School Bundle Pack</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="font-bold text-slate-700 block mb-1">Pack Title *</label>
            <input
              type="text"
              placeholder="e.g. Grade 10 O/L Revision Science Bundle"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Grade Level</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white"
            >
              <option value="Grade 1-2">Grade 1-2</option>
              <option value="Grade 3-5">Grade 3-5</option>
              <option value="Grade 6-9">Grade 6-9</option>
              <option value="O/L (Grade 10-11)">O/L (Grade 10-11)</option>
              <option value="A/L Science">A/L Science</option>
              <option value="A/L Commerce">A/L Commerce</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Tier</label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white uppercase"
            >
              <option value="essential">Essential Tier</option>
              <option value="standard">Standard Tier</option>
              <option value="premium">Premium Tier</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Bundle Savings (%)</label>
            <input
              type="number"
              min="0"
              max="50"
              value={savingsPercentage}
              onChange={(e) => setSavingsPercentage(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="font-bold text-slate-700 block mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this pack include and who is it intended for?"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
            />
          </div>
        </div>

        {/* Products Selection */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <label className="font-bold text-slate-900 block text-sm">
            Select Products Included in Pack ({selectedProductIds.length} selected)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
            {allProducts.map((p) => {
              const isChecked = selectedProductIds.includes(p.id);
              return (
                <label
                  key={p.id}
                  className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-colors ${
                    isChecked ? 'border-[#08275E] bg-blue-50/40' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleProduct(p.id)}
                      className="w-4 h-4 text-[#08275E] rounded"
                    />
                    <span className="truncate font-semibold text-slate-800">{p.name}</span>
                  </div>
                  <span className="font-mono text-slate-500 shrink-0">Rs. {p.priceCents / 100}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
          <Link
            href="/admin/school-packs"
            className="px-5 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-600"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="bg-[#08275E] hover:bg-[#103b8c] text-white font-bold px-6 py-2.5 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Save className="w-4 h-4 text-[#FFD21C]" />
            <span>Create Pack &amp; Publish</span>
          </button>
        </div>
      </form>
    </div>
  );
}
