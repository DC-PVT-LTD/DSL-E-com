'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Bookmark, ShoppingCart, Trash2, Plus, ArrowRight, Check } from 'lucide-react';
import { AccountNav } from '@/components/common/AccountNav';
import { useUserStore } from '@/services/userStore';
import { productService } from '@/services/productService';
import { useCartStore } from '@/services/cartStore';
import { formatLKR } from '@/lib/currency';

export default function AccountSavedListsPage() {
  const currentUser = useUserStore((state) => state.currentUser);
  const removeSavedList = useUserStore((state) => state.removeSavedList);
  const addItem = useCartStore((state) => state.addItem);
  const setDrawerOpen = useCartStore((state) => state.setDrawerOpen);

  const [addedListId, setAddedListId] = useState<string | null>(null);

  const savedLists = currentUser?.savedLists || [];
  const allProducts = productService.getAll();

  const handleAddAllToCart = (listId: string, productIds: string[]) => {
    productIds.forEach((pid) => {
      const product = allProducts.find((p) => p.id === pid);
      if (product) {
        addItem(product, 1);
      }
    });

    setAddedListId(listId);
    setTimeout(() => {
      setAddedListId(null);
      setDrawerOpen(true);
    }, 800);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Saved Stationery Lists</h1>
        <p className="text-xs text-slate-500 mt-1">
          Save custom booklists for easy 1-click re-ordering each school term or office month.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <AccountNav />
        </div>

        <div className="lg:col-span-3 space-y-6">
          {savedLists.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-xs text-slate-500">
              <Bookmark className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-bold text-slate-800 text-sm">No saved stationery lists yet</p>
              <p className="mt-1">Create lists for your school term or monthly office replenishment.</p>
            </div>
          ) : (
            savedLists.map((list) => {
              const items = allProducts.filter((p) => list.itemProductIds.includes(p.id));
              const totalCents = items.reduce((acc, p) => acc + p.priceCents, 0);

              return (
                <div key={list.id} className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-100 gap-2">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">{list.title}</h2>
                      {list.description && <p className="text-xs text-slate-500 mt-0.5">{list.description}</p>}
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleAddAllToCart(list.id, list.itemProductIds)}
                        className="bg-[#08275E] hover:bg-[#103b8c] text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
                      >
                        {addedListId === list.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Added to Cart!</span>
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="w-3.5 h-3.5 text-[#FFD21C]" />
                            <span>Add All to Cart ({formatLKR(totalCents)})</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => removeSavedList(list.id)}
                        className="text-slate-400 hover:text-rose-500 p-1.5 transition-colors"
                        title="Delete list"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Items in list */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {items.map((prod) => (
                      <div key={prod.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="font-semibold text-slate-800 truncate mr-2">{prod.name}</span>
                        <span className="font-bold text-[#08275E] shrink-0">{formatLKR(prod.priceCents)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
