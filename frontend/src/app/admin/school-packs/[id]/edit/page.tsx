'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Check, RefreshCw, AlertTriangle, Search } from 'lucide-react';
import { schoolPackService } from '@/services/schoolPackService';
import { productService } from '@/services/productService';
import { Product } from '@/types/product';
import { formatLKR } from '@/lib/currency';

/** Protected test product that must NEVER appear in new packs */
const TEST_PRODUCT_ID = 'cmw0j4cro00089kusmwsbv48t';
/** Warn admin when stock is at or below this threshold */
const LOW_STOCK_THRESHOLD = 10;

interface PackItemDraft {
  productId: string;
  defaultQuantity: number;
  substituteProductIds: string[];
}

export default function AdminEditSchoolPackPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [gradeOptions, setGradeOptions] = useState<string[]>([
    'Grade 1-2',
    'Grade 3-5',
    'Grade 6-9',
    'O/L (Grade 10-11)',
    'A/L Science',
    'A/L Commerce',
    'A/L Arts',
  ]);
  const [tierOptions, setTierOptions] = useState<string[]>(['essential', 'standard', 'premium']);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [grade, setGrade] = useState('Grade 1-2');
  const [tier, setTier] = useState('essential');
  const [description, setDescription] = useState('');
  const [savingsPercentage, setSavingsPercentage] = useState(10);
  const [isActive, setIsActive] = useState(true);
  const [items, setItems] = useState<PackItemDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState<Record<number, string>>({});
  const [subSearch, setSubSearch] = useState<Record<number, string>>({});

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [prodRes, configRes, pack] = await Promise.all([
          productService.fetchProducts({}, 'name_asc', 1, 100),
          schoolPackService.getConfig(),
          schoolPackService.getAdminPackById(id),
        ]);

        setAvailableProducts(prodRes.items.filter((p) => p.isActive && p.id !== TEST_PRODUCT_ID));
        if (configRes.gradeGroups.length) setGradeOptions(configRes.gradeGroups);
        if (configRes.tiers.length) setTierOptions(configRes.tiers);

        if (pack) {
          setName(pack.name);
          setSlug(pack.slug);
          setGrade(pack.grade);
          setTier(pack.tier);
          setDescription(pack.description);
          setSavingsPercentage(pack.savingsPercentage);
          setIsActive(pack.isActive);
          setItems(
            pack.items.map((i) => ({
              productId: i.productId,
              defaultQuantity: i.defaultQuantity,
              substituteProductIds: i.substituteProductIds || [],
            }))
          );
        }
      } catch (err) {
        console.error('Failed to load pack details for editing:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [id]);

  const handleAddItem = () => {
    const unselected = availableProducts.find((p) => !items.some((i) => i.productId === p.id));
    if (unselected) {
      setItems([...items, { productId: unselected.id, defaultQuantity: 1, substituteProductIds: [] }]);
    } else if (availableProducts.length > 0) {
      setItems([...items, { productId: availableProducts[0].id, defaultQuantity: 1, substituteProductIds: [] }]);
    }
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleUpdateItemProduct = (index: number, newProductId: string) => {
    setItems(items.map((it, i) => (i === index ? { ...it, productId: newProductId } : it)));
  };

  const handleUpdateItemQty = (index: number, qty: number) => {
    if (qty < 1) return;
    setItems(items.map((it, i) => (i === index ? { ...it, defaultQuantity: qty } : it)));
  };

  const handleToggleSubstitute = (index: number, subId: string) => {
    setItems(
      items.map((it, i) => {
        if (i !== index) return it;
        const exists = it.substituteProductIds.includes(subId);
        const nextSubs = exists
          ? it.substituteProductIds.filter((id) => id !== subId)
          : [...it.substituteProductIds, subId];
        return { ...it, substituteProductIds: nextSubs };
      })
    );
  };

  const productMap = new Map(availableProducts.map((p) => [p.id, p]));
  const calculatedSubtotalCents = items.reduce((acc, it) => {
    const p = productMap.get(it.productId);
    return acc + (p ? p.priceCents * it.defaultQuantity : 0);
  }, 0);
  const calculatedSavingsCents = Math.round((calculatedSubtotalCents * savingsPercentage) / 100);
  const calculatedTotalCents = Math.max(0, calculatedSubtotalCents - calculatedSavingsCents);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('Please enter a pack title.');
      return;
    }

    const pids = items.map((i) => i.productId);
    if (new Set(pids).size !== pids.length) {
      setErrorMsg('Cannot add duplicate primary products to the pack.');
      return;
    }

    setIsSubmitting(true);
    try {
      await schoolPackService.updatePack(id, {
        name: name.trim(),
        slug: slug.trim() || undefined,
        grade,
        tier,
        description: description.trim(),
        savingsPercentage,
        isActive,
        items: items.map((it) => ({
          productId: it.productId,
          defaultQuantity: it.defaultQuantity,
          substituteProductIds: it.substituteProductIds,
        })),
      });

      router.push('/admin/school-packs');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update school pack.');
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center text-xs text-slate-400">
        Loading pack details...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <Link
            href="/admin/school-packs"
            className="text-xs font-semibold text-[#08275E] hover:underline flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Packs</span>
          </Link>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Edit School Pack: {name}
          </h1>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl font-medium">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 text-xs">
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-4 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900">1. Pack Details</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="font-bold text-slate-700 block mb-1">Pack Title *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-[#08275E]"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Slug (URL)</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Discount Savings %</label>
              <input
                type="number"
                min="0"
                max="100"
                value={savingsPercentage}
                onChange={(e) => setSavingsPercentage(parseInt(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Grade Level</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs"
              >
                {gradeOptions.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Tier</label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs uppercase"
              >
                {tierOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="font-bold text-slate-700 block mb-1">Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Visibility</label>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-slate-300 text-[#08275E]"
                />
                <label htmlFor="isActiveToggle" className="text-xs text-slate-700 font-semibold cursor-pointer">
                  Published and visible on storefront
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Component Products */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">2. Component Products &amp; Substitutes</h2>
              <p className="text-[11px] text-slate-500">
                Adjust quantities or swap brand options
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddItem}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Item</span>
            </button>
          </div>

          <div className="space-y-4 divide-y divide-slate-100">
            {items.map((item, idx) => {
              const selectedProduct = productMap.get(item.productId);
              const isLowStock = selectedProduct && selectedProduct.stockQuantity <= LOW_STOCK_THRESHOLD;
              return (
                <div key={idx} className="pt-4 first:pt-0 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-600 block">
                        Product Item #{idx + 1}
                      </label>
                      {/* Product search filter */}
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Filter products…"
                          value={productSearch[idx] ?? ''}
                          onChange={(e) => setProductSearch((prev) => ({ ...prev, [idx]: e.target.value }))}
                          className="w-full pl-7 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 mb-1"
                        />
                      </div>
                      <select
                        value={item.productId}
                        onChange={(e) => handleUpdateItemProduct(idx, e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                      >
                        {availableProducts
                          .filter((p) => {
                            const s = productSearch[idx] ?? '';
                            return s.trim() === '' || p.name.toLowerCase().includes(s.toLowerCase());
                          })
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} — Rs. {(p.priceCents / 100).toFixed(2)} (Stock: {p.stockQuantity})
                            </option>
                          ))}
                      </select>
                      {isLowStock && (
                        <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg text-[10px] font-bold">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          Low Stock: only {selectedProduct.stockQuantity} units available
                        </div>
                      )}
                    </div>

                    <div className="w-28">
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        Default Qty
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={item.defaultQuantity}
                        onChange={(e) => handleUpdateItemQty(idx, parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-center"
                      />
                    </div>

                    <div className="w-28 text-right self-end sm:self-center">
                      <span className="text-[10px] text-slate-400 uppercase block">Line Total</span>
                      <span className="font-black text-[#08275E]">
                        {selectedProduct
                          ? formatLKR(selectedProduct.priceCents * item.defaultQuantity)
                          : 'Rs. 0'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      disabled={items.length <= 1}
                      className="p-2 text-slate-400 hover:text-rose-600 disabled:opacity-30 self-end sm:self-center rounded-lg"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Allowed Substitutes */}
                  <div className="pl-4 border-l-2 border-[#C6E7FF] space-y-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 text-[#0066CC]" />
                      Allowed Brand Substitutes ({availableProducts.filter((p) => p.id !== item.productId && item.substituteProductIds.includes(p.id)).length} selected):
                    </span>
                    {/* Substitute search */}
                    <div className="relative max-w-xs">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search substitutes…"
                        value={subSearch[idx] ?? ''}
                        onChange={(e) => setSubSearch((prev) => ({ ...prev, [idx]: e.target.value }))}
                        className="w-full pl-7 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-700"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                      {availableProducts
                        .filter((p) => p.id !== item.productId)
                        .filter((p) => {
                          const s = subSearch[idx] ?? '';
                          return s.trim() === '' || p.name.toLowerCase().includes(s.toLowerCase());
                        })
                        .map((sub) => {
                          const isSub = item.substituteProductIds.includes(sub.id);
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => handleToggleSubstitute(idx, sub.id)}
                              title={`${sub.name} — Rs. ${(sub.priceCents / 100).toFixed(2)} (Stock: ${sub.stockQuantity})`}
                              className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                                isSub
                                  ? 'bg-[#0066CC] text-white border-[#0066CC]'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {isSub ? '✓ ' : '+ '}
                              {sub.name.length > 20 ? sub.name.slice(0, 20) + '…' : sub.name}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Server Authoritative Summary Bar */}
        <div className="bg-[#08275E] text-white rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-md">
          <div className="space-y-1 text-center sm:text-left">
            <span className="text-xs text-slate-300 block">Server Authoritative Pack Pricing</span>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-black text-[#FFD21C]">
                {formatLKR(calculatedTotalCents)}
              </span>
              <span className="text-xs text-slate-300 line-through">
                {formatLKR(calculatedSubtotalCents)}
              </span>
              <span className="text-xs font-bold text-emerald-400">
                Save {formatLKR(calculatedSavingsCents)} ({savingsPercentage}% Off)
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto px-8 py-3.5 bg-[#FFD21C] hover:bg-[#ffe066] text-[#08275E] font-black rounded-full shadow-md transition-all text-xs flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <span>Updating Pack in Database...</span>
            ) : (
              <>
                <Check className="w-4 h-4 text-[#08275E]" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
