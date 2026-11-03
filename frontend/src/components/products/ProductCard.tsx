'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Heart, ShoppingBag, Check, Star, Sparkles } from 'lucide-react';
import { Product } from '@/types/product';
import { formatLKR, calculateSavingsPercent } from '@/lib/currency';
import { useCartStore } from '@/services/cartStore';
import { useUserStore } from '@/services/userStore';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const [added, setAdded] = useState(false);
  const addItem = useCartStore((state) => state.addItem);
  const isInWishlist = useUserStore((state) => state.isInWishlist);
  const toggleWishlist = useUserStore((state) => state.toggleWishlist);

  const inWishlist = isInWishlist(product.id);
  const isOutOfStock = product.stockQuantity <= 0;
  const hasVariants = Boolean(product.variants && product.variants.length > 1);

  const savingsPercent = product.compareAtPriceCents
    ? calculateSavingsPercent(product.compareAtPriceCents, product.priceCents)
    : 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock) return;

    const success = addItem(product, 1);
    if (success) {
      setAdded(true);
      setTimeout(() => setAdded(false), 1200);
    }
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product.id);
  };

  // Pastel accent color generator for category tag
  const getCategoryColor = (name: string) => {
    if (name.includes('Book') || name.includes('Paper')) return 'bg-[#C6E7FF]/40 text-[#b54a61]';
    if (name.includes('Pen') || name.includes('Writing')) return 'bg-[#B9D5FF]/40 text-[#2563eb]';
    if (name.includes('School') || name.includes('Pack')) return 'bg-[#FFD84D]/40 text-[#926002]';
    return 'bg-[#EBD5FA]/50 text-[#6b21a8]';
  };

  return (
    <div className="group relative bg-white rounded-2xl border border-[#C6E7FF]/60 hover:border-[#0066CC] hover:shadow-lg transition-all duration-300 flex flex-col overflow-hidden">
      {/* Top Left Badges */}
      <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1 items-start pointer-events-none">
        {savingsPercent > 0 && (
          <span className="bg-[#FFD84D] text-[#292525] text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
            {savingsPercent}% OFF
          </span>
        )}
        {product.isBestSeller && (
          <span className="bg-[#EBD5FA] text-[#6b21a8] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
            Bestseller
          </span>
        )}
        {product.isNewArrival && (
          <span className="bg-[#C6E7FF] text-[#831843] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
            New
          </span>
        )}
      </div>

      {/* Wishlist Button (Heart in top-right as in reference) */}
      <button
        onClick={handleToggleWishlist}
        className={`absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
          inWishlist
            ? 'bg-rose-50 text-[#0066CC] shadow-xs'
            : 'bg-white/80 backdrop-blur-xs text-[#292525]/40 hover:text-[#0066CC] hover:bg-white shadow-xs'
        }`}
        aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
        title={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        <Heart className={`w-4 h-4 ${inWishlist ? 'fill-[#0066CC]' : ''}`} />
      </button>

      {/* Visual Product Display (Square Aspect Ratio) */}
      <Link href={`/products/${product.slug}`} className="block relative bg-[#FAF7EE] aspect-square overflow-hidden">
        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center group-hover:scale-105 transition-transform duration-300">
          {product.images && product.images.length > 0 && typeof product.images[0] === 'string' && !product.images[0].includes('.png') ? (
            <img
              src={product.images[0]}
              alt={product.name}
              className="w-full h-full object-cover object-center rounded-xl"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-white shadow-xs border border-[#C6E7FF]/50 flex flex-col items-center justify-center text-[#0066CC] p-2">
              <span className="font-heylowitch text-3xl leading-none">{product.name.charAt(0)}</span>
              <span className="text-[9px] font-bold uppercase text-[#292525]/60 mt-1 truncate max-w-full">
                {product.brandName}
              </span>
            </div>
          )}
        </div>
      </Link>


      {/* Product Details Content */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Category & Rating */}
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full truncate ${getCategoryColor(product.categoryName)}`}>
              {product.categoryName}
            </span>
            <div className="flex items-center gap-1 text-[11px] text-[#292525]/70 font-semibold shrink-0">
              <Star className="w-3 h-3 fill-[#FFD84D] text-[#FFD84D]" />
              <span>{product.rating.toFixed(1)}</span>
            </div>
          </div>

          {/* Product Name */}
          <Link href={`/products/${product.slug}`} className="block group-hover:text-[#0066CC] transition-colors">
            <h3 className="text-xs sm:text-sm font-bold text-[#292525] line-clamp-2 leading-snug">
              {product.name}
            </h3>
          </Link>

          {/* Brand */}
          <div className="text-[11px] text-[#292525]/50 mt-1 font-medium">
            by {product.brandName}
          </div>
        </div>

        {/* Pricing & Clean Pill Button Matching Screenshot */}
        <div className="mt-3 pt-3 border-t border-[#C6E7FF]/40 flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm sm:text-base font-extrabold text-[#292525]">
                {formatLKR(product.priceCents)}
              </span>
              {product.compareAtPriceCents && product.compareAtPriceCents > product.priceCents && (
                <span className="text-xs text-[#292525]/40 line-through">
                  {formatLKR(product.compareAtPriceCents)}
                </span>
              )}
            </div>

            {/* In stock badge */}
            {isOutOfStock ? (
              <span className="text-[10px] font-bold text-rose-500">Sold Out</span>
            ) : (
              <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                In Stock
              </span>
            )}
          </div>

          {/* Pill Action Button matching reference screenshot */}
          {hasVariants ? (
            <Link
              href={`/products/${product.slug}`}
              className="w-full py-2 px-3 rounded-full border border-[#292525] hover:bg-[#292525] hover:text-white text-[#292525] font-semibold text-xs text-center transition-all shadow-xs"
            >
              Choose options
            </Link>
          ) : (
            <button
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              className={`w-full py-2 px-3 rounded-full font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs ${
                isOutOfStock
                  ? 'border border-[#292525]/20 text-[#292525]/30 cursor-not-allowed bg-slate-50'
                  : added
                  ? 'bg-emerald-600 text-white border border-emerald-600'
                  : 'border border-[#292525] hover:bg-[#0066CC] hover:border-[#0066CC] hover:text-white text-[#292525] bg-white'
              }`}
            >
              {added ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Added!</span>
                </>
              ) : isOutOfStock ? (
                <span>Out of stock</span>
              ) : (
                <>
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Add to cart</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

