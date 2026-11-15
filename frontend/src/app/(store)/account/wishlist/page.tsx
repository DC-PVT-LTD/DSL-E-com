'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, ShoppingBag, ArrowRight, Loader2 } from 'lucide-react';
import { AccountNav } from '@/components/common/AccountNav';
import { useUserStore } from '@/services/userStore';
import { useWishlistStore } from '@/services/wishlistStore';
import { ProductCard } from '@/components/products/ProductCard';

export default function AccountWishlistPage() {
  const router = useRouter();
  const currentUser = useUserStore((state) => state.currentUser);
  const fetchCurrentUser = useUserStore((state) => state.fetchCurrentUser);
  const items = useWishlistStore((state) => state.items);
  const fetchWishlist = useWishlistStore((state) => state.fetchWishlist);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        await fetchCurrentUser();
        await fetchWishlist();
      } catch {
      } finally {
        if (mounted) setIsChecking(false);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, [fetchCurrentUser, fetchWishlist]);

  useEffect(() => {
    if (!isChecking && !currentUser) {
      router.push('/login?redirect=/account/wishlist');
    }
  }, [isChecking, currentUser, router]);

  if (isChecking || !currentUser) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#0866E8]" />
        <p className="mt-3 text-xs text-slate-500 font-medium">Loading wishlist...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-14">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-[#09285C] tracking-tight">My Wishlist</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          {items.length} {items.length === 1 ? 'item' : 'items'} saved for future stationery purchases
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <AccountNav />
        </div>

        <div className="lg:col-span-3">
          {items.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center text-xs text-slate-500 shadow-xs">
              <Heart className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-bold text-slate-800 text-sm">Your wishlist is empty</p>
              <p className="mt-1">Click the heart icon on any product to save it here.</p>
              <Link
                href="/shop"
                className="mt-4 inline-flex items-center gap-1.5 bg-[#0866E8] hover:bg-[#09285C] text-white text-xs font-bold px-5 py-2.5 rounded-full transition-colors shadow-xs"
              >
                <span>Browse Catalogue</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-3">
              {items.map((item) => (
                <ProductCard key={item.id} product={item.product as any} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
