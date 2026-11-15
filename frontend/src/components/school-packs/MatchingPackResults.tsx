'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  AlertCircle,
  ShoppingCart,
  RotateCcw,
  LayoutGrid,
  Gift,
  Settings,
  Sparkles,
} from 'lucide-react';
import { SchoolPack } from '@/types/school-pack';
import { Product } from '@/types/product';
import { formatLKR } from '@/lib/currency';
import { useCartStore } from '@/services/cartStore';

interface MatchingPackResultsProps {
  packs: SchoolPack[];
  selectedGrade: string | null;
  selectedTier: string | null;
  onChangeChoices: () => void;
  onBrowseAll: () => void;
  compact?: boolean;
}

export const MatchingPackResults: React.FC<MatchingPackResultsProps> = ({
  packs,
  selectedGrade,
  selectedTier,
  onChangeChoices,
  onBrowseAll,
  compact = false,
}) => {
  const addSchoolPack = useCartStore((state) => state.addSchoolPack);
  const setDrawerOpen = useCartStore((state) => state.setDrawerOpen);
  const [addingPackId, setAddingPackId] = useState<string | null>(null);
  const [addedSuccessId, setAddedSuccessId] = useState<string | null>(null);

  const handleQuickAdd = async (pack: SchoolPack) => {
    try {
      setAddingPackId(pack.id);
      const payloadItems = pack.items.map((item) => {
        const prod: Product = item.product || {
          id: item.productId,
          name: item.productName || 'Stationery Item',
          slug: item.productId,
          sku: item.id || item.productId,
          description: '',
          shortDescription: '',
          categoryId: 'school-essentials',
          categoryName: 'School Essentials',
          brandId: 'dsl',
          brandName: 'DSL',
          priceCents: item.unitPriceCents || 0,
          stockQuantity: item.stockQuantity ?? 100,
          lowStockThreshold: 5,
          isActive: true,
          images: [],
          tags: [],
          rating: 5,
          reviewCount: 1,
          specifications: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        return {
          productId: item.productId,
          product: prod,
          quantity: item.defaultQuantity,
        };
      });

      const success = await addSchoolPack(
        {
          id: pack.id,
          name: pack.name,
          savingsPercentage: pack.savingsPercentage,
        },
        payloadItems
      );

      if (success) {
        setAddedSuccessId(pack.id);
        setTimeout(() => {
          setAddedSuccessId(null);
          setDrawerOpen(true);
        }, 600);
      }
    } catch (err) {
      console.error('Failed to add school pack:', err);
    } finally {
      setAddingPackId(null);
    }
  };

  // Compact Single-Page Mode for Scene 3 (Exact layout matching Image 2, fits 100% on one page)
  if (compact) {
    return (
      <div className="w-full bg-white/95 backdrop-blur-md rounded-[24px] sm:rounded-[32px] border border-white/90 shadow-2xl p-3.5 sm:p-4 lg:p-5 flex flex-col justify-between md:max-h-[calc(100vh-80px)]">
        {/* Header matching Image 2 */}
        <div className="flex items-center gap-2.5 mb-2.5 pb-2 border-b border-slate-100/80">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-blue-50 text-[#0866F5] border border-blue-100/60 flex items-center justify-center shrink-0 shadow-2xs">
            <Gift className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-lg font-black text-[#09285C] tracking-tight flex items-center gap-1.5">
              <span>Your Matching Stationery Packs</span>
              <Sparkles className="w-3.5 h-3.5 text-[#FFD84D] shrink-0" />
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">
              Here are the best packs for{' '}
              <strong className="text-[#0866F5] font-bold">
                {selectedGrade || 'Grade 6–9'} ({selectedTier ? (selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)) : 'Premium'})
              </strong>.
            </p>
          </div>
        </div>

        {/* Empty State */}
        {packs.length === 0 && (
          <div className="p-4 text-center space-y-2 max-w-md mx-auto py-6">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
            <h3 className="text-sm font-black text-[#09285C]">
              No Exact Matches Found
            </h3>
            <p className="text-xs text-slate-500">
              No pack found for <strong>{selectedGrade}</strong> in the <strong>{selectedTier}</strong> tier. Try another grade or tier.
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={onChangeChoices}
                className="px-4 py-2 rounded-full text-xs font-bold bg-[#0866F5] text-white hover:bg-[#0753C7] shadow-sm cursor-pointer"
              >
                Change Choices
              </button>
              <button
                type="button"
                onClick={onBrowseAll}
                className="px-4 py-2 rounded-full text-xs font-bold bg-white text-[#09285C] border border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                Browse All Packs
              </button>
            </div>
          </div>
        )}

        {/* 3 Package Cards matching Image 2 */}
        {packs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-3.5 items-stretch">
            {packs.slice(0, 3).map((pack, idx) => {
              const isAdding = addingPackId === pack.id;
              const isSuccess = addedSuccessId === pack.id;
              const savings = pack.savingsPercentage || (idx === 0 ? 15 : idx === 1 ? 10 : 12);
              const originalPriceCents = Math.round(pack.totalPriceCents / (1 - savings / 100));
              const thumbImage =
                idx === 0
                  ? '/assets/packs/pack-study.jpg'
                  : idx === 1
                  ? '/assets/packs/pack-essentials.jpg'
                  : '/assets/packs/pack-maths.jpg';

              return (
                <div
                  key={pack.id}
                  className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/90 hover:border-[#0866F5] p-3 sm:p-3 shadow-2xs hover:shadow-md transition-all duration-300 flex flex-col justify-between group"
                >
                  <div className="space-y-1.5 sm:space-y-2">
                    {/* Pack Thumbnail Box with Yellow Save % Badge */}
                    <div className="relative aspect-[16/9] max-h-[140px] sm:max-h-[110px] md:max-h-[86px] bg-gradient-to-b from-slate-50 to-slate-100/50 rounded-lg sm:rounded-xl overflow-hidden flex items-center justify-center border border-slate-100">
                      <img
                        src={thumbImage}
                        alt={pack.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute top-1.5 right-1.5 bg-[#FFD84D] text-[#594300] text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full shadow-2xs">
                        Save {savings}%
                      </span>
                    </div>

                    {/* Pack Title */}
                    <h3 className="text-xs sm:text-[13px] font-black text-[#09285C] leading-snug line-clamp-1 group-hover:text-[#0866F5] transition-colors">
                      {pack.name}
                    </h3>

                    {/* Grade & Tier Chips */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] sm:text-[10px] font-bold text-[#0866F5] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">
                        {pack.grade}
                      </span>
                      <span className="text-[9px] sm:text-[10px] font-bold text-[#0866F5] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md capitalize">
                        {pack.tier}
                      </span>
                    </div>

                    {/* Price & In-Stock Row */}
                    <div className="pt-0.5 flex items-baseline justify-between gap-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs sm:text-sm font-black text-[#0866F5]">
                          {formatLKR(pack.totalPriceCents)}
                        </span>
                        <span className="text-[9px] sm:text-[10px] text-slate-400 line-through">
                          {formatLKR(originalPriceCents)}
                        </span>
                      </div>
                      <span className="text-[9px] sm:text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md inline-flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5 stroke-[3] text-emerald-600" /> In Stock
                      </span>
                    </div>
                  </div>

                  {/* 3 Buttons stacked like Image 2 */}
                  <div className="pt-2 sm:pt-2.5 mt-2 border-t border-slate-100 space-y-1.5">
                    <Link
                      href={`/school-packs/${pack.slug || pack.id}`}
                      className="w-full block text-center py-1.5 px-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold text-[#09285C] bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      View Details
                    </Link>

                    <Link
                      href={`/school-packs/${pack.slug || pack.id}`}
                      className="w-full flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold text-[#0866F5] bg-white border border-blue-200 hover:bg-blue-50 transition-colors"
                    >
                      <Settings className="w-3 h-3 text-[#0866F5]" />
                      <span>Customize Pack</span>
                    </Link>

                    <button
                      type="button"
                      disabled={isAdding || isSuccess}
                      onClick={() => handleQuickAdd(pack)}
                      className={`w-full py-2 px-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm ${
                        isSuccess
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[#0866F5] hover:bg-[#0753C7] text-white shadow-blue-500/25'
                      }`}
                    >
                      {isSuccess ? (
                        <>
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Added!</span>
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>{isAdding ? 'Adding...' : 'Add to Cart'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom Navigation matching Image 2 - always fully visible */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onChangeChoices}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-[#09285C] bg-white border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#0866F5]" />
            <span>Change My Choices</span>
          </button>

          <button
            type="button"
            onClick={onBrowseAll}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-[#0866F5] bg-[#EAF4FF] hover:bg-blue-100/80 border border-blue-200/50 transition-all cursor-pointer shadow-2xs"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Browse All Packs</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/90 backdrop-blur-md rounded-2xl p-4 border border-white/80 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400">Showing matches for:</span>
          {selectedGrade && (
            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-blue-50 text-[#0866F5] border border-blue-200">
              {selectedGrade}
            </span>
          )}
          {selectedTier && (
            <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-amber-50 text-[#855B00] border border-amber-200">
              {selectedTier}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onChangeChoices}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-[#09285C] bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
            <span>Change My Choices</span>
          </button>
          <button
            type="button"
            onClick={onBrowseAll}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-slate-600 hover:text-[#0866F5] hover:bg-blue-50/50 transition-colors cursor-pointer"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Browse All Packs</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {packs.length === 0 && (
        <div className="bg-white/95 backdrop-blur-md rounded-[32px] border border-white/80 p-8 sm:p-12 text-center shadow-lg max-w-xl mx-auto space-y-4">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
          <h3 className="text-xl font-black text-[#09285C]">
            No Exact Matches Found
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
            Poo couldn&apos;t find an active pack specifically for{' '}
            <strong className="text-[#09285C]">{selectedGrade}</strong> in the{' '}
            <strong className="text-[#09285C]">{selectedTier}</strong> tier. You can try selecting a different tier or browse our full catalogue.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onChangeChoices}
              className="px-6 py-2.5 rounded-full text-xs font-bold bg-[#0866F5] text-white hover:bg-[#0753C7] shadow-md transition-all cursor-pointer"
            >
              Change My Choices
            </button>
            <button
              type="button"
              onClick={onBrowseAll}
              className="px-6 py-2.5 rounded-full text-xs font-bold bg-white text-[#09285C] border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer"
            >
              Browse All Packs
            </button>
          </div>
        </div>
      )}

      {/* Found Matching Packs Grid */}
      {packs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
          {packs.map((pack) => {
            const isAdding = addingPackId === pack.id;
            const isSuccess = addedSuccessId === pack.id;

            return (
              <div
                key={pack.id}
                className="bg-white/95 backdrop-blur-md rounded-[32px] border border-white/80 hover:border-[#0866F5] p-6 sm:p-7 shadow-[0_15px_40px_rgba(9,40,92,0.12)] hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  {/* Badges */}
                  <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
                    <span className="text-xs font-black text-[#09285C] bg-[#EAF4FF] border border-blue-200/50 px-3.5 py-1 rounded-full">
                      {pack.grade}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#594300] bg-[#FFD84D] px-3 py-1 rounded-full shadow-2xs">
                      {pack.tier} Tier • Save {pack.savingsPercentage}%
                    </span>
                  </div>

                  <h3 className="text-lg sm:text-xl font-black text-[#09285C] leading-snug">
                    {pack.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed line-clamp-2">
                    {pack.description}
                  </p>

                  {/* Stock Status Badge */}
                  <div className="mt-3">
                    {pack.allInStock !== false ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        All items in stock
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        Limited / out of stock items
                      </span>
                    )}
                  </div>

                  {/* Included Items Preview */}
                  <div className="mt-5 pt-4 border-t border-slate-100/90 space-y-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      Pack Includes:
                    </span>
                    {pack.items.slice(0, 5).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 text-xs text-slate-700"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 stroke-[2.5]" />
                        <span className="truncate">
                          {item.defaultQuantity}x {item.productName || item.product?.name}
                        </span>
                      </div>
                    ))}
                    {pack.items.length > 5 && (
                      <span className="text-[11px] text-slate-400 block pt-1">
                        + {pack.items.length - 5} more items
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Actions & Price */}
                <div className="mt-7 pt-5 border-t border-slate-100 space-y-4">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        Bundle Price
                      </span>
                      <span className="text-2xl font-black text-[#0866F5]">
                        {formatLKR(pack.totalPriceCents)}
                      </span>
                    </div>

                    {pack.calculatedSavingsCents && pack.calculatedSavingsCents > 0 && (
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                        Save {formatLKR(pack.calculatedSavingsCents)}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href={`/school-packs/${pack.slug || pack.id}`}
                      className="bg-white hover:bg-slate-50 text-[#09285C] border border-slate-200 text-xs font-bold py-2.5 px-3 rounded-full transition-all text-center flex items-center justify-center gap-1"
                    >
                      <span>Customize</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>

                    <button
                      type="button"
                      disabled={isAdding || isSuccess}
                      onClick={() => handleQuickAdd(pack)}
                      className={`text-xs font-bold py-2.5 px-3 rounded-full transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm ${
                        isSuccess
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[#0866F5] hover:bg-[#0753C7] text-white'
                      }`}
                    >
                      {isSuccess ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Added!</span>
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>{isAdding ? 'Adding...' : 'Add to Cart'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
