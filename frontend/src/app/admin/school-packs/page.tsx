'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Eye, EyeOff, Edit2, Trash2, Settings, AlertCircle, Sparkles } from 'lucide-react';
import { schoolPackService } from '@/services/schoolPackService';
import { SchoolPack, SchoolPackConfig } from '@/types/school-pack';
import { formatLKR } from '@/lib/currency';

export default function AdminSchoolPacksPage() {
  const [packs, setPacks] = useState<SchoolPack[]>([]);
  const [config, setConfig] = useState<SchoolPackConfig>({ gradeGroups: [], tiers: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [selectedTier, setSelectedTier] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'draft'>('all');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editGradesInput, setEditGradesInput] = useState('');
  const [editTiersInput, setEditTiersInput] = useState('');
  const [configSuccessMsg, setConfigSuccessMsg] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [packsRes, configRes] = await Promise.all([
        schoolPackService.getAdminPacks(),
        schoolPackService.getConfig(),
      ]);
      setPacks(packsRes.items);
      setConfig(configRes);
      setEditGradesInput(configRes.gradeGroups.join(', '));
      setEditTiersInput(configRes.tiers.join(', '));
    } catch (err) {
      console.error('Failed to load admin school packs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = schoolPackService.subscribe(loadData);
    return () => unsub();
  }, []);

  const handleToggle = async (id: string, currentStatus: boolean) => {
    try {
      await schoolPackService.togglePackStatus(id, !currentStatus);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to toggle status');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the school pack "${name}"?`)) return;
    try {
      await schoolPackService.deletePack(id);
      await loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete pack');
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const newGrades = editGradesInput
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean);
    const newTiers = editTiersInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    if (newGrades.length === 0 || newTiers.length === 0) {
      alert('Please specify at least one grade group and one tier.');
      return;
    }

    try {
      const updated = await schoolPackService.updateConfig({
        gradeGroups: newGrades,
        tiers: newTiers,
      });
      setConfig(updated);
      setConfigSuccessMsg('Grade groups and tiers configuration saved successfully!');
      setTimeout(() => setConfigSuccessMsg(null), 3000);
      setShowConfigModal(false);
    } catch (err: any) {
      alert(err?.message || 'Failed to update configuration');
    }
  };

  const filteredPacks = packs.filter((p) => {
    if (selectedGrade !== 'all' && p.grade.toLowerCase() !== selectedGrade.toLowerCase()) return false;
    if (selectedTier !== 'all' && p.tier.toLowerCase() !== selectedTier.toLowerCase()) return false;
    if (selectedStatus === 'active' && !p.isActive) return false;
    if (selectedStatus === 'draft' && p.isActive) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            School Pack Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure school grade packs, real inventory items, pricing bundles, and active tiers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfigModal(true)}
            className="bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 shadow-2xs transition-colors flex items-center gap-1.5"
          >
            <Settings className="w-3.5 h-3.5 text-slate-500" />
            <span>Config Grades &amp; Tiers</span>
          </button>

          <Link
            href="/admin/school-packs/new"
            className="bg-[#08275E] hover:bg-[#103b8c] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 text-[#FFD21C]" />
            <span>Create New Pack</span>
          </Link>
        </div>
      </div>

      {configSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold">
          {configSuccessMsg}
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500">Filter Grade:</span>
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
          >
            <option value="all">All Grades</option>
            {config.gradeGroups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">Filter Tier:</span>
          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium uppercase"
          >
            <option value="all">All Tiers</option>
            {config.tiers.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">Status:</span>
          {(['all', 'active', 'draft'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSelectedStatus(s)}
              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${
                selectedStatus === s
                  ? s === 'active'
                    ? 'bg-emerald-600 text-white'
                    : s === 'draft'
                    ? 'bg-slate-600 text-white'
                    : 'bg-[#08275E] text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading school packs...</div>
        ) : filteredPacks.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No school packs found. Click &ldquo;Create New Pack&rdquo; to add one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <th className="py-3 px-4 font-bold">Pack Name</th>
                  <th className="py-3 px-4 font-bold">Grade</th>
                  <th className="py-3 px-4 font-bold">Tier</th>
                  <th className="py-3 px-4 font-bold">Items Count</th>
                  <th className="py-3 px-4 font-bold">Bundle Price</th>
                  <th className="py-3 px-4 font-bold">Discount</th>
                  <th className="py-3 px-4 font-bold">Stock Status</th>
                  <th className="py-3 px-4 font-bold">Visibility</th>
                  <th className="py-3 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPacks.map((pack) => (
                  <tr key={pack.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {pack.name}
                      <span className="block text-[10px] text-slate-400 font-normal">/{pack.slug}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-semibold">{pack.grade}</td>
                    <td className="py-3.5 px-4">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                        {pack.tier}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{pack.items.length} items</td>
                    <td className="py-3.5 px-4 font-black text-[#08275E]">
                      {formatLKR(pack.totalPriceCents)}
                      {pack.calculatedOriginalSubtotalCents && pack.calculatedOriginalSubtotalCents > pack.totalPriceCents && (
                        <span className="block text-[10px] font-normal text-slate-400 line-through">
                          {formatLKR(pack.calculatedOriginalSubtotalCents)}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-emerald-600">
                      {pack.savingsPercentage}% off
                    </td>
                    <td className="py-3.5 px-4">
                      {pack.allInStock !== false ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          In Stock
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          {pack.outOfStockItemsCount} Low Stock
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => handleToggle(pack.id, pack.isActive)}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase transition-all ${
                          pack.isActive
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {pack.isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        <span>{pack.isActive ? 'Active' : 'Draft'}</span>
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/admin/school-packs/${pack.id}/edit`}
                          className="p-1.5 text-slate-500 hover:text-[#08275E] hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit pack"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          onClick={() => handleDelete(pack.id, pack.name)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete pack"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Grade Groups & Tiers Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 space-y-5 shadow-xl text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Configure Supported Grades &amp; Tiers</h2>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Supported Grade Groups (comma separated)
                </label>
                <textarea
                  rows={3}
                  value={editGradesInput}
                  onChange={(e) => setEditGradesInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-[#08275E]"
                  placeholder="Grade 1-2, Grade 3-5, Grade 6-9, O/L (Grade 10-11), A/L Science, A/L Commerce, A/L Arts"
                />
                <span className="text-[10px] text-slate-400">
                  Defines the grades customers can filter by on the storefront.
                </span>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Supported Tiers (comma separated)
                </label>
                <input
                  type="text"
                  value={editTiersInput}
                  onChange={(e) => setEditTiersInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-[#08275E]"
                  placeholder="essential, standard, premium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#08275E] text-white font-bold hover:bg-[#103b8c]"
                >
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
