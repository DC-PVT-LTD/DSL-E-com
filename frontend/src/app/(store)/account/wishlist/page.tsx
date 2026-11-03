'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, ShoppingBag, ArrowRight, Loader2 } from 'lucide-react';
import { AccountNav } from '@/components/common/AccountNav';
import { useUserStore } from '@/services/userStore';
import { productService } from '@/services/productService';
import { ProductCard } from '@/components/products/ProductCard';

export default function AccountWishlistPage() {
  const router = useRouter();
  const currentUser = useUserStore((state) => state.currentUser);
  const fetchCurrentUser = useUserStore((state) => state.fetchCurrentUser);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        await fetchCurrentUser();
      } catch {
      } finally {
        if (mounted) setIsChecking(false);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, [fetchCurrentUser]);

  useEffect(() => {
    if (!isChecking && !currentUser) {
      router.push('/login');
    }
  }, [isChecking, currentUser, router]);

  if (isChecking || !currentUser) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#0066CC]" />
        <p className="mt-3 text-xs text-[#292525]/60 font-medium">Loading wishlist...</p>
      </div>
    );
  }

  const wishlistIds = currentUser?.wishlistProductIds || [];
  const allProducts = productService.getAll();
  const wishlistProducts = allProducts.filter((p) => wishlistIds.includes(p.id));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">My Wishlist</h1>
        <p className="text-xs text-slate-500 mt-1">
          {wishlistProducts.length} items saved for future stationery purchases
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <AccountNav />
        </div>

        <div className="lg:col-span-3">
          {wishlistProducts.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-xs text-slate-500">
              <Heart className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-bold text-slate-800 text-sm">Your wishlist is empty</p>
              <p className="mt-1">Click the heart icon on any product to save it here.</p>
              <Link
                href="/shop"
                className="mt-4 inline-flex items-center gap-1.5 bg-[#08275E] text-white text-xs font-bold px-4 py-2 rounded-xl"
              >
                <span>Browse Catalogue</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {wishlistProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
