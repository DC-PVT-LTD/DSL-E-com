'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  Check,
  Eye,
  EyeOff,
  Search,
  AlertTriangle,
  X,
  Filter,
} from 'lucide-react';
import { recommendationService } from '@/services/recommendationService';
import { productService } from '@/services/productService';
import {
  RecommendationRule,
  StationeryPurpose,
  RecommendationConfig,
} from '@/types/recommendations';
import { Product } from '@/types/product';
import { formatLKR } from '@/lib/currency';

const PROTECTED_TEST_PRODUCT_ID = 'cmw0j4cro00089kusmwsbv48t';

export default function AdminFindMyStationeryPage() {
  const [rules, setRules] = useState<RecommendationRule[]>([]);
  const [config, setConfig] = useState<RecommendationConfig | null>(null);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPurposeFilter, setSelectedPurposeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RecommendationRule | null>(null);
  const [formPurpose, setFormPurpose] = useState<StationeryPurpose>('school');
  const [formName, setFormName] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formProductId, setFormProductId] = useState('');
  const [formDefaultQty, setFormDefaultQty] = useState(1);
  const [formPriority, setFormPriority] = useState(1);
  const [formGradeLevels, setFormGradeLevels] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [rulesData, configData, prodsData] = await Promise.all([
        recommendationService.getAdminRules(),
        recommendationService.getConfig(),
        productService.fetchProducts({}, 'name_asc', 1, 150),
      ]);
      setRules(rulesData);
      setConfig(configData);
      setAvailableProducts(
        prodsData.items.filter((p) => p.isActive && p.id !== PROTECTED_TEST_PRODUCT_ID)
      );
    } catch (err) {
      console.error('Failed to load admin recommendations data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showStatus = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    try {
      await recommendationService.toggleAdminRule(id, !currentStatus);
      setRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, isActive: !currentStatus } : r))
      );
      showStatus('Rule status toggled');
    } catch (err: any) {
      showStatus(err?.message || 'Failed to toggle status', 'error');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete recommendation rule "${name}"?`)) return;
    try {
      await recommendationService.deleteAdminRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
      showStatus('Recommendation rule deleted');
    } catch (err: any) {
      showStatus(err?.message || 'Failed to delete rule', 'error');
    }
  };

  const handleOpenCreateModal = () => {
    setEditingRule(null);
    setFormPurpose('school');
    setFormName('');
    setFormReason('');
    setFormProductId(availableProducts[0]?.id || '');
    setFormDefaultQty(1);
    setFormPriority(1);
    setFormGradeLevels(['Grade 1-2', 'Grade 3-5']);
    setProductSearch('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rule: RecommendationRule) => {
    setEditingRule(rule);
    setFormPurpose(rule.purpose);
    setFormName(rule.name);
    setFormReason(rule.reason);
    setFormProductId(rule.productId);
    setFormDefaultQty(rule.defaultQuantity);
    setFormPriority(rule.priority);
    setFormGradeLevels(rule.gradeLevels || []);
    setProductSearch('');
    setIsModalOpen(true);
  };

  const handleToggleGrade = (grade: string) => {
    setFormGradeLevels((prev) =>
      prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade]
    );
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formReason.trim() || !formProductId) {
      alert('Please fill out all required fields.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingRule) {
        const updated = await recommendationService.updateAdminRule(editingRule.id, {
          purpose: formPurpose,
          name: formName.trim(),
          reason: formReason.trim(),
          productId: formProductId,
          defaultQuantity: formDefaultQty,
          priority: formPriority,
          gradeLevels: formPurpose === 'school' ? formGradeLevels : undefined,
        });
        setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        showStatus('Recommendation rule updated successfully');
      } else {
        const created = await recommendationService.createAdminRule({
          purpose: formPurpose,
          name: formName.trim(),
          reason: formReason.trim(),
          productId: formProductId,
          defaultQuantity: formDefaultQty,
          priority: formPriority,
          gradeLevels: formPurpose === 'school' ? formGradeLevels : undefined,
          isActive: true,
        });
        setRules((prev) => [...prev, created]);
        showStatus('New recommendation rule created successfully');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err?.message || 'Failed to save rule');
    } finally {
      setIsSaving(false);
    }
  };

  // Filter rules by purpose and search query
  const filteredRules = rules.filter((r) => {
    if (selectedPurposeFilter !== 'all' && r.purpose !== selectedPurposeFilter) return false;
    if (
      searchQuery.trim() &&
      !r.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !r.reason.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const productMap = new Map(availableProducts.map((p) => [p.id, p]));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[#0066CC]" />
            <span>Find My Stationery Configuration</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure algorithmic recommendation rules, product assignments, syllabus grades, and priority order
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="bg-[#08275E] hover:bg-[#103b8c] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-[#FFD21C]" />
          <span>New Recommendation Rule</span>
        </button>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        {/* Purpose Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3 text-slate-400" />
            <span>Purpose:</span>
          </span>
          {['all', 'school', 'university', 'office', 'art_craft', 'gift'].map((p) => (
            <button
              key={p}
              onClick={() => setSelectedPurposeFilter(p)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase transition-all ${
                selectedPurposeFilter === p
                  ? 'bg-[#08275E] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p === 'all' ? 'All Rules' : p.replace('_', ' & ')}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-48">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search rules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#08275E]"
          />
        </div>
      </div>

      {/* Rules Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading recommendation rules...</div>
        ) : filteredRules.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 space-y-2">
            <p>No recommendation rules match your criteria.</p>
            <button
              onClick={handleOpenCreateModal}
              className="text-xs text-[#0066CC] font-bold hover:underline"
            >
              Click here to create a new rule
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <th className="py-3 px-4 font-bold">Rule Name &amp; Purpose</th>
                  <th className="py-3 px-4 font-bold">Target Criteria</th>
                  <th className="py-3 px-4 font-bold">Catalogue Product</th>
                  <th className="py-3 px-4 font-bold text-center">Default Qty</th>
                  <th className="py-3 px-4 font-bold text-center">Priority</th>
                  <th className="py-3 px-4 font-bold">Customer Reason</th>
                  <th className="py-3 px-4 font-bold">Status</th>
                  <th className="py-3 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRules.map((rule) => {
                  const product = productMap.get(rule.productId);
                  return (
                    <tr key={rule.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {rule.name}
                        <span className="block mt-0.5">
                          <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                            {rule.purpose.replace('_', ' & ')}
                          </span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        {rule.gradeLevels && rule.gradeLevels.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {rule.gradeLevels.map((g) => (
                              <span key={g} className="bg-blue-50 text-[#0066CC] text-[10px] font-bold px-1.5 py-0.5 rounded">
                                {g}
                              </span>
                            ))}
                          </div>
                        ) : rule.activityTypes ? (
                          <span className="text-slate-600">{rule.activityTypes.join(', ')}</span>
                        ) : rule.occasions ? (
                          <span className="text-slate-600">{rule.occasions.join(', ')}</span>
                        ) : rule.studyAreas ? (
                          <span className="text-slate-600">{rule.studyAreas.join(', ')}</span>
                        ) : (
                          <span className="text-slate-400 italic">General</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {product ? (
                          <div>
                            <span className="font-bold text-slate-800 block truncate max-w-xs">
                              {product.name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {formatLKR(product.priceCents)} • Stock: {product.stockQuantity}
                            </span>
                          </div>
                        ) : (
                          <span className="font-mono text-slate-500">{rule.productId}</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                        {rule.defaultQuantity}x
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-black text-[10px]">
                          #{rule.priority}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate" title={rule.reason}>
                        {rule.reason}
                      </td>

                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggle(rule.id, rule.isActive)}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase transition-all ${
                            rule.isActive
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {rule.isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          <span>{rule.isActive ? 'Active' : 'Disabled'}</span>
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(rule)}
                            className="p-1.5 text-slate-500 hover:text-[#08275E] hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit rule"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(rule.id, rule.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete rule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Rule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-xl w-full p-6 sm:p-8 space-y-5 shadow-xl text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                {editingRule ? 'Edit Recommendation Rule' : 'Create Recommendation Rule'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Purpose Category *</label>
                  <select
                    value={formPurpose}
                    onChange={(e) => setFormPurpose(e.target.value as StationeryPurpose)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium uppercase"
                  >
                    <option value="school">School</option>
                    <option value="university">University</option>
                    <option value="office">Office</option>
                    <option value="art_craft">Art &amp; Craft</option>
                    <option value="gift">Gift</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Priority Rank (1 = Top) *</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formPriority}
                    onChange={(e) => setFormPriority(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="font-bold text-slate-700 block mb-1">Rule Display Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Primary Daily Writing Pencil Set"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="font-bold text-slate-700 block mb-1">Catalogue Product *</label>
                  <div className="relative mb-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter product by name..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <select
                    value={formProductId}
                    onChange={(e) => setFormProductId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                  >
                    {availableProducts
                      .filter((p) =>
                        productSearch.trim() === '' ||
                        p.name.toLowerCase().includes(productSearch.toLowerCase())
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — Rs. {(p.priceCents / 100).toFixed(2)} (Stock: {p.stockQuantity})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Default Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formDefaultQty}
                    onChange={(e) => setFormDefaultQty(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-center"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="font-bold text-slate-700 block mb-1">Customer Reason / Explanation *</label>
                  <textarea
                    rows={2}
                    placeholder="Why this item is recommended (e.g. Essential dark graphite for daily classroom writing)"
                    value={formReason}
                    onChange={(e) => setFormReason(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                {formPurpose === 'school' && (
                  <div className="sm:col-span-2 space-y-1.5 pt-2 border-t border-slate-100">
                    <label className="font-bold text-slate-700 block">Applicable Grade Levels</label>
                    <div className="flex flex-wrap gap-1.5">
                      {(config?.schoolGrades || [
                        'Grade 1-2',
                        'Grade 3-5',
                        'Grade 6-9',
                        'O/L (Grade 10-11)',
                        'A/L Science',
                        'A/L Commerce',
                        'A/L Arts',
                      ]).map((grade) => {
                        const isChecked = formGradeLevels.includes(grade);
                        return (
                          <button
                            key={grade}
                            type="button"
                            onClick={() => handleToggleGrade(grade)}
                            className={`text-[10px] px-2.5 py-1 rounded-full border transition-all ${
                              isChecked
                                ? 'bg-[#08275E] text-white border-[#08275E]'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {isChecked ? '✓ ' : '+ '}
                            {grade}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-[#08275E] hover:bg-[#103b8c] text-white font-bold disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : editingRule ? 'Update Rule' : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

