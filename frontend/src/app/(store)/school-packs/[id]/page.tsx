'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Package,
  Plus,
  Minus,
  Check,
  ShoppingCart,
  ArrowLeft,
  RefreshCw,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { schoolPackService } from '@/services/schoolPackService';
import { productService } from '@/services/productService';
import { SchoolPack, SchoolPackItem } from '@/types/school-pack';
import { formatLKR } from '@/lib/currency';
import { useCartStore } from '@/services/cartStore';

interface ConfiguredItem {
  itemId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  substitutes?: { productId: string; productName: string; unitPriceCents: number }[];
}

function SchoolPackCustomizerContent() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const addItem = useCartStore((state) => state.addItem);
  const setDrawerOpen = useCartStore((state) => state.setDrawerOpen);

  const [pack, setPack] = useState<SchoolPack | undefined>(undefined);
  const [items, setItems] = useState<ConfiguredItem[]>([]);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    const p = schoolPackService.getById(id);
    setPack(p);
    if (p) {
      setItems(
        p.items.map((i) => ({
          itemId: i.id,
          productId: i.productId,
          productName: i.productName,
          quantity: i.defaultQuantity,
          unitPriceCents: i.unitPriceCents,
          substitutes: i.substitutes,
        }))
      );
    }
  }, [id]);

  if (!pack) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-[#292525]">School Pack Not Found</h1>
        <Link
          href="/school-packs"
          className="mt-4 inline-flex items-center gap-1.5 bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold px-5 py-2.5 rounded-full shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to School Packs</span>
        </Link>
      </div>
    );
  }

  const rawTotalCents = items.reduce((acc, i) => acc + i.unitPriceCents * i.quantity, 0);
  const discountCents = Math.round((rawTotalCents * pack.savingsPercentage) / 100);
  const finalTotalCents = rawTotalCents - discountCents;

  const handleUpdateQty = (itemId: string, newQty: number) => {
    if (newQty < 1) return;
    setItems((prev) =>
      prev.map((i) => (i.itemId === itemId ? { ...i, quantity: newQty } : i))
    );
  };

  const handleSubstitute = (itemId: string, sub: { productId: string; productName: string; unitPriceCents: number }) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.itemId === itemId) {
          return {
            ...i,
            productId: sub.productId,
            productName: sub.productName,
            unitPriceCents: sub.unitPriceCents,
          };
        }
        return i;
      })
    );
  };

  const handleAddToCart = () => {
    const allProducts = productService.getAll();
    items.forEach((item) => {
      const product = allProducts.find((p) => p.id === item.productId || p.name.includes(item.productName.split(' ')[0]));
      if (product) {
        addItem(product, item.quantity);
      }
    });

    setAdded(true);
    setTimeout(() => {
      setAdded(false);
      setDrawerOpen(true);
    }, 800);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-10">
      <nav className="flex items-center gap-1.5 text-xs text-[#292525]/50 font-medium">
        <Link href="/home" className="hover:text-[#0066CC]">Home</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link href="/school-packs" className="hover:text-[#0066CC]">School Packs</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-[#292525] font-bold">{pack.name}</span>
      </nav>

      <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-[#292525] bg-[#FFFDF0] border border-[#C6E7FF] px-3 py-0.5 rounded-full">
              {pack.grade}
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider text-[#594300] bg-[#FFD84D] px-2.5 py-0.5 rounded-full">
              {pack.tier} tier
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#292525] leading-tight">
            {pack.name}
          </h1>
          <p className="text-xs sm:text-sm text-[#292525]/70 mt-2 max-w-xl leading-relaxed">
            {pack.description}
          </p>
        </div>

        <div className="bg-[#FFFDF0] border border-[#C6E7FF] rounded-2xl p-5 text-center shrink-0">
          <span className="text-[10px] font-bold text-[#292525]/50 uppercase tracking-wider block">
            Customized Total (LKR)
          </span>
          <span className="text-2xl sm:text-3xl font-black text-[#0066CC] block mt-0.5">
            {formatLKR(finalTotalCents)}
          </span>
          <span className="text-[11px] font-bold text-emerald-600 block mt-1">
            Includes {pack.savingsPercentage}% Bundle Savings (-{formatLKR(discountCents)})
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#292525]">Customize Pack Contents</h2>
          <span className="text-xs text-[#292525]/50">Adjust quantities or substitute brands</span>
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.itemId}
              className="bg-white rounded-2xl border border-[#C6E7FF]/60 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs hover:border-[#0066CC] transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#FFFDF0] border border-[#C6E7FF] text-[#0066CC] flex items-center justify-center font-bold text-sm shrink-0">
                  {item.productName.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-[#292525]">{item.productName}</h3>
                  <div className="text-[11px] text-[#292525]/60 mt-0.5">
                    Unit: {formatLKR(item.unitPriceCents)}
                  </div>

                  {item.substitutes && item.substitutes.length > 0 && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] font-semibold text-[#292525]/50">Substitute:</span>
                      {item.substitutes.map((sub) => (
                        <button
                          key={sub.productId}
                          onClick={() => handleSubstitute(item.itemId, sub)}
                          className="text-[10px] font-bold text-[#0066CC] hover:underline bg-[#FFFDF0] border border-[#C6E7FF]/60 px-2.5 py-0.5 rounded-full flex items-center gap-1"
                        >
                          <RefreshCw className="w-2.5 h-2.5" />
                          <span>{sub.productName.split(' ')[0]}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-6 pl-14 sm:pl-0">
                <div className="flex items-center border border-[#C6E7FF] rounded-full overflow-hidden bg-[#FFFDF0]">
                  <button
                    onClick={() => handleUpdateQty(item.itemId, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                    className="p-1.5 hover:bg-[#C6E7FF]/40 text-[#292525] disabled:opacity-30"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-3 text-xs font-bold text-[#292525]">{item.quantity}</span>
                  <button
                    onClick={() => handleUpdateQty(item.itemId, item.quantity + 1)}
                    className="p-1.5 hover:bg-[#C6E7FF]/40 text-[#292525]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="text-right min-w-24">
                  <span className="text-sm font-black text-[#0066CC] block">
                    {formatLKR(item.unitPriceCents * item.quantity)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md sticky bottom-6">
        <div>
          <span className="text-xs text-[#292525]/60 block">Bundle Price ({items.length} items configured):</span>
          <span className="text-2xl font-black text-[#0066CC]">{formatLKR(finalTotalCents)}</span>
        </div>

        <button
          onClick={handleAddToCart}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#0066CC] hover:bg-[#0052a3] text-white font-bold text-sm px-8 py-3.5 rounded-full shadow-md hover:shadow-lg transition-all"
        >
          {added ? (
            <>
              <Check className="w-4 h-4 text-white" />
              <span>Pack Added to Cart!</span>
            </>
          ) : (
            <>
              <ShoppingCart className="w-4 h-4 text-white" />
              <span>Add Complete School Pack to Cart</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default function SchoolPackCustomizerPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-[#292525]/50">Loading pack customizer...</div>}>
      <SchoolPackCustomizerContent />
    </Suspense>
  );
}
