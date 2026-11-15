'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Tag, Copy, Check, ArrowRight, Sparkles } from 'lucide-react';
import { INITIAL_PROMOTIONS } from '@/mocks/promotions';
import { productService } from '@/services/productService';
import { ProductCard } from '@/components/products/ProductCard';

export default function OffersPage() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const onSaleProducts = productService.getAll().filter((p) => p.compareAtPriceCents && p.compareAtPriceCents > p.priceCents);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-14 space-y-12">
      {/* Header */}
      <div className="max-w-2xl">
        <div className="inline-flex items-center gap-1.5 bg-blue-50 text-[#0866E8] text-xs font-bold px-3.5 py-1 rounded-full uppercase tracking-wider mb-3 border border-blue-100">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Active Discounts</span>
        </div>
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-[#09285C] tracking-tight">
          Special Offers &amp; Promo Codes
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-2.5 leading-relaxed">
          Enjoy limited-time discounts on our back-to-school packs, volume office paper purchases,
          and first-order customer vouchers.
        </p>
      </div>

      {/* Promo Voucher Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {INITIAL_PROMOTIONS.map((promo, idx) => {
          const promoBg = idx === 0 ? 'bg-amber-50/70 border-amber-200' : idx === 1 ? 'bg-blue-50/60 border-blue-200' : 'bg-slate-50 border-slate-200';
          const badgeBg = idx === 0 ? 'bg-[#FFD84D] text-[#594300]' : idx === 1 ? 'bg-[#EAF4FF] text-[#0866E8]' : 'bg-slate-200 text-[#09285C]';

          return (
            <div
              key={promo.id}
              className={`rounded-3xl border ${promoBg} p-6 shadow-xs flex flex-col justify-between relative overflow-hidden`}
            >
              <div className="space-y-2.5">
                <span className={`text-[10px] font-black uppercase tracking-wider ${badgeBg} px-3 py-1 rounded-full inline-block shadow-2xs`}>
                  {promo.discountType === 'percentage' ? `${promo.discountValue}% OFF` : `LKR ${promo.discountValue} OFF`}
                </span>
                <h2 className="text-base sm:text-lg font-bold text-[#09285C]">{promo.title}</h2>
                <p className="text-xs text-slate-600 leading-relaxed">{promo.description}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200/60 flex items-center justify-between">
                <div className="bg-white/90 border-2 border-dashed border-[#0866E8]/40 rounded-full px-4 py-1.5 font-mono text-xs font-black text-[#0866E8] tracking-wider shadow-2xs">
                  {promo.code}
                </div>
                <button
                  onClick={() => handleCopy(promo.code)}
                  className="flex items-center gap-1.5 text-xs font-bold text-[#0866E8] hover:text-[#09285C] transition-colors p-1"
                >
                  {copiedCode === promo.code ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* On-Sale Stationery Items */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-[#09285C] tracking-tight">
              Stationery on Sale Today
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Save on high quality exercise books, highlighter sets, and writing instruments.
            </p>
          </div>
          <Link href="/shop" className="text-xs font-bold text-[#0866E8] hover:underline flex items-center gap-1">
            <span>View All Sale Items</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
          {onSaleProducts.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </div>
  );
}
