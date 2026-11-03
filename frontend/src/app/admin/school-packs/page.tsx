'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { GraduationCap, Plus, Eye, EyeOff, Edit2, Trash2 } from 'lucide-react';
import { schoolPackService } from '@/services/schoolPackService';
import { SchoolPack } from '@/types/school-pack';
import { formatLKR } from '@/lib/currency';

export default function AdminSchoolPacksPage() {
  const [packs, setPacks] = useState<SchoolPack[]>([]);

  const loadData = () => {
    setPacks(schoolPackService.getAll(true));
  };

  useEffect(() => {
    loadData();
    const unsub = schoolPackService.subscribe(loadData);
    return () => unsub();
  }, []);

  const handleToggle = (id: string) => {
    schoolPackService.togglePackStatus(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            School Pack Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure school grade packs, pricing bundles, and active tiers
          </p>
        </div>

        <Link
          href="/admin/school-packs/new"
          className="bg-[#08275E] hover:bg-[#103b8c] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-[#FFD21C]" />
          <span>Create New Pack</span>
        </Link>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <th className="py-3 px-4 font-bold">Pack Name</th>
              <th className="py-3 px-4 font-bold">Grade</th>
              <th className="py-3 px-4 font-bold">Tier</th>
              <th className="py-3 px-4 font-bold">Items Count</th>
              <th className="py-3 px-4 font-bold">Bundle Price</th>
              <th className="py-3 px-4 font-bold">Discount</th>
              <th className="py-3 px-4 font-bold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {packs.map((pack) => (
              <tr key={pack.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-3.5 px-4 font-bold text-slate-900">{pack.name}</td>
                <td className="py-3.5 px-4 text-slate-600 font-semibold">{pack.grade}</td>
                <td className="py-3.5 px-4">
                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                    {pack.tier}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-slate-600">{pack.items.length} items</td>
                <td className="py-3.5 px-4 font-black text-[#08275E]">{formatLKR(pack.totalPriceCents)}</td>
                <td className="py-3.5 px-4 font-bold text-emerald-600">{pack.savingsPercentage}% off</td>
                <td className="py-3.5 px-4">
                  <button
                    onClick={() => handleToggle(pack.id)}
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase transition-all ${
                      pack.isActive
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {pack.isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    <span>{pack.isActive ? 'Active' : 'Disabled'}</span>
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
