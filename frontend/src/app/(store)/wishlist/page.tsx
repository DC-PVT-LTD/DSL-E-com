'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Heart,
  ShoppingCart,
  Trash2,
  Check,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useWishlistStore } from '@/services/wishlistStore';
import { useCartStore } from '@/services/cartStore';
import { useUserStore } from '@/services/userStore';
import { formatLKR, calculateSavingsPercent } from '@/lib/currency';
import { WishlistItem } from '@/types/wishlist';

export default function WishlistPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const currentUser = useUserStore((state) => state.currentUser);
  const items = useWishlistStore((state) => state.items);
  const itemCount = useWishlistStore((state) => state.itemCount);
  const isLoading = useWishlistStore((state) => state.isLoading);
  const error = useWishlistStore((state) => state.error);
  const fetchWishlist = useWishlistStore((state) => state.fetchWishlist);
  const removeItem = useWishlistStore((state) => state.removeItem);
  const addItemToCart = useCartStore((state) => state.addItem);

  useEffect(() => {
    setMounted(true);
    fetchWishlist();
  }, [fetchWishlist]);

  const handleAddToCart = async (item: WishlistItem) => {
    const product = item.product;
    if (!product.isActive || product.stockQuantity <= 0) return;

    setAddingId(item.productId);
    try {
      const success = await addItemToCart(product as any, 1);
      if (success) {
        setAddedIds((prev) => new Set(prev).add(item.productId));
        setTimeout(() => {
          setAddedIds((prev) => {
            const next = new Set(prev);
            next.delete(item.productId);
            return next;
          });
        }, 1500);
      }
    } finally {
      setAddingId(null);
    }
  };

  const handleRemove = async (productId: string) => {
    await removeItem(productId);
  };

  if (!mounted) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center bg-[#FFFDF0]">
        <Loader2 className="w-8 h-8 animate-spin text-[#0066CC]" />
        <p className="mt-3 text-xs text-[#292525]/60 font-medium">Loading your wishlist...</p>
      </div>
    );
  }

  // Unauthenticated State
  if (!currentUser) {
    return (
      <div className="bg-[#FFFDF0] min-h-[70vh] flex items-center justify-center py-20 px-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-[#C6E7FF] p-8 sm:p-10 text-center shadow-xs">
          <div className="w-16 h-16 rounded-full bg-[#FF6B91]/15 flex items-center justify-center mx-auto text-[#FF6B91] mb-4">
            <Heart className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-[#292525]">Save Your Favourite Stationery</h1>
          <p className="text-xs text-[#292525]/70 mt-2 leading-relaxed">
            Sign in to access your personal wishlist, save items across devices, and easily transfer items into your cart.
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <Link
              href="/login?redirect=/wishlist"
              className="bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold py-3 rounded-full transition-colors shadow-xs"
            >
              Sign In to View Wishlist
            </Link>
            <Link
              href="/register?redirect=/wishlist"
              className="bg-[#FFFDF0] text-[#292525] hover:bg-[#FAF7EE] border border-[#C6E7FF] text-xs font-bold py-3 rounded-full transition-colors"
            >
              Create New Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Loading State
  if (isLoading && items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded-full w-48" />
          <div className="h-4 bg-slate-200 rounded-full w-72" />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pt-6">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
                <div className="aspect-square bg-slate-100 rounded-xl" />
                <div className="h-4 bg-slate-200 rounded-full w-3/4" />
                <div className="h-4 bg-slate-200 rounded-full w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10 sm:py-16 bg-[#FFFDF0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#C6E7FF]/60">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-4xl font-black text-[#292525] tracking-tight">
                My Wishlist
              </h1>
              <span className="bg-[#FF6B91]/15 text-[#FF6B91] text-xs font-bold px-2.5 py-0.5 rounded-full">
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </span>
            </div>
            <p className="text-xs text-[#292525]/60 mt-1">
              Your saved stationery essentials, exercise books, and fine writing instruments
            </p>
          </div>

          <Link
            href="/shop"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0066CC] hover:underline self-start sm:self-auto"
          >
            <span>Continue Shopping</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-rose-800 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => fetchWishlist()}
              className="text-xs font-bold underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {items.length === 0 ? (
          <div className="max-w-md mx-auto py-16 text-center bg-white rounded-3xl border border-[#C6E7FF] p-10 shadow-xs">
            <div className="w-16 h-16 rounded-full bg-[#FF6B91]/10 flex items-center justify-center mx-auto text-[#FF6B91] mb-4">
              <Heart className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-[#292525]">Your Wishlist is Empty</h2>
            <p className="text-xs text-[#292525]/60 mt-2 leading-relaxed">
              Explore our catalogue of CR books, fine gel pens, geometry instruments, and school packs. Click the heart icon on any item to save it here.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-2.5 justify-center">
              <Link
                href="/shop"
                className="bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold px-6 py-3 rounded-full transition-colors shadow-xs"
              >
                Browse Stationery Catalogue
              </Link>
              <Link
                href="/school-packs"
                className="bg-[#FFFDF0] hover:bg-[#FAF7EE] border border-[#C6E7FF] text-[#292525] text-xs font-bold px-6 py-3 rounded-full transition-colors"
              >
                School Packs
              </Link>
            </div>
          </div>
        ) : (
          /* Wishlist Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {items.map((item) => {
              const product = item.product;
              const isOutOfStock = product.stockQuantity <= 0 || !product.isActive;
              const isLowStock = !isOutOfStock && product.stockQuantity <= 5;
              const isAdded = addedIds.has(item.productId);
              const isAdding = addingId === item.productId;

              return (
                <div
                  key={item.id}
                  className="group relative bg-white rounded-2xl border border-[#C6E7FF]/70 hover:border-[#0066CC] hover:shadow-lg transition-all duration-300 flex flex-col overflow-hidden"
                >
                  {/* Top Badges & Remove Button */}
                  <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1 items-start pointer-events-none">
                    {product.categoryName && (
                      <span className="bg-[#FFFDF0] text-[#0066CC] border border-[#C6E7FF] text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        {product.categoryName}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleRemove(item.productId)}
                    className="absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full bg-white/90 backdrop-blur-xs text-[#292525]/50 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-all shadow-xs"
                    title="Remove from wishlist"
                    aria-label={`Remove ${product.name} from wishlist`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {/* Product Image */}
                  <Link
                    href={`/products/${product.slug}`}
                    className="block relative bg-[#FAF7EE] aspect-square overflow-hidden p-6"
                  >
                    <div className="w-full h-full flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                      {product.images && product.images.length > 0 && typeof product.images[0] === 'string' && (product.images[0].startsWith('http') || !product.images[0].includes('.png')) ? (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-full h-full object-contain object-center"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-white border border-[#C6E7FF] flex items-center justify-center text-[#0066CC] font-black text-2xl font-heylowitch">
                          {product.name.charAt(0)}
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Body Details */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      {product.brandName && (
                        <span className="text-[10px] font-bold text-[#0066CC] uppercase tracking-wider">
                          {product.brandName}
                        </span>
                      )}
                      <Link
                        href={`/products/${product.slug}`}
                        className="block text-xs font-bold text-[#292525] hover:text-[#0066CC] line-clamp-2 mt-0.5"
                      >
                        {product.name}
                      </Link>

                      {/* Price */}
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-sm font-black text-[#292525]">
                          {formatLKR(product.priceCents)}
                        </span>
                        {product.compareAtPriceCents && product.compareAtPriceCents > product.priceCents && (
                          <span className="text-[11px] text-[#292525]/40 line-through">
                            {formatLKR(product.compareAtPriceCents)}
                          </span>
                        )}
                      </div>

                      {/* Stock Status */}
                      <div className="mt-2">
                        {isOutOfStock ? (
                          <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full inline-block">
                            Out of Stock
                          </span>
                        ) : isLowStock ? (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full inline-block">
                            Only {product.stockQuantity} left
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                            In Stock
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 border-t border-[#C6E7FF]/40">
                      <button
                        onClick={() => handleAddToCart(item)}
                        disabled={isOutOfStock || isAdding}
                        className={`w-full py-2 px-3 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs ${
                          isOutOfStock
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                            : isAdded
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[#0066CC] hover:bg-[#0052a3] text-white hover:scale-101'
                        }`}
                      >
                        {isAdding ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Adding...</span>
                          </>
                        ) : isAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Added to Cart!</span>
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="w-3.5 h-3.5" />
                            <span>Add to Cart</span>
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
    </div>
  );
}

