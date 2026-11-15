'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Heart, ShoppingBag, Check, Star, Bookmark, AlertCircle, Plus } from 'lucide-react';
import { Product } from '@/types/product';
import { formatLKR, calculateSavingsPercent } from '@/lib/currency';
import { useCartStore } from '@/services/cartStore';
import { useWishlistStore } from '@/services/wishlistStore';
import { inventorySocketService } from '@/services/inventorySocketService';
import { SaveToListModal } from './SaveToListModal';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const [added, setAdded] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [quantityInput, setQuantityInput] = useState<string>('1');
  const [stockError, setStockError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<boolean>(false);

  const [liveStock, setLiveStock] = useState<number>(
    product.availableStock !== undefined ? product.availableStock : product.stockQuantity
  );

  React.useEffect(() => {
    const unsub = inventorySocketService.subscribeProduct(product.id, (update) => {
      setLiveStock(update.availableStock);
    });
    return () => unsub();
  }, [product.id]);

  const addItem = useCartStore((state) => state.addItem);
  const cartItems = useCartStore((state) => state.items);
  const isInWishlist = useWishlistStore((state) => state.isInWishlist);
  const toggleWishlist = useWishlistStore((state) => state.toggleWishlist);

  const existingCartItem = cartItems.find((item) => item.product.id === product.id);
  const alreadyInCart = existingCartItem ? existingCartItem.quantity : 0;
  const maxCanAdd = Math.max(0, liveStock - alreadyInCart);

  const inWishlist = isInWishlist(product.id);
  const isOutOfStock = liveStock <= 0;
  const hasVariants = Boolean(product.variants && product.variants.length > 1);

  const parsedCount = parseInt(quantityInput, 10);
  const isCountValid =
    !isOutOfStock &&
    !isNaN(parsedCount) &&
    parsedCount >= 1 &&
    parsedCount <= maxCanAdd;

  const handleQuantityChange = (val: string) => {
    setQuantityInput(val);
    const num = parseInt(val, 10);
    if (val === '' || isNaN(num)) {
      setStockError('Enter valid count');
    } else if (num <= 0) {
      setStockError('Minimum order is 1');
    } else if (num > liveStock) {
      setStockError(`Max ${liveStock} units`);
    } else if (num > maxCanAdd) {
      setStockError(`Max ${maxCanAdd} more`);
    } else {
      setStockError(null);
    }
  };

  const savingsPercent =
    product.compareAtPriceCents && product.compareAtPriceCents > product.priceCents
      ? calculateSavingsPercent(product.compareAtPriceCents, product.priceCents)
      : 0;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock) return;

    const count = Math.max(1, isNaN(parsedCount) ? 1 : parsedCount);
    if (count > maxCanAdd) {
      setStockError(`Only ${maxCanAdd} left to add`);
      return;
    }

    const success = await addItem(product, count);
    if (success) {
      setAdded(true);
      setQuantityInput('1');
      setStockError(null);
      setTimeout(() => setAdded(false), 1400);
    }
  };

  const handleToggleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await toggleWishlist(product);
  };

  // Only show rating if real reviews exist
  const hasValidRating = product.rating > 0 && product.reviewCount > 0;

  return (
    <div className="group relative bg-white rounded-2xl border border-slate-200/80 hover:border-[#0866E8]/40 hover:shadow-lg hover:shadow-[#09285C]/6 transition-all duration-300 flex flex-col overflow-hidden w-full">
      {/* Top Left Badges */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start pointer-events-none max-w-[70%]">
        {savingsPercent > 0 && (
          <span className="bg-[#0866E8] text-white text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
            {savingsPercent}% OFF
          </span>
        )}
        {product.isBestSeller && (
          <span className="bg-[#09285C] text-white text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
            Bestseller
          </span>
        )}
        {product.isNewArrival && (
          <span className="bg-[#EAF4FF] border border-[#0866E8]/30 text-[#0866E8] text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
            New
          </span>
        )}
      </div>

      {/* Top Right Floating Action Buttons */}
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1.5 items-center">
        <button
          type="button"
          onClick={handleToggleWishlist}
          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all ${
            inWishlist
              ? 'bg-rose-50 text-rose-600 shadow-sm'
              : 'bg-white/90 backdrop-blur-xs text-slate-400 hover:text-rose-600 hover:bg-white shadow-xs'
          }`}
          aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
          title={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${inWishlist ? 'fill-rose-600' : ''}`} />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsSaveModalOpen(true);
          }}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center bg-white/90 backdrop-blur-xs text-slate-400 hover:text-[#0866E8] hover:bg-white shadow-xs transition-all hidden sm:flex"
          aria-label="Save to Stationery List"
          title="Save to Stationery List"
        >
          <Bookmark className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Product Image Area */}
      <Link
        href={`/products/${product.slug}`}
        className="block relative bg-white aspect-square overflow-hidden"
      >
        <div className="w-full h-full flex flex-col items-center justify-center p-3 sm:p-4 text-center group-hover:scale-105 transition-transform duration-300">
          {product.images &&
          product.images.length > 0 &&
          typeof product.images[0] === 'string' &&
          product.images[0].trim() !== '' &&
          !imageError ? (
            <img
              src={product.images[0]}
              alt={product.name}
              loading="lazy"
              onError={() => setImageError(true)}
              className="w-full h-full object-contain object-center p-1 sm:p-2 rounded-xl transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#F7FAFF] shadow-xs border border-slate-200 flex flex-col items-center justify-center text-[#09285C] p-2">
              <span className="font-black text-2xl sm:text-3xl leading-none text-[#0866E8]">
                {product.name.charAt(0)}
              </span>
              <span className="text-[8px] sm:text-[9px] font-bold uppercase text-slate-400 mt-1 truncate max-w-full">
                {product.brandName}
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Product Details Content */}
      <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between bg-[#F7FAFF] border-t border-slate-100">
        <div>
          {/* Category & Optional Rating */}
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full truncate bg-white text-[#09285C] border border-[#EAF4FF] shadow-2xs">
              {product.categoryName}
            </span>
            {hasValidRating && (
              <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-slate-600 font-semibold shrink-0 bg-white px-1.5 py-0.5 rounded-full border border-slate-100">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span>{product.rating.toFixed(1)}</span>
              </div>
            )}
          </div>

          {/* Product Name */}
          <Link
            href={`/products/${product.slug}`}
            className="block group-hover:text-[#0866E8] transition-colors"
          >
            <h3 className="text-xs sm:text-sm font-bold text-[#09285C] line-clamp-2 leading-snug">
              {product.name}
            </h3>
          </Link>

          {/* Brand */}
          <div className="text-[10px] sm:text-[11px] text-[#64748B] mt-0.5 sm:mt-1 font-medium truncate">
            {product.brandName}
          </div>
        </div>

        {/* Pricing & Add to Cart Area */}
        <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-1">
            <div className="flex items-baseline gap-1 sm:gap-1.5 flex-wrap">
              <span className="text-xs sm:text-sm md:text-base font-black text-[#09285C] tracking-tight">
                {formatLKR(product.priceCents)}
              </span>
              {product.compareAtPriceCents &&
                product.compareAtPriceCents > product.priceCents && (
                  <span className="text-[10px] sm:text-xs text-slate-400 line-through">
                    {formatLKR(product.compareAtPriceCents)}
                  </span>
                )}
            </div>

            {/* In-Stock Indicator */}
            <span
              className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${
                isOutOfStock
                  ? 'text-rose-600 bg-rose-50 border-rose-200/60'
                  : liveStock < 10
                  ? 'text-amber-700 bg-amber-50 border-amber-200/60'
                  : 'text-emerald-700 bg-emerald-50/90 border-emerald-200/60'
              }`}
            >
              {isOutOfStock ? 'Out of stock' : liveStock < 10 ? `${liveStock} left` : 'In stock'}
            </span>
          </div>

          {/* Validation Error Banner */}
          {stockError && (
            <div className="text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-md flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span className="truncate">{stockError}</span>
            </div>
          )}

          {/* Action Area */}
          {hasVariants ? (
            <Link
              href={`/products/${product.slug}`}
              className="w-full py-2 rounded-xl text-center text-xs font-bold bg-white text-[#09285C] hover:bg-[#09285C] hover:text-white border border-slate-200 transition-all flex items-center justify-center gap-1.5 touch-target"
            >
              <span>View Options</span>
            </Link>
          ) : isOutOfStock ? (
            <button
              disabled
              className="w-full py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-400 cursor-not-allowed text-center touch-target"
            >
              Out of Stock
            </button>
          ) : (
            <div className="flex flex-col gap-1.5 w-full">
              {/* Responsive Cart Action: Full width touch button on mobile, with quantity stepper on desktop */}
              <div className="flex items-center gap-1.5 w-full">
                {/* Desktop Quantity Input */}
                <div className="relative w-14 sm:w-16 shrink-0 hidden sm:block">
                  <input
                    type="number"
                    min="1"
                    max={liveStock}
                    value={quantityInput}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    className={`w-full py-1.5 px-1 text-center text-xs font-black rounded-xl border transition-all ${
                      stockError
                        ? 'border-rose-500 bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                        : 'border-slate-200 bg-white text-[#09285C] focus:border-[#0866E8]'
                    }`}
                    aria-label="Quantity"
                    title="Enter count"
                  />
                </div>

                {/* Add to Cart Button */}
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={!isCountValid}
                  className={`w-full sm:flex-1 py-2 sm:py-1.5 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer touch-target ${
                    !isCountValid
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : added
                      ? 'bg-[#16A34A] text-white shadow-xs'
                      : 'bg-[#09285C] hover:bg-[#0866E8] active:bg-[#0866E8] text-white shadow-xs'
                  }`}
                >
                  {added ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Added!</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>Add to Cart</span>
                    </>
                  )}
                </button>
              </div>

              {/* Wholesale Quick Presets (Desktop only) */}
              {liveStock >= 20 && (
                <div className="hidden sm:flex items-center justify-end gap-1 pt-0.5">
                  <span className="text-[9px] text-slate-400 font-semibold mr-auto">Bulk:</span>
                  {[10, 50]
                    .filter((q) => q <= liveStock)
                    .map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleQuantityChange(String(preset));
                        }}
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 hover:bg-[#0866E8] hover:text-white text-slate-600 transition-colors cursor-pointer"
                      >
                        +{preset}
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isSaveModalOpen && (
        <SaveToListModal
          product={product}
          isOpen={isSaveModalOpen}
          onClose={() => setIsSaveModalOpen(false)}
        />
      )}
    </div>
  );
};
