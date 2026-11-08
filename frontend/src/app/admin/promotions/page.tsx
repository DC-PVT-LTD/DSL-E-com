'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Tag,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Calendar,
  Percent,
  Truck,
  Copy,
  Check,
  Edit2,
  Trash2,
  Layers,
  Eye,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Package,
  FolderTree,
} from 'lucide-react';
import { promotionService } from '@/services/promotionService';
import { categoryService } from '@/services/categoryService';
import { productService } from '@/services/productService';
import {
  Promotion,
  PromotionStatus,
  PromotionType,
  DiscountType,
  PromotionReportingSummary,
  PromotionRedemption,
  CreatePromotionPayload,
} from '@/types/promotion';
import { ProductCategory, Product } from '@/types/product';
import { formatLKR, centsToRupees, rupeesToCents } from '@/lib/currency';

export default function AdminPromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [summary, setSummary] = useState<PromotionReportingSummary>({
    totalPromotions: 0,
    activePromotions: 0,
    expiredPromotions: 0,
    scheduledPromotions: 0,
    disabledPromotions: 0,
    draftPromotions: 0,
    totalRedemptions: 0,
    totalDiscountValueCents: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PromotionStatus>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | PromotionType>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Categories & Products for eligibility pickers
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Add Code Modal state
  const [isAddCodeOpen, setIsAddCodeOpen] = useState(false);
  const [codeTargetPromo, setCodeTargetPromo] = useState<Promotion | null>(null);
  const [newCodeVal, setNewCodeVal] = useState('');
  const [newCodeMaxTotal, setNewCodeMaxTotal] = useState<number | ''>('');
  const [newCodeMaxUser, setNewCodeMaxUser] = useState<number | ''>('');
  const [generatingCode, setGeneratingCode] = useState(false);

  // View Redemptions Modal state
  const [isRedemptionsOpen, setIsRedemptionsOpen] = useState(false);
  const [redemptionsPromo, setRedemptionsPromo] = useState<Promotion | null>(null);
  const [redemptions, setRedemptions] = useState<PromotionRedemption[]>([]);
  const [redemptionsLoading, setRedemptionsLoading] = useState(false);

  // Copied code feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form Fields
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    promotionType: PromotionType;
    discountType: DiscountType;
    discountValue: number;
    maximumDiscountAmountRupees: number | '';
    minimumOrderAmountRupees: number | '';
    status: PromotionStatus;
    startDate: string;
    endDate: string;
    priority: number;
    isStackableWithSchoolPacks: boolean;
    isActive: boolean;
    initialCode: string;
    eligibleProductIds: string[];
    eligibleCategoryIds: string[];
  }>({
    name: '',
    description: '',
    promotionType: 'PERCENTAGE',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    maximumDiscountAmountRupees: '',
    minimumOrderAmountRupees: '',
    status: 'ACTIVE',
    startDate: new Date().toISOString().slice(0, 16),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    priority: 0,
    isStackableWithSchoolPacks: false,
    isActive: true,
    initialCode: '',
    eligibleProductIds: [],
    eligibleCategoryIds: [],
  });

  // Load Categories & Products on mount
  useEffect(() => {
    categoryService.fetchCategories().then(setCategories).catch(console.error);
    productService.fetchProducts({}, 'newest', 1, 100).then((res) => setProducts(res.items)).catch(console.error);
  }, []);

  const loadPromotions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, summaryRes] = await Promise.all([
        promotionService.getAdminPromotions({
          page,
          limit: 15,
          search: search.trim() || undefined,
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          promotionType: typeFilter === 'ALL' ? undefined : typeFilter,
        }),
        promotionService.getReportingSummary(),
      ]);

      setPromotions(listRes.items);
      setTotalPages(listRes.totalPages);
      setTotalItems(listRes.total);
      setSummary(summaryRes);
    } catch (err: any) {
      console.error('Failed to load promotions:', err);
      setError(err?.message || 'Failed to load promotions from database');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, typeFilter]);

  useEffect(() => {
    loadPromotions();
  }, [loadPromotions]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleGenerateCode = async () => {
    setGeneratingCode(true);
    try {
      const randomCode = await promotionService.generateUniqueCode('DSL');
      setFormData((prev) => ({ ...prev, initialCode: randomCode }));
      if (isAddCodeOpen) setNewCodeVal(randomCode);
    } catch (err) {
      console.error('Failed to generate code:', err);
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingPromotion(null);
    setFormData({
      name: '',
      description: '',
      promotionType: 'PERCENTAGE',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      maximumDiscountAmountRupees: '',
      minimumOrderAmountRupees: '',
      status: 'ACTIVE',
      startDate: new Date().toISOString().slice(0, 16),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      priority: 0,
      isStackableWithSchoolPacks: false,
      isActive: true,
      initialCode: '',
      eligibleProductIds: [],
      eligibleCategoryIds: [],
    });
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (promo: Promotion) => {
    setEditingPromotion(promo);
    const primaryCode = promo.codes?.[0]?.code || promo.code || '';
    setFormData({
      name: promo.name || promo.title || '',
      description: promo.description || '',
      promotionType: promo.promotionType,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      maximumDiscountAmountRupees: promo.maximumDiscountAmount ? centsToRupees(promo.maximumDiscountAmount) : '',
      minimumOrderAmountRupees: promo.minimumOrderAmount ? centsToRupees(promo.minimumOrderAmount) : '',
      status: promo.status,
      startDate: new Date(promo.startDate).toISOString().slice(0, 16),
      endDate: new Date(promo.endDate).toISOString().slice(0, 16),
      priority: promo.priority,
      isStackableWithSchoolPacks: promo.isStackableWithSchoolPacks,
      isActive: promo.isActive,
      initialCode: primaryCode,
      eligibleProductIds: promo.eligibleProducts?.map((ep) => ep.productId) || [],
      eligibleCategoryIds: promo.eligibleCategories?.map((ec) => ec.categoryId) || [],
    });
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Promotion name is required');
      return;
    }
    if (new Date(formData.startDate) >= new Date(formData.endDate)) {
      setFormError('Start date must be strictly before end date');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const payload: CreatePromotionPayload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        promotionType: formData.promotionType,
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        maximumDiscountAmount: formData.maximumDiscountAmountRupees ? rupeesToCents(Number(formData.maximumDiscountAmountRupees)) : null,
        minimumOrderAmount: formData.minimumOrderAmountRupees ? rupeesToCents(Number(formData.minimumOrderAmountRupees)) : null,
        status: formData.status,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString(),
        priority: Number(formData.priority) || 0,
        isStackableWithSchoolPacks: formData.isStackableWithSchoolPacks,
        isActive: formData.isActive,
        code: formData.initialCode.trim() ? formData.initialCode.trim().toUpperCase() : null,
        eligibleProductIds: formData.promotionType === 'PRODUCT_SPECIFIC' ? formData.eligibleProductIds : [],
        eligibleCategoryIds: formData.promotionType === 'CATEGORY_SPECIFIC' ? formData.eligibleCategoryIds : [],
      };

      if (editingPromotion) {
        await promotionService.updatePromotion(editingPromotion.id, payload);
      } else {
        await promotionService.createPromotion(payload);
      }

      setIsFormModalOpen(false);
      loadPromotions();
    } catch (err: any) {
      console.error('Failed to save promotion:', err);
      setFormError(err?.message || 'Failed to save promotion');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (promo: Promotion) => {
    try {
      if (promo.isActive) {
        await promotionService.deactivatePromotion(promo.id);
      } else {
        await promotionService.activatePromotion(promo.id);
      }
      loadPromotions();
    } catch (err: any) {
      alert(err?.message || 'Failed to toggle status');
    }
  };

  const handleDelete = async (promo: Promotion) => {
    const isDraft = promo.effectiveStatus === 'DRAFT' || (promo._count?.orders ?? 0) === 0;
    const confirmMsg = isDraft
      ? `Are you sure you want to permanently delete "${promo.name}"?`
      : `"${promo.name}" has redemption history. Deleting it will safely disable it to preserve order logs. Proceed?`;

    if (!confirm(confirmMsg)) return;

    try {
      const res = await promotionService.deletePromotion(promo.id);
      alert(res.message);
      loadPromotions();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete promotion');
    }
  };

  const handleOpenAddCodeModal = (promo: Promotion) => {
    setCodeTargetPromo(promo);
    setNewCodeVal('');
    setNewCodeMaxTotal('');
    setNewCodeMaxUser('');
    setIsAddCodeOpen(true);
  };

  const handleAddCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeTargetPromo || !newCodeVal.trim()) return;

    try {
      await promotionService.addPromoCode(codeTargetPromo.id, {
        code: newCodeVal.trim().toUpperCase(),
        maximumTotalUsage: newCodeMaxTotal ? Number(newCodeMaxTotal) : null,
        maximumUsagePerCustomer: newCodeMaxUser ? Number(newCodeMaxUser) : null,
        isActive: true,
      });
      setIsAddCodeOpen(false);
      loadPromotions();
    } catch (err: any) {
      alert(err?.message || 'Failed to add promo code');
    }
  };

  const handleOpenRedemptions = async (promo: Promotion) => {
    setRedemptionsPromo(promo);
    setIsRedemptionsOpen(true);
    setRedemptionsLoading(true);
    try {
      const res = await promotionService.getPromotionRedemptions(promo.id, 1, 50);
      setRedemptions(res.redemptions);
    } catch (err) {
      console.error('Failed to load redemptions:', err);
    } finally {
      setRedemptionsLoading(false);
    }
  };

  const getStatusBadge = (status: PromotionStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Active
          </span>
        );
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Clock className="w-3 h-3 text-blue-600" />
            Scheduled
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <Calendar className="w-3 h-3 text-slate-500" />
            Expired
          </span>
        );
      case 'DISABLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            Disabled
          </span>
        );
      case 'DRAFT':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertCircle className="w-3 h-3 text-amber-600" />
            Draft
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#08275E]/5 text-[#08275E]">
              <Tag className="w-5 h-5 text-[#0066CC]" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Promotions &amp; Discount Rules
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 pl-11">
            Configure coupons, school pack stacking eligibility, spending thresholds, and view live redemptions
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="bg-[#0066CC] hover:bg-[#0052a3] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-2 self-start sm:self-auto hover:scale-102"
        >
          <Plus className="w-4 h-4" />
          <span>Create Promotion</span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Active Promotions</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-3 text-2xl font-black text-slate-900">
            {summary.activePromotions}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {summary.totalPromotions} Total Campaigns
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Scheduled</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-3 text-2xl font-black text-slate-900">
            {summary.scheduledPromotions}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {summary.expiredPromotions} Expired Campaigns
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Redemptions</span>
            <Tag className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-3 text-2xl font-black text-slate-900">
            {summary.totalRedemptions}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Authoritative order redemptions</p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Discount Value</span>
            <Percent className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-3 text-2xl font-black text-[#0066CC]">
            {formatLKR(summary.totalDiscountValueCents)}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Total customer savings awarded</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search promotion name, code, or description..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setPage(1);
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="EXPIRED">Expired</option>
              <option value="DISABLED">Disabled</option>
              <option value="DRAFT">Draft</option>
            </select>
          </div>

          <div>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as any);
                setPage(1);
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
            >
              <option value="ALL">All Promotion Types</option>
              <option value="PERCENTAGE">Percentage (%)</option>
              <option value="FIXED_AMOUNT">Fixed Amount (Rs.)</option>
              <option value="FREE_DELIVERY">Free Delivery</option>
              <option value="PRODUCT_SPECIFIC">Product Specific</option>
              <option value="CATEGORY_SPECIFIC">Category Specific</option>
              <option value="ORDER_LEVEL">Order Level</option>
            </select>
          </div>
        </div>

        <button
          onClick={loadPromotions}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Promotions Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#0066CC] mb-2" />
            Loading campaigns from database...
          </div>
        ) : error ? (
          <div className="p-12 text-center text-xs text-rose-600 space-y-2">
            <AlertCircle className="w-6 h-6 mx-auto text-rose-500" />
            <p className="font-bold">{error}</p>
            <button
              onClick={loadPromotions}
              className="mt-2 text-xs font-bold text-[#0066CC] hover:underline"
            >
              Try Again
            </button>
          </div>
        ) : promotions.length === 0 ? (
          <div className="p-16 text-center text-xs text-slate-500 space-y-3">
            <Tag className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm font-bold text-slate-800">No promotions found</p>
            <p className="text-slate-400 max-w-sm mx-auto">
              No promotions match your current search or filter criteria. Create your first discount campaign!
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#0066CC] px-4 py-2 rounded-xl hover:bg-[#0052a3]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Promotion</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Promotion Name</th>
                  <th className="py-3.5 px-4">Promo Codes</th>
                  <th className="py-3.5 px-4">Discount Type &amp; Value</th>
                  <th className="py-3.5 px-4">School Packs Stacking</th>
                  <th className="py-3.5 px-4">Effective Status</th>
                  <th className="py-3.5 px-4">Date Window</th>
                  <th className="py-3.5 px-4">Redemptions</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {promotions.map((p) => {
                  const codesList = p.codes && p.codes.length > 0 ? p.codes : (p.code ? [{ id: 'direct', code: p.code, totalUsage: p.usageCount }] : []);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name & description */}
                      <td className="py-4 px-4 font-medium text-slate-900 max-w-xs">
                        <div className="font-bold text-slate-900">{p.name || p.title}</div>
                        {p.description && (
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            {p.description}
                          </div>
                        )}
                        {p.minimumOrderAmount && (
                          <div className="text-[10px] text-amber-700 mt-1 font-semibold">
                            Min Order: {formatLKR(p.minimumOrderAmount)}
                          </div>
                        )}
                      </td>

                      {/* Promo Codes */}
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap items-center gap-1.5 max-w-[200px]">
                          {codesList.map((c: any) => (
                            <span
                              key={c.code}
                              onClick={() => handleCopyCode(c.code)}
                              title="Click to copy code"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200 cursor-pointer transition-colors"
                            >
                              <span>{c.code}</span>
                              {copiedCode === c.code ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3 text-slate-400" />
                              )}
                            </span>
                          ))}
                          <button
                            onClick={() => handleOpenAddCodeModal(p)}
                            title="Add promo code"
                            className="p-1 text-slate-400 hover:text-[#0066CC] hover:bg-[#0066CC]/10 rounded-md transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Discount Type & Value */}
                      <td className="py-4 px-4 font-semibold text-slate-800">
                        {p.promotionType === 'FREE_DELIVERY' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                            <Truck className="w-3 h-3" />
                            Free Delivery
                          </span>
                        ) : p.discountType === 'PERCENTAGE' || p.promotionType === 'PERCENTAGE' ? (
                          <span className="font-extrabold text-[#0066CC]">
                            {p.discountValue}% OFF
                          </span>
                        ) : (
                          <span className="font-extrabold text-purple-700">
                            Rs. {p.discountValue} OFF
                          </span>
                        )}
                        {p.maximumDiscountAmount && (
                          <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                            Capped at {formatLKR(p.maximumDiscountAmount)}
                          </span>
                        )}
                        {p.promotionType === 'PRODUCT_SPECIFIC' && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded-md mt-1">
                            <Package className="w-2.5 h-2.5" /> Product Specific
                          </span>
                        )}
                        {p.promotionType === 'CATEGORY_SPECIFIC' && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-indigo-800 bg-indigo-50 px-1.5 py-0.5 rounded-md mt-1">
                            <FolderTree className="w-2.5 h-2.5" /> Category Specific
                          </span>
                        )}
                      </td>

                      {/* School Packs Stacking */}
                      <td className="py-4 px-4">
                        {p.isStackableWithSchoolPacks ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Layers className="w-3 h-3 text-emerald-600" />
                            Stackable
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            Not Stackable
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">{getStatusBadge(p.effectiveStatus)}</td>

                      {/* Dates */}
                      <td className="py-4 px-4 text-[11px] text-slate-600 whitespace-nowrap">
                        <div>
                          Start: <span className="font-semibold">{new Date(p.startDate).toLocaleDateString()}</span>
                        </div>
                        <div className="text-slate-400">
                          End: <span className="font-semibold text-slate-600">{new Date(p.endDate).toLocaleDateString()}</span>
                        </div>
                      </td>

                      {/* Redemptions count */}
                      <td className="py-4 px-4">
                        <button
                          onClick={() => handleOpenRedemptions(p)}
                          className="font-bold text-[#0066CC] hover:underline inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>{p._count?.redemptions ?? p.usageCount} orders</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleToggleActive(p)}
                            title={p.isActive ? 'Deactivate' : 'Activate'}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                              p.isActive
                                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                            }`}
                          >
                            {p.isActive ? 'Disable' : 'Enable'}
                          </button>

                          <button
                            onClick={() => handleOpenEditModal(p)}
                            title="Edit Promotion"
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDelete(p)}
                            title="Delete Promotion"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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

        {/* Pagination Footer */}
        {totalItems > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div>
              Showing <span className="font-bold">{promotions.length}</span> of{' '}
              <span className="font-bold">{totalItems}</span> campaigns
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE / EDIT PROMOTION MODAL */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl my-8 overflow-hidden animate-fade-in text-xs">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {editingPromotion ? 'Edit Promotion Campaign' : 'Create New Promotion'}
                </h2>
                <p className="text-[11px] text-slate-500">
                  Configure discount formula, stacking rules, and validity window
                </p>
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-medium">
                  {formError}
                </div>
              )}

              {/* Campaign Name & Description */}
              <div className="space-y-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Campaign Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Back-to-School Special 15%"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Description</label>
                  <textarea
                    rows={2}
                    placeholder="Brief description visible to staff and customers..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                  />
                </div>
              </div>

              {/* Promo Code & Random Generator */}
              {!editingPromotion && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">Primary Promotional Code</label>
                    <button
                      type="button"
                      onClick={handleGenerateCode}
                      disabled={generatingCode}
                      className="text-xs font-bold text-[#0066CC] hover:underline flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{generatingCode ? 'Generating...' : 'Generate Random Code'}</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. EXAM2026 (Leave empty to auto-generate unique code)"
                    value={formData.initialCode}
                    onChange={(e) => setFormData({ ...formData, initialCode: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono uppercase font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                  />
                </div>
              )}

              {/* Promotion Type & Value */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Promotion Type *</label>
                  <select
                    value={formData.promotionType}
                    onChange={(e) => {
                      const newType = e.target.value as PromotionType;
                      setFormData({
                        ...formData,
                        promotionType: newType,
                        discountType: newType === 'FREE_DELIVERY' ? 'FREE_DELIVERY' : (newType === 'FIXED_AMOUNT' ? 'FIXED_AMOUNT' : 'PERCENTAGE'),
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED_AMOUNT">Fixed Amount (Rs.)</option>
                    <option value="FREE_DELIVERY">Free Delivery</option>
                    <option value="PRODUCT_SPECIFIC">Product-Specific</option>
                    <option value="CATEGORY_SPECIFIC">Category-Specific</option>
                    <option value="ORDER_LEVEL">Order-Level</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    {formData.promotionType === 'FREE_DELIVERY'
                      ? 'Discount Value (N/A)'
                      : formData.discountType === 'PERCENTAGE'
                      ? 'Percentage Discount (%)'
                      : 'Fixed Discount (Rs.)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={formData.discountType === 'PERCENTAGE' ? 100 : undefined}
                    disabled={formData.promotionType === 'FREE_DELIVERY'}
                    value={formData.discountValue}
                    onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Max Discount Cap (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Optional (No Cap)"
                    value={formData.maximumDiscountAmountRupees}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        maximumDiscountAmountRupees: e.target.value === '' ? '' : Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                  />
                </div>
              </div>

              {/* Minimum Order Value */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">Minimum Order Amount (Rs.)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 2500 (Optional, 0 for no minimum requirement)"
                  value={formData.minimumOrderAmountRupees}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      minimumOrderAmountRupees: e.target.value === '' ? '' : Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                />
              </div>

              {/* CRITICAL: School Pack Stacking Toggle */}
              <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-black text-indigo-950 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      <span>Combine with School Pack Discounts?</span>
                    </label>
                    <p className="text-[11px] text-indigo-800/80 mt-0.5 leading-relaxed">
                      When disabled (default), customers cannot apply this code if their cart contains discounted School Packs.
                      When enabled, discounts calculate sequentially without exceeding eligible purchase value.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.isStackableWithSchoolPacks}
                    onChange={(e) => setFormData({ ...formData, isStackableWithSchoolPacks: e.target.checked })}
                    className="w-5 h-5 accent-[#0066CC] rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Product / Category Specific Pickers */}
              {formData.promotionType === 'PRODUCT_SPECIFIC' && (
                <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-2">
                  <label className="font-bold text-blue-950 block">Eligible Products (Select Applicable)</label>
                  <div className="max-h-40 overflow-y-auto space-y-1 bg-white p-2 rounded-xl border border-blue-200">
                    {products.map((prod) => {
                      const isSelected = formData.eligibleProductIds.includes(prod.id);
                      return (
                        <label
                          key={prod.id}
                          className="flex items-center gap-2 p-1 hover:bg-blue-50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  eligibleProductIds: [...formData.eligibleProductIds, prod.id],
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  eligibleProductIds: formData.eligibleProductIds.filter((id) => id !== prod.id),
                                });
                              }
                            }}
                            className="accent-[#0066CC]"
                          />
                          <span className="font-medium text-slate-800">{prod.name}</span>
                          <span className="text-slate-400 font-mono text-[10px]">({prod.sku})</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {formData.promotionType === 'CATEGORY_SPECIFIC' && (
                <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-2xl space-y-2">
                  <label className="font-bold text-indigo-950 block">Eligible Categories (Select Applicable)</label>
                  <div className="max-h-40 overflow-y-auto space-y-1 bg-white p-2 rounded-xl border border-indigo-200">
                    {categories.map((cat) => {
                      const isSelected = formData.eligibleCategoryIds.includes(cat.id);
                      return (
                        <label
                          key={cat.id}
                          className="flex items-center gap-2 p-1 hover:bg-indigo-50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  eligibleCategoryIds: [...formData.eligibleCategoryIds, cat.id],
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  eligibleCategoryIds: formData.eligibleCategoryIds.filter((id) => id !== cat.id),
                                });
                              }
                            }}
                            className="accent-[#0066CC]"
                          />
                          <span className="font-medium text-slate-800">{cat.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Start & End Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Start Date &amp; Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-800 mb-1">End Date &amp; Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                  />
                </div>
              </div>

              {/* Status & Active Checkbox */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center gap-2">
                  <label className="font-bold text-slate-800">Initial Status:</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as PromotionStatus })}
                    className="px-2 py-1 bg-white border border-slate-200 rounded-lg font-medium"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="DRAFT">DRAFT</option>
                    <option value="DISABLED">DISABLED</option>
                  </select>
                </div>

                <label className="flex items-center gap-1.5 font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="accent-[#0066CC]"
                  />
                  <span>Active</span>
                </label>
              </div>

              {/* Modal Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#0066CC] hover:bg-[#0052a3] text-white rounded-xl font-bold shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingPromotion ? 'Update Campaign' : 'Create Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD PROMO CODE MODAL */}
      {isAddCodeOpen && codeTargetPromo && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4 animate-fade-in text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Add Code to &ldquo;{codeTargetPromo.name}&rdquo;</h3>
                <p className="text-[11px] text-slate-500">Attach another custom or auto-generated coupon code</p>
              </div>
              <button
                onClick={() => setIsAddCodeOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCodeSubmit} className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-800">Coupon Code *</label>
                  <button
                    type="button"
                    onClick={handleGenerateCode}
                    className="text-[11px] text-[#0066CC] font-bold hover:underline flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Generate</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. SPECIAL50"
                  value={newCodeVal}
                  onChange={(e) => setNewCodeVal(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase font-bold focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Max Total Uses</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={newCodeMaxTotal}
                    onChange={(e) => setNewCodeMaxTotal(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Max Per Customer</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={newCodeMaxUser}
                    onChange={(e) => setNewCodeMaxUser(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddCodeOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#0066CC] hover:bg-[#0052a3] text-white rounded-xl font-bold"
                >
                  Add Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW REDEMPTIONS MODAL */}
      {isRedemptionsOpen && redemptionsPromo && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl p-6 space-y-4 animate-fade-in text-xs max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Redemption History: {redemptionsPromo.name}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Confirmed customer orders where this promotion was redeemed
                </p>
              </div>
              <button
                onClick={() => setIsRedemptionsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {redemptionsLoading ? (
                <div className="p-8 text-center text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#0066CC] mb-2" />
                  Loading redemption records...
                </div>
              ) : redemptions.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  No redemptions recorded for this promotion yet.
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-2">Order #</th>
                      <th className="p-2">Customer</th>
                      <th className="p-2">Discount Given</th>
                      <th className="p-2">Redeemed At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {redemptions.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="p-2 font-mono font-bold text-slate-900">
                          {r.order?.orderNumber || r.orderId || 'N/A'}
                        </td>
                        <td className="p-2">
                          <div className="font-semibold text-slate-800">
                            {r.customer?.name || 'Customer'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {r.customerEmail || r.customer?.email}
                          </div>
                        </td>
                        <td className="p-2 font-bold text-[#0066CC]">
                          {formatLKR(r.discountAmount)}
                        </td>
                        <td className="p-2 text-slate-500 text-[11px]">
                          {new Date(r.redeemedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end shrink-0">
              <button
                onClick={() => setIsRedemptionsOpen(false)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
