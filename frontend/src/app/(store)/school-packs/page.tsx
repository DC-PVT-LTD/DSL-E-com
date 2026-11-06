'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { schoolPackService } from '@/services/schoolPackService';
import { SchoolPack, SchoolPackConfig } from '@/types/school-pack';
import { formatLKR } from '@/lib/currency';

export default function SchoolPacksPage() {
  const [packs, setPacks] = useState<SchoolPack[]>([]);
  const [config, setConfig] = useState<SchoolPackConfig>({
    gradeGroups: ['Grade 1-2', 'Grade 3-5', 'Grade 6-9', 'O/L (Grade 10-11)', 'A/L Science', 'A/L Commerce', 'A/L Arts'],
    tiers: ['essential', 'standard', 'premium'],
  });
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedTier, setSelectedTier] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      try {
        const [configData, packsData] = await Promise.all([
          schoolPackService.getConfig(),
          schoolPackService.getPacks(),
        ]);
        if (isMounted) {
          if (configData) setConfig(configData);
          setPacks(packsData.items);
        }
      } catch (err) {
        console.error('Failed to load school packs data:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();

    const unsub = schoolPackService.subscribe(() => {
      loadData();
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  const filteredPacks = packs.filter((p) => {
    if (selectedGrade !== 'all' && p.grade.toLowerCase() !== selectedGrade.toLowerCase()) return false;
    if (selectedTier !== 'all' && p.tier.toLowerCase() !== selectedTier.toLowerCase()) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-12">
      {/* Header */}
      <div className="max-w-2xl">
        <div className="inline-flex items-center gap-1.5 bg-[#FFD84D] text-[#594300] text-xs font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider mb-3 shadow-xs">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Curated Grade Bundles</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-[#292525] tracking-tight">
          School Stationery Packs
        </h1>
        <p className="text-sm text-[#292525]/70 mt-2.5 leading-relaxed">
          Pre-assembled school kits configured according to the Sri Lankan curriculum.
          Save up to 18% compared to buying items individually, with full freedom to customize contents and substitute products.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-[#292525]/50 mr-1">Grade:</span>
          <button
            onClick={() => setSelectedGrade('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
              selectedGrade === 'all'
                ? 'bg-[#0066CC] text-white shadow-xs'
                : 'bg-[#FFFDF0] text-[#292525]/70 hover:bg-[#C6E7FF]/30 border border-[#C6E7FF]/40'
            }`}
          >
            All Grades
          </button>
          {config.gradeGroups.map((grade) => (
            <button
              key={grade}
              onClick={() => setSelectedGrade(grade)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                selectedGrade === grade
                  ? 'bg-[#0066CC] text-white shadow-xs'
                  : 'bg-[#FFFDF0] text-[#292525]/70 hover:bg-[#C6E7FF]/30 border border-[#C6E7FF]/40'
              }`}
            >
              {grade}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#292525]/50 mr-1">Tier:</span>
          <button
            onClick={() => setSelectedTier('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold uppercase transition-all ${
              selectedTier === 'all'
                ? 'bg-[#0066CC] text-white shadow-xs'
                : 'bg-[#FFFDF0] text-[#292525]/70 hover:bg-[#C6E7FF]/30 border border-[#C6E7FF]/40'
            }`}
          >
            All
          </button>
          {config.tiers.map((tier) => (
            <button
              key={tier}
              onClick={() => setSelectedTier(tier)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold uppercase transition-all ${
                selectedTier === tier
                  ? 'bg-[#0066CC] text-white shadow-xs'
                  : 'bg-[#FFFDF0] text-[#292525]/70 hover:bg-[#C6E7FF]/30 border border-[#C6E7FF]/40'
              }`}
            >
              {tier}
            </button>
          ))}
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-7 animate-pulse space-y-4">
              <div className="h-6 bg-slate-100 rounded-full w-24"></div>
              <div className="h-8 bg-slate-100 rounded-xl w-3/4"></div>
              <div className="h-16 bg-slate-100 rounded-xl"></div>
              <div className="h-24 bg-slate-100 rounded-2xl"></div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredPacks.length === 0 && (
        <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-12 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
          <h3 className="text-lg font-bold text-[#292525]">No School Packs Found</h3>
          <p className="text-xs text-[#292525]/60 max-w-md mx-auto">
            {selectedGrade !== 'all'
              ? `No ${selectedGrade} packs are currently available${selectedTier !== 'all' ? ` in the ${selectedTier} tier` : ''}. Check back soon or browse another grade above.`
              : selectedTier !== 'all'
              ? `No ${selectedTier}-tier packs are currently available. Try another tier or view all grades.`
              : 'No stationery packs are currently available. Check back soon.'}
          </p>
        </div>
      )}

      {/* Packs Grid */}
      {!isLoading && filteredPacks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredPacks.map((pack) => (
            <div
              key={pack.id}
              className="bg-white rounded-3xl border border-[#C6E7FF]/60 hover:border-[#0066CC] p-7 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3.5">
                  <span className="text-xs font-bold text-[#292525] bg-[#FFFDF0] border border-[#C6E7FF] px-3 py-1 rounded-full">
                    {pack.grade}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#594300] bg-[#FFD84D] px-3 py-1 rounded-full shadow-2xs">
                    {pack.tier} Tier • Save {pack.savingsPercentage}%
                  </span>
                </div>

                <h2 className="text-xl font-bold text-[#292525] leading-snug">
                  {pack.name}
                </h2>
                <p className="text-xs text-[#292525]/60 mt-2 leading-relaxed">
                  {pack.description}
                </p>

                {/* Stock Indicator Badge */}
                <div className="mt-3">
                  {pack.allInStock !== false ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      All items in stock
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      {pack.outOfStockItemsCount || 1} item low / out of stock
                    </span>
                  )}
                </div>

                {/* Items Preview */}
                <div className="mt-5 pt-4 border-t border-[#C6E7FF]/30 space-y-2">
                  <span className="text-[11px] font-bold text-[#292525]/50 uppercase tracking-wider block mb-2">
                    Pack Includes:
                  </span>
                  {pack.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 text-xs text-[#292525]/80">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate">
                        {item.defaultQuantity}x {item.productName || item.product?.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-5 border-t border-[#C6E7FF]/30 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#292525]/50 uppercase block">Bundle Price</span>
                  <span className="text-2xl font-black text-[#0066CC]">
                    {formatLKR(pack.totalPriceCents)}
                  </span>
                  {pack.calculatedOriginalSubtotalCents && pack.calculatedOriginalSubtotalCents > pack.totalPriceCents && (
                    <span className="block text-xs text-[#292525]/40 line-through">
                      {formatLKR(pack.calculatedOriginalSubtotalCents)}
                    </span>
                  )}
                  {pack.calculatedSavingsCents && pack.calculatedSavingsCents > 0 && (
                    <span className="block text-[11px] font-bold text-emerald-600">
                      Save {formatLKR(pack.calculatedSavingsCents)}
                    </span>
                  )}
                </div>

                <Link
                  href={`/school-packs/${pack.slug || pack.id}`}
                  className="bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold px-5 py-3 rounded-full transition-all shadow-sm flex items-center gap-1.5"
                >
                  <span>Customize</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
